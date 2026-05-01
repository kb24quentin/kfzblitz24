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
  const bodyHtml = formData.get("bodyHtml") as string;
  const signatureRaw = (formData.get("signature") as string) || "";
  // Both body and signature can carry variables we need to track
  const variables = extractVariables(bodyHtml + signatureRaw);

  await prisma.template.create({
    data: {
      name: formData.get("name") as string,
      subject: formData.get("subject") as string,
      bodyHtml,
      bodyText: (formData.get("bodyText") as string) || null,
      signature: signatureRaw.trim() ? signatureRaw : null,
      variables: JSON.stringify(variables),
    },
  });
  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplate(formData: FormData) {
  const id = formData.get("id") as string;
  const bodyHtml = formData.get("bodyHtml") as string;
  const signatureRaw = (formData.get("signature") as string) || "";
  const variables = extractVariables(bodyHtml + signatureRaw);

  await prisma.template.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      subject: formData.get("subject") as string,
      bodyHtml,
      bodyText: (formData.get("bodyText") as string) || null,
      signature: signatureRaw.trim() ? signatureRaw : null,
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
