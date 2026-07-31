export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { CallsQueue } from "./calls-queue";
import { Phone } from "lucide-react";

export default async function CallsPage() {
  // Alle offenen Call-Reminder (nur die aus Kadenz-Steps, damit hier nicht
  // ad-hoc Reminder ohne Call-Kontext auftauchen).
  const reminders = await prisma.reminder.findMany({
    where: {
      status: "pending",
      step: { channel: "call" },
    },
    include: {
      contact: {
        select: {
          id: true, firstName: true, lastName: true, company: true, position: true,
          phone: true, email: true, city: true, status: true,
        },
      },
      user: { select: { id: true, name: true } },
      step: {
        select: {
          id: true, order: true, callNote: true,
          campaign: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Für jeden Reminder auch die letzten Aktivitäten des Kontakts holen —
  // im Modal brauchen wir Kontext. N+1 ist OK bei <100 offenen Anrufen;
  // wenn's mal massiv wird, in eine Batch-Query umbauen.
  const contactIds = [...new Set(reminders.map((r) => r.contactId))];
  const recentActivities = contactIds.length
    ? await prisma.activity.findMany({
        where: { contactId: { in: contactIds } },
        orderBy: { createdAt: "desc" },
        take: contactIds.length * 10,
        include: { user: { select: { name: true } } },
      })
    : [];
  const activitiesByContact = new Map<string, typeof recentActivities>();
  for (const a of recentActivities) {
    const list = activitiesByContact.get(a.contactId) ?? [];
    if (list.length < 10) list.push(a);
    activitiesByContact.set(a.contactId, list);
  }

  const enriched = reminders.map((r) => ({
    ...r,
    dueDate: r.dueDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    activities: (activitiesByContact.get(r.contactId) ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      content: a.content,
      createdAt: a.createdAt.toISOString(),
      userName: a.user?.name ?? null,
    })),
  }));

  const now = new Date();
  const overdue = reminders.filter((r) => new Date(r.dueDate) < now).length;
  const today = reminders.filter((r) => {
    const d = new Date(r.dueDate);
    return d.toDateString() === now.toDateString();
  }).length;
  const upcoming = reminders.length - overdue - today;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <Phone className="w-5 h-5 text-accent" /> Anrufe
          </h2>
          <p className="text-sm text-text-light mt-1">
            Alle offenen Call-Aufgaben aus Kadenz-Schritten. Klick auf einen Eintrag zum Anrufen + Loggen.
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Überfällig" value={overdue} tone="danger" />
        <Tile label="Heute" value={today} tone="accent" />
        <Tile label="Später" value={upcoming} tone="neutral" />
      </div>

      <CallsQueue reminders={enriched} />
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: "danger" | "accent" | "neutral" }) {
  const color =
    tone === "danger" ? "border-danger/40 bg-danger/5 text-danger"
    : tone === "accent" ? "border-accent/40 bg-accent/5 text-accent"
    : "border-border bg-bg-card text-text";
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}
