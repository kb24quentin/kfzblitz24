"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function extractVariables(html: string): string[] {
  const matches = html.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

export async function createTemplate(formData: FormData) {
  const type = ((formData.get("type") as string) || "email") as "email" | "letter";
  const bodyHtml = formData.get("bodyHtml") as string;
  const letterPs = (formData.get("letterPs") as string) || null;
  // Signaturen sind ein Email-Konzept. Bei Brief-Templates ignorieren.
  const signatureId = type === "email"
    ? ((formData.get("signatureId") as string) || null)
    : null;
  const variables = extractVariables(bodyHtml + " " + (letterPs ?? ""));

  await prisma.template.create({
    data: {
      name: formData.get("name") as string,
      type,
      subject: formData.get("subject") as string,
      bodyHtml,
      bodyText: (formData.get("bodyText") as string) || null,
      signatureId,
      letterPs: type === "letter" ? letterPs : null,
      variables: JSON.stringify(variables),
    },
  });
  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplate(formData: FormData) {
  const id = formData.get("id") as string;
  const type = ((formData.get("type") as string) || "email") as "email" | "letter";
  const bodyHtml = formData.get("bodyHtml") as string;
  const letterPs = (formData.get("letterPs") as string) || null;
  const signatureId = type === "email"
    ? ((formData.get("signatureId") as string) || null)
    : null;
  const variables = extractVariables(bodyHtml + " " + (letterPs ?? ""));

  await prisma.template.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      type,
      subject: formData.get("subject") as string,
      bodyHtml,
      bodyText: (formData.get("bodyText") as string) || null,
      signatureId,
      letterPs: type === "letter" ? letterPs : null,
      variables: JSON.stringify(variables),
    },
  });
  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplate(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.template.delete({ where: { id } });
  revalidatePath("/templates");
}
