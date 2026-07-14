"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { saveSlaHours, saveAutoAckSettings } from "@/lib/settings";

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

export async function saveAutoAckSettingsAction(formData: FormData) {
  await requireUser();
  const enabled = formData.get("enabled") === "on";
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!subject || !body) throw new Error("Betreff + Text erforderlich");
  await saveAutoAckSettings({ enabled, subject, body });
  revalidatePath("/settings");
}

// ─── User Management (admin only) ─────────────────────────────────────

async function requireAdmin() {
  const me = await requireUser();
  if (me.role !== "admin") throw new Error("Nur Admins dürfen User verwalten");
  return me;
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "agent");

  if (!name || !email || !password || password.length < 6) {
    throw new Error("Name + Email + Passwort (min. 6 Zeichen) erforderlich");
  }
  if (!["admin", "agent"].includes(role)) throw new Error("Ungültige Rolle");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email ist bereits vergeben");

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, password: hashed, role },
  });
  revalidatePath("/settings");
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "agent");
  const password = String(formData.get("password") || "");

  if (!id || !name || !email) throw new Error("ID + Name + Email erforderlich");
  if (!["admin", "agent"].includes(role)) throw new Error("Ungültige Rolle");

  const data: {
    name: string;
    email: string;
    role: string;
    password?: string;
  } = { name, email, role };

  if (password && password.length >= 6) {
    data.password = await bcrypt.hash(password, 12);
  }

  await prisma.user.update({ where: { id }, data });
  revalidatePath("/settings");
}

export async function toggleUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (id === admin.id && !active) throw new Error("Du kannst dich nicht selbst deaktivieren");

  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/settings");
}
