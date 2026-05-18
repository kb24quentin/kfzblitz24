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
import { prisma } from "@/lib/db";
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

/**
 * GET /api/pda/containers
 *
 * Paginierte Liste der Container für die PDA-Übersicht.
 * Filter: ?status=open|closed|shipped|received_supplier, ?type=palette|carton|bag.
 */
export async function GET(req: Request) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized" },
      { status: auth.status }
    );
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const type = url.searchParams.get("type")?.trim() || undefined;
  const supplierId = url.searchParams.get("supplierId")?.trim() || undefined;
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "30") || 30));

  const where: { status?: string; type?: string; supplierId?: string } = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (supplierId) where.supplierId = supplierId;

  const containers = await prisma.container.findMany({
    where,
    orderBy: { openedAt: "desc" },
    take: limit,
    include: {
      items: { select: { id: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    containers: containers.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      status: c.status,
      partnerId: c.partnerId,
      supplierId: c.supplierId,
      supplierName: c.supplier?.name ?? null,
      openedAt: c.openedAt.toISOString(),
      closedAt: c.closedAt?.toISOString() ?? null,
      maxOpenUntil: c.maxOpenUntil?.toISOString() ?? null,
      items: c.items,
    })),
  });
}

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

  let body: {
    type?: string;
    partnerId?: string;
    supplierId?: string;
    createdByPda?: string;
  } = {};
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

  // Supplier ist Pflicht: "Container = 1 Lieferant".
  // Wir prüfen Existenz hier, damit createContainer einen sauberen
  // Fehler werfen kann, falls die Stammdaten-Row fehlt.
  const supplierId = body.supplierId?.trim();
  if (!supplierId) {
    return NextResponse.json(
      { error: "supplierId fehlt — bitte Lieferant (Interparts/Autopartner) wählen" },
      { status: 400 },
    );
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true, active: true },
  });
  if (!supplier) {
    return NextResponse.json(
      { error: `Supplier nicht gefunden: ${supplierId}` },
      { status: 404 },
    );
  }
  if (!supplier.active) {
    return NextResponse.json(
      { error: `Supplier ${supplier.name} ist inaktiv` },
      { status: 409 },
    );
  }

  const container = await createContainer({
    type,
    supplierId: supplier.id,
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
      // Lieferanten-Name auf das Label — das Lager soll auf einen Blick
      // sehen, an wen die Palette geht.
      partnerName: supplier.name,
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
      supplierId: container.supplierId,
      supplierName: supplier.name,
      status: container.status,
      openedAt: container.openedAt.toISOString(),
      closedAt: container.closedAt?.toISOString() ?? null,
      maxOpenUntil: container.maxOpenUntil?.toISOString() ?? null,
      createdByPda: container.createdByPda,
    },
    printResult,
  });
}
