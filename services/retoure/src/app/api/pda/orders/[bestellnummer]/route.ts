/**
 * GET /api/pda/orders/:bestellnummer
 *
 * Live-Lookup einer Bestellung bei Webisco → liefert alle Positionen der
 * Order. Wird vom PDA-"Extra-aus-Order"-Flow genutzt, wenn der Mitarbeiter
 * Artikel im Paket findet die NICHT angemeldet waren aber zur selben
 * Bestellung gehörten.
 */

import { NextResponse } from "next/server";
import { fetchBelegByNumber, getWebiscoConfig } from "@/lib/webisco";
import { checkPdaAuth } from "@/lib/pda-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bestellnummer: string }> }
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

  const { bestellnummer } = await params;
  const cfg = getWebiscoConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Webisco nicht konfiguriert" },
      { status: 503 }
    );
  }

  const result = await fetchBelegByNumber(cfg, {
    typ: "auftrag",
    id: bestellnummer,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Webisco: ${result.error}` },
      { status: 502 }
    );
  }
  if (result.data.length === 0) {
    return NextResponse.json(
      { error: "Bestellung nicht gefunden", bestellnummer },
      { status: 404 }
    );
  }

  // Beleg mit den meisten Positionen — analog zum Customer-Lookup
  const best =
    [...result.data].sort(
      (a, b) =>
        b.positionen.filter((p) => p.typ === "artikel").length -
        a.positionen.filter((p) => p.typ === "artikel").length
    )[0] ?? result.data[0];

  const articles = best.positionen.filter((p) => p.typ === "artikel");
  return NextResponse.json({
    bestellnummer: best.bestellnummer,
    belegId: best.id,
    belegnummer: best.belegnummer,
    belegdatum: best.belegdatum,
    customer: best.rechnungsadresse,
    items: articles.map((a) => ({
      artikelnummer: a.artikelnummer,
      hersteller: a.hersteller,
      beschreibung: a.beschreibung,
      menge: a.menge,
      offene_gutschriftsmenge: a.offene_gutschriftsmenge,
      einzelpreis_brutto: a.einzelpreis_brutto,
      einzelgewicht_g: a.einzelgewicht,
      status: a.status,
    })),
  });
}
