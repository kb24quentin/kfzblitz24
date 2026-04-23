"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getFromAddress, wrapEmailHtml, htmlToPlainText } from "@/lib/email";
import bcrypt from "bcryptjs";
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
  const password = formData.get("password") as string;
  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: hashedPassword,
      role: (formData.get("role") as string) || "user",
    },
  });

  revalidatePath("/settings");
}

export async function updateUser(formData: FormData) {
  const id = formData.get("id") as string;
  const data: Record<string, string> = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    role: (formData.get("role") as string) || "user",
  };

  const password = formData.get("password") as string;
  if (password && password.length >= 6) {
    data.password = await bcrypt.hash(password, 12);
  }

  await prisma.user.update({ where: { id }, data });
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
