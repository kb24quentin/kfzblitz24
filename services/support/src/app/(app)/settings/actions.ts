"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { saveSlaHours } from "@/lib/settings";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht angemeldet");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User nicht gefunden");
  return user;
}

export async function saveMySignatureAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "Standard").trim() || "Standard";
  const html = String(formData.get("html") || "").trim();
  if (!html) throw new Error("HTML erforderlich");

  await prisma.signature.upsert({
    where: { userId: user.id },
    create: { userId: user.id, name, html },
    update: { name, html },
  });

  revalidatePath("/settings");
}

export async function deleteMySignatureAction() {
  const user = await requireUser();
  await prisma.signature.deleteMany({ where: { userId: user.id } });
  revalidatePath("/settings");
}

export async function saveSlaSettingsAction(formData: FormData) {
  await requireUser();
  const first = Number(formData.get("firstResponseHours") || 24);
  const res = Number(formData.get("resolutionHours") || 72);
  await saveSlaHours({ firstResponseHours: first, resolutionHours: res });
  revalidatePath("/settings");
}
