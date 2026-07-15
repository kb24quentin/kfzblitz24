import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function Header() {
  const session = await auth();
  const name = session?.user?.name || session?.user?.email || "";

  const now = new Date();
  const [dueCount, totalSnoozed] = await Promise.all([
    prisma.ticket.count({
      where: {
        snoozedUntil: { lte: now, not: null },
        status: { notIn: ["resolved", "closed"] },
      },
    }),
    prisma.ticket.count({
      where: {
        snoozedUntil: { not: null },
        status: { notIn: ["resolved", "closed"] },
      },
    }),
  ]);

  return (
    <header className="h-14 border-b border-border bg-bg-card flex items-center gap-4 px-6">
      <form method="get" action="/search" className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light pointer-events-none" />
          <input
            type="search"
            name="q"
            placeholder="Global suchen: Tickets, Kontakte, Bestellungen, Templates …"
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
            aria-label="Global suchen"
          />
        </div>
      </form>

      <Link
        href="/tickets/snoozed"
        className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-light hover:text-text hover:bg-bg-secondary transition-colors shrink-0"
        title={
          dueCount > 0
            ? `${dueCount} Ticket(s) auf Wiedervorlage — jetzt fällig`
            : `${totalSnoozed} Ticket(s) auf Wiedervorlage`
        }
      >
        <Bell className={`w-4 h-4 ${dueCount > 0 ? "text-danger" : ""}`} />
        {dueCount > 0 ? (
          <>
            <span className="font-semibold text-danger">{dueCount}</span>
            <span className="text-xs">fällig</span>
          </>
        ) : totalSnoozed > 0 ? (
          <span className="text-xs">{totalSnoozed} Wiedervorlage</span>
        ) : (
          <span className="text-xs text-text-light">Keine Wiedervorlagen</span>
        )}
        {dueCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
            {dueCount > 9 ? "9+" : dueCount}
          </span>
        )}
      </Link>

      <div className="text-sm text-text-light shrink-0">
        <span className="font-medium text-text">{name}</span>
      </div>
    </header>
  );
}
