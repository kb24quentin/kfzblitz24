import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { getFromAddress, getReplyToAddress, wrapEmailHtml, htmlToPlainText } from "@/lib/email";
import { insertToGmailSent } from "@/lib/gmail";

let _resend: Resend | null = null;
function client(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  _resend = new Resend(key);
  return _resend;
}

type SendArgs = {
  ticketId: string;
  subject?: string;
  bodyHtml: string;
  authorUserId?: string | null;
  aiGenerated?: boolean;
  approvedDraftId?: string | null;
};

/**
 * Sends a reply via Resend, persists it as an outbound Message on the ticket,
 * inserts a copy into the Gmail Sent folder so the team sees the thread in
 * Gmail as fallback, and (if resolved-worthy) updates ticket SLA fields.
 */
export async function sendMailAndPersist({
  ticketId,
  subject,
  bodyHtml,
  authorUserId,
  aiGenerated = false,
  approvedDraftId = null,
}: SendArgs) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!ticket) throw new Error("Ticket nicht gefunden");

  const to = ticket.contact.email;
  const lastMsg = ticket.messages[0];
  const finalSubject =
    subject?.trim() || (ticket.subject.startsWith("Re: ") ? ticket.subject : `Re: ${ticket.subject}`);

  const wrappedHtml = wrapEmailHtml(bodyHtml);
  const plainText = htmlToPlainText(bodyHtml);

  // Build In-Reply-To / References to preserve threading
  const inReplyTo = lastMsg?.messageIdHeader || undefined;
  const headers: Record<string, string> = {};
  if (inReplyTo) {
    headers["In-Reply-To"] = inReplyTo;
    headers["References"] = inReplyTo;
  }

  const from = getFromAddress();
  const replyTo = getReplyToAddress();

  const res = await client().emails.send({
    from,
    to,
    replyTo,
    subject: finalSubject,
    html: wrappedHtml,
    text: plainText,
    headers,
  });

  if (res.error) {
    throw new Error(`Resend send failed: ${res.error.message}`);
  }
  const resendId = res.data?.id;

  // Persist as outbound Message
  const message = await prisma.message.create({
    data: {
      ticketId,
      authorUserId: authorUserId ?? null,
      direction: "outbound",
      fromEmail: from,
      toEmail: to,
      subject: finalSubject,
      bodyHtml: wrappedHtml,
      bodyText: plainText,
      resendMessageId: resendId,
      inReplyTo,
      aiGenerated,
      sentAt: new Date(),
    },
  });

  // Post-processing in one transaction: event + firstResponseAt + draft-approve
  const updates: Promise<unknown>[] = [
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: authorUserId ?? null,
        type: aiGenerated ? "ai_auto_sent" : "message_sent",
        meta: JSON.stringify({ messageId: message.id, resendId }),
      },
    }),
  ];

  if (!ticket.firstResponseAt) {
    updates.push(
      prisma.ticket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      })
    );
  }

  if (approvedDraftId) {
    updates.push(
      prisma.aiDraft.update({
        where: { id: approvedDraftId },
        data: {
          status: "sent",
          reviewedById: authorUserId ?? null,
          reviewedAt: new Date(),
        },
      })
    );
  }

  await Promise.all(updates);

  // Best-effort: mirror into Gmail Sent so agents see the thread in Gmail.
  // Fails silently — Gmail may not be configured yet.
  try {
    await insertToGmailSent({
      threadId: ticket.gmailThreadId,
      from,
      to,
      subject: finalSubject,
      bodyHtml: wrappedHtml,
      bodyText: plainText,
      inReplyTo,
    });
  } catch (err) {
    console.warn("[resend-send] Gmail Sent-insert failed:", err instanceof Error ? err.message : err);
  }

  return { messageId: message.id, resendId };
}
