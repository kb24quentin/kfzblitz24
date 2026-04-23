export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { InboxView } from "./inbox-view";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter || "";

  const where = filter ? { status: filter } : {};

  const replies = await prisma.reply.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    include: {
      contact: true,
      email: { include: { campaign: true } },
    },
  });

  const counts = {
    all: await prisma.reply.count(),
    unread: await prisma.reply.count({ where: { status: "unread" } }),
    action_needed: await prisma.reply.count({ where: { status: "action_needed" } }),
    resolved: await prisma.reply.count({ where: { status: "resolved" } }),
  };

  return <InboxView replies={replies} counts={counts} currentFilter={filter} />;
}
