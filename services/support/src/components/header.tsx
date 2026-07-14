import Link from "next/link";
import { Bell } from "lucide-react";
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
    <header className="h-14 border-b border-border bg-bg-card flex items-center justify-between px-6">
      <div>
        <Link
          href="/tickets/snoozed"
          className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-light hover:text-text hover:bg-bg-secondary transition-colors"
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
      </div>
      <div className="text-sm text-text-light">
        Angemeldet als <span className="font-medium text-text">{name}</span>
      </div>
    </header>
  );
}
