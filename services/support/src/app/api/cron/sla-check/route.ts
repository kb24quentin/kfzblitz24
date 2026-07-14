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

  return Response.json({
    ok: true,
    woken,
    firstResponseBreachesFlagged: firstResponseBreaches.length,
    resolutionBreachesFlagged: resolutionBreaches.length,
  });
}
