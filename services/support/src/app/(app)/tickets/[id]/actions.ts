"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendMailAndPersist } from "@/lib/resend-send";
import { computeSlaDeadlines } from "@/lib/settings";
import { TICKET_STATUSES } from "@/lib/status";
import { generateTicketCode } from "@/lib/ticket-code";

async function requireUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Nicht angemeldet");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User nicht gefunden");
  return user;
}

/**
 * Send a reply, optionally changing status in the same action.
 * `statusAfter` values: 'keep' | 'open' | 'pending' | 'on_hold' | 'resolved' | 'closed'
 * Default is 'pending' (Warten auf Kunde).
 */
export async function sendReplyAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  const draftId = String(formData.get("draftId") || "") || null;
  const statusAfter = String(formData.get("statusAfter") || "pending");

  if (!ticketId || !bodyHtml) throw new Error("Ticket-ID + Body erforderlich");

  await sendMailAndPersist({
    ticketId,
    subject,
    bodyHtml,
    authorUserId: user.id,
    aiGenerated: !!draftId,
    approvedDraftId: draftId,
  });

  if (
    statusAfter &&
    statusAfter !== "keep" &&
    (TICKET_STATUSES as readonly string[]).includes(statusAfter)
  ) {
    await setStatusAction(ticketId, statusAfter);
  }

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
  if (!(TICKET_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Ungültiger Status: " + status);
  }

  const resolvedAt =
    status === "resolved" || status === "closed"
      ? existing.resolvedAt ?? new Date()
      : null;

  // Clear snooze when leaving on_hold
  const clearSnooze = status !== "on_hold" && existing.snoozedUntil !== null;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        resolvedAt,
        ...(clearSnooze ? { snoozedUntil: null, snoozedReason: null } : {}),
      },
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

export async function snoozeTicketAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const until = String(formData.get("until") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;

  if (!ticketId || !until) throw new Error("Ticket + Zeitpunkt erforderlich");
  const dt = new Date(until);
  if (isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
    throw new Error("Zeitpunkt muss in der Zukunft liegen");
  }

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "on_hold",
        snoozedUntil: dt,
        snoozedReason: reason,
      },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "snoozed",
        meta: JSON.stringify({ until: dt.toISOString(), reason }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/");
}

export async function wakeTicketAction(ticketId: string) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: existing.status === "on_hold" ? "open" : existing.status,
        snoozedUntil: null,
        snoozedReason: null,
      },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "woken",
        meta: null,
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/");
}

export async function addOrderAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const ref = String(formData.get("ref") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  if (!ticketId || !ref) return;

  await prisma.ticketOrder.create({
    data: { ticketId, ref, note },
  });
  await prisma.ticketEvent.create({
    data: {
      ticketId,
      userId: user.id,
      type: "order_added",
      meta: JSON.stringify({ ref }),
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function removeOrderAction(orderId: string) {
  const user = await requireUser();
  const existing = await prisma.ticketOrder.findUnique({ where: { id: orderId } });
  if (!existing) return;
  await prisma.ticketOrder.delete({ where: { id: orderId } });
  await prisma.ticketEvent.create({
    data: {
      ticketId: existing.ticketId,
      userId: user.id,
      type: "order_removed",
      meta: JSON.stringify({ ref: existing.ref }),
    },
  });
  revalidatePath(`/tickets/${existing.ticketId}`);
}

export async function resendMessageAction(messageId: string) {
  const user = await requireUser();
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error("Nachricht nicht gefunden");
  if (msg.direction !== "outbound") throw new Error("Nur ausgehende Nachrichten können erneut gesendet werden");

  await sendMailAndPersist({
    ticketId: msg.ticketId,
    subject: msg.subject || undefined,
    bodyHtml: msg.bodyHtml,
    authorUserId: user.id,
    appendSignature: false, // original already has signature
    kind: "resend",
    resentFromId: msg.id,
    countsAsFirstResponse: false, // resend of an existing message is not a NEW first response
  });

  revalidatePath(`/tickets/${msg.ticketId}`);
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
  const orderRefsRaw = String(formData.get("orderRefs") || "").trim();
  const orderRefs = orderRefsRaw
    ? orderRefsRaw
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

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

  const now = new Date();
  const { firstResponseDueAt, resolutionDueAt } = await computeSlaDeadlines(now);
  const code = await generateTicketCode();

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      code,
      priority,
      contactId: contact.id,
      firstResponseDueAt,
      resolutionDueAt,
      orders: orderRefs.length
        ? { create: orderRefs.map((ref) => ({ ref })) }
        : undefined,
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
              createdAt: now,
            },
          }),
        ]
      : []),
    prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        userId: user.id,
        type: "created",
        meta: JSON.stringify({ source: "manual", orderRefs }),
      },
    }),
  ]);

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}
