import { prisma } from "@/lib/db";

export type SearchResult =
  | {
      kind: "ticket";
      id: string;
      code: string;
      subject: string;
      status: string;
      customerName: string;
      customerEmail: string;
      archived: boolean;
      snoozed: boolean;
      lastActivityAt: Date;
    }
  | {
      kind: "contact";
      id: string;
      name: string;
      email: string;
      phone: string | null;
      ticketCount: number;
    }
  | {
      kind: "order";
      id: string;
      ref: string;
      status: string | null;
      totalBrutto: number | null;
      ticketId: string;
      ticketCode: string;
    }
  | {
      kind: "template";
      id: string;
      name: string;
      shortcode: string | null;
      category: string | null;
    };

/**
 * Globale suche über tickets (alle, inkl. archiv+snooze), contacts, orders,
 * templates. Rückgabe gruppiert nach kind. Max 20 hits pro kind für schnellen
 * dropdown/results-render.
 */
export async function globalSearch(q: string): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const matchNum = /^\d+$/.test(query);
  const numeric = matchNum ? parseInt(query, 10) : 0;
  // #CODE — 6 alphanumerisch — akzeptiere mit + ohne führendes #
  const codeMatch = query.replace(/^#/, "").match(/^[a-zA-Z0-9]{4,10}$/)?.[0];

  const [tickets, contacts, orders, templates] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        OR: [
          { subject: { contains: query, mode: "insensitive" } },
          { code: { equals: codeMatch?.toUpperCase() ?? "___never___" } },
          ...(matchNum ? [{ number: numeric }] : []),
          { contact: { email: { contains: query, mode: "insensitive" } } },
          { contact: { name: { contains: query, mode: "insensitive" } } },
          { contact: { firstName: { contains: query, mode: "insensitive" } } },
          { contact: { lastName: { contains: query, mode: "insensitive" } } },
          { orders: { some: { ref: { contains: query, mode: "insensitive" } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        contact: { select: { name: true, email: true, firstName: true, lastName: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, sentAt: true },
        },
      },
    }),
    prisma.contact.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { _count: { select: { tickets: true } } },
    }),
    prisma.ticketOrder.findMany({
      where: { ref: { contains: query, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { ticket: { select: { id: true, code: true } } },
    }),
    prisma.template.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortcode: { contains: query, mode: "insensitive" } },
          { subject: { contains: query, mode: "insensitive" } },
          { bodyHtml: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 20,
    }),
  ]);

  const results: SearchResult[] = [];

  for (const t of tickets) {
    const lastMsg = t.messages[0];
    const lastActivityAt = lastMsg ? lastMsg.sentAt ?? lastMsg.createdAt : t.createdAt;
    const c = t.contact;
    const displayName =
      [c.firstName, c.lastName].filter(Boolean).join(" ") || c.name || c.email;
    results.push({
      kind: "ticket",
      id: t.id,
      code: t.code,
      subject: t.subject,
      status: t.status,
      customerName: displayName,
      customerEmail: c.email,
      archived: t.status === "resolved" || t.status === "closed",
      snoozed: !!t.snoozedUntil && t.snoozedUntil.getTime() > Date.now(),
      lastActivityAt,
    });
  }
  for (const c of contacts) {
    const displayName = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.name || c.email;
    results.push({
      kind: "contact",
      id: c.id,
      name: displayName,
      email: c.email,
      phone: c.phone,
      ticketCount: c._count.tickets,
    });
  }
  for (const o of orders) {
    results.push({
      kind: "order",
      id: o.id,
      ref: o.ref,
      status: o.status,
      totalBrutto: o.totalBrutto,
      ticketId: o.ticketId,
      ticketCode: o.ticket.code,
    });
  }
  for (const t of templates) {
    results.push({
      kind: "template",
      id: t.id,
      name: t.name,
      shortcode: t.shortcode,
      category: t.category,
    });
  }

  return results;
}
