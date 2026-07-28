"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createCustomerAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const type = String(formData.get("type") || "b2c");
  const companyName = str(formData.get("companyName"));
  const firstName = str(formData.get("firstName"));
  const lastName = str(formData.get("lastName"));

  if (type === "b2b" && !companyName) throw new Error("Firmenname ist Pflicht bei B2B");
  if (type === "b2c" && !lastName) throw new Error("Nachname ist Pflicht bei B2C");

  const c = await prisma.customer.create({
    data: {
      workshopId: ctx.workshopId,
      type,
      companyName,
      firstName,
      lastName,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      street: str(formData.get("street")),
      zip: str(formData.get("zip")),
      city: str(formData.get("city")),
      taxId: str(formData.get("taxId")),
      notes: str(formData.get("notes")),
    },
  });
  revalidatePath("/app/kunden");
  redirect(`/app/kunden/${c.id}`);
}

export async function updateCustomerAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const existing = await prisma.customer.findUnique({ where: { id }, select: { workshopId: true } });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  await prisma.customer.update({
    where: { id },
    data: {
      type: String(formData.get("type") || "b2c"),
      companyName: str(formData.get("companyName")),
      firstName: str(formData.get("firstName")),
      lastName: str(formData.get("lastName")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      street: str(formData.get("street")),
      zip: str(formData.get("zip")),
      city: str(formData.get("city")),
      taxId: str(formData.get("taxId")),
      notes: str(formData.get("notes")),
    },
  });
  revalidatePath("/app/kunden");
  revalidatePath(`/app/kunden/${id}`);
}

export async function deleteCustomerAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const existing = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true } } },
  });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (existing._count.invoices > 0) {
    throw new Error("Kunde hat Rechnungen und kann nicht gelöscht werden (GoBD).");
  }
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/app/kunden");
  redirect("/app/kunden");
}

export async function createVehicleAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const customerId = String(formData.get("customerId") || "");
  if (!customerId) throw new Error("Kunde fehlt");
  const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { workshopId: true } });
  if (!cust || cust.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const yearRaw = str(formData.get("year"));
  const mileageRaw = str(formData.get("mileage"));
  const powerRaw = str(formData.get("power"));
  const firstRegRaw = str(formData.get("firstRegistration"));
  const nextTuevRaw = str(formData.get("nextTuev"));
  const nextInspRaw = str(formData.get("nextInspection"));

  await prisma.vehicle.create({
    data: {
      workshopId: ctx.workshopId,
      customerId,
      licensePlate: str(formData.get("licensePlate")),
      vin: str(formData.get("vin")),
      brand: str(formData.get("brand")),
      model: str(formData.get("model")),
      variant: str(formData.get("variant")),
      year: yearRaw ? parseInt(yearRaw, 10) : null,
      hsn: str(formData.get("hsn")),
      tsn: str(formData.get("tsn")),
      fuelType: str(formData.get("fuelType")),
      transmission: str(formData.get("transmission")),
      power: powerRaw ? parseInt(powerRaw, 10) : null,
      color: str(formData.get("color")),
      firstRegistration: firstRegRaw ? new Date(firstRegRaw) : null,
      mileage: mileageRaw ? parseInt(mileageRaw, 10) : null,
      mileageUpdatedAt: mileageRaw ? new Date() : null,
      nextTuev: nextTuevRaw ? new Date(nextTuevRaw) : null,
      nextInspection: nextInspRaw ? new Date(nextInspRaw) : null,
      notes: str(formData.get("notes")),
    },
  });
  revalidatePath(`/app/kunden/${customerId}`);
}

export async function updateVehicleAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const yearRaw = str(formData.get("year"));
  const mileageRaw = str(formData.get("mileage"));
  const powerRaw = str(formData.get("power"));
  const firstRegRaw = str(formData.get("firstRegistration"));
  const nextTuevRaw = str(formData.get("nextTuev"));
  const nextInspRaw = str(formData.get("nextInspection"));

  const newMileage = mileageRaw ? parseInt(mileageRaw, 10) : null;

  await prisma.vehicle.update({
    where: { id },
    data: {
      licensePlate: str(formData.get("licensePlate")),
      vin: str(formData.get("vin")),
      brand: str(formData.get("brand")),
      model: str(formData.get("model")),
      variant: str(formData.get("variant")),
      year: yearRaw ? parseInt(yearRaw, 10) : null,
      hsn: str(formData.get("hsn")),
      tsn: str(formData.get("tsn")),
      fuelType: str(formData.get("fuelType")),
      transmission: str(formData.get("transmission")),
      power: powerRaw ? parseInt(powerRaw, 10) : null,
      color: str(formData.get("color")),
      firstRegistration: firstRegRaw ? new Date(firstRegRaw) : null,
      mileage: newMileage,
      mileageUpdatedAt: newMileage !== existing.mileage ? new Date() : existing.mileageUpdatedAt,
      nextTuev: nextTuevRaw ? new Date(nextTuevRaw) : null,
      nextInspection: nextInspRaw ? new Date(nextInspRaw) : null,
      notes: str(formData.get("notes")),
    },
  });
  revalidatePath(`/app/kunden/${existing.customerId}`);
  revalidatePath(`/app/kunden/${existing.customerId}/fahrzeuge/${id}`);
}

export async function deleteVehicleAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.vehicle.delete({ where: { id } });
  revalidatePath(`/app/kunden/${existing.customerId}`);
  redirect(`/app/kunden/${existing.customerId}`);
}
