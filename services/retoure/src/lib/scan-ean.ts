/**
 * Scan-EAN Core-Logik — herausgezogen aus /api/pda/cases/[id]/scan-ean
 * damit die Multi-Case-Session-Variante (/api/pda/sessions/scan-ean)
 * dieselbe Match/Apply-Kette nutzen kann.
 *
 * Aufgeteilt in pure-classify (read-only) + apply (mit Side-Effects).
 * Damit kann ein Multi-Case-Aufrufer ZUERST über alle Cases klassifizieren
 * und dann erst den Apply-Schritt auf der "richtigen" Case ausführen —
 * ohne Item-Leichen in Cases zu hinterlassen die zufällig zuerst probiert
 * wurden.
 */
import { prisma } from "@/lib/db";
import { addEvent } from "@/lib/retoure-cases";
import {
  fetchArtikelByEan,
  fetchBelegByNumber,
  getWebiscoConfig,
} from "@/lib/webisco";
import { serializeItem } from "@/app/api/pda/cases/[id]/route";

export interface ScanEanResult {
  kind: "ok_registered" | "ok_extra" | "not_ok_unknown";
  message: string;
  scannedEan: string;
  item: ReturnType<typeof serializeItem> | null;
  resolvedArticle?: {
    artikelnummer?: string | null;
    hersteller?: string | null;
    beschreibung?: string | null;
  };
}

export interface ResolvedArticle {
  artikelnummer?: string | null;
  hersteller?: string | null;
  beschreibung?: string | null;
}

// ── Phase 1: registered match ──────────────────────────────────────

/** Read-only: matched dieser EAN ein pending-Item dieser Case? */
export async function findRegisteredMatch(
  caseId: string,
  ean: string,
): Promise<{
  id: string;
  caseId: string;
  artikelnummer: string | null;
  hersteller: string | null;
  beschreibung: string | null;
  menge: number;
  grund: string | null;
  einzelpreis_brutto: number | null;
  einzelgewicht_g: number | null;
  eanCode: string | null;
  einspeiserid: number | null;
} | null> {
  const item = await prisma.retoureItem.findFirst({
    where: {
      caseId,
      source: "registered",
      status: "pending",
      eanCode: ean,
    },
    select: {
      id: true,
      caseId: true,
      artikelnummer: true,
      hersteller: true,
      beschreibung: true,
      menge: true,
      grund: true,
      einzelpreis_brutto: true,
      einzelgewicht_g: true,
      eanCode: true,
      einspeiserid: true,
    },
  });
  return item;
}

/**
 * Wendet einen registered-match an: per-Stück-Splitting wenn menge>1,
 * sonst einfach status=received setzen. Schreibt Event, returned das
 * fertig serialisierte Result.
 */
export async function applyRegisteredMatch(
  caseId: string,
  match: NonNullable<Awaited<ReturnType<typeof findRegisteredMatch>>>,
  ean: string,
  actor: string,
): Promise<ScanEanResult> {
  if (match.menge > 1) {
    await prisma.$transaction(async (tx) => {
      await tx.retoureItem.update({
        where: { id: match.id },
        data: {
          menge: 1,
          status: "received",
          receivedAt: new Date(),
          receivedByPda: actor,
          scanCount: 1,
          gesamtpreis_brutto: match.einzelpreis_brutto,
        },
      });
      const remaining = match.menge - 1;
      for (let i = 0; i < remaining; i++) {
        await tx.retoureItem.create({
          data: {
            caseId,
            source: "registered",
            status: "pending",
            artikelnummer: match.artikelnummer,
            hersteller: match.hersteller,
            beschreibung: match.beschreibung,
            menge: 1,
            grund: match.grund,
            einzelpreis_brutto: match.einzelpreis_brutto,
            gesamtpreis_brutto: match.einzelpreis_brutto,
            einzelgewicht_g: match.einzelgewicht_g,
            eanCode: match.eanCode,
            einspeiserid: match.einspeiserid,
          },
        });
      }
    });
    await addEvent(
      caseId,
      "item_split_for_per_unit_rating",
      `Item gesplittet: ${match.menge}× ${match.beschreibung ?? match.artikelnummer} → ${match.menge} Einzel-Items für individuelle Bewertung`,
      { itemId: match.id, originalMenge: match.menge },
      actor,
    );
  } else {
    await prisma.retoureItem.update({
      where: { id: match.id },
      data: {
        status: "received",
        receivedAt: new Date(),
        receivedByPda: actor,
        scanCount: 1,
      },
    });
  }

  await addEvent(
    caseId,
    "item_scanned_registered",
    `EAN ${ean} matched registriertes Item: ${match.beschreibung ?? match.artikelnummer ?? "—"}`,
    { itemId: match.id, ean, source: "registered" },
    actor,
  );

  const updated = await prisma.retoureItem.findUnique({
    where: { id: match.id },
    include: {
      supplier: { select: { id: true, name: true } },
      container: { select: { id: true, code: true } },
    },
  });

  const sameArticlePending = await prisma.retoureItem.count({
    where: {
      caseId,
      artikelnummer: match.artikelnummer,
      source: "registered",
      status: "pending",
    },
  });
  const sameArticleTotal = await prisma.retoureItem.count({
    where: {
      caseId,
      artikelnummer: match.artikelnummer,
      source: "registered",
    },
  });
  const sameArticleDone = sameArticleTotal - sameArticlePending;

  return {
    kind: "ok_registered",
    message:
      sameArticleTotal > 1
        ? `Artikel bestätigt (${sameArticleDone}/${sameArticleTotal})`
        : "Artikel bestätigt",
    scannedEan: ean,
    item: updated ? serializeItem(updated) : null,
  };
}

// ── Phase 2: Webisco classification ────────────────────────────────

/**
 * Lazy-populates `orderPositionsJson` via Webisco beleganfrage. Idempotent.
 */
async function ensureOrderPositionsSnapshot(
  caseId: string,
): Promise<ResolvedArticle[]> {
  const c = await prisma.retoureCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      belegId: true,
      bestellnummer: true,
      orderPositionsJson: true,
    },
  });
  if (!c) return [];

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

  const idForQuery = c.belegId ?? c.bestellnummer;
  if (!idForQuery) return [];

  const res = await fetchBelegByNumber(cfg, {
    id: idForQuery,
    typ: "auftrag",
  });
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

/**
 * Webisco-EAN-Auflösung — was ist das für ein Artikel? Käuferunabhängig,
 * also Cache-fähig auf Aufruferebene (Multi-Case-Sessions rufen das nur
 * einmal pro EAN auf, nicht pro Case).
 */
export async function lookupArticleByEan(
  ean: string,
): Promise<ResolvedArticle | null> {
  const cfg = getWebiscoConfig();
  if (!cfg) return null;
  const lookup = await fetchArtikelByEan(cfg, ean);
  return lookup.ok && lookup.data.length > 0 ? lookup.data[0] : null;
}

/**
 * Check ob ein bereits aufgelöster Artikel in der Order einer bestimmten
 * Case enthalten ist. Nutzt den orderPositionsJson-Snapshot (lazy-
 * populated via Webisco beleganfrage).
 */
export async function isArticleInCaseOrder(
  caseId: string,
  artikelnummer: string,
): Promise<boolean> {
  const orderPositions = await ensureOrderPositionsSnapshot(caseId);
  return orderPositions.some(
    (p) =>
      p.artikelnummer &&
      p.artikelnummer.trim().toLowerCase() ===
        artikelnummer.trim().toLowerCase(),
  );
}

/**
 * Convenience: kombinierter Webisco-Check für eine einzelne Case. Wird
 * vom Single-Case-Endpoint genutzt; Multi-Case nutzt die separierten
 * Helpers oben um den EAN→Artikel-Lookup nicht N-mal zu wiederholen.
 */
export async function classifyAgainstWebisco(
  caseId: string,
  ean: string,
): Promise<{
  resolvedArticle: ResolvedArticle | null;
  articleInOrder: boolean;
}> {
  const resolvedArticle = await lookupArticleByEan(ean);
  if (!resolvedArticle?.artikelnummer) {
    return { resolvedArticle, articleInOrder: false };
  }
  const articleInOrder = await isArticleInCaseOrder(
    caseId,
    resolvedArticle.artikelnummer,
  );
  return { resolvedArticle, articleInOrder };
}

/** Apply: extra-Item (Artikel war auf Order aber nicht in der RMA). */
export async function applyExtraMatch(
  caseId: string,
  ean: string,
  resolvedArticle: ResolvedArticle,
  actor: string,
): Promise<ScanEanResult> {
  const extra = await prisma.retoureItem.create({
    data: {
      caseId,
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
    caseId,
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

  return {
    kind: "ok_extra",
    message: "Aus der Order (nicht angemeldet) — hinzugefügt",
    scannedEan: ean,
    item: serializeItem(extra),
    resolvedArticle,
  };
}

/** Apply: unknown-Item (Falschsendung — geht auf kfzBlitz24-internal). */
export async function applyUnknown(
  caseId: string,
  ean: string,
  resolvedArticle: ResolvedArticle | null,
  actor: string,
): Promise<ScanEanResult> {
  const INTERNAL_SUPPLIER_ID = "kfzblitz24-internal";
  const verdictReason = resolvedArticle
    ? "Falschsendung — keine Bewertung erforderlich"
    : "Falschsendung — EAN unbekannt, keine Bewertung erforderlich";

  const unknown = await prisma.retoureItem.create({
    data: {
      caseId,
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
      scoredAt: new Date(),
      verdictReason,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      container: { select: { id: true, code: true } },
    },
  });

  await addEvent(
    caseId,
    "item_unknown_added",
    `Falschsendung gescannt: EAN ${ean}${resolvedArticle ? ` (${resolvedArticle.beschreibung ?? resolvedArticle.artikelnummer})` : " — unbekannt"}`,
    { itemId: unknown.id, ean, source: "unknown", resolvedArticle },
    actor,
  );

  return {
    kind: "not_ok_unknown",
    message: resolvedArticle
      ? "Artikel war NICHT in der Order — auf kfzBlitz24-Retoure-Palette"
      : "EAN unbekannt — auf kfzBlitz24-Retoure-Palette",
    scannedEan: ean,
    item: serializeItem(unknown),
    resolvedArticle: resolvedArticle ?? undefined,
  };
}

/**
 * Convenience: full single-case scan-ean flow.
 * Phase 1 → Phase 2a → Phase 2b. Used by /api/pda/cases/[id]/scan-ean.
 */
export async function scanEanForCase(
  caseId: string,
  ean: string,
  actor: string,
): Promise<ScanEanResult> {
  const reg = await findRegisteredMatch(caseId, ean);
  if (reg) return applyRegisteredMatch(caseId, reg, ean, actor);

  const cls = await classifyAgainstWebisco(caseId, ean);
  if (cls.articleInOrder && cls.resolvedArticle) {
    return applyExtraMatch(caseId, ean, cls.resolvedArticle, actor);
  }
  return applyUnknown(caseId, ean, cls.resolvedArticle, actor);
}
