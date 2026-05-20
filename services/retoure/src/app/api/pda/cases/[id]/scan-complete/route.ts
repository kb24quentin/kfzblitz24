/**
 * POST /api/pda/cases/:id/scan-complete
 *
 * Worker tappt "Fertig mit Scannen" — setzt scanCompletedAt damit der
 * Wizard in den ASSESS-Step weiterläuft. Vorher würde der Wizard im
 * SCAN-Step hängen bleiben weil wir bewusst NICHT auto-advancen
 * sobald alle angemeldeten Items received sind — der Mitarbeiter
 * soll noch Extras und Falschsendungen scannen können.
 *
 * Body (optional): { pdaId?: string }
 *
 * Idempotent — wenn scanCompletedAt schon gesetzt ist, geben wir den
 * vorhandenen Wert zurück ohne update.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent } from "@/lib/retoure-cases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ScanCompleteBody {
  pdaId?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const { id } = await params;
  let body: ScanCompleteBody = {};
  try {
    body = (await req.json()) as ScanCompleteBody;
  } catch {
    /* no body fine */
  }

  const c = await prisma.retoureCase.findUnique({
    where: { id },
    select: { id: true, scanCompletedAt: true },
  });
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  if (c.scanCompletedAt) {
    return NextResponse.json({
      ok: true,
      alreadyCompleted: true,
      scanCompletedAt: c.scanCompletedAt.toISOString(),
    });
  }

  const actor = body.pdaId ? `pda:${body.pdaId}` : "pda";
  const now = new Date();

  await prisma.retoureCase.update({
    where: { id },
    data: { scanCompletedAt: now },
  });

  // Item-Counts für die Timeline-Notiz mitloggen — gibt dem Admin eine
  // schnelle Übersicht "wie ist der Scan ausgegangen".
  const items = await prisma.retoureItem.findMany({
    where: { caseId: id },
    select: { source: true, status: true },
  });
  const registered = items.filter((i) => i.source === "registered" && i.status !== "pending" && i.status !== "missing").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const extras = items.filter((i) => i.source === "extra").length;
  const unknowns = items.filter((i) => i.source === "unknown").length;

  await addEvent(
    id,
    "scan_completed",
    `Scan abgeschlossen: ${registered} angemeldet bestätigt, ${missing} fehlend, ${extras} Bonus, ${unknowns} Falschsendung`,
    { registered, missing, extras, unknowns },
    actor,
  );

  return NextResponse.json({
    ok: true,
    scanCompletedAt: now.toISOString(),
    counts: { registered, missing, extras, unknowns },
  });
}
