/**
 * POST /api/pda/containers
 *
 * Legt einen neuen Container (Palette/Karton/Beutel) an und druckt
 * direkt das Pallet-Label via ZPL an den konfigurierten Drucker.
 *
 * Body: { type: "palette" | "carton" | "bag", partnerId?: string }
 *
 * Drucker-Host kommt aus env `PRINTER_HOST`. Wenn nicht gesetzt:
 *   - Container wird trotzdem angelegt (best-effort)
 *   - printResult = { ok: false, error: "PRINTER_HOST not configured" }
 *
 * Returns: { container, printResult }
 */

import { NextResponse } from "next/server";
import { checkPdaAuth } from "@/lib/pda-auth";
import {
  createContainer,
  type ContainerType,
} from "@/lib/containers";
import {
  palletLabelZpl,
  sendZplToPrinter,
  type PrintResult,
} from "@/lib/label-print";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES: ContainerType[] = ["palette", "carton", "bag"];

export async function POST(req: Request) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  let body: { type?: string; partnerId?: string; createdByPda?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body ist kein JSON" }, { status: 400 });
  }

  const type = (body.type ?? "palette").trim() as ContainerType;
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type muss eines von ${ALLOWED_TYPES.join(", ")} sein` },
      { status: 400 },
    );
  }

  const container = await createContainer({
    type,
    partnerId: body.partnerId?.trim() || undefined,
    createdByPda: body.createdByPda?.trim() || undefined,
  });

  // Label drucken — best effort, Fehler propagiert nicht den Create.
  const printerHost = process.env.PRINTER_HOST?.trim();
  let printResult: PrintResult;
  if (!printerHost) {
    printResult = { ok: false, error: "PRINTER_HOST not configured" };
  } else {
    const zpl = palletLabelZpl({
      palletCode: container.code,
      // Phase 7 ergänzt echte Partner-Namen; bis dahin Platzhalter.
      partnerName: container.partnerId ?? "(kein Partner)",
      createdAt: container.openedAt,
      maxOpenUntil: container.maxOpenUntil ?? container.openedAt,
    });
    printResult = await sendZplToPrinter(zpl, printerHost);
  }

  return NextResponse.json({
    container: {
      id: container.id,
      code: container.code,
      type: container.type,
      partnerId: container.partnerId,
      status: container.status,
      openedAt: container.openedAt.toISOString(),
      closedAt: container.closedAt?.toISOString() ?? null,
      maxOpenUntil: container.maxOpenUntil?.toISOString() ?? null,
      createdByPda: container.createdByPda,
    },
    printResult,
  });
}
