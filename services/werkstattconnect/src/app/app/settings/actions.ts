"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopAdmin } from "@/lib/admin-guard";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function updateWorkshopBasicsAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  await prisma.workshop.update({
    where: { id: ctx.workshopId },
    data: {
      contactEmail: String(formData.get("contactEmail") || "").trim() || "info@example.com",
      contactPhone: str(formData.get("contactPhone")),
      street: str(formData.get("street")),
      zip: str(formData.get("zip")),
      city: str(formData.get("city")),
      taxId: str(formData.get("taxId")),
    },
  });
  revalidatePath("/app/settings");
}

export async function updateBankAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  await prisma.workshop.update({
    where: { id: ctx.workshopId },
    data: {
      iban: str(formData.get("iban")),
      bic: str(formData.get("bic")),
      bankName: str(formData.get("bankName")),
    },
  });
  revalidatePath("/app/settings");
}

// Legacy — jetzt in ./briefpapier/actions.ts (saveBriefpapierAction). Bleibt hier für backward-compat falls externe caller.
export async function updateBrandingAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();

  const file = formData.get("letterheadLogo") as File | null;
  let logoBytes: Uint8Array<ArrayBuffer> | undefined;
  let logoMime: string | undefined;
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > 500_000) throw new Error("Logo zu groß (max 500 KB)");
    const buf = await file.arrayBuffer();
    const out = new Uint8Array(new ArrayBuffer(buf.byteLength));
    out.set(new Uint8Array(buf));
    logoBytes = out;
    logoMime = file.type || "image/png";
  }

  const clearLogo = String(formData.get("clearLogo") || "") === "on";

  await prisma.workshop.update({
    where: { id: ctx.workshopId },
    data: {
      brandPrimary: str(formData.get("brandPrimary")),
      brandAccent: str(formData.get("brandAccent")),
      brandFooterText: str(formData.get("brandFooterText")),
      footerCol1: str(formData.get("footerCol1")),
      footerCol2: str(formData.get("footerCol2")),
      footerCol3: str(formData.get("footerCol3")),
      letterheadTemplate: String(formData.get("letterheadTemplate") || "modern-orange"),
      ...(clearLogo
        ? { letterheadLogo: null, letterheadLogoMime: null }
        : logoBytes
          ? { letterheadLogo: logoBytes, letterheadLogoMime: logoMime }
          : {}),
    },
  });
  revalidatePath("/app/settings");
}

export async function updatePricingAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const rateStr = String(formData.get("hourlyRate") || "95,00");
  const rateCent = Math.max(0, Math.round(parseFloat(rateStr.replace(",", ".")) * 100 || 0));
  const markup = Math.max(0, Math.min(500, parseInt(String(formData.get("partsMarkupPercent") || "15"), 10)));
  await prisma.workshop.update({
    where: { id: ctx.workshopId },
    data: { hourlyRateCent: rateCent, partsMarkupPercent: markup },
  });
  revalidatePath("/app/settings");
}

export async function updateQuotePrefixAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const prefix = String(formData.get("quotePrefix") || "AN-").trim().slice(0, 8) || "AN-";
  await prisma.workshop.update({ where: { id: ctx.workshopId }, data: { quotePrefix: prefix } });
  revalidatePath("/app/settings");
}

export async function updateInvoicePrefixAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const prefix = String(formData.get("invoicePrefix") || "RE-").trim().slice(0, 8);
  await prisma.workshop.update({
    where: { id: ctx.workshopId },
    data: { invoicePrefix: prefix || "RE-" },
  });
  revalidatePath("/app/settings");
}
