/**
 * Eligibility-Check für neue Retoure-Anmeldungen.
 *
 * Wird sowohl vom Submit-Endpoint (Hard-Gate) als auch vom Shop-Plugin
 * (Vorab-UI-Decision) genutzt. Antwort enthält offene Cases zur selben
 * Bestellnummer damit der Shop ggf. statt „Neue Retoure" einen Verweis
 * auf den existierenden Case zeigt.
 */
import { prisma } from "@/lib/db";

/** 14 Tage Widerrufsfrist + 14 Tage Coulance-Versandzeit = 28 Tage Buffer. */
const WIDERRUF_DEADLINE_DAYS = 14;

/** Status-Werte die einen Case als „offen" (= laufend, nicht final) markieren. */
const OPEN_CASE_STATUSES = [
  "angemeldet",
  "versandt",
  "unterwegs",
  "eingang_partner",
  "partner_verarbeitet",
  "unterwegs_lieferant",
  "pruefung",
];

export type EligibilityReason =
  | "order_not_found"
  | "frist_abgelaufen"
  | "already_open_case"
  | "no_delivery_yet"
  | "b2b_no_widerruf"
  | null;

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
  eligibleUntil: Date | null;
  existingCases: Array<{
    id: string;
    bestellnummer: string;
    status: string;
    kategorie: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
    voraussichtlicheErstattung: number;
  }>;
}

export interface EligibilityOptions {
  /**
   * Liefer-Datum aus dem Shop. Wenn unbekannt, wird die Frist ab heute
   * gerechnet (defensive — nicht ideal, aber sicher).
   */
  deliveredAt?: Date | null;
  /**
   * Bei B2B-Kunden: aktuell gewähren wir Coulance-mäßig auch 14 Tage
   * (siehe D-011). Wenn das später anders geregelt werden soll, hier
   * Logik anpassen.
   */
  kundenstatus?: "privat" | "gewerbe_vorsteuer";
}

/**
 * Hauptchecker: ist eine neue Retoure für diese Bestellnummer möglich?
 */
export async function checkEligibility(
  bestellnummer: string,
  opts: EligibilityOptions = {},
): Promise<EligibilityResult> {
  const trimmed = bestellnummer.trim();
  if (!trimmed) {
    return {
      eligible: false,
      reason: "order_not_found",
      eligibleUntil: null,
      existingCases: [],
    };
  }

  // 1. Offene Cases zur Bestellnummer suchen
  const cases = await prisma.retoureCase.findMany({
    where: { bestellnummer: trimmed },
    select: {
      id: true,
      bestellnummer: true,
      status: true,
      kategorie: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      voraussichtlicheErstattung: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const openCases = cases.filter((c) => OPEN_CASE_STATUSES.includes(c.status));

  // 2. Frist berechnen — ausgehend vom delivered-Datum (falls bekannt)
  //    Fallback: ab heute (defensive, gibt nur 14 Tage statt 14+14)
  const referenceDate = opts.deliveredAt ?? new Date();
  const eligibleUntil = new Date(referenceDate);
  eligibleUntil.setDate(eligibleUntil.getDate() + WIDERRUF_DEADLINE_DAYS);

  // 3. Frist abgelaufen?
  if (new Date() > eligibleUntil) {
    return {
      eligible: false,
      reason: "frist_abgelaufen",
      eligibleUntil,
      existingCases: openCases,
    };
  }

  // 4. Existierender offener Case?
  if (openCases.length > 0) {
    return {
      eligible: false,
      reason: "already_open_case",
      eligibleUntil,
      existingCases: openCases,
    };
  }

  // 5. Alles OK
  return {
    eligible: true,
    reason: null,
    eligibleUntil,
    existingCases: [],
  };
}

/**
 * Berechnet das `eligibleUntil` für einen neu angelegten Case — nur die
 * Frist, ohne weitere Validation. Wird im Submit-Handler genutzt um
 * `RetoureCase.eligibleUntil` zu setzen.
 *
 * Default: 14 Tage ab createdAt (Anmeldung). Bei Gewährleistung: 30 Tage
 * (mehr Coulance, weil längerer Workflow).
 */
export function computeEligibleUntil(
  createdAt: Date = new Date(),
  kategorie: "widerruf" | "gewaehrleistung" = "widerruf",
): Date {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + (kategorie === "gewaehrleistung" ? 30 : WIDERRUF_DEADLINE_DAYS));
  return d;
}
