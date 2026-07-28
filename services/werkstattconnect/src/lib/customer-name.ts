export function customerDisplayName(c: {
  type: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  if (c.type === "b2b" && c.companyName) return c.companyName;
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.companyName || "Unbenannter Kunde";
}

export function vehicleDisplayName(v: {
  brand?: string | null;
  model?: string | null;
  licensePlate?: string | null;
}) {
  const bm = [v.brand, v.model].filter(Boolean).join(" ").trim();
  if (bm && v.licensePlate) return `${bm} (${v.licensePlate})`;
  return bm || v.licensePlate || "Fahrzeug";
}
