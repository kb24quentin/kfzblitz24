import Link from "next/link";
import { notFound } from "next/navigation";
import { User as UserIcon, Mail, Phone, StickyNote, ArrowLeft } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { fullNameOf } from "@/lib/name-parse";
import { STATUS_LABEL } from "@/lib/status";
import { ContactNotesForm } from "./notes-form";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUserEmail = session?.user?.email;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      tickets: {
        orderBy: { createdAt: "desc" },
        include: {
          assignee: { select: { name: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, direction: true, sentAt: true },
          },
        },
      },
      contactNotes: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!contact) return notFound();

  const displayName = fullNameOf(contact) || contact.email;
  const openTicketCount = contact.tickets.filter(
    (t) => !["closed", "resolved"].includes(t.status),
  ).length;
  const totalTicketCount = contact.tickets.length;

  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-text-light hover:text-text mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück zu Kontakten
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-text flex items-center gap-2">
                  <UserIcon className="w-5 h-5" /> {displayName}
                </h1>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-text-light">
                    <Mail className="w-3.5 h-3.5" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-text hover:text-accent"
                    >
                      {contact.email}
                    </a>
                  </div>
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-text-light">
                      <Phone className="w-3.5 h-3.5" />
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-text hover:text-accent"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-bold text-text tabular-nums">{totalTicketCount}</div>
                <div className="text-xs text-text-light">
                  {totalTicketCount === 1 ? "Ticket" : "Tickets"} gesamt
                </div>
                {openTicketCount > 0 && (
                  <div className="text-xs text-accent mt-1 font-medium">
                    {openTicketCount} offen
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-xl">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="font-semibold text-text">
                Alle Tickets ({contact.tickets.length})
              </h2>
            </div>
            {contact.tickets.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-text-light">
                Noch keine Tickets von diesem Kunden.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {contact.tickets.map((t) => {
                  const isClosed = ["closed", "resolved"].includes(t.status);
                  const last = t.messages[0];
                  const lastWhen = last ? last.sentAt || last.createdAt : t.createdAt;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/tickets/${t.id}`}
                        className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-mono text-xs text-text-light">
                              #{t.code}
                            </span>
                            <span
                              className={`font-medium truncate ${isClosed ? "text-text-light" : "text-text"}`}
                            >
                              {t.subject}
                            </span>
                          </div>
                          <div className="text-xs text-text-light mt-0.5">
                            {STATUS_LABEL[t.status] || t.status}
                            {t.assignee && ` · ${t.assignee.name}`}
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-xs text-text-light">
                          {formatDistanceToNow(lastWhen, { locale: de, addSuffix: true })}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-text mb-3 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-warning" /> Kunden-Notizen
              <span className="text-xs text-text-light font-normal">
                ({contact.contactNotes.length})
              </span>
            </h3>

            {contact.contactNotes.length === 0 && (
              <div className="text-xs text-text-light italic mb-3">
                Noch keine Notizen. Nützlich für dauerhafte Infos zu diesem Kunden.
              </div>
            )}

            <ul className="space-y-2 mb-3">
              {contact.contactNotes.map((n) => (
                <li key={n.id} className="bg-warning/5 border border-warning/20 rounded p-3 text-sm">
                  <div className="whitespace-pre-wrap text-text">{n.body}</div>
                  <div className="mt-2 text-xs text-text-light">
                    {n.user.name} · {format(n.createdAt, "dd.MM.yyyy HH:mm", { locale: de })}
                  </div>
                </li>
              ))}
            </ul>

            <ContactNotesForm contactId={contact.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
