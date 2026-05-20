/**
 * POST /api/pda/cases/:id/scan-ean
 *
 * Worker scannt einen Artikel-Barcode (EAN) mit dem Q900. Backend
 * klassifiziert und reagiert:
 *
 *   1. EAN matched ein registriertes Item (status="pending")
 *      → markiert als "received" → kind="ok_registered" (GROßES GRÜN)
 *
 *   2. EAN matched KEIN registriertes Item, aber Webisco kennt den
 *      Artikel UND er war auf dem Original-Beleg dieses Kunden
 *      → fügt als source="extra" hinzu → kind="ok_extra" (GROßES GRÜN)
 *      Beispiel: Kunde hatte 5 Artikel bestellt, nur 3 als RMA
 *      angemeldet, packt aber 4 ins Paket — der vierte ist ok.
 *
 *   3. EAN ist unbekannt oder Artikel war NICHT auf dem Original-Beleg
 *      → fügt als source="unknown" hinzu, default-Supplier ist die
 *      "kfzBlitz24 Retoure (intern)" Sammelpalette
 *      → kind="not_ok_unknown" (GROßES ROT)
 *
 * Body:
 *   { ean: string, pdaId?: string }
 *
 * Response:
 *   {
 *     kind: "ok_registered" | "ok_extra" | "not_ok_unknown",
 *     message: string,
 *     item: { id, source, status, artikelnummer?, hersteller?, beschreibung?, ... },
 *     scannedEan: string,
 *     /// nur bei kind="not_ok_unknown" wenn Webisco was wusste:
 *     resolvedArticle?: { artikelnummer?, hersteller?, beschreibung? }
 *   }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent, transitionStatus } from "@/lib/retoure-cases";
import {
  fetchArtikelByEan,
  fetchBelegByNumber,
  getWebiscoConfig,
} from "@/lib/webisco";
import { serializeItem } from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ScanEanBody {
  ean?: string;
  pdaId?: string;
}

/** Lazy-populates `orderPositionsJson` via Webisco beleganfrage. Idempotent. */
async function ensureOrderPositionsSnapshot(caseId: string): Promise<
  Array<{ artikelnummer?: string; hersteller?: string; beschreibung?: string }>
> {
  const c = await prisma.retoureCase.findUnique({
    where: { id: caseId },
    select: { id: true, belegId: true, bestellnummer: true, orderPositionsJson: true },
  });
  if (!c) return [];

  // Schon gefüllt? Nehmen.
  try {
    const existing = JSON.parse(c.orderPositionsJson ?? "[]");
    if (Array.isArray(existing) && existing.length > 0) {
      return existing;
    }
  } catch {
    /* fall through to refetch */
  }

  const cfg = getWebiscoConfig();
  if (!cfg) return [];

  // Vorzugsweise via interner Webisco-id (genauer), Fallback bestellnummer.
  const idForQuery = c.belegId ?? c.bestellnummer;
  if (!idForQuery) return [];

  const res = await fetchBelegByNumber(cfg, { id: idForQuery, typ: "auftrag" });
  if (!res.ok || res.data.length === 0) return [];

  const positions = res.data[0].positionen.map((p) => ({
    artikelnummer: p.artikelnummer,
    hersteller: p.hersteller,
    beschreibung: p.beschreibung,
  }));

  await prisma.retoureCase.update({
    where: { id: caseId },
    data: { orderPositionsJson: JSON.stringify(positions) },
  });

  return positions;
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
  let body: ScanEanBody;
  try {
    body = (await req.json()) as ScanEanBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ean = (body.ean ?? "").trim();
  if (ean.length === 0) {
    return NextResponse.json({ error: "ean fehlt" }, { status: 400 });
  }

  const actor = body.pdaId ? `pda:${body.pdaId}` : "pda";

  const c = await prisma.retoureCase.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          supplier: { select: { id: true, name: true } },
          container: { select: { id: true, code: true } },
        },
      },
    },
  });
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  // ── Phase 1: Match gegen registrierte Items (per-Stück-Rating) ────
  //
  // User-Brief: "wenn man einen Artikel scannt, der mehrfach vorkommt
  // will er dennoch dass man den gleichen Artikel am Stück scannt,
  // aber für jede Stückzahl muss eine eigene Bewertung erfolgen".
  //
  // Lösung: BEIM ERSTEN SCAN eines Items mit menge>1 splitten wir das
  // RetoureItem in N Items (jedes mit menge=1). Jeder folgende Scan
  // matcht ein eigenes Item → kriegt sein eigenes Rating. Damit kann
  // der Worker 3 Stück als "rot" und 2 als "grün" bewerten.
  //
  // Match-Logik: pending-Items mit menge>=1 + eanCode. Wir filtern
  // auch status="pending" damit gerade bewertete Items nicht nochmal
  // matchen (würden sonst beim Re-Scan eine 2. Rating-Runde triggern).
  const registeredMatch = c.items.find(
    (it) =>
      it.source === "registered" &&
      it.eanCode === ean &&
      it.status === "pending",
  );

  if (registeredMatch) {
    // Auto-Split wenn menge>1: erstes Item bleibt das aktuelle, die
    // restlichen menge-1 Stück werden als zusätzliche Pending-Items
    // angelegt (jeweils menge=1, frische Stamm-Daten geklont).
    if (registeredMatch.menge > 1) {
      await prisma.$transaction(async (tx) => {
        // Das current item: menge=1, status=received, scanCount=1
        await tx.retoureItem.update({
          where: { id: registeredMatch.id },
          data: {
            menge: 1,
            status: "received",
            receivedAt: new Date(),
            receivedByPda: actor,
            scanCount: 1,
            // Preis-Felder auf "pro Stück" umstellen
            gesamtpreis_brutto: registeredMatch.einzelpreis_brutto,
          },
        });
        // N-1 neue Items als pending, jeweils menge=1
        const remaining = registeredMatch.menge - 1;
        for (let i = 0; i < remaining; i++) {
          await tx.retoureItem.create({
            data: {
              caseId: id,
              source: "registered",
              status: "pending",
              artikelnummer: registeredMatch.artikelnummer,
              hersteller: registeredMatch.hersteller,
              beschreibung: registeredMatch.beschreibung,
              menge: 1,
              grund: registeredMatch.grund,
              einzelpreis_brutto: registeredMatch.einzelpreis_brutto,
              gesamtpreis_brutto: registeredMatch.einzelpreis_brutto,
              einzelgewicht_g: registeredMatch.einzelgewicht_g,
              eanCode: registeredMatch.eanCode,
              einspeiserid: registeredMatch.einspeiserid,
            },
          });
        }
      });
      await addEvent(
        id,
        "item_split_for_per_unit_rating",
        `Item gesplittet: ${registeredMatch.menge}× ${registeredMatch.beschreibung ?? registeredMatch.artikelnummer} → ${registeredMatch.menge} Einzel-Items für individuelle Bewertung`,
        {
          itemId: registeredMatch.id,
          originalMenge: registeredMatch.menge,
        },
        actor,
      );
    } else {
      // menge=1: ganz normal als received markieren
      await prisma.retoureItem.update({
        where: { id: registeredMatch.id },
        data: {
          status: "received",
          receivedAt: new Date(),
          receivedByPda: actor,
          scanCount: 1,
        },
      });
    }

    await addEvent(
      id,
      "item_scanned_registered",
      `EAN ${ean} matched registriertes Item: ${registeredMatch.beschreibung ?? registeredMatch.artikelnummer ?? "—"}`,
      {
        itemId: registeredMatch.id,
        ean,
        source: "registered",
      },
      actor,
    );

    const updated = await prisma.retoureItem.findUnique({
      where: { id: registeredMatch.id },
      include: {
        supplier: { select: { id: true, name: true } },
        container: { select: { id: true, code: true } },
      },
    });

    // Anzahl noch offene Items mit derselben artikelnummer (Anzeige
    // "1 von 5"). Wir zählen über alle pending-Items mit gleichem
    // artikelnummer für den Case.
    const sameArticlePending = await prisma.retoureItem.count({
      where: {
        caseId: id,
        artikelnummer: registeredMatch.artikelnummer,
        source: "registered",
        status: "pending",
      },
    });
    const sameArticleTotal = await prisma.retoureItem.count({
      where: {
        caseId: id,
        artikelnummer: registeredMatch.artikelnummer,
        source: "registered",
      },
    });
    const sameArticleDone = sameArticleTotal - sameArticlePending;

    return NextResponse.json({
      kind: "ok_registered",
      message:
        sameArticleTotal > 1
          ? `Artikel bestätigt (${sameArticleDone}/${sameArticleTotal})`
          : "Artikel bestätigt",
      scannedEan: ean,
      item: updated ? serializeItem(updated) : null,
    });
  }

  // ── Phase 2: EAN unbekannt unter registrierten Items ─────────────
  // Versuche Webisco-Auflösung: was ist das überhaupt für ein Artikel?
  const cfg = getWebiscoConfig();
  const webiscoLookup = cfg
    ? await fetchArtikelByEan(cfg, ean)
    : { ok: false as const, error: "webisco-not-configured" };

  const resolvedArticle =
    webiscoLookup.ok && webiscoLookup.data.length > 0
      ? webiscoLookup.data[0]
      : null;

  // Order-Snapshot um zu entscheiden ob's "aus der Order" (extra) ist
  // oder fremd (unknown).
  const orderPositions = await ensureOrderPositionsSnapshot(id);
  const articleInOrder =
    resolvedArticle?.artikelnummer &&
    orderPositions.some(
      (p) =>
        p.artikelnummer &&
        p.artikelnummer.trim().toLowerCase() ===
          resolvedArticle.artikelnummer!.trim().toLowerCase(),
    );

  if (articleInOrder && resolvedArticle) {
    // Phase 2a: Artikel war auf der Order, nur nicht in der RMA →
    // als "extra" hinzufügen, status=received.
    const extra = await prisma.retoureItem.create({
      data: {
        caseId: id,
        source: "extra",
        status: "received",
        artikelnummer: resolvedArticle.artikelnummer ?? null,
        hersteller: resolvedArticle.hersteller ?? null,
        beschreibung: resolvedArticle.beschreibung ?? null,
        menge: 1,
        grund: "Im Paket gefunden (war auf Order)",
        eanCode: ean,
        receivedAt: new Date(),
        receivedByPda: actor,
        scanCount: 1,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        container: { select: { id: true, code: true } },
      },
    });

    await addEvent(
      id,
      "item_extra_added",
      `Extra-Item via EAN ${ean}: ${resolvedArticle.beschreibung ?? resolvedArticle.artikelnummer}`,
      {
        itemId: extra.id,
        ean,
        source: "extra",
        artikelnummer: resolvedArticle.artikelnummer,
      },
      actor,
    );

    return NextResponse.json({
      kind: "ok_extra",
      message: "Aus der Order (nicht angemeldet) — hinzugefügt",
      scannedEan: ean,
      item: serializeItem(extra),
      resolvedArticle,
    });
  }

  // Phase 2b: Artikel nicht in der Order ODER Webisco kennt's gar nicht
  //  → "unknown" anlegen, default-Supplier = kfzBlitz24-internal-Palette.
  //
  // Wichtig: status="assessed" + scoredAt direkt setzen damit der Wizard
  // den ASSESS-Step für Falschsendungen überspringt — die brauchen keine
  // Zustands-Bewertung (sind eh falsch geliefert, gehen zurück an uns).
  // Bonus-Items (source="extra") werden dagegen NORMAL bewertet —
  // siehe Phase 2a oben.
  const INTERNAL_SUPPLIER_ID = "kfzblitz24-internal";
  const verdictReason = resolvedArticle
    ? "Falschsendung — keine Bewertung erforderlich"
    : "Falschsendung — EAN unbekannt, keine Bewertung erforderlich";

  const unknown = await prisma.retoureItem.create({
    data: {
      caseId: id,
      source: "unknown",
      status: "assessed",
      artikelnummer: resolvedArticle?.artikelnummer ?? null,
      hersteller: resolvedArticle?.hersteller ?? null,
      beschreibung:
        resolvedArticle?.beschreibung ?? `Unbekannter Artikel (EAN ${ean})`,
      menge: 1,
      grund: resolvedArticle
        ? "Falschsendung — Artikel nicht in dieser Order"
        : "Falschsendung — EAN in Webisco nicht gefunden",
      eanCode: ean,
      receivedAt: new Date(),
      receivedByPda: actor,
      scanCount: 1,
      supplierId: INTERNAL_SUPPLIER_ID,
      // Skip-Assess-Markierung: scoredAt gesetzt, verdict bleibt null,
      // verdictReason erklärt warum. deriveStep() sieht status="assessed"
      // + verdict != "red" → führt direkt zu PALETTE.
      scoredAt: new Date(),
      verdictReason,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      container: { select: { id: true, code: true } },
    },
  });

  await addEvent(
    id,
    "item_unknown_added",
    `Falschsendung gescannt: EAN ${ean}${resolvedArticle ? ` (${resolvedArticle.beschreibung ?? resolvedArticle.artikelnummer})` : " — unbekannt"}`,
    {
      itemId: unknown.id,
      ean,
      source: "unknown",
      resolvedArticle,
    },
    actor,
  );

  return NextResponse.json({
    kind: "not_ok_unknown",
    message: resolvedArticle
      ? "Artikel war NICHT in der Order — auf kfzBlitz24-Retoure-Palette"
      : "EAN unbekannt — auf kfzBlitz24-Retoure-Palette",
    scannedEan: ean,
    item: serializeItem(unknown),
    resolvedArticle: resolvedArticle ?? undefined,
  });
}

// Hilfsfunktion damit der TypeScript-Linter `transitionStatus` als
// "used" sieht — wir nutzen sie aktuell nicht, lassen aber den Import
// drin damit zukünftige Erweiterungen (z. B. case komplett-received
// auto-transition) das hier ergänzen können.
void transitionStatus;
