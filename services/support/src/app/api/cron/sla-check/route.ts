import { checkBearer } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Wakes tickets whose snooze has expired, and flags tickets that have breached
 * their first-response or resolution SLA (once, deduped via events). Runs
 * frequently (every few minutes).
 */
export async function POST(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) return new Response("Unauthorized", { status: auth.status });

  const now = new Date();

  // 1. Auto-wake snoozed tickets
  const dueSnoozed = await prisma.ticket.findMany({
    where: {
      snoozedUntil: { lte: now, not: null },
      status: { notIn: ["resolved", "closed"] },
    },
    select: { id: true, status: true },
  });
  let woken = 0;
  for (const t of dueSnoozed) {
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: t.id },
        data: {
          status: t.status === "on_hold" ? "open" : t.status,
          snoozedUntil: null,
          snoozedReason: null,
        },
      }),
      prisma.ticketEvent.create({
        data: {
          ticketId: t.id,
          type: "woken",
          meta: JSON.stringify({ auto: true }),
        },
      }),
    ]);
    woken++;
  }

  // 2. Flag first-response SLA breach (dedupe via existing event)
  const firstResponseBreaches = await prisma.ticket.findMany({
    where: {
      firstResponseDueAt: { lt: now },
      firstResponseAt: null,
      status: { notIn: ["resolved", "closed"] },
      events: { none: { type: "first_response_sla_breached" } },
    },
    select: { id: true, priority: true },
  });
  for (const t of firstResponseBreaches) {
    await prisma.$transaction([
      prisma.ticketEvent.create({
        data: {
          ticketId: t.id,
          type: "first_response_sla_breached",
          meta: JSON.stringify({ at: now.toISOString() }),
        },
      }),
      ...(t.priority !== "urgent"
        ? [
            prisma.ticket.update({
              where: { id: t.id },
              data: { priority: "urgent" },
            }),
          ]
        : []),
    ]);
  }

  // 3. Flag resolution SLA breach (dedupe via existing event)
  const resolutionBreaches = await prisma.ticket.findMany({
    where: {
      resolutionDueAt: { lt: now },
      status: { notIn: ["resolved", "closed"] },
      events: { none: { type: "resolution_sla_breached" } },
    },
    select: { id: true },
  });
  for (const t of resolutionBreaches) {
    await prisma.ticketEvent.create({
      data: {
        ticketId: t.id,
        type: "resolution_sla_breached",
        meta: JSON.stringify({ at: now.toISOString() }),
      },
    });
  }

  // 4. Auto-close tickets die 7 Tage im 'pending' hängen ohne Kunden-Antwort.
  //    Trigger: status=pending + letzte outbound-message >7d + KEINE inbound
  //    seit dieser outbound. Auto-reopen setzt bei jeder Kunden-antwort den
  //    status zurück auf 'open', deshalb impliziert status=pending: der Kunde
  //    hat seit unserer letzten Antwort nichts mehr geschickt.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const staleForClose = await prisma.ticket.findMany({
    where: {
      status: "pending",
      messages: {
        some: {
          direction: "outbound",
          createdAt: { lte: sevenDaysAgo },
        },
      },
    },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, direction: true },
      },
    },
  });
  let autoClosed = 0;
  for (const t of staleForClose) {
    const last = t.messages[0];
    // Nur schließen wenn die LETZTE nachricht outbound war (kein customer
    // hat zwischen unserem outbound und jetzt geantwortet) UND >7d alt ist.
    if (!last || last.direction !== "outbound" || last.createdAt > sevenDaysAgo) continue;
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: t.id },
        data: {
          status: "closed",
          resolvedAt: now,
        },
      }),
      prisma.ticketEvent.create({
        data: {
          ticketId: t.id,
          type: "auto_closed_no_response",
          meta: JSON.stringify({ lastOutboundAt: last.createdAt.toISOString() }),
        },
      }),
    ]);
    autoClosed++;
  }

  return Response.json({
    ok: true,
    woken,
    firstResponseBreachesFlagged: firstResponseBreaches.length,
    resolutionBreachesFlagged: resolutionBreaches.length,
    autoClosed,
  });
}
