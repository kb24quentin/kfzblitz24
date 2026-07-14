import { prisma } from "@/lib/db";
import { classifyAndDraft, isAiConfigured, aiModel } from "@/lib/ai";
import { sendMailAndPersist } from "@/lib/resend-send";
import { getAutoSendCategories, getAutoSendMinConfidence } from "@/lib/settings";

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
    customerFirstName: ticket.contact.firstName,
    customerLastName: ticket.contact.lastName,
    bodyText: lastInbound.bodyText || lastInbound.bodyHtml.replace(/<[^>]+>/g, ""),
    ticketCode: ticket.code,
    previousMessages: ticket.messages.map((m) => ({
      direction: m.direction,
      bodyText: m.bodyText || m.bodyHtml.replace(/<[^>]+>/g, ""),
      createdAt: m.createdAt,
    })),
  });

  const [autoSendCats, minConf] = await Promise.all([
    getAutoSendCategories(),
    getAutoSendMinConfidence(),
  ]);
  const eligible =
    result.confidence >= minConf && autoSendCats.has(result.category);

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
