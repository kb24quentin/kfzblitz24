/**
 * GET /api/pda/cases/lookup?code=<scanned-code>&withTracking=<paket-label>
 *
 * Sucht eine Retoure-Case anhand des gescannten Codes. Reihenfolge:
 *   1. Case-ID (cuid)              → 1:1 Match
 *   2. Bestellnummer (KB24-…)      → letzter Case mit dieser Bestellnummer
 *   3. Tracking-Number (dhl ODER customer) — Paket-Label
 *
 * Optionaler `withTracking`-Param:
 *   Wird vom 2-stufigen PDA-Scan-Flow benutzt — wenn der Worker zuerst
 *   das Paket-Label gescannt hat und KEIN Case dazu gefunden wurde,
 *   scannt er dann den Retourenschein. Der Backend-Lookup mit
 *   `?code=<KB-Nummer>&withTracking=<Paket-Label>` findet den Case
 *   per Bestellnummer und schreibt das Paket-Label als
 *   customerTrackingNumber zurück (sofern noch leer). Damit ist die
 *   Daten-Vervollständigung Teil des PDA-Workflows.
 *
 * Antwort: { case: {...}, matchedBy, attachedTracking?: boolean }
 * 404 wenn nichts gefunden.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  const attachTracking = (url.searchParams.get("withTracking") ?? "").trim();
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

  // 3. Tracking-Number — checkt DHL, Customer und additionalTrackings (Multi-Paket)
  if (!c) {
    c = await prisma.retoureCase.findFirst({
      where: {
        OR: [
          { dhlTrackingNumber: code },
          { customerTrackingNumber: code },
          // additionalTrackings ist JSON-String — wir suchen substring-
          // basiert. Bei Vorbereitung des Searches escape'n wir die
          // Quotes für sauberen JSON-Vergleich.
          { additionalTrackings: { contains: `"${code}"` } },
        ],
      },
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

  // Tracking-Save: zwei Fälle.
  //
  // Fall A — Case hat noch GAR kein Tracking → wir schreiben den
  //   gescannten Paket-Code als customerTrackingNumber (primary).
  //   Beispiel: Customer hatte Selbstversand-Tracking nicht eingetragen
  //   und Worker reicht's beim Wareneingang nach.
  //
  // Fall B — Case hat schon ein Tracking, aber dieses Paket ist NEU
  //   (Multi-Paket-Szenario: Kunde hat 5 Items in 2 Boxen verteilt).
  //   Wir hängen den Code an additionalTrackings an — wenn er noch
  //   nicht drin steht.
  let attachedTracking = false;
  if (attachTracking && matchedBy === "bestellnummer") {
    const knownPrimary = c.customerTrackingNumber ?? c.dhlTrackingNumber;
    if (!knownPrimary) {
      // Fall A
      await prisma.retoureCase.update({
        where: { id: c.id },
        data: { customerTrackingNumber: attachTracking },
      });
      await prisma.retoureEvent.create({
        data: {
          caseId: c.id,
          type: "tracking_added",
          message: `Tracking-Nummer beim Paket-Scan ergänzt: ${attachTracking}`,
          meta: JSON.stringify({ source: "pda-package-scan", tracking: attachTracking }),
          actor: "pda",
        },
      });
      c.customerTrackingNumber = attachTracking;
      attachedTracking = true;
    } else if (knownPrimary !== attachTracking) {
      // Fall B — Multi-Paket
      let existing: string[] = [];
      try {
        const parsed = JSON.parse(c.additionalTrackings || "[]");
        if (Array.isArray(parsed)) existing = parsed.filter((s) => typeof s === "string");
      } catch { /* schema-default fixt */ }
      if (!existing.includes(attachTracking)) {
        existing.push(attachTracking);
        await prisma.retoureCase.update({
          where: { id: c.id },
          data: { additionalTrackings: JSON.stringify(existing) },
        });
        await prisma.retoureEvent.create({
          data: {
            caseId: c.id,
            type: "tracking_added",
            message: `Weiteres Paket-Tracking ergänzt: ${attachTracking}`,
            meta: JSON.stringify({
              source: "pda-package-scan-multi",
              tracking: attachTracking,
              total: existing.length + 1,
            }),
            actor: "pda",
          },
        });
        c.additionalTrackings = JSON.stringify(existing);
        attachedTracking = true;

        // ── Auto-Reopen (Use Case 3) ─────────────────────────────────
        // Wenn beim 2./3. Paket noch pending registered items existieren,
        // muss der Wizard wieder in den Scan-Step gehen — egal in welchem
        // konkreten Zustand der Case war. Worker hat 1. Paket vielleicht
        // schon palettiert und auf "Fertig mit Scannen" gedrückt, aber
        // die 2 fehlenden Items aus Paket 2 müssen noch gescannt werden.
        //
        // Wir leeren immer `scanCompletedAt` wenn pending items existieren
        // (PDA-deriveStep zwingt dann SCAN). Und wir resetten den Status
        // auf eingang_partner wenn der Case schon auf partner_verarbeitet/
        // unterwegs_lieferant gestanden hatte.
        const stillPending = await prisma.retoureItem.count({
          where: {
            caseId: c.id,
            source: "registered",
            status: "pending",
          },
        });
        if (stillPending > 0) {
          const wasDone =
            c.status === "partner_verarbeitet" ||
            c.status === "unterwegs_lieferant";
          const updates: {
            status?: string;
            scanCompletedAt?: Date | null;
          } = {};
          if (wasDone) updates.status = "eingang_partner";
          if (c.scanCompletedAt !== null) updates.scanCompletedAt = null;

          if (Object.keys(updates).length > 0) {
            await prisma.retoureCase.update({
              where: { id: c.id },
              data: updates,
            });
            await prisma.retoureEvent.create({
              data: {
                caseId: c.id,
                type: "status_change",
                message: `Case wieder geöffnet — neues Paket angekommen, ${stillPending} Artikel noch offen`,
                meta: JSON.stringify({
                  from: c.status,
                  to: updates.status ?? c.status,
                  scanCompletedReset: updates.scanCompletedAt === null,
                  reason: "additional-package-arrived",
                  stillPending,
                }),
                actor: "pda",
              },
            });
            if (updates.status) c.status = updates.status;
            if (updates.scanCompletedAt === null) c.scanCompletedAt = null;
          }
        }
      }
    }
  }

  return NextResponse.json({
    matchedBy,
    attachedTracking,
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
