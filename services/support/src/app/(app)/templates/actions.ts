"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht angemeldet");
  return session.user.email;
}

function extractVariables(html: string, subject: string): string[] {
  const combined = subject + " " + html;
  const matches = combined.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1])));
}

function normalizeShortcode(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^::/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return cleaned || null;
}

export async function createTemplateAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  const shortcode = normalizeShortcode(String(formData.get("shortcode") || ""));
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  if (!name || !subject || !bodyHtml) throw new Error("Name + Betreff + Body erforderlich");

  if (shortcode) {
    const clash = await prisma.template.findUnique({ where: { shortcode } });
    if (clash) throw new Error(`Kürzel '::${shortcode}' ist schon vergeben`);
  }

  const variables = extractVariables(bodyHtml, subject);
  await prisma.template.create({
    data: {
      name,
      shortcode,
      subject,
      bodyHtml,
      category,
      variables: JSON.stringify(variables),
    },
  });

  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplateAction(id: string, formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  const shortcode = normalizeShortcode(String(formData.get("shortcode") || ""));
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  if (!name || !subject || !bodyHtml) throw new Error("Name + Betreff + Body erforderlich");

  if (shortcode) {
    const clash = await prisma.template.findFirst({
      where: { shortcode, NOT: { id } },
    });
    if (clash) throw new Error(`Kürzel '::${shortcode}' ist schon vergeben`);
  }

  const variables = extractVariables(bodyHtml, subject);
  await prisma.template.update({
    where: { id },
    data: {
      name,
      shortcode,
      subject,
      bodyHtml,
      category,
      variables: JSON.stringify(variables),
    },
  });

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}/edit`);
  redirect("/templates");
}

export async function deleteTemplateAction(id: string) {
  await requireUser();
  await prisma.template.delete({ where: { id } });
  revalidatePath("/templates");
}
