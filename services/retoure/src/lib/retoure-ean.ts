/**
 * EAN-Enrichment für Retoure-Items.
 *
 * Workflow:
 *   1. Customer reicht Retoure ein → wir machen `beleganfrage` und
 *      speichern Positionen (artikelnummer, hersteller, …) — KEIN EAN
 *      weil `beleganfrage` keinen liefert.
 *   2. Beim ersten PDA-Lookup ruft `enrichCaseItemsWithEan(caseId)`
 *      diese Funktion. Wir gehen alle Items des Case durch, sammeln
 *      die mit fehlendem `eanCode`, machen EINEN `artikelanfrage` in
 *      Webisco und schreiben die Codes per UPDATE zurück.
 *   3. Spätere Lookups finden die EANs schon in der DB → kein
 *      Webisco-Roundtrip mehr.
 *
 * Robustheit:
 *   - Bei Webisco-Down: warm fail. Caller blockiert NICHT.
 *   - Bei Artikeln ohne EAN (Sammelartikel/Sets): bleiben null.
 *   - Bei Artikeln die Webisco nicht (mehr) findet: bleiben null.
 */

import { prisma } from "@/lib/db";
import { fetchArtikelInfos, getWebiscoConfig } from "@/lib/webisco";

/**
 * Fetcht EAN-Codes für alle Items des Case die noch keinen haben und
 * schreibt sie per UPDATE in die DB. Gibt die Anzahl der erfolgreich
 * gesetzten EANs zurück (für Logging/Observability).
 *
 * Idempotent: zweiter Aufruf macht keine weiteren Webisco-Calls, weil
 * die Items dann schon `eanCode` haben.
 */
export async function enrichCaseItemsWithEan(caseId: string): Promise<number> {
  const items = await prisma.retoureItem.findMany({
    where: {
      caseId,
      eanCode: null,
      // nur "registered"-Items haben verlässliche artikelnummer aus Webisco;
      // "extra" und "unknown" wurden vom Lager hinzugefügt, EAN ist da
      // entweder schon vom Scan da oder Item ist nicht im System.
      source: "registered",
      // ohne artikelnummer können wir Webisco nicht anfragen
      NOT: { artikelnummer: null },
    },
    select: {
      id: true,
      artikelnummer: true,
      hersteller: true,
    },
  });

  if (items.length === 0) return 0;

  const cfg = getWebiscoConfig();
  if (!cfg) {
    // env nicht konfiguriert → bewusst kein throw, das ist kein Fehler
    // sondern eine Dev-Umgebung ohne Webisco-Anbindung.
    return 0;
  }

  const result = await fetchArtikelInfos(
    cfg,
    items.map((i) => ({
      artikelnummer: i.artikelnummer as string,
      hersteller: i.hersteller ?? undefined,
    })),
  );

  if (!result.ok) {
    // warm fail — Lookup-Aufruf blockt nicht wegen Webisco
    console.warn(
      `[retoure-ean] enrichCaseItemsWithEan(${caseId}) Webisco-Fehler: ${result.error}`,
    );
    return 0;
  }

  // Mapping: artikelnummer (+ optional hersteller) → eancode
  // Webisco kann mehrere Treffer pro Anfrage liefern (zb. wenn Hersteller
  // leer war und der Code bei mehreren Herstellern existiert). Wir nehmen
  // den ersten Treffer mit eancode. Bei Konflikten lieber konservativ
  // bleiben (null lassen) statt einen falschen EAN zu speichern.
  const seenKey = new Set<string>();
  let written = 0;
  for (const item of items) {
    const candidates = result.data.filter(
      (a) =>
        a.artikelnummer === item.artikelnummer &&
        // Hersteller-Match nur strikt wenn Hersteller bekannt war
        (item.hersteller
          ? (a.hersteller ?? "").toLowerCase() === item.hersteller.toLowerCase()
          : true) &&
        a.eancode !== undefined,
    );
    if (candidates.length === 0) continue;
    // Eindeutigkeit: bei mehreren Treffern mit verschiedenen EANs
    // bleiben wir konservativ und schreiben nichts.
    const distinctEans = new Set(candidates.map((c) => c.eancode));
    if (distinctEans.size !== 1) continue;
    const ean = candidates[0].eancode!;
    // Doppelte EAN-Schreibungen vermeiden (passiert wenn ein Artikel
    // mehrfach in derselben Order ist — dasselbe Item-ID nicht doppelt
    // updaten)
    const key = `${item.id}|${ean}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    await prisma.retoureItem.update({
      where: { id: item.id },
      data: { eanCode: ean },
    });
    written++;
  }

  return written;
}
