"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkshopAdmin } from "@/lib/admin-guard";
import { sendPasswordSetupMail } from "@/lib/mail";

function newToken() {
  return randomBytes(24).toString("hex");
}
function tokenExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export async function inviteTeamMemberAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "mitarbeiter");
  if (!name || !email) throw new Error("Name und Email sind Pflicht");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email ungültig");
  if (role === "owner") throw new Error("Nur KB24-Admin kann Owner ändern");

  const exists = await prisma.workshopUser.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new Error(`Ein Benutzer mit ${email} existiert bereits`);

  const workshop = await prisma.workshop.findUnique({
    where: { id: ctx.workshopId },
    select: { name: true },
  });
  if (!workshop) throw new Error("Werkstatt nicht gefunden");

  const token = newToken();
  await prisma.workshopUser.create({
    data: {
      workshopId: ctx.workshopId,
      email,
      name,
      role: role === "admin" ? "admin" : "mitarbeiter",
      active: true,
      passwordSetupToken: token,
      passwordSetupExpires: tokenExpiry(),
    },
  });

  try {
    await sendPasswordSetupMail({
      to: email,
      recipientName: name,
      workshopName: workshop.name,
      token,
      variant: "team-invite",
    });
  } catch (e) {
    console.error("[inviteTeamMember] mail failed", e);
  }

  revalidatePath("/app/team");
}

export async function toggleTeamMemberActiveAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const userId = String(formData.get("userId") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!userId) throw new Error("User-ID fehlt");
  const target = await prisma.workshopUser.findUnique({ where: { id: userId } });
  if (!target || target.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (target.role === "owner") throw new Error("Owner kann nicht deaktiviert werden");
  await prisma.workshopUser.update({ where: { id: userId }, data: { active } });
  revalidatePath("/app/team");
}

export async function resendTeamMemberSetupMailAction(formData: FormData) {
  const ctx = await requireWorkshopAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) throw new Error("User-ID fehlt");
  const user = await prisma.workshopUser.findUnique({
    where: { id: userId },
    include: { workshop: { select: { name: true } } },
  });
  if (!user || user.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const token = newToken();
  await prisma.workshopUser.update({
    where: { id: userId },
    data: {
      password: null,
      passwordSetupToken: token,
      passwordSetupExpires: tokenExpiry(),
    },
  });

  await sendPasswordSetupMail({
    to: user.email,
    recipientName: user.name,
    workshopName: user.workshop.name,
    token,
    variant: "team-invite",
  });

  revalidatePath("/app/team");
}
