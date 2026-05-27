/**
 * GET /api/retoure/order-preview/{bestellnummer}
 *
 * Live-Pull der Bestelldaten aus Webisco — **canonical Data-Source** für
 * den Native-in-Shop-Form-Render seit Architektur-v3 (28.05.2026).
 *
 * Flow:
 *   1. Shop ruft das BEVOR er den Retoure-Form rendert (idealerweise mit
 *      `?abiscoAuftragsnummer=AW...` für narrowing).
 *   2. Wir liefern alle Order-Positionen mit Webisco-canonical Werten
 *      (artikelnummer, hersteller, beschreibung, einzelgewicht_g,
 *      positionId für Multi-Same-Item-Disambiguierung).
 *   3. Shop rendert genau diese Items als Auswahl im Form (analog
 *      Customer-Portal — selbe UX).
 *   4. Customer wählt aus + grund_code + photos.
 *   5. Shop submitted mit `artikelnummer` (1:1 echo) + `hersteller` (1:1
 *      echo) + `beschreibung` (1:1 echo) + `menge` (Customer-Wahl) +
 *      `einzelpreis_brutto` (Shopware-Original — actual-paid, NICHT
 *      Webisco-current).
 *   6. RET-Backend matched per `#positionId`-Suffix-Trick → 100% reliable.
 *
 * Query-Params:
 *   `abiscoAuftragsnummer` — Abisco-interne Auftragsnummer (z. B.
 *     "AW243775571") aus `kb24_webisco_order_sync`. Stark empfohlen —
 *     bestellnummer-only-Lookup matched nicht zuverlässig.
 *
 * Auth: Bearer (Shop-API-Token).
 *
 * Response: `{ order: {...}, positions: [...] }` oder 404 wenn Webisco
 * die Bestellung nicht kennt — Shop MUSS dann auf Shopware-Order-Daten
 * fallback'en (degraded UX, aber Submit funktioniert trotzdem).
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

  const url = new URL(req.url);
  const abiscoAuftragsnummer = url.searchParams.get("abiscoAuftragsnummer")?.trim() || null;

  const cfg = getWebiscoConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "webisco_not_configured" },
      { status: 503 },
    );
  }

  // Prio: AW-Nummer (zuverlässig, via auftragsnummer-Pfad) →
  // bestellnummer-Fallback. Wenn AW-Nummer gegeben aber Webisco nichts
  // findet, versuchen wir trotzdem nochmal mit bestellnummer (manche
  // Sync-Records sind out-of-date).
  const lookupId = abiscoAuftragsnummer || trimmed;
  let result = await fetchBelegByNumber(cfg, {
    typ: "auftrag",
    id: lookupId,
  });
  // Fallback-Versuch wenn AW-Nummer nichts brachte
  if (result.ok && result.data.length === 0 && abiscoAuftragsnummer && trimmed !== abiscoAuftragsnummer) {
    result = await fetchBelegByNumber(cfg, {
      typ: "auftrag",
      id: trimmed,
    });
  }

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

  // Defensive: wenn Webisco viele Belege zurückgibt obwohl wir mit
  // auftragsnummer/bestellnummer narrow'en wollten, ist der Filter
  // wahrscheinlich nicht griff. Wir nehmen das spezifischste Match:
  // bevorzugt jenes wo bestellnummer exakt passt, sonst Newest-First.
  // (Beobachteter Bug: AW-Lookup gibt manchmal 270 Belege zurück statt 1.)
  let beleg = result.data[0];
  if (result.data.length > 1) {
    const exactMatch = result.data.find(
      (b) => b.bestellnummer != null && b.bestellnummer === trimmed,
    );
    if (exactMatch) {
      beleg = exactMatch;
    } else {
      // Fallback: neuester Beleg (höchste id)
      beleg = result.data.reduce((latest, b) =>
        (b.id ?? 0) > (latest.id ?? 0) ? b : latest,
      );
    }
  }

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
    // Diagnostik damit Shop sehen kann ob das Narrowing zuverlässig
    // war. `belegCount > 1` heißt: Webisco lieferte mehrere Kandidaten,
    // wir haben den specifischst-matching ausgewählt — Shop sollte das
    // monitoren.
    meta: {
      lookupId,
      belegCount: result.data.length,
      narrowed: result.data.length > 1,
    },
  });
}
