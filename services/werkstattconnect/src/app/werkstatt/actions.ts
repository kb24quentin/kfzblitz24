"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

/** Mechaniker startet Arbeit → status=in_progress, actualStartedAt=now */
export async function startWorkAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a || a.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointment.update({
    where: { id },
    data: {
      status: "in_progress",
      actualStartedAt: a.actualStartedAt ?? new Date(),
      mechanicId: a.mechanicId ?? ctx.userId,
    },
  });
  revalidatePath("/werkstatt");
  revalidatePath(`/werkstatt/${id}`);
}

/** Mechaniker pausiert/stoppt → status zurück auf scheduled */
export async function pauseWorkAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a || a.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointment.update({
    where: { id },
    data: { status: "scheduled" },
  });
  revalidatePath("/werkstatt");
  revalidatePath(`/werkstatt/${id}`);
}

/** Mechaniker meldet fertig → status=awaiting_approval, actualEndedAt=now */
export async function finishWorkAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a || a.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointment.update({
    where: { id },
    data: {
      status: "awaiting_approval",
      actualEndedAt: new Date(),
      customerApprovalRequested: true,
    },
  });
  revalidatePath("/werkstatt");
  revalidatePath(`/werkstatt/${id}`);
}

/** Kunden-Freigabe (Barzahlung/Vor Ort): Betrag + Unterschrift-SVG */
export async function customerApproveAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const amountStr = String(formData.get("approvedAmount") || "0");
  const amountCent = Math.round(parseFloat(amountStr.replace(",", ".")) * 100 || 0);
  const signatureSvg = str(formData.get("signatureSvg"));
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a || a.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointment.update({
    where: { id },
    data: {
      status: "approved",
      approvedAmountCent: amountCent,
      approvalSignatureSvg: signatureSvg,
      approvedAt: new Date(),
    },
  });
  revalidatePath("/werkstatt");
  revalidatePath(`/werkstatt/${id}`);
}

/** Auftrag komplett abschließen (nach Kunden-Freigabe → status=completed) */
export async function completeAppointmentAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a || a.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointment.update({
    where: { id },
    data: { status: "completed" },
  });
  revalidatePath("/werkstatt");
  revalidatePath(`/werkstatt/${id}`);
}

/* -------------------- Work-Log entries -------------------- */

export async function addWorkLogAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const appointmentId = String(formData.get("appointmentId") || "");
  const kind = String(formData.get("kind") || "labor");
  const name = String(formData.get("name") || "").trim();
  const quantityStr = String(formData.get("quantity") || "1");
  const quantity = parseFloat(quantityStr.replace(",", ".")) || 1;
  const unit = String(formData.get("unit") || (kind === "labor" ? "Std" : "Stk"));
  const serviceItemId = str(formData.get("serviceItemId"));
  const note = str(formData.get("note"));
  if (!name) throw new Error("Bezeichnung ist Pflicht");

  const a = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!a || a.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  await prisma.appointmentWorkLog.create({
    data: {
      appointmentId,
      createdBy: ctx.userId,
      kind: ["labor", "part", "note"].includes(kind) ? kind : "note",
      name,
      quantity,
      unit,
      serviceItemId,
      note,
    },
  });
  revalidatePath(`/werkstatt/${appointmentId}`);
}

export async function addWorkLogFromServiceAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const appointmentId = String(formData.get("appointmentId") || "");
  const serviceItemId = String(formData.get("serviceItemId") || "");
  const a = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!a || a.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  const s = await prisma.serviceItem.findUnique({ where: { id: serviceItemId } });
  if (!s || s.workshopId !== ctx.workshopId) throw new Error("Leistung nicht gefunden");

  // Labor-eintrag mit std aus katalog
  await prisma.appointmentWorkLog.create({
    data: {
      appointmentId,
      createdBy: ctx.userId,
      kind: s.laborHours ? "labor" : "part",
      name: s.name,
      quantity: s.laborHours ?? 1,
      unit: s.laborHours ? "Std" : s.unit,
      serviceItemId,
    },
  });

  // Auto-suggested parts als weitere log-einträge
  const suggested = (s.suggestedParts as string[] | null) ?? [];
  for (const partName of suggested) {
    let qty = 1;
    const paar = /\bpaar\b/i.test(partName);
    if (paar) qty = 2;
    const stkMatch = partName.match(/\((\d+)\s*stk/i);
    if (stkMatch) qty = parseInt(stkMatch[1], 10);
    const lMatch = partName.match(/\((\d+)\s*l\b/i);
    if (lMatch) qty = parseInt(lMatch[1], 10);
    await prisma.appointmentWorkLog.create({
      data: {
        appointmentId,
        createdBy: ctx.userId,
        kind: "part",
        name: partName,
        quantity: qty,
        unit: partName.toLowerCase().includes("(") && partName.toLowerCase().includes("l)") ? "l" : "Stk",
      },
    });
  }
  revalidatePath(`/werkstatt/${appointmentId}`);
}

export async function deleteWorkLogAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const entry = await prisma.appointmentWorkLog.findUnique({
    where: { id },
    include: { appointment: { select: { workshopId: true, id: true } } },
  });
  if (!entry || entry.appointment.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.appointmentWorkLog.delete({ where: { id } });
  revalidatePath(`/werkstatt/${entry.appointment.id}`);
}
