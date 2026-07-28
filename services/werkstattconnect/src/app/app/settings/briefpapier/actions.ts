"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopAdmin } from "@/lib/admin-guard";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function saveBriefpapierAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();

  const logoState = String(formData.get("logoState") || "keep"); // 'keep' | 'new' | 'clear'
  let logoBytes: Uint8Array<ArrayBuffer> | undefined;
  let logoMime: string | undefined;
  if (logoState === "new") {
    const file = formData.get("letterheadLogo") as File | null;
    if (file && typeof file === "object" && file.size > 0) {
      if (file.size > 500_000) throw new Error("Logo zu groß (max 500 KB)");
      const buf = await file.arrayBuffer();
      const out = new Uint8Array(new ArrayBuffer(buf.byteLength));
      out.set(new Uint8Array(buf));
      logoBytes = out;
      logoMime = file.type || "image/png";
    }
  }

  await prisma.workshop.update({
    where: { id: ctx.workshopId },
    data: {
      letterheadTemplate: String(formData.get("letterheadTemplate") || "modern-orange"),
      brandPrimary: str(formData.get("brandPrimary")),
      brandAccent: str(formData.get("brandAccent")),
      brandFooterText: str(formData.get("brandFooterText")),
      footerCol1: str(formData.get("footerCol1")),
      footerCol2: str(formData.get("footerCol2")),
      footerCol3: str(formData.get("footerCol3")),
      ...(logoState === "clear"
        ? { letterheadLogo: null, letterheadLogoMime: null }
        : logoBytes
          ? { letterheadLogo: logoBytes, letterheadLogoMime: logoMime }
          : {}),
    },
  });
  revalidatePath("/app/settings/briefpapier");
  revalidatePath("/app/settings");
}
