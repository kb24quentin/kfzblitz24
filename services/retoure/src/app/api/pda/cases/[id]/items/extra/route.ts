/**
 * POST /api/pda/cases/:id/items/extra
 *
 * Mitarbeiter hat zusätzlich zum Angemeldeten Items im Paket gefunden.
 *  - source="extra"   → Artikel war in der gleichen Order, nur nicht angemeldet
 *  - source="unknown" → Artikel ist nicht in der Order (Wrong-Item)
 *
 * Body:
 *   {
 *     source: "extra" | "unknown",
 *     artikelnummer?: string,
 *     hersteller?: string,
 *     beschreibung?: string,
 *     menge: number,
 *     grund?: string,           // Default "Im Paket gefunden"
 *     einzelpreis_brutto?: number,
 *     einzelgewicht_g?: number,
 *     pdaId?: string
 *   }
 *
 * Erstellt direkt einen RetoureItem mit status="received".
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent } from "@/lib/retoure-cases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ExtraItemBody {
  source?: "extra" | "unknown";
  artikelnummer?: string;
  hersteller?: string;
  beschreibung?: string;
  menge?: number;
  grund?: string;
  einzelpreis_brutto?: number;
  einzelgewicht_g?: number;
  pdaId?: string;
}

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
  let body: ExtraItemBody;
  try {
    body = (await req.json()) as ExtraItemBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = body.source === "unknown" ? "unknown" : "extra";
  const menge = Math.max(1, body.menge ?? 1);

  const c = await prisma.retoureCase.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const unitPrice = body.einzelpreis_brutto ?? null;
  const totalPrice = unitPrice !== null ? unitPrice * menge : null;

  const item = await prisma.retoureItem.create({
    data: {
      caseId: id,
      source,
      status: "received",
      artikelnummer: body.artikelnummer ?? null,
      hersteller: body.hersteller ?? null,
      beschreibung: body.beschreibung ?? null,
      menge,
      grund: body.grund ?? "Im Paket gefunden",
      einzelpreis_brutto: unitPrice,
      gesamtpreis_brutto: totalPrice,
      einzelgewicht_g: body.einzelgewicht_g ?? null,
      receivedAt: new Date(),
      receivedByPda: body.pdaId ? `pda:${body.pdaId}` : "pda",
      scanCount: 1,
    },
  });

  await addEvent(
    id,
    source === "unknown" ? "item_unknown_added" : "item_extra_added",
    `Item (${source}) hinzugefügt: ${body.artikelnummer ?? body.beschreibung ?? "ohne Bezeichnung"}`,
    {
      itemId: item.id,
      source,
      artikelnummer: body.artikelnummer,
      menge,
    },
    body.pdaId ? `pda:${body.pdaId}` : "pda"
  );

  return NextResponse.json({ ok: true, item: { id: item.id, source: item.source, status: item.status } });
}
