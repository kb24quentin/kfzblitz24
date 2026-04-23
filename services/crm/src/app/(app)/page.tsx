export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  Users, Send, Mail, MessageSquare, TrendingUp, Plus,
  ArrowUpRight, Bell, Clock, AlertCircle, CheckCircle,
} from "lucide-react";

async function getStats() {
  const [totalContacts, totalCampaigns, sentEmails, openedEmails, repliedEmails, actionNeeded] = await Promise.all([
    prisma.contact.count(),
    prisma.campaign.count(),
    prisma.email.count({ where: { status: { not: "queued" } } }),
    prisma.email.count({ where: { openedAt: { not: null } } }),
    prisma.email.count({ where: { repliedAt: { not: null } } }),
    prisma.reply.count({ where: { status: "action_needed" } }),
  ]);

  return {
    totalContacts, totalCampaigns, sentEmails,
    openRate: sentEmails > 0 ? ((openedEmails / sentEmails) * 100).toFixed(1) : "0",
    replyRate: sentEmails > 0 ? ((repliedEmails / sentEmails) * 100).toFixed(1) : "0",
    actionNeeded,
  };
}

export default async function Dashboard() {
  const stats = await getStats();

  const reminders = await prisma.reminder.findMany({
    where: { status: "pending", dueDate: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) } },
    orderBy: { dueDate: "asc" },
    take: 10,
    include: { contact: true, user: true },
  });

  const recentActivities = await prisma.activity.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { contact: true, user: true },
  });

  const statCards = [
    { label: "Kontakte", value: stats.totalContacts, icon: Users, color: "bg-blue-500", href: "/contacts" },
    { label: "Emails gesendet", value: stats.sentEmails, icon: Send, color: "bg-accent", href: "/campaigns" },
    { label: "Open Rate", value: `${stats.openRate}%`, icon: Mail, color: "bg-success", href: "/analytics" },
    { label: "Reply Rate", value: `${stats.replyRate}%`, icon: MessageSquare, color: "bg-primary", href: "/analytics" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.href} className="bg-bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.color} w-10 h-10 rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-text-light opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold text-text">{stat.value}</p>
            <p className="text-sm text-text-light">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Action Needed */}
      {stats.actionNeeded > 0 && (
        <Link href="/inbox?filter=action_needed" className="block bg-accent/10 border border-accent/30 rounded-xl p-4 hover:bg-accent/15 transition-colors">
          <div className="flex items-center gap-3">
            <div className="bg-accent w-10 h-10 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-text">{stats.actionNeeded} Antworten erfordern Aktion</p>
              <p className="text-sm text-text-light">Klicke hier um zur Inbox zu gelangen</p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-text mb-4">Schnellaktionen</h2>
            <div className="space-y-2">
              <Link href="/campaigns/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-secondary transition-colors">
                <div className="bg-accent/10 w-9 h-9 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4 text-accent" /></div>
                <span className="text-sm font-medium">Neue Kampagne</span>
              </Link>
              <Link href="/contacts/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-secondary transition-colors">
                <div className="bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-primary" /></div>
                <span className="text-sm font-medium">Kontakt hinzufuegen</span>
              </Link>
              <Link href="/templates/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-secondary transition-colors">
                <div className="bg-success/10 w-9 h-9 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-success" /></div>
                <span className="text-sm font-medium">Template erstellen</span>
              </Link>
            </div>
          </div>

          {/* Reminders Widget */}
          <div className="bg-bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-text mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" /> Wiedervorlagen
              {reminders.length > 0 && (
                <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full">{reminders.length}</span>
              )}
            </h2>
            {reminders.length === 0 ? (
              <p className="text-sm text-text-light text-center py-4">Keine faelligen Wiedervorlagen</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((r) => {
                  const isOverdue = new Date(r.dueDate) < new Date();
                  return (
                    <Link key={r.id} href={`/contacts/${r.contactId}`} className="block p-3 rounded-lg bg-bg-secondary hover:bg-border/30 transition-colors">
                      <div className="flex items-center gap-2">
                        {isOverdue ? <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" /> : <Clock className="w-3.5 h-3.5 text-text-light shrink-0" />}
                        <span className="text-sm font-medium truncate">{r.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-light">
                        <span>{r.contact.firstName} {r.contact.lastName}</span>
                        <span>·</span>
                        <span className={isOverdue ? "text-danger font-medium" : ""}>{new Date(r.dueDate).toLocaleDateString("de-DE")}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="lg:col-span-2 bg-bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-text mb-4">Letzte Aktivitaeten</h2>
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 text-text-light">
              <Mail className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Noch keine Aktivitaeten</p>
              <p className="text-xs mt-1">Erstelle eine Kampagne oder fuege Kontakte hinzu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/contacts/${activity.contactId}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary hover:bg-border/30 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    activity.type === "comment" ? "bg-blue-500"
                    : activity.type === "status_change" ? "bg-accent"
                    : activity.type === "call" ? "bg-success"
                    : activity.type === "reminder_created" ? "bg-info"
                    : "bg-text-light"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.contact.firstName} {activity.contact.lastName}
                      <span className="text-text-light font-normal"> – {activity.content || activity.type}</span>
                    </p>
                    <p className="text-xs text-text-light">
                      {activity.user?.name || "System"} · {new Date(activity.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
