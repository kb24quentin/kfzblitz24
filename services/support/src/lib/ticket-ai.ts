import { prisma } from "@/lib/db";
import { classifyAndDraft, isAiConfigured, aiModel } from "@/lib/ai";
import { sendMailAndPersist } from "@/lib/resend-send";
import { getAutoSendCategories, getAutoSendMinConfidence } from "@/lib/settings";

/**
 * Generates an AI draft for the newest inbound message on a ticket.
 * If confidence is high enough AND the category is auto-send-whitelisted,
 * the draft is sent immediately (skipping human review). Otherwise it lands
 * as a pending draft on the ticket for a human to approve.
 *
 * @param options.force  If true, marks any existing pending draft as
 *                       'superseded' before generating a fresh one. Used by
 *                       the manual "Neu erzeugen"-button in the UI.
 */
export async function generateDraftForTicket(
  ticketId: string,
  options?: { force?: boolean }
): Promise<void> {
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

  const force = options?.force === true;

  const existingPending = await prisma.aiDraft.findFirst({
    where: {
      ticketId,
      status: "pending",
      createdAt: { gt: lastInbound.createdAt },
    },
  });
  if (existingPending && !force) return;
  if (existingPending && force) {
    await prisma.aiDraft.update({
      where: { id: existingPending.id },
      data: { status: "superseded" },
    });
  }

  const templates = await prisma.template.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      shortcode: true,
      name: true,
      category: true,
      subject: true,
      bodyHtml: true,
    },
  });

  const result = await classifyAndDraft({
    subject: ticket.subject,
    fromEmail: ticket.contact.email,
    fromName: ticket.contact.name,
    customerFirstName: ticket.contact.firstName,
    customerLastName: ticket.contact.lastName,
    bodyText: lastInbound.bodyText || lastInbound.bodyHtml.replace(/<[^>]+>/g, ""),
    ticketCode: ticket.code,
    templates,
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

  // Only sharpen priority — never soften. AI can escalate but not de-escalate.
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
          templateUsed: result.templateUsed,
          autoSendEligible: eligible,
          reasoning: result.reasoning,
          forced: force,
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
