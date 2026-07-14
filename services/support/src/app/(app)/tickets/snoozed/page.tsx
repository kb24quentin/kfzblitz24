import { TicketList } from "@/components/ticket-list";

export const dynamic = "force-dynamic";

export default async function SnoozedTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; priority?: string }>;
}) {
  const sp = await searchParams;
  return (
    <TicketList
      mode="snoozed"
      title="Wiedervorlage"
      subtitle="Tickets die zu einem festen Zeitpunkt wieder auftauchen sollen"
      query={sp.q}
      priorityFilter={sp.priority}
    />
  );
}
