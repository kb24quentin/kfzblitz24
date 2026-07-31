"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getFromAddress, wrapEmailHtml, htmlToPlainText, getListUnsubscribeHeaders } from "@/lib/email";
import { revalidatePath } from "next/cache";

export type TestEmailState = { ok: boolean; message: string };

export async function sendTestEmail(
  _prev: TestEmailState,
  formData: FormData
): Promise<TestEmailState> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Nicht eingeloggt." };

  const to = (formData.get("to") as string | null)?.trim() ?? "";
  const subject = (formData.get("subject") as string | null)?.trim() ?? "";
  const body = (formData.get("body") as string | null) ?? "";

  if (!to || !subject || !body.trim()) {
    return { ok: false, message: "Bitte alle Felder ausfüllen." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, message: "Ungültige Empfänger-Adresse." };
  }
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, message: "RESEND_API_KEY ist auf dem Server nicht gesetzt." };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: getFromAddress(),
      to: [to],
      subject,
      html: wrapEmailHtml(body),
      text: htmlToPlainText(body),
      headers: getListUnsubscribeHeaders(),
    });

    if (result.error) {
      return { ok: false, message: `Resend-Fehler: ${result.error.message}` };
    }
    return {
      ok: true,
      message: `Versendet an ${to} (Resend ID: ${result.data?.id ?? "—"}).`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Fehler: ${msg}` };
  }
}

export async function createUser(formData: FormData) {
  // Password ist obsolet — login läuft ausschließlich via Google SSO.
  await prisma.user.create({
    data: {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: (formData.get("role") as string) || "user",
    },
  });

  revalidatePath("/settings");
}

export async function updateUser(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.user.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: (formData.get("role") as string) || "user",
    },
  });
  revalidatePath("/settings");
}

export async function toggleUserActive(formData: FormData) {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  await prisma.user.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/settings");
}

// ─── Signatures ─────────────────────────────────────────────────────────

export async function createSignature(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const html = (formData.get("html") as string) ?? "";
  if (!name || !html.trim()) return;
  await prisma.signature.create({ data: { name, html } });
  revalidatePath("/settings");
}

export async function updateSignature(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const html = (formData.get("html") as string) ?? "";
  if (!id || !name || !html.trim()) return;
  await prisma.signature.update({ where: { id }, data: { name, html } });
  revalidatePath("/settings");
}

export async function deleteSignature(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.signature.delete({ where: { id } });
  revalidatePath("/settings");
}

// ─── Senders (Absender) ─────────────────────────────────────────────────

export async function createSender(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!name || !email) return;
  await prisma.sender.create({ data: { name, email } });
  revalidatePath("/settings");
}

export async function updateSender(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!id || !name || !email) return;
  await prisma.sender.update({ where: { id }, data: { name, email } });
  revalidatePath("/settings");
}

export async function deleteSender(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.sender.delete({ where: { id } });
  revalidatePath("/settings");
}
