import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { Inbox, Plus, Clock, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  pending: "Wartend",
  on_hold: "Pausiert",
  resolved: "Gelöst",
  closed: "Geschlossen",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};

const PRIORITY_CLASSES: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-info/10 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-danger/15 text-danger",
};

function slaColor(dueAt: Date, resolved: boolean) {
  if (resolved) return "text-text-light";
  const hoursLeft = (dueAt.getTime() - Date.now()) / 36e5;
  if (hoursLeft < 0) return "text-danger font-semibold";
  if (hoursLeft < 2) return "text-danger";
  if (hoursLeft < 6) return "text-warning";
  return "text-success";
}

export default async function TicketsPage() {
  const tickets = await prisma.ticket.findMany({
    where: { status: { notIn: ["closed"] } },
    orderBy: [{ priority: "desc" }, { slaDueAt: "asc" }],
    take: 100,
    include: {
      contact: true,
      assignee: true,
      _count: { select: { messages: true, notes: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Inbox className="w-5 h-5" /> Tickets
          </h1>
          <p className="text-sm text-text-light mt-1">
            Offene Anfragen sortiert nach Priorität und SLA
          </p>
        </div>
        <Link
          href="/tickets/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" /> Neues Ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <Inbox className="w-12 h-12 text-text-light mx-auto mb-3" />
          <h3 className="text-base font-semibold text-text mb-1">
            Noch keine Tickets
          </h3>
          <p className="text-sm text-text-light max-w-md mx-auto">
            Sobald der Gmail-Sync eingerichtet ist, erscheinen eingehende
            E-Mails an <span className="font-mono text-text">service@kfzblitz24.de</span> hier
            automatisch als Tickets.
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
                <th className="px-4 py-3 font-medium">SLA</th>
                <th className="px-4 py-3 font-medium">Erstellt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => {
                const overdue = !t.resolvedAt && t.slaDueAt.getTime() < Date.now();
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
                        {t._count.messages} Nachricht(en), {t._count.notes} Notiz(en)
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-text">{t.contact.name || t.contact.email}</div>
                      {t.contact.name && (
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
                    <td className={`px-4 py-3 ${slaColor(t.slaDueAt, !!t.resolvedAt)}`}>
                      <span className="inline-flex items-center gap-1">
                        {overdue ? (
                          <AlertCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {formatDistanceToNow(t.slaDueAt, { locale: de, addSuffix: true })}
                      </span>
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
