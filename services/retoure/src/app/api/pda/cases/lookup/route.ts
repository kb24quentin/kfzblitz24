/**
 * GET /api/pda/cases/lookup?code=<scanned-code>
 *
 * Sucht eine Retoure-Case anhand des gescannten RMA-Codes ODER der
 * Bestellnummer (Customer kann Retourenschein vergessen, dann sucht der
 * Mitarbeiter über die Order).
 *
 * Reihenfolge der Treffer-Strategien:
 *   1. Case-ID (cuid)              → 1:1 Match
 *   2. Bestellnummer (KB24-…)      → letzter Case mit dieser Bestellnummer
 *   3. DHL Tracking-Number         → für Pakete die nicht "unsere" Sendung sind
 *
 * Antwort: { case: {...}, matchedBy: "id" | "bestellnummer" | "tracking" }
 * 404 wenn nichts gefunden.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status }
    );
  }

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "code fehlt" }, { status: 400 });
  }

  // 1. Case-ID
  let c = await prisma.retoureCase.findFirst({
    where: { id: code },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  let matchedBy: "id" | "bestellnummer" | "tracking" = "id";

  // 2. Bestellnummer
  if (!c) {
    c = await prisma.retoureCase.findFirst({
      where: { bestellnummer: code },
      orderBy: { createdAt: "desc" },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        items: { orderBy: { createdAt: "asc" } },
      },
    });
    matchedBy = "bestellnummer";
  }

  // 3. Tracking-Number
  if (!c) {
    c = await prisma.retoureCase.findFirst({
      where: { dhlTrackingNumber: code },
      orderBy: { createdAt: "desc" },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        items: { orderBy: { createdAt: "asc" } },
      },
    });
    matchedBy = "tracking";
  }

  if (!c) {
    return NextResponse.json(
      { error: "Keine Retoure gefunden", code },
      { status: 404 }
    );
  }

  return NextResponse.json({
    matchedBy,
    case: {
      id: c.id,
      bestellnummer: c.bestellnummer,
      belegId: c.belegId,
      belegnummer: c.belegnummer,
      status: c.status,
      customer: {
        anrede: c.customerAnrede,
        vorname: c.customerVorname,
        name: c.customerName,
        strasse: c.customerStrasse,
        plz: c.customerPlz,
        ort: c.customerOrt,
        email: c.customerEmail,
        telefon: c.customerTelefon,
        handy: c.customerHandy,
      },
      shipping: {
        mode: c.shippingMode,
        labelRequested: c.labelRequested,
        labelPaid: c.labelPaid,
        weightSentKg: c.weightSentKg,
      },
      dhl: {
        shipmentId: c.dhlShipmentId,
        trackingNumber: c.dhlTrackingNumber,
      },
      customerTrackingNumber: c.customerTrackingNumber,
      money: {
        warenwertBrutto: c.warenwertBrutto,
        labelFeeBrutto: c.labelFeeBrutto,
        voraussichtlicheErstattung: c.voraussichtlicheErstattung,
      },
      // Echte RetoureItem-Rows (mit source + status + Bewertung).
      // c.itemsJson bleibt das Audit-Snapshot der Anmeldung — nicht für PDA.
      items: c.items.map((it) => ({
        id: it.id,
        source: it.source,
        status: it.status,
        artikelnummer: it.artikelnummer,
        hersteller: it.hersteller,
        beschreibung: it.beschreibung,
        menge: it.menge,
        grund: it.grund,
        einzelpreis_brutto: it.einzelpreis_brutto,
        gesamtpreis_brutto: it.gesamtpreis_brutto,
        einzelgewicht_g: it.einzelgewicht_g,
        einkaufspreis_brutto: it.einkaufspreis_brutto,
        receivedAt: it.receivedAt?.toISOString() ?? null,
        receivedByPda: it.receivedByPda,
        scanCount: it.scanCount,
        score: {
          employee: it.employeeScore,
          ai: it.aiScore,
          combined: it.combinedScore,
          verdict: it.verdict,
          verdictReason: it.verdictReason,
          at: it.scoredAt?.toISOString() ?? null,
        },
        photoCount: it.photoCount,
        containerId: it.containerId,
      })),
      events: c.events.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        meta: e.meta ? JSON.parse(e.meta) : null,
        actor: e.actor,
        createdAt: e.createdAt.toISOString(),
      })),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    },
  });
}
