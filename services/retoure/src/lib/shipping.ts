import type { Beleg, BelegPosition } from "./webisco";

export type ShippingMode = "standard" | "sicher" | "unknown";

/** Keywords that indicate the customer booked the "Sichere Rückgabe" / free-return upgrade. */
const SICHER_KEYWORDS = ["sichere rückgabe", "sichere rueckgabe", "gratis rücksendung"];

export function detectShippingMode(beleg: Beleg): ShippingMode {
  const zustellungen = beleg.positionen.filter((p) => p.typ === "zustellung");
  if (zustellungen.length === 0) return "unknown";
  const anySicher = zustellungen.some((z) => {
    const label = (z.beschreibung ?? "").toLowerCase();
    return SICHER_KEYWORDS.some((k) => label.includes(k));
  });
  return anySicher ? "sicher" : "standard";
}

/** Only these positions can be returned by the customer. Filters out
 *  shipping/zustellung, text-only lines, and drop-shipment positions. */
export function returnableArticles(beleg: Beleg): BelegPosition[] {
  return beleg.positionen.filter((p) => {
    if (p.typ !== "artikel") return false;
    if (p.status === "geliefertstreckengeschaeft") return false;
    // Article must have a positive quantity that can still be credited.
    const maxMenge = maxReturnableQuantity(p);
    return maxMenge > 0;
  });
}

export function maxReturnableQuantity(p: BelegPosition): number {
  // offene_gutschriftsmenge is the authoritative "still creditable" qty
  // (Webisco returns it when available). Fall back to |menge|.
  if (p.offene_gutschriftsmenge !== undefined && p.offene_gutschriftsmenge > 0) {
    return p.offene_gutschriftsmenge;
  }
  const m = Math.abs(p.menge ?? 0);
  return m > 0 ? m : 0;
}
