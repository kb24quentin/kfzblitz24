export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit, Mail, Phone, Building2, MapPin, Tag,
  Calendar, User, Clock, AlertCircle, CheckCircle,
  Send, Eye, MousePointerClick, MessageSquare,
} from "lucide-react";
import { ActivityTimeline } from "./activity-timeline";
import { ReminderForm } from "./reminder-form";
import { SendEmailForm } from "./send-email-form";
import { StatusSelect, PrioritySelect, AssignSelect } from "./contact-actions";
import { completeReminder } from "./actions";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  replied: "bg-green-100 text-green-700",
  interested: "bg-emerald-100 text-emerald-700",
  not_interested: "bg-red-100 text-red-700",
  customer: "bg-purple-100 text-purple-700",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

const priorityLabels: Record<string, string> = {
  low: "Niedrig", medium: "Mittel", high: "Hoch",
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      assignedTo: true,
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true },
      },
      reminders: {
        where: { status: { not: "done" } },
        orderBy: { dueDate: "asc" },
        include: { user: true },
      },
      emails: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { campaign: true },
      },
    },
  });

  if (!contact) notFound();

  // Aggregate email stats across all of this contact's emails
  const allEmails = await prisma.email.findMany({
    where: { contactId: id },
    select: { status: true, openedAt: true, clickedAt: true, repliedAt: true },
  });
  const emailStats = {
    sent: allEmails.filter((e) => e.status !== "queued").length,
    opened: allEmails.filter((e) => e.openedAt).length,
    clicked: allEmails.filter((e) => e.clickedAt).length,
    replied: allEmails.filter((e) => e.repliedAt).length,
  };
  const pct = (n: number) =>
    emailStats.sent > 0 ? `${((n / emailStats.sent) * 100).toFixed(0)}%` : "—";

  // All replies from this contact, newest first
  const replies = await prisma.reply.findMany({
    where: { contactId: id },
    orderBy: { receivedAt: "desc" },
    include: { email: { select: { id: true, subject: true } } },
  });

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const tags = JSON.parse(contact.tags || "[]") as string[];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link href="/contacts" className="p-2 hover:bg-bg-card rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-light" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text">
              {contact.firstName} {contact.lastName}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[contact.priority]}`}>
              {priorityLabels[contact.priority]}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                contact.outreach === "local"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-blue-100 text-blue-700"
              }`}
              title={
                contact.outreach === "local"
                  ? "Local — wird in Mail-Kampagnen ausgeschlossen"
                  : "Remote — Mail-Outreach"
              }
            >
              {contact.outreach === "local" ? "Local" : "Remote"}
            </span>
          </div>
          <p className="text-sm text-text-light">
            {contact.company && `${contact.company} · `}{contact.position && `${contact.position} · `}{contact.city}
          </p>
        </div>
        <Link
          href={`/contacts/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
        >
          <Edit className="w-4 h-4" /> Bearbeiten
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info + Reminders + Emails */}
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Status</label>
              <StatusSelect contactId={id} currentStatus={contact.status} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Prioritaet</label>
              <PrioritySelect contactId={id} currentPriority={contact.priority} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Zugewiesen an</label>
              <AssignSelect contactId={id} currentAssignedId={contact.assignedToId} users={users} />
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-text">Kontaktdaten</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-text-light" />
                <a href={`mailto:${contact.email}`} className="text-accent hover:underline">{contact.email}</a>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-text-light" />
                  <a href={`tel:${contact.phone}`} className="hover:text-accent">{contact.phone}</a>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-text-light" />
                  <span>{contact.company}{contact.position && ` · ${contact.position}`}</span>
                </div>
              )}
              {contact.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-text-light" />
                  <span>{contact.city}</span>
                </div>
              )}
              {contact.assignedTo && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-text-light" />
                  <span>Zugewiesen: {contact.assignedTo.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-light" />
                <span className="text-text-light">Erstellt: {new Date(contact.createdAt).toLocaleDateString("de-DE")}</span>
              </div>
              {contact.lastContactedAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-text-light" />
                  <span className="text-text-light">Letzter Kontakt: {new Date(contact.lastContactedAt).toLocaleDateString("de-DE")}</span>
                </div>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-xs bg-bg-secondary px-2 py-0.5 rounded-full text-text-light">
                    <Tag className="w-3 h-3" /> {t}
                  </span>
                ))}
              </div>
            )}
            {contact.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-text-light font-medium mb-1">Notizen</p>
                <p className="text-sm text-text whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Reminders */}
          <div className="bg-bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold text-sm text-text mb-3">Wiedervorlagen</h3>
            {contact.reminders.length === 0 ? (
              <p className="text-xs text-text-light mb-3">Keine offenen Wiedervorlagen</p>
            ) : (
              <div className="space-y-2 mb-3">
                {contact.reminders.map((r) => {
                  const isOverdue = new Date(r.dueDate) < new Date();
                  return (
                    <div key={r.id} className={`p-3 rounded-lg text-sm ${isOverdue ? "bg-red-50 border border-red-200" : "bg-bg-secondary"}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text">{r.title}</span>
                        <form action={async () => {
                          "use server";
                          await completeReminder(r.id, contact.id);
                        }}>
                          <button type="submit" className="text-xs px-2 py-1 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors font-medium">
                            Erledigt
                          </button>
                        </form>
                      </div>
                      {r.description && <p className="text-xs text-text-light mt-1">{r.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {isOverdue ? (
                          <AlertCircle className="w-3 h-3 text-danger" />
                        ) : (
                          <Clock className="w-3 h-3 text-text-light" />
                        )}
                        <span className={`text-xs ${isOverdue ? "text-danger font-medium" : "text-text-light"}`}>
                          {new Date(r.dueDate).toLocaleDateString("de-DE")}
                        </span>
                        <span className="text-xs text-text-light">· {r.user.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <ReminderForm contactId={id} />
          </div>

          {/* Email Stats */}
          {emailStats.sent > 0 && (
            <div className="bg-bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-sm text-text mb-3">Email-Statistik</h3>
              <div className="grid grid-cols-2 gap-2">
                <StatTile icon={Send} color="text-accent" label="Versendet" value={String(emailStats.sent)} />
                <StatTile icon={Eye} color="text-success" label="Geöffnet" value={`${emailStats.opened} (${pct(emailStats.opened)})`} />
                <StatTile icon={MousePointerClick} color="text-info" label="Geklickt" value={`${emailStats.clicked} (${pct(emailStats.clicked)})`} />
                <StatTile icon={MessageSquare} color="text-primary" label="Geantwortet" value={`${emailStats.replied} (${pct(emailStats.replied)})`} />
              </div>
            </div>
          )}

          {/* Send direct mail */}
          <SendEmailForm
            contactId={id}
            contactEmail={contact.email}
            contactName={`${contact.firstName} ${contact.lastName}`}
          />

          {/* Antworten vom Kunden */}
          {replies.length > 0 && (
            <div className="bg-bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-sm text-text mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Antworten vom Kunden ({replies.length})
              </h3>
              <div className="space-y-2">
                {replies.map((r) => (
                  <Link
                    key={r.id}
                    href={`/emails/${r.emailId}`}
                    className="block p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-text truncate">
                        {r.subject ?? "(kein Betreff)"}
                      </span>
                      {r.status === "unread" && (
                        <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded shrink-0">
                          neu
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text whitespace-pre-wrap line-clamp-3">
                      {r.body.length > 200 ? r.body.slice(0, 200) + "…" : r.body}
                    </p>
                    <p className="text-xs text-text-light mt-2">
                      {new Date(r.receivedAt).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}{" "}
                      · auf:{" "}
                      <span className="font-medium">{r.email.subject}</span>
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Email Historie */}
          {contact.emails.length > 0 && (
            <div className="bg-bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-sm text-text mb-3">Email-Historie</h3>
              <div className="space-y-2">
                {contact.emails.map((email) => (
                  <Link
                    key={email.id}
                    href={`/emails/${email.id}`}
                    className="block p-3 bg-bg-secondary rounded-lg hover:bg-bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          email.status === "opened" || email.status === "delivered"
                            ? "bg-success"
                            : email.status === "bounced"
                            ? "bg-danger"
                            : email.status === "replied"
                            ? "bg-primary"
                            : "bg-info"
                        }`}
                      />
                      <span className="text-sm font-medium truncate">{email.subject}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-text-light">
                      <span>{email.campaign?.name ?? "Direkt-Mail"}</span>
                      <span>·</span>
                      <span>{email.status}</span>
                      {email.sentAt && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(email.sentAt).toLocaleString("de-DE", {
                              day: "2-digit", month: "2-digit", year: "2-digit",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </>
                      )}
                      {email.openedAt && (
                        <span className="inline-flex items-center gap-1 text-success">
                          · <Eye className="w-3 h-3" /> {new Date(email.openedAt).toLocaleDateString("de-DE")}
                        </span>
                      )}
                      {email.clickedAt && (
                        <span className="inline-flex items-center gap-1 text-info">
                          · <MousePointerClick className="w-3 h-3" /> {new Date(email.clickedAt).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="lg:col-span-2">
          <h3 className="font-semibold text-text mb-4">Aktivitaeten</h3>
          <ActivityTimeline activities={contact.activities} contactId={id} />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof Mail;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 bg-bg-secondary rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-text-light">{label}</span>
      </div>
      <p className="text-sm font-semibold text-text">{value}</p>
    </div>
  );
}
