/**
 * Parser für Artikelnummern-Strings vom Shop.
 *
 * Shop schickt z.B. `"F 026 407 147 #169251"` — das ist:
 *   - `F 026 407 147` = echte Webisco-Artikelnummer (Bosch-Format mit Leerzeichen)
 *   - `#169251`       = Shopware-Line-Item-Position-Id (für Disambiguierung
 *                       wenn Customer den gleichen Artikel mehrfach hat)
 *
 * Webisco kennt das #-Suffix nicht. Wir parsen es ab und behandeln die
 * positionId optional für Multi-Same-Item-Cases.
 */

export interface ParsedArtikelnummer {
  /** Cleaned Webisco-Artikelnummer ohne Suffix. */
  artikelnummer: string;
  /** Optional: Shopware-Line-Item-Position-Id (alles nach `#`). */
  positionId: string | null;
}

/**
 * Parsed eine Shop-Artikelnummer in (artikelnummer, optional positionId).
 *
 * Regeln:
 * - Trim außen
 * - Trennt am ersten `#` (alles danach = positionId)
 * - Mehrfach-Whitespace wird zu einzelnem Space normalisiert (Webisco
 *   behält die Leerzeichen in `F 026 407 147` bei)
 */
export function parseArtikelnummer(raw: string): ParsedArtikelnummer {
  const trimmed = raw.trim();
  if (!trimmed) return { artikelnummer: "", positionId: null };
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx < 0) {
    return {
      artikelnummer: normalizeWhitespace(trimmed),
      positionId: null,
    };
  }
  const before = trimmed.slice(0, hashIdx).trim();
  const after = trimmed.slice(hashIdx + 1).trim();
  return {
    artikelnummer: normalizeWhitespace(before),
    positionId: after || null,
  };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
