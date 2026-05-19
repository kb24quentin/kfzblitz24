/**
 * POST /api/pda/cases/:id/receive
 *
 * Wird vom PDA gefeuert wenn der Mitarbeiter das Paket physisch
 * scannt. Setzt partnerReceivedAt + Case-Status auf "eingang_partner"
 * (sofern noch nicht weiter). Damit stoppt der SLA-Timer für diesen Case.
 *
 * Body (alle optional):
 *   { pdaId?: string }  — welcher PDA hat gescannt (für Audit)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent, transitionStatus } from "@/lib/retoure-cases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status }
    );
  }

  const { id } = await params;
  let body: { pdaId?: string } = {};
  try {
    body = (await req.json()) as { pdaId?: string };
  } catch {
    /* no body is fine */
  }

  const c = await prisma.retoureCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (c.partnerReceivedAt) {
    return NextResponse.json({
      ok: true,
      alreadyReceived: true,
      partnerReceivedAt: c.partnerReceivedAt.toISOString(),
    });
  }

  await prisma.retoureCase.update({
    where: { id },
    data: { partnerReceivedAt: new Date() },
  });

  const actor = body.pdaId ? `pda:${body.pdaId}` : "pda";

  // Status-Übergang (schreibt selbst `status_change` ins Event-Log) —
  // bewusst KEIN separater `partner_received`-Event mehr, das wäre eine
  // Doppelung der gleichen Aktion in der Timeline.
  const ACTIVE_PRE_RECEIVE = ["angemeldet", "versandt", "unterwegs"];
  if (ACTIVE_PRE_RECEIVE.includes(c.status)) {
    await transitionStatus(id, "eingang_partner", {
      actor,
      message: "Paket beim Partner-Lager eingegangen",
    });
  } else {
    // Edge-Case: Case ist in einem Status den wir nicht erwartet hatten
    // (z. B. pruefung). Wir wollen zumindest einen Eintrag in der Timeline,
    // dass der Partner-Scan trotzdem passiert ist.
    await addEvent(
      id,
      "partner_received",
      "Paket beim Partner-Lager eingegangen",
      { pdaId: body.pdaId },
      actor,
    );
  }

  return NextResponse.json({
    ok: true,
    caseId: id,
    partnerReceivedAt: new Date().toISOString(),
  });
}
