import { prisma } from "@/lib/db";
import { classifyAndDraft, isAiConfigured, aiModel } from "@/lib/ai";
import { calculateCost } from "@/lib/ai-pricing";
import { sendMailAndPersist } from "@/lib/resend-send";
import { getAutoSendCategories, getAutoSendMinConfidence, pickAiAutosendDelayMs } from "@/lib/settings";
import { summarizeBeleg, type Beleg } from "@/lib/webisco-lookup";
import { pickWeightedAiPersona } from "@/lib/ai-personas";

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
      orders: {
        where: { emailMatched: true },
        orderBy: { createdAt: "desc" },
      },
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

  const linkedOrders = ticket.orders
    .filter((o) => o.webiscoData)
    .map((o) => {
      try {
        const beleg = JSON.parse(o.webiscoData as string) as Beleg;
        return { ref: o.ref, summary: summarizeBeleg(beleg) };
      } catch {
        return null;
      }
    })
    .filter((x): x is { ref: string; summary: string } => x !== null);

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
    linkedOrders,
  });

  const [autoSendCats, minConf] = await Promise.all([
    getAutoSendCategories(),
    getAutoSendMinConfidence(),
  ]);
  const eligible =
    result.confidence >= minConf && autoSendCats.has(result.category);

  // Bei autosend: AI-persona picken (weighted) und delay bestimmen.
  // Beides nur wenn autosend eligible — manuelle drafts nutzen agent-signatur.
  const persona = eligible ? await pickWeightedAiPersona() : null;
  const delayMs = eligible ? await pickAiAutosendDelayMs() : 0;
  const scheduledSendAt = eligible ? new Date(Date.now() + delayMs) : null;

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
      aiPersonaId: persona?.id ?? null,
      scheduledSendAt,
    },
  });

  const cost = calculateCost(
    result.usage.model,
    result.usage.promptTokens,
    result.usage.completionTokens,
    result.usage.cachedTokens,
  );
  await prisma.aiUsage.create({
    data: {
      ticketId,
      aiDraftId: draft.id,
      model: result.usage.model,
      purpose: force ? "regenerate" : "draft",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      cachedTokens: result.usage.cachedTokens,
      inputCostUsd: cost.inputCostUsd,
      outputCostUsd: cost.outputCostUsd,
      totalCostUsd: cost.totalCostUsd,
      latencyMs: result.usage.latencyMs,
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
    // Delay ist bewusst NICHT-blocking — wir feuern setTimeout und return
    // sofort. Cron /api/cron/sla-check ist der safety-net-fallback falls der
    // process während des delays neustartet (deploy etc.) — er picken alle
    // approved drafts mit scheduledSendAt <= now die noch nicht gesendet sind.
    if (delayMs > 0) {
      setTimeout(() => {
        dispatchScheduledSend(draft.id).catch((err) =>
          console.warn("[ticket-ai] scheduled send failed:", err instanceof Error ? err.message : err),
        );
      }, delayMs);
      console.log(`[ticket-ai] AI-autosend scheduled ${Math.round(delayMs / 1000)}s (draft=${draft.id}, persona=${persona?.name ?? "none"})`);
    } else {
      await dispatchScheduledSend(draft.id);
    }
  }
}

/**
 * Sendet einen scheduled AI-draft (aufgerufen von setTimeout ODER vom
 * cron-safety-net). Idempotent: prüft draft.status vor send damit ein
 * bereits gesendeter/rejected draft nicht doppelt rausgeht.
 */
export async function dispatchScheduledSend(draftId: string): Promise<void> {
  const draft = await prisma.aiDraft.findUnique({
    where: { id: draftId },
    include: { aiPersona: { select: { name: true, position: true } } },
  });
  if (!draft) return;
  if (draft.status !== "approved") return; // already sent, rejected, or superseded
  if (!draft.autoSendEligible) return;

  await sendMailAndPersist({
    ticketId: draft.ticketId,
    subject: draft.subject,
    bodyHtml: draft.bodyHtml,
    aiGenerated: true,
    approvedDraftId: draft.id,
    aiPersona: draft.aiPersona
      ? { name: draft.aiPersona.name, position: draft.aiPersona.position }
      : null,
  });
}
