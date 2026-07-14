"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { APPS } from "@/lib/apps";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht angemeldet");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User nicht gefunden");
  return user;
}

async function requireAdmin() {
  const me = await requireUser();
  if (me.role !== "admin") throw new Error("Nur Admins dürfen das");
  return me;
}

const VALID_APP_KEYS: Set<string> = new Set(APPS.map((a) => a.key as string));

export async function toggleUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (id === admin.id && !active) throw new Error("Du kannst dich nicht selbst deaktivieren");
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/settings");
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "user");
  if (!id || !name) throw new Error("ID + Name erforderlich");
  if (!["user", "admin"].includes(role)) throw new Error("Ungültige Rolle");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("User nicht gefunden");

  const data: { name: string; role?: string } = { name };
  if (id !== admin.id) data.role = role;

  await prisma.user.update({ where: { id }, data });
  revalidatePath("/settings");
}

export async function grantAccessAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const appKey = String(formData.get("appKey") || "");
  const role = String(formData.get("role") || "user");
  if (!userId || !VALID_APP_KEYS.has(appKey)) throw new Error("Ungültige Parameter");

  await prisma.appAccess.upsert({
    where: { userId_appKey: { userId, appKey } },
    create: { userId, appKey, role },
    update: { role },
  });
  revalidatePath("/settings");
}

export async function revokeAccessAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const appKey = String(formData.get("appKey") || "");
  await prisma.appAccess.deleteMany({ where: { userId, appKey } });
  revalidatePath("/settings");
}
