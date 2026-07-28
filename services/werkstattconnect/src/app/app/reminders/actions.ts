"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createReminderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const customerId = String(formData.get("customerId") || "");
  const vehicleId = str(formData.get("vehicleId"));
  const type = String(formData.get("type") || "custom");
  const title = String(formData.get("title") || "").trim();
  const dueDate = String(formData.get("dueDate") || "");
  const notifyDaysBefore = parseInt(String(formData.get("notifyDaysBefore") || "30"), 10);
  if (!customerId || !title || !dueDate) throw new Error("Kunde, Titel, Datum sind Pflicht");
  const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { workshopId: true } });
  if (!cust || cust.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  await prisma.reminder.create({
    data: {
      workshopId: ctx.workshopId,
      customerId,
      vehicleId,
      type,
      title,
      note: str(formData.get("note")),
      dueDate: new Date(dueDate),
      notifyDaysBefore: isFinite(notifyDaysBefore) ? notifyDaysBefore : 30,
    },
  });
  revalidatePath("/app/reminders");
}

export async function dismissReminderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const r = await prisma.reminder.findUnique({ where: { id } });
  if (!r || r.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.reminder.update({ where: { id }, data: { status: "dismissed" } });
  revalidatePath("/app/reminders");
}

export async function reactivateReminderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const r = await prisma.reminder.findUnique({ where: { id } });
  if (!r || r.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.reminder.update({ where: { id }, data: { status: "pending", sentAt: null } });
  revalidatePath("/app/reminders");
}

export async function deleteReminderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const r = await prisma.reminder.findUnique({ where: { id } });
  if (!r || r.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.reminder.delete({ where: { id } });
  revalidatePath("/app/reminders");
}
