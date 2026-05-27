/**
 * GET /api/retoure/by-order/{bestellnummer}
 *
 * Detail-Pull für Shop-Customer-Account-View. Live, kein Cache.
 *
 * Response: vollständiges Case-Detail inkl. Items + Timeline + Label/Gutschrift-URLs.
 *
 * 404 wenn keine Retoure für diese Bestellnummer existiert.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bestellnummer: string }> },
) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const { bestellnummer } = await params;

  // Aktuellster Case zur Bestellnummer (Customer kann mehrere
  // Retouren für die gleiche Order haben — wir liefern den neusten)
  const c = await prisma.retoureCase.findFirst({
    where: { bestellnummer: bestellnummer.trim() },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          container: { select: { id: true, code: true } },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!c) {
    return NextResponse.json(
      { error: "not_found", bestellnummer },
      { status: 404 },
    );
  }

  const baseUrl = process.env.RETOURE_PUBLIC_URL?.replace(/\/+$/, "") ?? "";

  return NextResponse.json({
    case: {
      id: c.id,
      bestellnummer: c.bestellnummer,
      // Bug-A-Fix (28.05.2026): die Felder waren bereits persistiert,
      // aber im API-Response nicht exposed. Shop sah dadurch null/0
      // obwohl die DB-Werte korrekt sind.
      belegnummer: c.belegnummer,
      belegdatum: c.belegdatum,
      belegId: c.belegId,
      kategorie: c.kategorie,
      status: c.status,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      eligibleUntil: c.eligibleUntil?.toISOString() ?? null,
      warenwertBrutto: c.warenwertBrutto,
      voraussichtlicheErstattung: c.voraussichtlicheErstattung,
      tatsaechlicheErstattung: c.tatsaechlicheErstattung,
      labelFeeBrutto: c.labelFeeBrutto,
      labelRequested: c.labelRequested,
      shippingMode: c.shippingMode,
      gutschriftNr: c.gutschriftNr,
      customer: {
        anrede: c.customerAnrede,
        vorname: c.customerVorname,
        name: c.customerName,
        email: c.customerEmail,
      },
      items: c.items.map((it) => ({
        id: it.id,
        artikelnummer: it.artikelnummer,
        beschreibung: it.beschreibung,
        hersteller: it.hersteller,
        menge: it.menge,
        source: it.source,
        status: it.status,
        verdict: it.verdict,
        grund_code: it.grundCode,
        grund_freitext: it.grundFreitext,
        einzelpreis_brutto: it.einzelpreis_brutto,
        gesamtpreis_brutto: it.gesamtpreis_brutto,
        erstattungsbetrag_brutto: it.erstattungsbetragBrutto,
        photoCount: it.photoCount,
        containerCode: it.container?.code ?? null,
      })),
      timeline: c.events.map((e) => ({
        occurredAt: e.createdAt.toISOString(),
        type: e.type,
        label: e.message,
        actor: e.actor,
        meta: e.meta ? safeJsonParse(e.meta) : null,
      })),
      shippingLabel:
        c.dhlTrackingNumber || c.customerTrackingNumber
          ? {
              pdfUrl: `${baseUrl}/api/retoure/cases/${c.id}/shipping-label-pdf`,
              trackingCode: c.dhlTrackingNumber ?? c.customerTrackingNumber,
              carrier: "DHL",
              eligibleUntil: c.eligibleUntil?.toISOString() ?? null,
            }
          : null,
      gutschrift: c.gutschriftNr
        ? {
            nummer: c.gutschriftNr,
            pdfUrl: `${baseUrl}/api/retoure/cases/${c.id}/gutschrift-pdf`,
            erstelltAm: c.updatedAt.toISOString(),
          }
        : null,
    },
  });
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
