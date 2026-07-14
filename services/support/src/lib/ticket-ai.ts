import { prisma } from "@/lib/db";
import { classifyAndDraft, isAiConfigured, aiModel } from "@/lib/ai";
import { sendMailAndPersist } from "@/lib/resend-send";

const AUTO_SEND_MIN_CONFIDENCE = 0.9;

/**
 * Categories where auto-send is allowed IF a rule was explicitly enabled in
 * the Setting store under key "autoSendCategories" (JSON array of strings).
 * By default nothing is auto-sent — humans review everything.
 */
async function getAutoSendCategories(): Promise<Set<string>> {
  const s = await prisma.setting.findUnique({ where: { key: "autoSendCategories" } });
  if (!s?.value) return new Set();
  try {
    const arr = JSON.parse(s.value);
    return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Generates an AI draft for the newest inbound message on a ticket.
 * If confidence is high enough AND the category is auto-send-whitelisted,
 * the draft is sent immediately (skipping human review). Otherwise it lands
 * as a pending draft on the ticket for a human to approve.
 */
export async function generateDraftForTicket(ticketId: string): Promise<void> {
  if (!isAiConfigured()) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return;

  const lastInbound = [...ticket.messages].reverse().find((m) => m.direction === "inbound");
  if (!lastInbound) return;

  // Skip if we already have a pending draft newer than the last inbound
  const existingPending = await prisma.aiDraft.findFirst({
    where: {
      ticketId,
      status: "pending",
      createdAt: { gt: lastInbound.createdAt },
    },
  });
  if (existingPending) return;

  const result = await classifyAndDraft({
    subject: ticket.subject,
    fromEmail: ticket.contact.email,
    fromName: ticket.contact.name,
    bodyText: lastInbound.bodyText || lastInbound.bodyHtml.replace(/<[^>]+>/g, ""),
    ticketNumber: ticket.number,
    previousMessages: ticket.messages.map((m) => ({
      direction: m.direction,
      bodyText: m.bodyText || m.bodyHtml.replace(/<[^>]+>/g, ""),
      createdAt: m.createdAt,
    })),
  });

  const autoSendCats = await getAutoSendCategories();
  const eligible =
    result.confidence >= AUTO_SEND_MIN_CONFIDENCE &&
    autoSendCats.has(result.category);

  const draft = await prisma.aiDraft.create({
    data: {
      ticketId,
      model: aiModel(),
      subject: result.subject,
      bodyHtml: result.bodyHtml,
      confidence: result.confidence,
      category: result.category,
      autoSendEligible: eligible,
      status: eligible ? "approved" : "pending",
    },
  });

  // Also update ticket category + priority (only sharpen priority, never soften)
  const priorityRank: Record<string, number> = { low: 1, normal: 2, high: 3, urgent: 4 };
  const currentPri = priorityRank[ticket.priority] ?? 2;
  const suggestedPri = priorityRank[result.priority] ?? 2;
  const newPri = suggestedPri > currentPri ? result.priority : ticket.priority;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { category: result.category, priority: newPri },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        type: "ai_drafted",
        meta: JSON.stringify({
          draftId: draft.id,
          category: result.category,
          priority: result.priority,
          confidence: result.confidence,
          autoSendEligible: eligible,
        }),
      },
    }),
  ]);

  if (eligible) {
    await sendMailAndPersist({
      ticketId,
      subject: result.subject,
      bodyHtml: result.bodyHtml,
      aiGenerated: true,
      approvedDraftId: draft.id,
    });
  }
}
