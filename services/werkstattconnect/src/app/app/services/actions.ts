"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopAdmin } from "@/lib/admin-guard";
import { parseEurToCent } from "@/lib/money";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createServiceItemAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const name = String(formData.get("name") || "").trim();
  const priceStr = String(formData.get("netPrice") || "0");
  const vatPercent = parseInt(String(formData.get("vatPercent") || "19"), 10);
  const unit = String(formData.get("unit") || "Stk");
  if (!name) throw new Error("Name ist Pflicht");
  await prisma.serviceItem.create({
    data: {
      workshopId: ctx.workshopId,
      name,
      description: str(formData.get("description")),
      netPriceCent: parseEurToCent(priceStr),
      vatPercent: [7, 19].includes(vatPercent) ? vatPercent : 19,
      unit: ["Stk", "Std", "Pauschal"].includes(unit) ? unit : "Stk",
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

  const priceStr = String(formData.get("netPrice") || "0");
  const vatPercent = parseInt(String(formData.get("vatPercent") || "19"), 10);
  const unit = String(formData.get("unit") || "Stk");

  await prisma.serviceItem.update({
    where: { id },
    data: {
      name: String(formData.get("name") || existing.name),
      description: str(formData.get("description")),
      netPriceCent: parseEurToCent(priceStr),
      vatPercent: [7, 19].includes(vatPercent) ? vatPercent : 19,
      unit: ["Stk", "Std", "Pauschal"].includes(unit) ? unit : "Stk",
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
