export function formatEur(cent: number) {
  return (cent / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

export function parseEurToCent(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const clean = String(input).trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  if (!isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function centToFloat(cent: number) {
  return cent / 100;
}

export type PositionKind = "labor" | "part";

export type InvoicePosition = {
  kind: PositionKind; // 'labor' = arbeitsleistung, 'part' = teil
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  netPriceCent: number;
  vatPercent: number;
  netTotalCent: number;
  vatTotalCent: number;
  grossTotalCent: number;
};

export function calcPosition(
  quantity: number,
  netPriceCent: number,
  vatPercent: number
) {
  const netTotalCent = Math.round(quantity * netPriceCent);
  const vatTotalCent = Math.round((netTotalCent * vatPercent) / 100);
  const grossTotalCent = netTotalCent + vatTotalCent;
  return { netTotalCent, vatTotalCent, grossTotalCent };
}

/**
 * Berechnet den effektiven netto-preis in cent für eine ServiceItem-position.
 * Wenn laborHours gesetzt → laborHours × hourlyRate.
 * Sonst netPriceCent (fester preis).
 */
export function serviceItemPriceCent(
  item: { laborHours: number | null; netPriceCent: number },
  hourlyRateCent: number
): number {
  if (item.laborHours && item.laborHours > 0) {
    return Math.round(item.laborHours * hourlyRateCent);
  }
  return item.netPriceCent;
}

/**
 * Wendet parts-markup an: einkaufspreis × (1 + markupPercent/100) → verkaufspreis
 */
export function applyPartsMarkup(purchasePriceCent: number, markupPercent: number): number {
  return Math.round(purchasePriceCent * (1 + markupPercent / 100));
}

export function sumPositions(positions: InvoicePosition[]) {
  return positions.reduce(
    (acc, p) => ({
      subtotalNetCent: acc.subtotalNetCent + p.netTotalCent,
      totalVatCent: acc.totalVatCent + p.vatTotalCent,
      totalGrossCent: acc.totalGrossCent + p.grossTotalCent,
    }),
    { subtotalNetCent: 0, totalVatCent: 0, totalGrossCent: 0 }
  );
}
