"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { APPS } from "@/lib/apps";
import { syncGrantToApp, syncRevokeFromApp } from "@/lib/app-sync";

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

const VALID_APP_KEYS: Set<string> = new Set(APPS.map((a) => a.key));

export async function toggleUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (id === admin.id && !active) throw new Error("Du kannst dich nicht selbst deaktivieren");

  const target = await prisma.user.findUnique({
    where: { id },
    include: { appAccesses: true },
  });
  if (!target) throw new Error("User nicht gefunden");

  await prisma.user.update({ where: { id }, data: { active } });

  // When deactivating: revoke every downstream app-sync (soft-deactivate on
  // support-side; other apps ignore for now). When activating: re-sync every
  // existing app-access so the app-side user record is aligned again.
  if (!active) {
    await Promise.all(
      target.appAccesses.map((a) => syncRevokeFromApp(a.appKey, target.email))
    );
  } else {
    await Promise.all(
      target.appAccesses.map((a) =>
        syncGrantToApp(a.appKey, {
          email: target.email,
          name: target.name,
          role: a.role,
          googleId: target.googleId,
          imageUrl: target.imageUrl,
        })
      )
    );
  }

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

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User nicht gefunden");

  await prisma.appAccess.upsert({
    where: { userId_appKey: { userId, appKey } },
    create: { userId, appKey, role },
    update: { role },
  });

  // Push to the target app (if it supports sync API + user is active in intranet)
  if (user.active) {
    await syncGrantToApp(appKey, {
      email: user.email,
      name: user.name,
      role,
      googleId: user.googleId,
      imageUrl: user.imageUrl,
    });
  }

  revalidatePath("/settings");
}

export async function revokeAccessAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const appKey = String(formData.get("appKey") || "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await prisma.appAccess.deleteMany({ where: { userId, appKey } });

  if (user) await syncRevokeFromApp(appKey, user.email);

  revalidatePath("/settings");
}
