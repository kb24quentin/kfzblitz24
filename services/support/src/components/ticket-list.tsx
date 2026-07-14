import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Inbox, Plus, Clock, AlertCircle, Search, Archive, Bell } from "lucide-react";
import { fullNameOf } from "@/lib/name-parse";
import { STATUS_LABEL, PRIORITY_LABEL, PRIORITY_CLASSES } from "@/lib/status";

function slaColor(dueAt: Date, resolved: boolean) {
  if (resolved) return "text-text-light";
  const hoursLeft = (dueAt.getTime() - Date.now()) / 36e5;
  if (hoursLeft < 0) return "text-danger font-semibold";
  if (hoursLeft < 2) return "text-danger";
  if (hoursLeft < 6) return "text-warning";
  return "text-success";
}

type Props = {
  mode: "active" | "archived" | "snoozed";
  title: string;
  subtitle: string;
  query?: string;
  statusFilter?: string;
  priorityFilter?: string;
  assigneeFilter?: string;
};

export async function TicketList({
  mode,
  title,
  subtitle,
  query,
  statusFilter,
  priorityFilter,
  assigneeFilter,
}: Props) {
  const where: Prisma.TicketWhereInput = {};

  if (mode === "archived") {
    where.status = { in: ["resolved", "closed"] };
  } else if (mode === "snoozed") {
    where.snoozedUntil = { not: null };
    where.status = { notIn: ["resolved", "closed"] };
  } else if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  } else {
    where.status = { notIn: ["resolved", "closed"] };
  }

  if (priorityFilter && priorityFilter !== "all") {
    where.priority = priorityFilter;
  }

  if (assigneeFilter) {
    if (assigneeFilter === "unassigned") where.assigneeId = null;
    else if (assigneeFilter !== "all") where.assigneeId = assigneeFilter;
  }

  const q = query?.trim();
  if (q) {
    const numeric = Number(q);
    const matchNum = !Number.isNaN(numeric) && Number.isFinite(numeric);
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { contact: { email: { contains: q, mode: "insensitive" } } },
      { contact: { name: { contains: q, mode: "insensitive" } } },
      { contact: { firstName: { contains: q, mode: "insensitive" } } },
      { contact: { lastName: { contains: q, mode: "insensitive" } } },
      { contact: { phone: { contains: q, mode: "insensitive" } } },
      { contact: { orderRef: { contains: q, mode: "insensitive" } } },
      { orders: { some: { ref: { contains: q, mode: "insensitive" } } } },
      { messages: { some: { bodyText: { contains: q, mode: "insensitive" } } } },
      ...(matchNum ? [{ number: numeric }] : []),
    ];
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy:
      mode === "archived"
        ? [{ resolvedAt: "desc" }]
        : mode === "snoozed"
          ? [{ snoozedUntil: "asc" }]
          : [{ priority: "desc" }, { firstResponseDueAt: "asc" }],
    take: 200,
    include: {
      contact: true,
      assignee: true,
      _count: { select: { messages: true, notes: true } },
    },
  });

  const basePath =
    mode === "archived"
      ? "/tickets/archive"
      : mode === "snoozed"
        ? "/tickets/snoozed"
        : "/tickets";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            {mode === "archived" ? (
              <Archive className="w-5 h-5" />
            ) : mode === "snoozed" ? (
              <Bell className="w-5 h-5" />
            ) : (
              <Inbox className="w-5 h-5" />
            )}
            {title}
          </h1>
          <p className="text-sm text-text-light mt-1">{subtitle}</p>
        </div>
        {mode === "active" && (
          <Link
            href="/tickets/new"
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" /> Neues Ticket
          </Link>
        )}
      </div>

      <form method="get" action={basePath} className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
          <input
            type="search"
            name="q"
            defaultValue={q || ""}
            placeholder="Suche: Betreff, Kunde, Bestellnr., #Ticket-Nr., oder Text…"
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
        {mode === "active" && (
          <select
            name="status"
            defaultValue={statusFilter || ""}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Alle offenen</option>
            <option value="open">Offen</option>
            <option value="pending">Warten auf Kunde</option>
            <option value="on_hold">Pausiert</option>
          </select>
        )}
        <select
          name="priority"
          defaultValue={priorityFilter || ""}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Alle Prio</option>
          <option value="urgent">Dringend</option>
          <option value="high">Hoch</option>
          <option value="normal">Normal</option>
          <option value="low">Niedrig</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
        >
          Filtern
        </button>
        {(q || statusFilter || priorityFilter || assigneeFilter) && (
          <Link
            href={basePath}
            className="px-3 py-2 text-sm text-text-light hover:text-text"
          >
            Zurücksetzen
          </Link>
        )}
      </form>

      {tickets.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <div className="mx-auto mb-3">
            {mode === "archived" ? (
              <Archive className="w-12 h-12 text-text-light mx-auto" />
            ) : mode === "snoozed" ? (
              <Bell className="w-12 h-12 text-text-light mx-auto" />
            ) : (
              <Inbox className="w-12 h-12 text-text-light mx-auto" />
            )}
          </div>
          <h3 className="text-base font-semibold text-text mb-1">
            {q
              ? "Keine Treffer"
              : mode === "archived"
                ? "Keine archivierten Tickets"
                : mode === "snoozed"
                  ? "Keine Tickets auf Wiedervorlage"
                  : "Noch keine Tickets"}
          </h3>
          <p className="text-sm text-text-light max-w-md mx-auto">
            {q
              ? `Für "${q}" wurde nichts gefunden.`
              : mode === "archived"
                ? "Gelöste und geschlossene Tickets landen hier."
                : mode === "snoozed"
                  ? "Setze Tickets auf Wiedervorlage im Ticket-Detail."
                  : "Sobald der Gmail-Sync eingerichtet ist, erscheinen eingehende E-Mails hier automatisch."}
          </p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary border-b border-border">
              <tr className="text-left text-xs uppercase text-text-light">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Betreff</th>
                <th className="px-4 py-3 font-medium">Kunde</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priorität</th>
                <th className="px-4 py-3 font-medium">Zugewiesen</th>
                <th className="px-4 py-3 font-medium">
                  {mode === "archived"
                    ? "Gelöst"
                    : mode === "snoozed"
                      ? "Wiedervorlage"
                      : "1. Antwort SLA"}
                </th>
                <th className="px-4 py-3 font-medium">Erstellt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => {
                const overdue =
                  !t.resolvedAt && t.firstResponseDueAt.getTime() < Date.now();
                const displayName = fullNameOf(t.contact);
                const snoozeDue = t.snoozedUntil && t.snoozedUntil.getTime() <= Date.now();
                return (
                  <tr key={t.id} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-text-light">
                      #{t.number}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="text-text font-medium hover:text-accent"
                      >
                        {t.subject}
                      </Link>
                      <div className="text-xs text-text-light mt-0.5">
                        {t._count.messages} Nachricht(en){t._count.notes > 0 && `, ${t._count.notes} Notiz(en)`}
                        {t.snoozedUntil && !snoozeDue && (
                          <span className="ml-2 inline-flex items-center gap-1 text-warning">
                            <Bell className="w-3 h-3" /> Snooze bis{" "}
                            {formatDistanceToNow(t.snoozedUntil, {
                              locale: de,
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-text">{displayName || t.contact.email}</div>
                      {displayName && (
                        <div className="text-xs text-text-light">{t.contact.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{STATUS_LABEL[t.status] || t.status}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          PRIORITY_CLASSES[t.priority] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {PRIORITY_LABEL[t.priority] || t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-light">
                      {t.assignee?.name || "—"}
                    </td>
                    <td className={`px-4 py-3 ${
                      mode === "archived"
                        ? "text-text-light"
                        : mode === "snoozed" && t.snoozedUntil
                          ? snoozeDue
                            ? "text-danger font-semibold"
                            : "text-warning"
                          : slaColor(t.firstResponseDueAt, !!t.resolvedAt)
                    }`}>
                      {mode === "archived" && t.resolvedAt ? (
                        formatDistanceToNow(t.resolvedAt, { locale: de, addSuffix: true })
                      ) : mode === "snoozed" && t.snoozedUntil ? (
                        <span className="inline-flex items-center gap-1">
                          <Bell className="w-3.5 h-3.5" />
                          {formatDistanceToNow(t.snoozedUntil, { locale: de, addSuffix: true })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {overdue ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {formatDistanceToNow(t.firstResponseDueAt, { locale: de, addSuffix: true })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-light">
                      {formatDistanceToNow(t.createdAt, { locale: de, addSuffix: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
