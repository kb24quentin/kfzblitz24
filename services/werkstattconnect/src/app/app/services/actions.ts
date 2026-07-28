"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopAdmin } from "@/lib/admin-guard";
import { parseEurToCent } from "@/lib/money";
import { STANDARD_CATALOG } from "@/lib/service-catalog-seed";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createServiceItemAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const name = String(formData.get("name") || "").trim();
  const category = str(formData.get("category"));
  const laborHoursRaw = str(formData.get("laborHours"));
  const laborHours = laborHoursRaw ? parseFloat(laborHoursRaw.replace(",", ".")) : null;
  const priceStr = String(formData.get("netPrice") || "0");
  const vatPercent = parseInt(String(formData.get("vatPercent") || "19"), 10);
  const unit = String(formData.get("unit") || "Stk");
  if (!name) throw new Error("Name ist Pflicht");

  await prisma.serviceItem.create({
    data: {
      workshopId: ctx.workshopId,
      category,
      name,
      description: str(formData.get("description")),
      laborHours: laborHours && laborHours > 0 ? laborHours : null,
      netPriceCent: laborHours && laborHours > 0 ? 0 : parseEurToCent(priceStr),
      vatPercent: [7, 19].includes(vatPercent) ? vatPercent : 19,
      unit: laborHours && laborHours > 0 ? "Std" : (["Stk", "Std", "Pauschal", "l", "m"].includes(unit) ? unit : "Stk"),
    },
  });
  revalidatePath("/app/services");
}

export async function updateServiceItemAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const existing = await prisma.serviceItem.findUnique({ where: { id } });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const laborHoursRaw = str(formData.get("laborHours"));
  const laborHours = laborHoursRaw ? parseFloat(laborHoursRaw.replace(",", ".")) : null;
  const priceStr = String(formData.get("netPrice") || "0");
  const vatPercent = parseInt(String(formData.get("vatPercent") || "19"), 10);
  const unit = String(formData.get("unit") || "Stk");

  await prisma.serviceItem.update({
    where: { id },
    data: {
      category: str(formData.get("category")),
      name: String(formData.get("name") || existing.name),
      description: str(formData.get("description")),
      laborHours: laborHours && laborHours > 0 ? laborHours : null,
      netPriceCent: laborHours && laborHours > 0 ? 0 : parseEurToCent(priceStr),
      vatPercent: [7, 19].includes(vatPercent) ? vatPercent : 19,
      unit: laborHours && laborHours > 0 ? "Std" : (["Stk", "Std", "Pauschal", "l", "m"].includes(unit) ? unit : "Stk"),
      active: String(formData.get("active") || "on") === "on",
    },
  });
  revalidatePath("/app/services");
}

export async function deleteServiceItemAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const existing = await prisma.serviceItem.findUnique({ where: { id } });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.serviceItem.delete({ where: { id } });
  revalidatePath("/app/services");
}

/**
 * Lädt den STANDARD_CATALOG für die aktuelle werkstatt. Duplikate-schutz:
 * items werden nur angelegt wenn noch kein item mit gleichem name+category existiert.
 */
export async function seedStandardCatalogAction() {
  const ctx = await requireWorkshopAdmin();
  const existing = await prisma.serviceItem.findMany({
    where: { workshopId: ctx.workshopId },
    select: { name: true, category: true },
  });
  const seen = new Set(existing.map((e) => `${e.category ?? ""}|${e.name}`));

  const toCreate = STANDARD_CATALOG.filter(
    (c) => !seen.has(`${c.category}|${c.name}`)
  ).map((c) => ({
    workshopId: ctx.workshopId,
    category: c.category,
    name: c.name,
    description: c.description ?? null,
    laborHours: c.laborHours,
    netPriceCent: 0,
    vatPercent: 19,
    unit: "Std",
    active: true,
  }));

  if (toCreate.length > 0) {
    await prisma.serviceItem.createMany({ data: toCreate });
  }
  revalidatePath("/app/services");
}
