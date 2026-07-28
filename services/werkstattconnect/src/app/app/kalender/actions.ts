"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

function combineDT(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

export async function createAppointmentAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const customerId = String(formData.get("customerId") || "");
  const title = String(formData.get("title") || "").trim();
  const date = String(formData.get("date") || "");
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  if (!customerId || !title || !date || !startTime || !endTime) {
    throw new Error("Kunde, Titel, Datum und Zeiten sind Pflicht");
  }
  const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { workshopId: true } });
  if (!cust || cust.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const startsAt = combineDT(date, startTime);
  const endsAt = combineDT(date, endTime);
  if (endsAt <= startsAt) throw new Error("Ende muss nach Start liegen");

  const vehicleId = str(formData.get("vehicleId"));
  const mechanicId = str(formData.get("mechanicId"));

  await prisma.appointment.create({
    data: {
      workshopId: ctx.workshopId,
      customerId,
      vehicleId,
      mechanicId,
      title,
      description: str(formData.get("description")),
      startsAt,
      endsAt,
      status: "scheduled",
    },
  });
  revalidatePath("/app/kalender");
  revalidatePath(`/app/kunden/${customerId}`);
}

export async function updateAppointmentStatusAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["scheduled", "in_progress", "completed", "cancelled"].includes(status)) {
    throw new Error("Ungültige Eingabe");
  }
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointment.update({ where: { id }, data: { status } });
  revalidatePath("/app/kalender");
}

export async function deleteAppointmentAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing || existing.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/app/kalender");
}
