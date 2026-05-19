/**
 * POST /api/pda/cases/:id/items/:itemId/scan
 *
 * Mitarbeiter bestätigt: dieser Artikel war IM PAKET.
 *  - Body { present: true } → status="received", receivedAt=now
 *  - Body { present: false } → status="missing" (war angemeldet, lag aber nicht im Paket)
 *  - Body { pdaId?: string } für Audit
 *
 * Idempotent: mehrfaches Scannen mit present:true erhöht nur scanCount.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent } from "@/lib/retoure-cases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

  const { id, itemId } = await params;
  let body: { present?: boolean; pdaId?: string };
  try {
    body = (await req.json()) as { present?: boolean; pdaId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const present = body.present !== false; // default true

  const item = await prisma.retoureItem.findUnique({ where: { id: itemId } });
  if (!item || item.caseId !== id) {
    return NextResponse.json({ error: "Item not found in case" }, { status: 404 });
  }

  const actor = body.pdaId ? `pda:${body.pdaId}` : "pda";
  const now = new Date();

  if (present) {
    const updated = await prisma.retoureItem.update({
      where: { id: itemId },
      data: {
        status: "received",
        receivedAt: item.receivedAt ?? now,
        receivedByPda: item.receivedByPda ?? actor,
        scanCount: item.scanCount + 1,
      },
    });
    await addEvent(
      id,
      "item_received",
      `Artikel ${item.artikelnummer ?? "(ohne Nr)"} als anwesend bestätigt`,
      { itemId, scanCount: updated.scanCount },
      actor
    );
    return NextResponse.json({ ok: true, item: { id: updated.id, status: updated.status, scanCount: updated.scanCount, receivedAt: updated.receivedAt?.toISOString() } });
  } else {
    const updated = await prisma.retoureItem.update({
      where: { id: itemId },
      data: { status: "missing" },
    });
    await addEvent(
      id,
      "item_missing",
      `Artikel ${item.artikelnummer ?? "(ohne Nr)"} war NICHT im Paket`,
      { itemId },
      actor
    );
    return NextResponse.json({ ok: true, item: { id: updated.id, status: updated.status } });
  }
}
