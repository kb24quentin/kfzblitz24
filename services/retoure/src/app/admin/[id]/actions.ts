"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { transitionStatus, addEvent } from "@/lib/retoure-cases";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht eingeloggt");
  return session.user;
}

export async function updateStatusAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const newStatus = String(formData.get("status") ?? "");
  const message = String(formData.get("message") ?? "").trim() || undefined;
  if (!id || !newStatus) return;
  await transitionStatus(id, newStatus, {
    actor: user.email ?? "admin",
    message: message ?? `Manueller Status-Wechsel auf "${newStatus}"`,
  });
  revalidatePath(`/admin/${id}`);
  revalidatePath("/admin");
}

export async function addNoteAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!id || !note) return;
  await addEvent(id, "note", note, undefined, user.email ?? "admin");
  revalidatePath(`/admin/${id}`);
}

export async function setCustomerTrackingAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const tracking = String(formData.get("tracking") ?? "").trim();
  if (!id) return;
  await prisma.retoureCase.update({
    where: { id },
    data: { customerTrackingNumber: tracking || null },
  });
  await addEvent(
    id,
    "tracking_added",
    tracking
      ? `Eigene Tracking-Nummer hinterlegt: ${tracking}`
      : "Eigene Tracking-Nummer entfernt",
    undefined,
    user.email ?? "admin"
  );
  revalidatePath(`/admin/${id}`);
}
