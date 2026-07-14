import { checkBearer } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Detects tickets that have breached SLA in the last poll interval and creates
 * `sla_breached` events + bumps priority to `urgent` (if not already).
 * Runs frequently (every few minutes) — the query uses a small lookback window
 * and existing-event dedup so we only fire once per ticket.
 */
export async function POST(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) return new Response("Unauthorized", { status: auth.status });

  const now = new Date();

  const overdue = await prisma.ticket.findMany({
    where: {
      status: { notIn: ["resolved", "closed"] },
      slaDueAt: { lt: now },
    },
    select: { id: true, priority: true, events: { where: { type: "sla_breached" }, take: 1 } },
  });

  let flagged = 0;
  for (const t of overdue) {
    if (t.events.length > 0) continue;
    await prisma.$transaction([
      prisma.ticketEvent.create({
        data: {
          ticketId: t.id,
          type: "sla_breached",
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
    flagged++;
  }

  return Response.json({ ok: true, checked: overdue.length, flagged });
}
