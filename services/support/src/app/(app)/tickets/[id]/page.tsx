import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { TicketDetail } from "./ticket-detail";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUserSignature = session?.user?.email
    ? await prisma.signature.findFirst({
        where: { user: { email: session.user.email } },
        select: { html: true },
      })
    : null;

  const [ticket, users, templates] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        contact: true,
        assignee: true,
        orders: { orderBy: { createdAt: "asc" } },
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
      select: {
        id: true,
        name: true,
        shortcode: true,
        subject: true,
        bodyHtml: true,
        category: true,
      },
    }),
  ]);

  if (!ticket) notFound();

  return (
    <TicketDetail
      ticket={{
        ...ticket,
        firstResponseDueAt: ticket.firstResponseDueAt.toISOString(),
        resolutionDueAt: ticket.resolutionDueAt.toISOString(),
        firstResponseAt: ticket.firstResponseAt?.toISOString() || null,
        resolvedAt: ticket.resolvedAt?.toISOString() || null,
        snoozedUntil: ticket.snoozedUntil?.toISOString() || null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        orders: ticket.orders.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        })),
        messages: ticket.messages.map((m) => ({
          ...m,
          sentAt: m.sentAt?.toISOString() || null,
          createdAt: m.createdAt.toISOString(),
          kind: m.kind,
          resentFromId: m.resentFromId,
          resendMessageId: m.resendMessageId,
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
      signatureHtml={currentUserSignature?.html || null}
    />
  );
}
