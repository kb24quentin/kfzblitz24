"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendMailAndPersist } from "@/lib/resend-send";

async function requireUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Nicht angemeldet");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User nicht gefunden");
  return user;
}

export async function sendReplyAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  const draftId = String(formData.get("draftId") || "") || null;

  if (!ticketId || !bodyHtml) throw new Error("Ticket-ID + Body erforderlich");

  await sendMailAndPersist({
    ticketId,
    subject,
    bodyHtml,
    authorUserId: user.id,
    aiGenerated: !!draftId,
    approvedDraftId: draftId,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function addNoteAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!ticketId || !body) return;

  await prisma.$transaction([
    prisma.ticketNote.create({
      data: { ticketId, userId: user.id, body },
    }),
    prisma.ticketEvent.create({
      data: { ticketId, userId: user.id, type: "note_added" },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
}

export async function setStatusAction(ticketId: string, status: string) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");

  const resolvedAt =
    status === "resolved" ? existing.resolvedAt ?? new Date() : null;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status, resolvedAt },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "status_changed",
        meta: JSON.stringify({ from: existing.status, to: status }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function setPriorityAction(ticketId: string, priority: string) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { priority } }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "priority_changed",
        meta: JSON.stringify({ from: existing.priority, to: priority }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function setAssigneeAction(
  ticketId: string,
  assigneeId: string | null
) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId } }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "assigned",
        meta: JSON.stringify({
          from: existing.assigneeId,
          to: assigneeId,
        }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function updateContactAction(formData: FormData) {
  await requireUser();
  const contactId = String(formData.get("contactId") || "");
  const firstName = String(formData.get("firstName") || "").trim() || null;
  const lastName = String(formData.get("lastName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const orderRef = String(formData.get("orderRef") || "").trim() || null;
  const ticketId = String(formData.get("ticketId") || "");

  if (!contactId) throw new Error("Kontakt-ID erforderlich");

  const composedName = [firstName, lastName].filter(Boolean).join(" ") || null;

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName,
      lastName,
      name: composedName,
      phone,
      orderRef,
    },
  });

  if (ticketId) revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/contacts");
}

export async function rejectDraftAction(draftId: string, reason?: string) {
  const user = await requireUser();
  await prisma.aiDraft.update({
    where: { id: draftId },
    data: {
      status: "rejected",
      reviewedById: user.id,
      reviewedAt: new Date(),
      rejectedReason: reason?.trim() || null,
    },
  });
  const draft = await prisma.aiDraft.findUnique({ where: { id: draftId } });
  if (draft) revalidatePath(`/tickets/${draft.ticketId}`);
}

export async function createTicketAction(formData: FormData) {
  const user = await requireUser();
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "")
    .trim()
    .toLowerCase();
  const firstName = String(formData.get("firstName") || "").trim() || null;
  const lastName = String(formData.get("lastName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const priority = String(formData.get("priority") || "normal");

  if (!subject || !contactEmail) throw new Error("Betreff + Kunden-Email erforderlich");

  const composedName = [firstName, lastName].filter(Boolean).join(" ") || null;

  const contact = await prisma.contact.upsert({
    where: { email: contactEmail },
    create: {
      email: contactEmail,
      firstName,
      lastName,
      name: composedName,
      phone,
    },
    update: {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(composedName ? { name: composedName } : {}),
      ...(phone ? { phone } : {}),
    },
  });

  const slaHours = Number(process.env.SLA_HOURS || "24");
  const slaDueAt = new Date(Date.now() + slaHours * 3600_000);

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      priority,
      contactId: contact.id,
      slaDueAt,
    },
  });

  await prisma.$transaction([
    ...(bodyHtml
      ? [
          prisma.message.create({
            data: {
              ticketId: ticket.id,
              authorUserId: user.id,
              direction: "outbound",
              fromEmail: user.email,
              toEmail: contact.email,
              subject,
              bodyHtml,
              createdAt: new Date(),
            },
          }),
        ]
      : []),
    prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        userId: user.id,
        type: "created",
        meta: JSON.stringify({ source: "manual" }),
      },
    }),
  ]);

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}
