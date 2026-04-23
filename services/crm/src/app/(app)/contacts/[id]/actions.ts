"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getFromAddress, wrapEmailHtml, htmlToPlainText } from "@/lib/email";
import { revalidatePath } from "next/cache";

export type SendDirectEmailResult = { ok: boolean; message: string };

export async function sendDirectEmail(
  _prev: SendDirectEmailResult,
  formData: FormData
): Promise<SendDirectEmailResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, message: "Nicht eingeloggt." };

  const contactId = formData.get("contactId") as string;
  const subject = (formData.get("subject") as string)?.trim();
  const body = (formData.get("body") as string) ?? "";

  if (!contactId || !subject || !body.trim()) {
    return { ok: false, message: "Bitte Betreff und Inhalt ausfüllen." };
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { ok: false, message: "Kontakt nicht gefunden." };

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return { ok: false, message: "Benutzer nicht gefunden." };

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, message: "RESEND_API_KEY ist nicht gesetzt." };
  }

  const htmlWrapped = wrapEmailHtml(body);

  let resendId: string | null = null;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: getFromAddress(),
      to: [contact.email],
      subject,
      html: htmlWrapped,
      text: htmlToPlainText(body),
    });
    if (result.error) {
      return { ok: false, message: `Resend-Fehler: ${result.error.message}` };
    }
    resendId = result.data?.id ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Versand fehlgeschlagen: ${msg}` };
  }

  const email = await prisma.email.create({
    data: {
      contactId,
      campaignId: null,
      templateId: null,
      subject,
      body: htmlWrapped,
      status: "sent",
      sentAt: new Date(),
      resendEmailId: resendId,
    },
  });

  await prisma.$transaction([
    prisma.activity.create({
      data: {
        contactId,
        userId: user.id,
        type: "email_sent",
        content: `Direkt-Mail gesendet: ${subject}`,
      },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: new Date() },
    }),
  ]);

  revalidatePath(`/contacts/${contactId}`);
  return { ok: true, message: `Mail gesendet (${email.id})` };
}

async function getCurrentUserId() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return user?.id || null;
}

export async function addComment(contactId: string, content: string) {
  const userId = await getCurrentUserId();
  await prisma.activity.create({
    data: { contactId, userId, type: "comment", content },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function addNote(contactId: string, content: string) {
  const userId = await getCurrentUserId();
  await prisma.activity.create({
    data: { contactId, userId, type: "note", content },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function changeStatus(contactId: string, newStatus: string) {
  const userId = await getCurrentUserId();
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;

  await prisma.$transaction([
    prisma.contact.update({
      where: { id: contactId },
      data: { status: newStatus },
    }),
    prisma.activity.create({
      data: {
        contactId,
        userId,
        type: "status_change",
        content: `Status geaendert`,
        oldValue: contact.status,
        newValue: newStatus,
      },
    }),
  ]);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
}

export async function changePriority(contactId: string, priority: string) {
  await prisma.contact.update({
    where: { id: contactId },
    data: { priority },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function assignContact(contactId: string, userId: string | null) {
  await prisma.contact.update({
    where: { id: contactId },
    data: { assignedToId: userId || null },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function createReminder(formData: FormData) {
  const contactId = formData.get("contactId") as string;
  const userId = await getCurrentUserId();
  if (!userId) return;

  await prisma.$transaction([
    prisma.reminder.create({
      data: {
        contactId,
        userId,
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        dueDate: new Date(formData.get("dueDate") as string),
      },
    }),
    prisma.activity.create({
      data: {
        contactId,
        userId,
        type: "reminder_created",
        content: `Wiedervorlage: ${formData.get("title")}`,
      },
    }),
  ]);
  revalidatePath(`/contacts/${contactId}`);
}

export async function completeReminder(reminderId: string, contactId: string) {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { status: "done" },
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
}

export async function logCall(contactId: string, notes: string) {
  const userId = await getCurrentUserId();
  await prisma.$transaction([
    prisma.activity.create({
      data: { contactId, userId, type: "call", content: notes },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: new Date() },
    }),
  ]);
  revalidatePath(`/contacts/${contactId}`);
}
