import { prisma } from "@/lib/db";
import { gmail, isGmailConfigured, getGmailUserEmail } from "@/lib/gmail";
import { generateDraftForTicket } from "@/lib/ticket-ai";
import { splitName } from "@/lib/name-parse";

const INGEST_LABEL_NAME = "kb24-support-ingested";
let cachedLabelId: string | null = null;

async function getIngestLabelId(): Promise<string> {
  if (cachedLabelId) return cachedLabelId;
  const g = await gmail();
  const labels = await g.users.labels.list({ userId: "me" });
  const found = labels.data.labels?.find((l) => l.name === INGEST_LABEL_NAME);
  if (found?.id) {
    cachedLabelId = found.id;
    return found.id;
  }
  const created = await g.users.labels.create({
    userId: "me",
    requestBody: {
      name: INGEST_LABEL_NAME,
      labelListVisibility: "labelHide",
      messageListVisibility: "hide",
    },
  });
  cachedLabelId = created.data.id!;
  return cachedLabelId;
}

type Parsed = {
  gmailMessageId: string;
  gmailThreadId: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  messageIdHeader: string | null;
  inReplyTo: string | null;
  bodyHtml: string;
  bodyText: string;
  receivedAt: Date;
};

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBodies(payload: {
  mimeType?: string | null;
  body?: { data?: string | null; size?: number | null } | null;
  parts?: unknown[] | null;
}): { html: string; text: string } {
  let html = "";
  let text = "";

  const walk = (p: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: unknown[] | null;
  }) => {
    if (p.body?.data) {
      const decoded = decodeB64Url(p.body.data);
      if (p.mimeType === "text/html" && !html) html = decoded;
      else if (p.mimeType === "text/plain" && !text) text = decoded;
    }
    if (p.parts && Array.isArray(p.parts)) {
      for (const child of p.parts) walk(child as Parameters<typeof walk>[0]);
    }
  };
  walk(payload);

  if (!html && text) {
    html = `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
  }
  if (!text && html) {
    text = html
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFrom(fromHeader: string): { email: string; name: string | null } {
  const m = fromHeader.match(/^\s*(?:"?([^"<]*?)"?\s*)?<?([^\s>]+@[^\s>]+)>?\s*$/);
  if (!m) return { email: fromHeader.trim().toLowerCase(), name: null };
  const name = m[1]?.trim() || null;
  return { email: m[2].trim().toLowerCase(), name };
}

async function parseMessage(id: string): Promise<Parsed | null> {
  const g = await gmail();
  const msg = await g.users.messages.get({ userId: "me", id, format: "full" });
  const payload = msg.data.payload;
  if (!payload || !msg.data.id || !msg.data.threadId) return null;

  const headers = new Map<string, string>();
  for (const h of payload.headers || []) {
    if (h.name && h.value) headers.set(h.name.toLowerCase(), h.value);
  }

  const from = parseFrom(headers.get("from") || "");
  const to = headers.get("to") || "";
  const subject = headers.get("subject") || "(kein Betreff)";
  const messageIdHeader = headers.get("message-id") || null;
  const inReplyTo = headers.get("in-reply-to") || null;
  const dateStr = headers.get("date");
  const receivedAt = dateStr ? new Date(dateStr) : msg.data.internalDate
    ? new Date(Number(msg.data.internalDate))
    : new Date();

  const bodies = extractBodies(payload);

  return {
    gmailMessageId: msg.data.id,
    gmailThreadId: msg.data.threadId,
    fromEmail: from.email,
    fromName: from.name,
    toEmail: to,
    subject,
    messageIdHeader,
    inReplyTo,
    bodyHtml: bodies.html,
    bodyText: bodies.text,
    receivedAt,
  };
}

async function findOrCreateTicket(p: Parsed): Promise<{ ticketId: string; isNew: boolean }> {
  // 1. Try to find ticket by gmailThreadId
  const byThread = await prisma.ticket.findFirst({
    where: { gmailThreadId: p.gmailThreadId },
  });
  if (byThread) {
    // Reopen if resolved/closed
    if (["resolved", "closed"].includes(byThread.status)) {
      await prisma.ticket.update({
        where: { id: byThread.id },
        data: { status: "open", resolvedAt: null },
      });
    }
    return { ticketId: byThread.id, isNew: false };
  }

  // 2. Try to find ticket by In-Reply-To → message.messageIdHeader
  if (p.inReplyTo) {
    const byReply = await prisma.message.findFirst({
      where: { messageIdHeader: p.inReplyTo },
      select: { ticketId: true },
    });
    if (byReply) {
      await prisma.ticket.update({
        where: { id: byReply.ticketId },
        data: { gmailThreadId: p.gmailThreadId },
      });
      return { ticketId: byReply.ticketId, isNew: false };
    }
  }

  // 3. New ticket
  const { firstName, lastName } = splitName(p.fromName);
  const contact = await prisma.contact.upsert({
    where: { email: p.fromEmail },
    create: { email: p.fromEmail, name: p.fromName, firstName, lastName },
    update: p.fromName ? { name: p.fromName } : {},
  });

  // Backfill first/last if the contact doesn't have them yet (never overwrite)
  if ((firstName || lastName) && (!contact.firstName || !contact.lastName)) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        firstName: contact.firstName || firstName,
        lastName: contact.lastName || lastName,
      },
    });
  }

  const slaHours = Number(process.env.SLA_HOURS || "24");
  const slaDueAt = new Date(p.receivedAt.getTime() + slaHours * 3600_000);

  const cleanSubject = p.subject.replace(/^(Re|Aw|Fwd|Wg):\s*/gi, "");

  const ticket = await prisma.ticket.create({
    data: {
      subject: cleanSubject,
      contactId: contact.id,
      slaDueAt,
      gmailThreadId: p.gmailThreadId,
    },
  });

  await prisma.ticketEvent.create({
    data: {
      ticketId: ticket.id,
      type: "created",
      meta: JSON.stringify({ source: "gmail", threadId: p.gmailThreadId }),
    },
  });

  return { ticketId: ticket.id, isNew: true };
}

export async function ingestMessage(id: string): Promise<{ ticketId: string; isNew: boolean } | null> {
  const parsed = await parseMessage(id);
  if (!parsed) return null;

  // Skip messages from ourselves (avoid ingesting our own outbound as inbound)
  const ourEmail = (await getGmailUserEmail())?.toLowerCase();
  if (ourEmail && parsed.fromEmail === ourEmail) return null;

  // Deduplicate by gmailMessageId
  const existing = await prisma.message.findUnique({
    where: { gmailMessageId: parsed.gmailMessageId },
    select: { id: true, ticketId: true },
  });
  if (existing) return { ticketId: existing.ticketId, isNew: false };

  const { ticketId, isNew } = await findOrCreateTicket(parsed);

  await prisma.message.create({
    data: {
      ticketId,
      direction: "inbound",
      fromEmail: parsed.fromEmail,
      toEmail: parsed.toEmail,
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml,
      bodyText: parsed.bodyText,
      gmailMessageId: parsed.gmailMessageId,
      messageIdHeader: parsed.messageIdHeader,
      inReplyTo: parsed.inReplyTo,
      createdAt: parsed.receivedAt,
    },
  });

  await prisma.ticketEvent.create({
    data: {
      ticketId,
      type: "message_received",
      meta: JSON.stringify({ from: parsed.fromEmail, subject: parsed.subject }),
    },
  });

  // Label the Gmail message as ingested + mark read
  try {
    const labelId = await getIngestLabelId();
    const g = await gmail();
    await g.users.messages.modify({
      userId: "me",
      id: parsed.gmailMessageId,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ["UNREAD"],
      },
    });
  } catch (err) {
    console.warn("[gmail-sync] label/read update failed:", err instanceof Error ? err.message : err);
  }

  // Fire and forget: AI draft generation
  generateDraftForTicket(ticketId).catch((err) =>
    console.warn("[gmail-sync] AI draft failed:", err instanceof Error ? err.message : err)
  );

  return { ticketId, isNew };
}

export async function syncGmailInbox(): Promise<{
  found: number;
  ingested: number;
  errors: number;
  newTickets: number;
}> {
  if (!(await isGmailConfigured())) {
    throw new Error("Gmail not configured");
  }

  const g = await gmail();
  const labelId = await getIngestLabelId();

  // Query for unread inbox messages that we haven't already ingested.
  // Excluding by label id via -label:kb24-support-ingested keeps re-processing off.
  const q = `in:inbox is:unread -label:${INGEST_LABEL_NAME}`;
  const list = await g.users.messages.list({ userId: "me", q, maxResults: 50 });
  const items = list.data.messages || [];

  let ingested = 0;
  let errors = 0;
  let newTickets = 0;
  for (const item of items) {
    if (!item.id) continue;
    try {
      const res = await ingestMessage(item.id);
      if (res) {
        ingested++;
        if (res.isNew) newTickets++;
      }
    } catch (err) {
      errors++;
      console.error("[gmail-sync] ingest failed for", item.id, err);
    }
  }

  await prisma.gmailCursor.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastPolledAt: new Date() },
    update: { lastPolledAt: new Date() },
  });

  // Reference labelId to satisfy TS unused-variable rule (we cache it above)
  void labelId;

  return { found: items.length, ingested, errors, newTickets };
}
