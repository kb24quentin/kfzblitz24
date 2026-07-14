import { TicketList } from "@/components/ticket-list";

export const dynamic = "force-dynamic";

export default async function TicketArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; priority?: string; assignee?: string }>;
}) {
  const sp = await searchParams;
  return (
    <TicketList
      mode="archived"
      title="Archiv"
      subtitle="Gelöste Tickets, älteste unten"
      query={sp.q}
      priorityFilter={sp.priority}
      assigneeFilter={sp.assignee}
    />
  );
}
