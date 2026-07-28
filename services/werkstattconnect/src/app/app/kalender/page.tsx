import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { WorkshopShell } from "../shell";
import { AppointmentCreateButton } from "./appointment-create-button";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const WORK_HOURS = { start: 7, end: 19 };

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { week } = await searchParams;
  const anchor = week ? new Date(week) : new Date();
  const monday = startOfWeek(anchor);
  const sunday = new Date(monday.getTime() + 7 * DAY_MS);

  const [appointments, customers, mechanics] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        workshopId: ctx.workshopId,
        startsAt: { gte: monday, lt: sunday },
      },
      include: {
        customer: true,
        vehicle: true,
        mechanic: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.customer.findMany({
      where: { workshopId: ctx.workshopId },
      select: {
        id: true,
        type: true,
        companyName: true,
        firstName: true,
        lastName: true,
        vehicles: { select: { id: true, brand: true, model: true, licensePlate: true } },
      },
      orderBy: [{ lastName: "asc" }, { companyName: "asc" }],
      take: 500,
    }),
    prisma.workshopUser.findMany({
      where: { workshopId: ctx.workshopId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const days = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday.getTime() + i * DAY_MS);
    return d;
  });
  const prevWeek = new Date(monday.getTime() - 7 * DAY_MS).toISOString().slice(0, 10);
  const nextWeek = new Date(monday.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <WorkshopShell current="kalender">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-orange-600" />
            Kalender
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            KW {getWeekNumber(monday)} · {monday.toLocaleDateString("de-DE")} –{" "}
            {new Date(sunday.getTime() - DAY_MS).toLocaleDateString("de-DE")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/kalender?week=${prevWeek}`} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link href={`/app/kalender?week=${todayStr}`} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50">
            Heute
          </Link>
          <Link href={`/app/kalender?week=${nextWeek}`} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </Link>
          <AppointmentCreateButton customers={customers} mechanics={mechanics} defaultDate={todayStr} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[80px_repeat(6,minmax(0,1fr))] border-b border-slate-200">
          <div className="p-3 text-xs font-semibold text-slate-500"></div>
          {days.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={`p-3 text-xs font-semibold text-center border-l border-slate-200 ${
                  isToday ? "bg-orange-50 text-orange-700" : "text-slate-700"
                }`}
              >
                {fmtDay(d)}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[80px_repeat(6,minmax(0,1fr))]">
          <div>
            {Array.from({ length: WORK_HOURS.end - WORK_HOURS.start }, (_, i) => (
              <div key={i} className="h-16 border-b border-slate-100 px-2 py-1 text-xs text-slate-400">
                {String(WORK_HOURS.start + i).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d, dIdx) => {
            const dayApps = appointments.filter(
              (a) => a.startsAt.toDateString() === d.toDateString()
            );
            return (
              <div key={dIdx} className="border-l border-slate-200 relative">
                {Array.from({ length: WORK_HOURS.end - WORK_HOURS.start }, (_, i) => (
                  <div key={i} className="h-16 border-b border-slate-100" />
                ))}
                {dayApps.map((a) => {
                  const startH = a.startsAt.getHours() + a.startsAt.getMinutes() / 60;
                  const endH = a.endsAt.getHours() + a.endsAt.getMinutes() / 60;
                  const top = Math.max(0, (startH - WORK_HOURS.start) * 64);
                  const height = Math.max(24, (endH - startH) * 64);
                  return (
                    <Link
                      key={a.id}
                      href={`/app/kalender/${a.id}`}
                      className={`absolute left-1 right-1 rounded-lg p-2 border overflow-hidden text-xs shadow-sm hover:shadow-md transition ${statusStyle(a.status)}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="font-semibold truncate">{a.title}</div>
                      <div className="text-[10px] opacity-80 truncate">
                        {a.startsAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · {customerDisplayName(a.customer)}
                      </div>
                      {a.mechanic && (
                        <div className="text-[10px] opacity-70 truncate">👤 {a.mechanic.name}</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
        <LegendChip label="geplant" cls="bg-slate-100 border-slate-300 text-slate-700" />
        <LegendChip label="läuft" cls="bg-blue-50 border-blue-300 text-blue-700" />
        <LegendChip label="erledigt" cls="bg-emerald-50 border-emerald-300 text-emerald-700" />
        <LegendChip label="storniert" cls="bg-red-50 border-red-300 text-red-700" />
      </div>
    </WorkshopShell>
  );
}

function statusStyle(status: string) {
  const map: Record<string, string> = {
    scheduled: "bg-slate-50 border-slate-300 text-slate-800",
    in_progress: "bg-blue-50 border-blue-300 text-blue-800",
    completed: "bg-emerald-50 border-emerald-300 text-emerald-800",
    cancelled: "bg-red-50 border-red-300 text-red-800 line-through",
  };
  return map[status] ?? "bg-slate-50 border-slate-300";
}

function LegendChip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded text-xs ${cls}`}>{label}</span>
  );
}

function getWeekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
