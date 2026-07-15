"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  saveSlaHours,
  saveAutoAckSettings,
  saveAutoSendCategories,
  saveAutoSendMinConfidence,
  saveTicketCategories,
  saveBusinessHours,
  type BusinessHours,
} from "@/lib/settings";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht angemeldet");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User nicht gefunden");
  return user;
}

export async function saveMySignatureAction(formData: FormData) {
  const user = await requireUser();
  const displayName = String(formData.get("displayName") || "").trim();
  const position = String(formData.get("position") || "").trim();
  if (!displayName) throw new Error("Name erforderlich");
  if (!position) throw new Error("Position erforderlich");

  await prisma.signature.upsert({
    where: { userId: user.id },
    create: { userId: user.id, displayName, position },
    update: { displayName, position },
  });

  revalidatePath("/settings");
}

export async function resetMySignatureAction() {
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

export async function saveAiAutopilotAction(formData: FormData) {
  await requireAdmin();
  const cats: string[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("cat_") && v === "on") cats.push(k.slice(4));
  }
  const rawConf = Number(formData.get("minConfidence") || 90);
  const conf = Math.max(50, Math.min(100, rawConf)) / 100;
  await saveAutoSendCategories(cats);
  await saveAutoSendMinConfidence(conf);
  revalidatePath("/settings");
}

export async function saveCategoriesAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("categories") || "[]");
  let parsed: { key: string; label: string }[] = [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) parsed = arr;
  } catch {
    throw new Error("Ungültige Kategorien-Daten");
  }
  await saveTicketCategories(parsed);
  revalidatePath("/settings");
}

export async function saveBusinessHoursAction(formData: FormData) {
  await requireAdmin();
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const bh: BusinessHours = {
    mon: { active: false, from: "08:00", to: "18:00" },
    tue: { active: false, from: "08:00", to: "18:00" },
    wed: { active: false, from: "08:00", to: "18:00" },
    thu: { active: false, from: "08:00", to: "18:00" },
    fri: { active: false, from: "08:00", to: "18:00" },
    sat: { active: false, from: "10:00", to: "14:00" },
    sun: { active: false, from: "10:00", to: "14:00" },
    timezone: String(formData.get("timezone") || "Europe/Berlin"),
  };
  for (const d of days) {
    bh[d] = {
      active: formData.get(`${d}_active`) === "on",
      from: String(formData.get(`${d}_from`) || "08:00"),
      to: String(formData.get(`${d}_to`) || "18:00"),
    };
  }
  await saveBusinessHours(bh);
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
