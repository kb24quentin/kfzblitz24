"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { APPS } from "@/lib/apps";
import { syncGrantToApp, syncRevokeFromApp } from "@/lib/app-sync";
import { notifyAdmins, notifyUser } from "@/lib/notify";

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

/**
 * User-initiated: request access to an app. Creates AccessRequest + notifies
 * admins. Idempotent — if a pending request for same user+app already exists,
 * just updates the requestedRole.
 */
export async function requestAccessAction(formData: FormData) {
  const me = await requireUser();
  const appKey = String(formData.get("appKey") || "");
  const requestedRole = String(formData.get("requestedRole") || "").trim();
  const message = String(formData.get("message") || "").trim() || null;
  const app = APPS.find((a) => a.key === appKey);
  if (!app) throw new Error("Ungültige App");
  if (!requestedRole || !app.roles.some((r) => r.key === requestedRole)) {
    throw new Error("Ungültige Rolle");
  }

  // Already has access? Then nothing to request
  const existingGrant = await prisma.appAccess.findUnique({
    where: { userId_appKey: { userId: me.id, appKey } },
  });
  if (existingGrant) return;

  const existingPending = await prisma.accessRequest.findFirst({
    where: { userId: me.id, appKey, status: "pending" },
  });
  if (existingPending) {
    await prisma.accessRequest.update({
      where: { id: existingPending.id },
      data: { requestedRole, message },
    });
  } else {
    await prisma.accessRequest.create({
      data: { userId: me.id, appKey, requestedRole, message },
    });
  }

  const roleLabel =
    app.roles.find((r) => r.key === requestedRole)?.label || requestedRole;
  notifyAdmins(
    `Zugriffs-Anfrage: ${me.name} → ${app.label} (${roleLabel})`,
    `<p><strong>${me.name}</strong> (${me.email}) beantragt Zugriff auf <strong>${app.label}</strong> als <strong>${roleLabel}</strong>.</p>
${message ? `<p style="background:#f4f5f7;padding:12px;border-left:3px solid #ff6600;border-radius:4px;color:#3d4654;"><em>${message}</em></p>` : ""}
<p style="margin-top:20px;">
  <a href="https://kfzblitz24-group.com/settings" style="display:inline-block;background:#ff6600;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
    Anfrage bearbeiten →
  </a>
</p>`
  ).catch(() => {});

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function approveRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const req = await prisma.accessRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!req || req.status !== "pending") return;

  const app = APPS.find((a) => a.key === req.appKey);
  if (!app) throw new Error("App unbekannt");

  await prisma.$transaction([
    prisma.appAccess.upsert({
      where: { userId_appKey: { userId: req.userId, appKey: req.appKey } },
      create: { userId: req.userId, appKey: req.appKey, role: req.requestedRole },
      update: { role: req.requestedRole },
    }),
    prisma.accessRequest.update({
      where: { id: req.id },
      data: {
        status: "granted",
        respondedAt: new Date(),
        respondedById: admin.id,
      },
    }),
  ]);

  // Sync to the target app if it supports it (and user active)
  if (req.user.active) {
    await syncGrantToApp(req.appKey, {
      email: req.user.email,
      name: req.user.name,
      role: req.requestedRole,
      googleId: req.user.googleId,
      imageUrl: req.user.imageUrl,
    });
  }

  const roleLabel =
    app.roles.find((r) => r.key === req.requestedRole)?.label || req.requestedRole;
  notifyUser(
    req.user.email,
    `Freigabe erteilt: ${app.label}`,
    `<p>Guten Tag ${req.user.name},</p>
<p>dein Zugriff auf <strong>${app.label}</strong> (${roleLabel}) wurde freigegeben.</p>
<p style="margin-top:20px;">
  <a href="${app.url}" style="display:inline-block;background:#ff6600;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
    ${app.label} öffnen →
  </a>
</p>`
  ).catch(() => {});

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function denyRequestAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  await prisma.accessRequest.update({
    where: { id },
    data: {
      status: "denied",
      respondedAt: new Date(),
      respondedById: admin.id,
    },
  });
  revalidatePath("/settings");
}
