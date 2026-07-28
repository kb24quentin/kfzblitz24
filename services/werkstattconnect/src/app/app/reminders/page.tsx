import Link from "next/link";
import { Bell, X, RefreshCw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { WorkshopShell } from "../shell";
import { ReminderCreateButton } from "./reminder-create-button";
import {
  deleteReminderAction,
  dismissReminderAction,
  reactivateReminderAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { status } = await searchParams;
  const filter = status || "pending";

  const [reminders, customers, workshop] = await Promise.all([
    prisma.reminder.findMany({
      where: {
        workshopId: ctx.workshopId,
        ...(filter === "all" ? {} : { status: filter }),
      },
      include: {
        customer: true,
        vehicle: true,
      },
      orderBy: [{ dueDate: "asc" }],
      take: 200,
    }),
    prisma.customer.findMany({
      where: { workshopId: ctx.workshopId },
      include: { vehicles: { select: { id: true, brand: true, model: true, licensePlate: true } } },
      orderBy: [{ lastName: "asc" }],
      take: 500,
    }),
    prisma.workshop.findUnique({ where: { id: ctx.workshopId }, select: { plan: true } }),
  ]);

  const isPro = workshop?.plan === "pro";

  return (
    <WorkshopShell current="reminders">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-orange-600" />
            Erinnerungen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isPro
              ? "Kunden werden automatisch per E-Mail an anstehende Termine erinnert (Pro-Plan)."
              : "Free-Plan: Erinnerungen werden angezeigt, aber nicht automatisch versendet. Upgrade auf Pro für Auto-Versand."}
          </p>
        </div>
        <ReminderCreateButton customers={customers} />
      </div>

      <div className="flex gap-2 mb-4">
        {(["pending", "sent", "dismissed", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/app/reminders?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              filter === s
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {statusLabel(s)}
          </Link>
        ))}
      </div>

      {reminders.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Keine Erinnerungen im Filter „{statusLabel(filter)}".</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Fällig</th>
                <th className="text-left px-4 py-3 font-medium">Titel</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium">Fahrzeug</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reminders.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className={overdueClass(r.dueDate)}>{r.dueDate.toLocaleDateString("de-DE")}</div>
                    <div className="text-xs text-slate-400">{daysUntil(r.dueDate)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.title}</div>
                    <div className="text-xs text-slate-500">{typeLabel(r.type)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/app/kunden/${r.customer.id}`} className="text-slate-700 hover:text-orange-600">
                      {customerDisplayName(r.customer)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {r.vehicle ? vehicleDisplayName(r.vehicle) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} sentAt={r.sentAt} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {r.status !== "dismissed" && (
                        <form action={dismissReminderAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="p-1 text-slate-400 hover:text-slate-700" title="Abhaken">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      )}
                      {r.status === "dismissed" && (
                        <form action={reactivateReminderAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="p-1 text-slate-400 hover:text-emerald-600" title="Wieder öffnen">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      )}
                      <form action={deleteReminderAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="p-1 text-slate-400 hover:text-red-600" title="Löschen">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WorkshopShell>
  );
}

function overdueClass(d: Date) {
  const days = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "text-red-600 font-semibold text-sm";
  if (days < 14) return "text-amber-600 font-semibold text-sm";
  return "text-slate-900 font-medium text-sm";
}

function daysUntil(d: Date) {
  const days = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days > 0) return `in ${days} Tagen`;
  if (days === -1) return "gestern";
  return `vor ${-days} Tagen`;
}

function typeLabel(t: string) {
  return (
    { tuev: "HU/TÜV", inspection: "Inspektion", oil_change: "Ölwechsel", custom: "Sonstige" }[t] ?? t
  );
}

function statusLabel(s: string) {
  return { pending: "Offen", sent: "Versendet", dismissed: "Erledigt", all: "Alle" }[s] ?? s;
}

function StatusBadge({ status, sentAt }: { status: string; sentAt: Date | null }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    sent: "bg-emerald-50 text-emerald-700",
    dismissed: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ""}`}>
      {statusLabel(status)}
      {sentAt && ` · ${sentAt.toLocaleDateString("de-DE")}`}
    </span>
  );
}
