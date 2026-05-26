/**
 * Standardisierte Rückgabe-Gründe für Native-in-Shop-Submits.
 *
 * Quelle der Wahrheit für Codes ↔ Auto-Verdict-Hints ↔ Photo-Pflicht ↔
 * Eigen-Fehler-Flag.
 *
 * Source-of-Truth für Shop-Dev: `docs/06-decisions-log.md` § D-009.
 */

/**
 * Final-Liste laut Quentin's DECISIONS_REPLY.md (2026-05-26):
 * - `defekt` + `beschaedigt_transport` zusammengeführt zu `defekt_oder_beschaedigt`
 *   (Customer kann selten Ursache zuordnen, Lager differenziert beim Auspacken).
 * - `customer_reue` aufgeteilt in `nicht_mehr_benoetigt` + `anders_entschieden`
 *   (klareres Wording, bessere KPI-Auswertung).
 * - `qualitaet` umbenannt zu `qualitaet_nicht_wie_erwartet` (Photo nur optional).
 */
export const RETURN_REASON_CODES = [
  "passt_nicht_zum_fahrzeug",
  "falsche_lieferung",
  "defekt_oder_beschaedigt",
  "qualitaet_nicht_wie_erwartet",
  "nicht_mehr_benoetigt",
  "anders_entschieden",
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
    labelDe: "Passt nicht zu meinem Fahrzeug",
    labelEn: "Doesn't fit my vehicle",
    photoRequired: false,
    autoVerdictHint: "yellow",
    internalFault: false,
  },
  falsche_lieferung: {
    code: "falsche_lieferung",
    labelDe: "Falsche Lieferung (anderer Artikel als bestellt)",
    labelEn: "Wrong item delivered",
    photoRequired: true,
    autoVerdictHint: "red",
    internalFault: true,
  },
  defekt_oder_beschaedigt: {
    code: "defekt_oder_beschaedigt",
    labelDe: "Artikel defekt oder beschädigt",
    labelEn: "Defective or damaged",
    photoRequired: true,
    autoVerdictHint: "red",
    internalFault: true, // Default; Lager kann beim Auspacken override (Transport vs Customer-Schuld)
  },
  qualitaet_nicht_wie_erwartet: {
    code: "qualitaet_nicht_wie_erwartet",
    labelDe: "Qualität entspricht nicht der Erwartung",
    labelEn: "Quality didn't meet expectations",
    photoRequired: false, // Optional — Shop-UI kann nudgen, aber nicht hart durchsetzen
    autoVerdictHint: "yellow",
    internalFault: false,
  },
  nicht_mehr_benoetigt: {
    code: "nicht_mehr_benoetigt",
    labelDe: "Nicht mehr benötigt / falsch bestellt",
    labelEn: "No longer needed / ordered by mistake",
    photoRequired: false,
    autoVerdictHint: "green",
    internalFault: false,
  },
  anders_entschieden: {
    code: "anders_entschieden",
    labelDe: "Anders entschieden (z.B. anderen Anbieter genommen)",
    labelEn: "Changed my mind",
    photoRequired: false,
    autoVerdictHint: "green",
    internalFault: false,
  },
  anderes: {
    code: "anderes",
    labelDe: "Anderer Grund (mit Freitext)",
    labelEn: "Other reason",
    photoRequired: false,
    autoVerdictHint: "yellow",
    internalFault: false,
  },
};

export function isValidReasonCode(code: string): code is ReturnReasonCode {
  return (RETURN_REASON_CODES as readonly string[]).includes(code);
}

export function getReasonSpec(code: string): ReturnReasonSpec | null {
  return isValidReasonCode(code) ? RETURN_REASONS[code] : null;
}
