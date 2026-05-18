"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { closeContainer } from "@/lib/containers";
import {
  palletLabelZpl,
  sendZplToPrinter,
  type PrintResult,
} from "@/lib/label-print";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht eingeloggt");
  return session.user;
}

/**
 * Re-Print: stößt nochmal einen ZPL-Druck des aktuellen Container-
 * Labels an. Drucker-IP aus env `PRINTER_HOST`. Bei Fehlern wird das
 * Ergebnis still verschluckt — Admin sieht den Effekt am ausgedruckten
 * Label. Kann man später um einen Toast-Feedback-Kanal ergänzen.
 */
export async function reprintContainerLabelAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const c = await prisma.container.findUnique({ where: { id } });
  if (!c) return;
  const host = process.env.PRINTER_HOST?.trim();
  if (!host) return;
  const zpl = palletLabelZpl({
    palletCode: c.code,
    partnerName: c.partnerId ?? "(kein Partner)",
    createdAt: c.openedAt,
    maxOpenUntil: c.maxOpenUntil ?? c.openedAt,
  });
  // Best-effort — Errors werden hier nicht weitergegeben.
  const _res: PrintResult = await sendZplToPrinter(zpl, host);
  void _res;
  revalidatePath(`/admin/containers/${id}`);
}

export async function closeContainerAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await closeContainer(id, user.email ?? "admin");
  revalidatePath(`/admin/containers/${id}`);
  revalidatePath("/admin/containers");
}

export async function updateContainerNotesAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return;
  await prisma.container.update({
    where: { id },
    data: { notes: notes.length > 0 ? notes : null },
  });
  revalidatePath(`/admin/containers/${id}`);
}
