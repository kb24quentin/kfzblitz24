"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createSupplier,
  updateSupplier,
  type SupplierInput,
} from "@/lib/suppliers";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht eingeloggt");
  return session.user;
}

function extractSupplierInput(formData: FormData): SupplierInput {
  const leadDaysRaw = String(formData.get("defaultLeadDays") ?? "").trim();
  const leadDays = leadDaysRaw ? Number(leadDaysRaw) : 30;
  return {
    name: String(formData.get("name") ?? "").trim(),
    shortCode: String(formData.get("shortCode") ?? "") || null,
    routeCode: String(formData.get("routeCode") ?? "").trim() || null,
    contactPerson: String(formData.get("contactPerson") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    street: String(formData.get("street") ?? "") || null,
    postalCode: String(formData.get("postalCode") ?? "") || null,
    city: String(formData.get("city") ?? "") || null,
    country: String(formData.get("country") ?? "DE").trim() || "DE",
    rmaPolicy: String(formData.get("rmaPolicy") ?? "") || null,
    defaultLeadDays: Number.isFinite(leadDays) && leadDays > 0 ? leadDays : 30,
    active: formData.get("active") === "on",
  };
}

export async function createSupplierAction(formData: FormData) {
  await requireUser();
  const input = extractSupplierInput(formData);
  if (!input.name) {
    throw new Error("Name ist Pflichtfeld");
  }
  const s = await createSupplier(input);
  revalidatePath("/admin/suppliers");
  redirect(`/admin/suppliers/${s.id}`);
}

export async function updateSupplierAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Supplier-ID fehlt");
  const input = extractSupplierInput(formData);
  if (!input.name) {
    throw new Error("Name ist Pflichtfeld");
  }
  await updateSupplier(id, input);
  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${id}`);
}
