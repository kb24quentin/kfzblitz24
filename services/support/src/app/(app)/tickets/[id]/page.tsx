import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TicketDetail } from "./ticket-detail";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [ticket, users, templates] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        contact: true,
        assignee: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            authorUser: { select: { id: true, name: true, email: true } },
          },
        },
        notes: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        drafts: {
          where: { status: { in: ["pending", "approved"] } },
          orderBy: { createdAt: "desc" },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.template.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, subject: true, bodyHtml: true, category: true },
    }),
  ]);

  if (!ticket) notFound();

  return (
    <TicketDetail
      ticket={{
        ...ticket,
        slaDueAt: ticket.slaDueAt.toISOString(),
        firstResponseAt: ticket.firstResponseAt?.toISOString() || null,
        resolvedAt: ticket.resolvedAt?.toISOString() || null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        messages: ticket.messages.map((m) => ({
          ...m,
          sentAt: m.sentAt?.toISOString() || null,
          createdAt: m.createdAt.toISOString(),
        })),
        notes: ticket.notes.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        })),
        drafts: ticket.drafts.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          reviewedAt: d.reviewedAt?.toISOString() || null,
        })),
        events: ticket.events.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      }}
      users={users}
      templates={templates}
    />
  );
}
