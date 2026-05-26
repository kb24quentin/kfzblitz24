/**
 * Standardisierte Rückgabe-Gründe für Native-in-Shop-Submits.
 *
 * Quelle der Wahrheit für Codes ↔ Auto-Verdict-Hints ↔ Photo-Pflicht ↔
 * Eigen-Fehler-Flag.
 *
 * Source-of-Truth für Shop-Dev: `docs/06-decisions-log.md` § D-009.
 */

export const RETURN_REASON_CODES = [
  "passt_nicht_zum_fahrzeug",
  "customer_reue",
  "defekt",
  "falsche_lieferung",
  "beschaedigt_transport",
  "qualitaet",
  "anderes",
] as const;

export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

export interface ReturnReasonSpec {
  code: ReturnReasonCode;
  labelDe: string;
  labelEn: string;
  /**
   * Photo vom Customer beim Submit Pflicht? Wenn ja → Submit-Endpoint
   * rejected den Item ohne `photo_ids`.
   */
  photoRequired: boolean;
  /**
   * Hinweis für PDA-Worker bei Bewertung welche Tendenz zu erwarten ist.
   * Worker kann frei abweichen — das ist nur ein Vor-Score.
   */
  autoVerdictHint: "green" | "yellow" | "red";
  /**
   * Markiert Retouren die UNSER Verschulden sind (z. B. falsche Lieferung).
   * Customer kriegt 100% Refund (verdict=green), aber intern für KPI-
   * Auswertung „Eigen-Fehlerquote" geflagged.
   */
  internalFault: boolean;
}

export const RETURN_REASONS: Record<ReturnReasonCode, ReturnReasonSpec> = {
  passt_nicht_zum_fahrzeug: {
    code: "passt_nicht_zum_fahrzeug",
    labelDe: "Passt nicht zum Fahrzeug",
    labelEn: "Doesn't fit my vehicle",
    photoRequired: false,
    autoVerdictHint: "yellow",
    internalFault: false,
  },
  customer_reue: {
    code: "customer_reue",
    labelDe: "Doch nicht benötigt / falsch bestellt",
    labelEn: "No longer needed / wrong order",
    photoRequired: false,
    autoVerdictHint: "yellow",
    internalFault: false,
  },
  defekt: {
    code: "defekt",
    labelDe: "Artikel defekt",
    labelEn: "Defective item",
    photoRequired: true,
    autoVerdictHint: "red",
    internalFault: false,
  },
  falsche_lieferung: {
    code: "falsche_lieferung",
    labelDe: "Falsche Lieferung von uns",
    labelEn: "Wrong item delivered by us",
    photoRequired: true,
    autoVerdictHint: "green", // Customer kriegt 100% — er kann ja nichts dafür
    internalFault: true,
  },
  beschaedigt_transport: {
    code: "beschaedigt_transport",
    labelDe: "Transportschaden",
    labelEn: "Damaged in transit",
    photoRequired: true,
    autoVerdictHint: "yellow",
    internalFault: false,
  },
  qualitaet: {
    code: "qualitaet",
    labelDe: "Qualität unzureichend",
    labelEn: "Quality issues",
    photoRequired: false,
    autoVerdictHint: "yellow",
    internalFault: false,
  },
  anderes: {
    code: "anderes",
    labelDe: "Anderer Grund (Freitext)",
    labelEn: "Other reason",
    photoRequired: false,
    autoVerdictHint: "green",
    internalFault: false,
  },
};

export function isValidReasonCode(code: string): code is ReturnReasonCode {
  return (RETURN_REASON_CODES as readonly string[]).includes(code);
}

export function getReasonSpec(code: string): ReturnReasonSpec | null {
  return isValidReasonCode(code) ? RETURN_REASONS[code] : null;
}
