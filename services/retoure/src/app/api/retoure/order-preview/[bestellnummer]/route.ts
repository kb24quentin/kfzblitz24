/**
 * GET /api/retoure/order-preview/{bestellnummer}
 *
 * Live-Pull der Bestelldaten aus Webisco — analog zum Customer-Portal-Flow.
 * Shop ruft das BEVOR er den Retoure-Form rendert, bekommt:
 *   - Order-Header (belegId, belegnummer, belegdatum, Customer-Snapshot)
 *   - Alle Positionen mit Preisen, Beschreibung, Hersteller, Gewicht
 *   - Vorgeschlagener Versand-Modus + Default-Wert
 *
 * Damit kann der Shop dem Customer dieselbe Item-Selection-UX zeigen wie
 * unser Retouren-Portal: Customer wählt aus den echten Order-Positionen,
 * Preise stimmen 1:1 mit der Original-Rechnung.
 *
 * Auth: Bearer (Shop-API-Token).
 *
 * Response: `{ order: {...}, positions: [...] }` oder 404 wenn Webisco
 * die Bestellnummer nicht kennt.
 */
import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { fetchBelegByNumber, getWebiscoConfig } from "@/lib/webisco";

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
  const trimmed = bestellnummer.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "bestellnummer_missing" }, { status: 400 });
  }

  const cfg = getWebiscoConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "webisco_not_configured" },
      { status: 503 },
    );
  }

  const result = await fetchBelegByNumber(cfg, {
    typ: "auftrag",
    id: trimmed,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "webisco_lookup_failed", details: result.error },
      { status: 502 },
    );
  }

  if (result.data.length === 0) {
    return NextResponse.json(
      { error: "order_not_found", bestellnummer: trimmed },
      { status: 404 },
    );
  }

  const beleg = result.data[0];

  // Customer-Snapshot (Rechnungs- oder Lieferadresse aus Webisco)
  const rechAdr = beleg.rechnungsadresse ?? {};
  const liefAdr = beleg.lieferadresse ?? {};
  const customer = {
    anrede: rechAdr.anrede ?? liefAdr.anrede ?? null,
    vorname: rechAdr.vorname ?? liefAdr.vorname ?? null,
    name: rechAdr.name ?? liefAdr.name ?? null,
    strasse: rechAdr.strasse ?? liefAdr.strasse ?? null,
    plz: rechAdr.plz ?? liefAdr.plz ?? null,
    ort: rechAdr.ort ?? liefAdr.ort ?? null,
    email: rechAdr.email ?? liefAdr.email ?? null,
    telefon: rechAdr.telefon ?? liefAdr.telefon ?? null,
  };

  // Positionen mit allem was Shop für die Anzeige braucht.
  // positionId ist das Disambiguierungs-Token für den #-Suffix-Trick
  // ("F 026 407 147 #169251") wenn Customer denselben Artikel mehrfach
  // in der Order hat.
  const positions = (beleg.positionen ?? []).map((p) => ({
    // Webisco-Feld heißt `id` (numerisch) — wir stringen für Shop-Side
    // Disambiguierung im #-Suffix-Trick ("F 026 407 147 #169251").
    positionId: p.id != null ? String(p.id) : null,
    artikelnummer: p.artikelnummer ?? null,
    hersteller: p.hersteller ?? null,
    beschreibung: p.beschreibung ?? null,
    menge: p.menge ?? 1,
    einzelpreis_brutto: p.einzelpreis_brutto ?? null,
    gesamtpreis_brutto: p.positionspreis_brutto ?? null,
    einzelgewicht_g: p.einzelgewicht ?? null,
  }));

  const orderTotalBrutto = positions.reduce(
    (sum, p) => sum + (p.gesamtpreis_brutto ?? 0),
    0,
  );

  return NextResponse.json({
    order: {
      bestellnummer: trimmed,
      belegId: beleg.id != null ? String(beleg.id) : null,
      belegnummer: beleg.belegnummer ?? null,
      belegdatum: beleg.belegdatum ?? null,
      orderTotalBrutto,
      customer,
    },
    positions,
  });
}
