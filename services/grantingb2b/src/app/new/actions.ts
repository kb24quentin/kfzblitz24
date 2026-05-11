"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/upload";
import { runAssessment } from "@/lib/assess";

export type CreateCaseState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function req(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function opt(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function bool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

export async function createCaseAction(
  _prev: CreateCaseState,
  formData: FormData
): Promise<CreateCaseState> {
  const fieldErrors: Record<string, string> = {};

  const customerType = req(formData, "customerType"); // werkstatt | wiederverkaeufer
  const businessSubtype = opt(formData, "businessSubtype");
  const companyName = req(formData, "companyName");
  const contactFirstName = req(formData, "contactFirstName");
  const contactLastName = req(formData, "contactLastName");
  const email = req(formData, "email");
  const phone = opt(formData, "phone");
  const street = req(formData, "street");
  const postalCode = req(formData, "postalCode");
  const city = req(formData, "city");
  const country = req(formData, "country") || "Deutschland";
  const shippingSameAsBilling = bool(formData, "shippingSameAsBilling");
  const shippingStreet = opt(formData, "shippingStreet");
  const shippingPostalCode = opt(formData, "shippingPostalCode");
  const shippingCity = opt(formData, "shippingCity");
  const shippingCountry = opt(formData, "shippingCountry");
  const ustId = opt(formData, "ustId");
  const gewerbeschein = formData.get("gewerbeschein");

  // ─── Validation ─────────────────────────────────────────────────────
  if (!customerType) fieldErrors.customerType = "Kundentyp wählen.";
  if (!companyName) fieldErrors.companyName = "Pflichtfeld.";
  if (!contactFirstName || !contactLastName) {
    fieldErrors.contactFirstName = "Vor- und Nachname.";
  }
  if (!email) fieldErrors.email = "Pflichtfeld.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = "Ungültige Email.";
  if (!street) fieldErrors.street = "Pflichtfeld.";
  if (!postalCode) fieldErrors.postalCode = "Pflichtfeld.";
  if (!city) fieldErrors.city = "Pflichtfeld.";
  if (!shippingSameAsBilling) {
    if (!shippingStreet) fieldErrors.shippingStreet = "Pflichtfeld.";
    if (!shippingPostalCode) fieldErrors.shippingPostalCode = "Pflichtfeld.";
    if (!shippingCity) fieldErrors.shippingCity = "Pflichtfeld.";
  }
  const hasGewerbeschein =
    gewerbeschein instanceof File && gewerbeschein.size > 0;
  if (!hasGewerbeschein) {
    fieldErrors.gewerbeschein = "Gewerbeschein ist Pflicht (PDF/JPG/PNG, max 10 MB).";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Bitte überprüfe die rot markierten Felder.",
      fieldErrors,
    };
  }

  // ─── Create case (without file first, to get a stable id) ───────────
  const created = await prisma.b2BCase.create({
    data: {
      customerType,
      businessSubtype,
      companyName,
      contactFirstName,
      contactLastName,
      email,
      phone,
      street,
      postalCode,
      city,
      country,
      shippingSameAsBilling,
      shippingStreet: shippingSameAsBilling ? null : shippingStreet,
      shippingPostalCode: shippingSameAsBilling ? null : shippingPostalCode,
      shippingCity: shippingSameAsBilling ? null : shippingCity,
      shippingCountry: shippingSameAsBilling ? null : shippingCountry,
      ustId,
      source: "form",
    },
  });

  await prisma.b2BCaseEvent.create({
    data: {
      caseId: created.id,
      type: "case_created",
      message: `Case angelegt für ${companyName}`,
      actor: "form",
    },
  });

  // ─── File upload ────────────────────────────────────────────────────
  if (gewerbeschein instanceof File && gewerbeschein.size > 0) {
    try {
      const stored = await saveUpload(gewerbeschein, created.id);
      await prisma.b2BCase.update({
        where: { id: created.id },
        data: {
          gewerbescheinPath: stored.path,
          gewerbescheinFilename: stored.filename,
          gewerbescheinMimeType: stored.mimeType,
          gewerbescheinSizeBytes: stored.sizeBytes,
        },
      });
      await prisma.b2BCaseEvent.create({
        data: {
          caseId: created.id,
          type: "document_uploaded",
          message: `Gewerbeschein hochgeladen: ${stored.filename}`,
          actor: "form",
        },
      });
    } catch (e) {
      const msg = e instanceof UploadError ? e.message : `Upload-Fehler: ${String(e)}`;
      await prisma.b2BCaseEvent.create({
        data: {
          caseId: created.id,
          type: "note",
          message: `WARN: ${msg}`,
          actor: "system",
        },
      });
    }
  }

  // Bereits hier auf "assessing" setzen, damit die Detail-Seite gleich
  // das richtige Banner zeigt.
  await prisma.b2BCase.update({
    where: { id: created.id },
    data: { status: "assessing" },
  });

  // ─── Assessment im Hintergrund nach dem Response ────────────────────
  // `after()` schedule die Arbeit erst nachdem die Redirect-Response
  // an den Browser raus ist — der User sieht sofort die Detail-Seite,
  // VIES/Nominatim/OpenAI laufen dann im Hintergrund.
  const newId = created.id;
  after(async () => {
    try {
      await runAssessment(newId);
    } catch (e) {
      await prisma.b2BCaseEvent.create({
        data: {
          caseId: newId,
          type: "note",
          message: `Assessment fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
          actor: "system",
        },
      });
    }
  });

  revalidatePath("/");
  redirect(`/cases/${newId}`);
}
