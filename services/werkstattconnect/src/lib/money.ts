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

export type InvoicePosition = {
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
