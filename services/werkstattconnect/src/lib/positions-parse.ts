import { calcPosition, parseEurToCent, type InvoicePosition, type PositionKind } from "./money";

/**
 * Parst positionen aus formdata. Ausgelagert aus rechnungen/actions.ts
 * weil "use server"-files nur async exports haben dürfen.
 */
export function positionsFromFormData(formData: FormData): InvoicePosition[] {
  const kinds = formData.getAll("pos_kind").map(String);
  const names = formData.getAll("pos_name").map(String);
  const descs = formData.getAll("pos_description").map(String);
  const qtys = formData.getAll("pos_quantity").map(String);
  const units = formData.getAll("pos_unit").map(String);
  const prices = formData.getAll("pos_netPrice").map(String);
  const vats = formData.getAll("pos_vatPercent").map(String);
  const out: InvoicePosition[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] || "").trim();
    if (!name) continue;
    const kind: PositionKind = kinds[i] === "part" ? "part" : "labor";
    const quantity = parseFloat((qtys[i] || "1").replace(",", "."));
    const netPriceCent = parseEurToCent(prices[i] || "0");
    const vatPercent = parseInt(vats[i] || "19", 10);
    const { netTotalCent, vatTotalCent, grossTotalCent } = calcPosition(quantity, netPriceCent, vatPercent);
    out.push({
      kind,
      name,
      description: (descs[i] || "").trim() || undefined,
      quantity,
      unit: units[i] || (kind === "labor" ? "Std" : "Stk"),
      netPriceCent,
      vatPercent,
      netTotalCent,
      vatTotalCent,
      grossTotalCent,
    });
  }
  return out;
}
