"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireKbAdmin } from "@/lib/admin-guard";
import { uniqueWorkshopSlug } from "@/lib/slug";
import { sendPasswordSetupMail } from "@/lib/mail";
import { STANDARD_CATALOG } from "@/lib/service-catalog-seed";

function newToken() {
  return randomBytes(24).toString("hex");
}

function tokenExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export async function createWorkshopAction(formData: FormData) {
  await requireKbAdmin();

  const name = String(formData.get("name") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const ownerEmail = String(formData.get("ownerEmail") || "").trim().toLowerCase();
  const contactPhone = String(formData.get("contactPhone") || "").trim() || null;
  const street = String(formData.get("street") || "").trim() || null;
  const zip = String(formData.get("zip") || "").trim() || null;
  const city = String(formData.get("city") || "").trim() || null;
  const taxId = String(formData.get("taxId") || "").trim() || null;
  const plan = String(formData.get("plan") || "free");

  if (!name || !ownerName || !ownerEmail) {
    throw new Error("Name, Owner-Name und Owner-Email sind Pflicht");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error("Owner-Email ist ungültig");
  }

  const emailExists = await prisma.workshopUser.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });
  if (emailExists) {
    throw new Error(`Ein Benutzer mit ${ownerEmail} existiert bereits`);
  }

  const slug = await uniqueWorkshopSlug(name);
  const token = newToken();

  const workshop = await prisma.workshop.create({
    data: {
      name,
      slug,
      contactEmail: ownerEmail,
      contactPhone,
      street,
      zip,
      city,
      taxId,
      ownerEmail,
      plan,
      users: {
        create: {
          email: ownerEmail,
          name: ownerName,
          role: "owner",
          active: true,
          passwordSetupToken: token,
          passwordSetupExpires: tokenExpiry(),
        },
      },
    },
  });

  // Standard-Katalog auto-seed (kann später via /app/services erweitert werden)
  try {
    await prisma.serviceItem.createMany({
      data: STANDARD_CATALOG.map((c) => ({
        workshopId: workshop.id,
        category: c.category,
        name: c.name,
        description: c.description ?? null,
        laborHours: c.laborHours,
        netPriceCent: 0,
        vatPercent: 19,
        unit: "Std",
        active: true,
      })),
    });
  } catch (e) {
    console.error("[createWorkshop] catalog-seed failed", e);
  }

  try {
    await sendPasswordSetupMail({
      to: ownerEmail,
      recipientName: ownerName,
      workshopName: name,
      token,
      variant: "welcome",
    });
  } catch (e) {
    console.error("[createWorkshop] mail failed", e);
  }

  revalidatePath("/admin/workshops");
  redirect(`/admin/workshops/${workshop.id}`);
}

export async function toggleWorkshopActiveAction(formData: FormData) {
  await requireKbAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!id) throw new Error("Werkstatt-ID fehlt");
  await prisma.workshop.update({ where: { id }, data: { active } });
  revalidatePath(`/admin/workshops/${id}`);
  revalidatePath("/admin/workshops");
}

export async function updateWorkshopPlanAction(formData: FormData) {
  await requireKbAdmin();
  const id = String(formData.get("id") || "");
  const plan = String(formData.get("plan") || "free");
  if (!id) throw new Error("Werkstatt-ID fehlt");
  await prisma.workshop.update({ where: { id }, data: { plan } });
  revalidatePath(`/admin/workshops/${id}`);
  revalidatePath("/admin/workshops");
}

export async function resendWorkshopUserSetupMailAction(formData: FormData) {
  await requireKbAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) throw new Error("User-ID fehlt");
  const user = await prisma.workshopUser.findUnique({
    where: { id: userId },
    include: { workshop: { select: { name: true, id: true } } },
  });
  if (!user) throw new Error("User nicht gefunden");

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
    variant: user.role === "owner" ? "welcome" : "team-invite",
  });

  revalidatePath(`/admin/workshops/${user.workshop.id}`);
}
