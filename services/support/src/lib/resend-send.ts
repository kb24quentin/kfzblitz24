import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { getFromAddress, getReplyToAddress, wrapEmailHtml, htmlToPlainText } from "@/lib/email";
import { insertToGmailSent } from "@/lib/gmail";
import { isFullHtmlDocument } from "@/lib/mail-template";
import { ensureCodeInSubject } from "@/lib/ticket-code";
import {
  getAutoAckEnabled,
  getAutoAckSubject,
  getAutoAckBody,
  getSlaFirstResponseHours,
  substituteAckVariables,
} from "@/lib/settings";

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
  /** When false, skip auto-appending the author's signature. Default true. */
  appendSignature?: boolean;
  /** reply | acknowledgement | resend — default 'reply' */
  kind?: "reply" | "acknowledgement" | "resend";
  /** For resends: FK to the original message we're resending */
  resentFromId?: string | null;
  /** For acknowledgements: don't set firstResponseAt (ack is not a real response) */
  countsAsFirstResponse?: boolean;
};

/**
 * Sends the auto-acknowledgement to the customer on new inbound tickets.
 * Idempotent: does nothing if the ticket already has an acknowledgement message.
 * Does NOT count as first-response (SLA metric stays honest).
 */
export async function sendAcknowledgement(ticketId: string): Promise<void> {
  if (!(await getAutoAckEnabled())) return;

  const [ticket, existingAck] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { contact: true },
    }),
    prisma.message.findFirst({
      where: { ticketId, kind: "acknowledgement" },
      select: { id: true },
    }),
  ]);
  if (!ticket || existingAck) return;

  const [subjectTpl, bodyTpl, slaHours] = await Promise.all([
    getAutoAckSubject(),
    getAutoAckBody(),
    getSlaFirstResponseHours(),
  ]);

  const ctx = {
    ticketNumber: ticket.number,
    ticketCode: ticket.code,
    ticketSubject: ticket.subject,
    contact: ticket.contact,
    slaFirstResponseHours: slaHours,
  };
  const subject = substituteAckVariables(subjectTpl, ctx);
  const bodyHtml = substituteAckVariables(bodyTpl, ctx);

  await sendMailAndPersist({
    ticketId,
    subject,
    bodyHtml,
    authorUserId: null,
    kind: "acknowledgement",
    appendSignature: false,
    countsAsFirstResponse: false,
  });
}

async function loadSignatureHtml(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const sig = await prisma.signature.findUnique({ where: { userId } });
  return sig?.html?.trim() || null;
}

function joinBodyWithSignature(bodyHtml: string, signatureHtml: string | null): string {
  if (!signatureHtml) return bodyHtml;
  // Skip if signature is already present verbatim (idempotent for AI-approved drafts)
  if (bodyHtml.includes(signatureHtml)) return bodyHtml;
  return `${bodyHtml}\n<br><br>\n${signatureHtml}`;
}

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
  appendSignature = true,
  kind = "reply",
  resentFromId = null,
  countsAsFirstResponse = true,
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
  const rawSubject =
    subject?.trim() || (ticket.subject.startsWith("Re: ") ? ticket.subject : `Re: ${ticket.subject}`);
  // Ensure ticket code marker in subject so customer replies thread back to this ticket
  // even if their client strips In-Reply-To (Outlook, some webmails).
  const finalSubject = ensureCodeInSubject(rawSubject, ticket.code);

  // `bodyHtml` may be a bare inner-content fragment (typical, from the
  // TipTap composer or from the ack template) OR a pre-wrapped full HTML
  // document (rare — legacy resend of pre-refactor messages). The double-
  // wrap check below keeps both cases correct.
  const signatureHtml = appendSignature ? await loadSignatureHtml(authorUserId) : null;
  const innerContentRaw = joinBodyWithSignature(bodyHtml, signatureHtml);
  // Embed the ticket code as an HTML comment right before the body — invisible
  // to the customer but preserved by most mail clients on reply, giving us a
  // fallback thread anchor when the subject marker gets stripped.
  const innerContent = `<!-- TICKET-REF:${ticket.code} -->\n${innerContentRaw}`;
  const wrappedHtml = isFullHtmlDocument(innerContent)
    ? innerContent
    : wrapEmailHtml(innerContent, { ticketCode: ticket.code });
  const plainText =
    htmlToPlainText(innerContent) +
    `\n\n---\nReferenznummer: #${ticket.code}\nBitte bei Antwort im Betreff belassen.`;

  // Build In-Reply-To / References to preserve threading
  const inReplyTo = lastMsg?.messageIdHeader || undefined;
  const headers: Record<string, string> = {
    // Custom header — some clients pass it through on reply.
    "X-KB24-Ticket": ticket.code,
  };
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

  // Persist the INNER content (not the branded wrap) — display in the ticket
  // thread renders it as a fragment, and a future resend applies a fresh wrap.
  const message = await prisma.message.create({
    data: {
      ticketId,
      authorUserId: authorUserId ?? null,
      direction: "outbound",
      kind,
      resentFromId,
      fromEmail: from,
      toEmail: to,
      subject: finalSubject,
      bodyHtml: innerContent,
      bodyText: plainText,
      resendMessageId: resendId,
      inReplyTo,
      aiGenerated,
      sentAt: new Date(),
    },
  });

  // Post-processing in one transaction: event + firstResponseAt + draft-approve
  const eventType =
    kind === "acknowledgement"
      ? "acknowledgement_sent"
      : kind === "resend"
        ? "message_resent"
        : aiGenerated
          ? "ai_auto_sent"
          : "message_sent";

  const updates: Promise<unknown>[] = [
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: authorUserId ?? null,
        type: eventType,
        meta: JSON.stringify({ messageId: message.id, resendId, resentFromId }),
      },
    }),
  ];

  if (!ticket.firstResponseAt && countsAsFirstResponse) {
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
