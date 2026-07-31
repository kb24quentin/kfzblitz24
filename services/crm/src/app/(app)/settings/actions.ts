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

// ─── Test-Brief ─────────────────────────────────────────────────────────

export type TestLetterState = { ok: boolean; message: string };

export async function sendTestLetter(
  _prev: TestLetterState,
  formData: FormData
): Promise<TestLetterState> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Nicht eingeloggt." };

  const company = ((formData.get("company") as string) || "").trim() || null;
  const salutation = ((formData.get("salutation") as string) || "").trim() || null;
  const firstName = ((formData.get("firstName") as string) || "").trim();
  const lastName = ((formData.get("lastName") as string) || "").trim();
  const street = ((formData.get("street") as string) || "").trim();
  const houseNumber = ((formData.get("houseNumber") as string) || "").trim();
  const zipCode = ((formData.get("zipCode") as string) || "").trim();
  const city = ((formData.get("city") as string) || "").trim();

  const subject = ((formData.get("subject") as string) || "").trim();
  const anrede = ((formData.get("anrede") as string) || "").trim();
  const bodyText = ((formData.get("body") as string) || "").trim();
  const ps = ((formData.get("ps") as string) || "").trim() || null;
  const signatureName = ((formData.get("signatureName") as string) || "").trim();

  if (!firstName || !lastName || !street || !zipCode || !city) {
    return { ok: false, message: "Empfänger unvollständig — Vor-/Nachname + Straße + PLZ + Stadt sind Pflicht." };
  }
  if (!subject || !bodyText || !anrede) {
    return { ok: false, message: "Betreff, Anrede und Brieftext sind Pflicht." };
  }
  if (!process.env.OB24_API_KEY) {
    return { ok: false, message: "OB24_API_KEY ist auf dem Server nicht gesetzt." };
  }

  try {
    const { renderLetterPdf } = await import("@/lib/letter-pdf");
    const { sendPrintjob, currentMode } = await import("@/lib/ob24");

    const paragraphs = bodyText
      .split(/\n{2,}/)
      .map((p) => p.trim().replace(/\n+/g, " "))
      .filter(Boolean);

    const pdf = await renderLetterPdf({
      senderName: process.env.LETTER_SENDER_NAME || "kfzBlitz24 GmbH",
      senderLine1: process.env.LETTER_SENDER_LINE1 || "Bomhardstraße 7",
      senderLine2: process.env.LETTER_SENDER_LINE2 || "82031 Grünwald bei München",
      recipient: {
        company,
        salutation,
        firstName,
        lastName,
        street,
        houseNumber: houseNumber || null,
        zipCode,
        city,
        country: "DE",
      },
      anrede,
      subject,
      bodyParagraphs: paragraphs,
      closing: "Mit freundlichen Grüßen",
      signatureName: signatureName || "kfzBlitz24 Team",
      ps,
      footer:
        "kfzBlitz24 GmbH · Bomhardstraße 7 · 82031 Grünwald bei München · " +
        "Geschäftsführer: Christian Engert · HRB 291765 Amtsgericht München · USt-IdNr.: DE367617344",
      versionCode: "AKQ-KB24 · Rev. 07/2026 · v1.0 (TEST)",
    });

    const result = await sendPrintjob({ pdf });
    const mode = currentMode();
    const item = result.items?.[0];
    const cost = item ? (item.amount + item.vat).toFixed(2) : "—";
    const cartHint =
      mode === "test"
        ? " Der Brief liegt jetzt im OnlineBrief24-Warenkorb — bitte dort öffnen und Layout prüfen."
        : " Der Brief wurde bereits produziert und wird versendet.";
    return {
      ok: true,
      message: `Testbrief an OB24 übergeben (${mode}). Job #${result.id} · ${item?.pages ?? "?"} Seiten · ${cost} €.${cartHint}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Versand fehlgeschlagen: ${msg}` };
  }
}
