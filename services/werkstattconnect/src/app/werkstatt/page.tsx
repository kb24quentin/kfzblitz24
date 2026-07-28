import Link from "next/link";
import { CalendarDays, CheckCircle2, Circle, PlayCircle, Signature, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { WerkstattShell } from "./shell";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export default async function WerkstattHome() {
  const ctx = await requireWorkshopUser();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [mine, unassigned, later] = await Promise.all([
    // Mir zugewiesen, heute
    prisma.appointment.findMany({
      where: {
        workshopId: ctx.workshopId,
        mechanicId: ctx.userId,
        startsAt: { gte: todayStart, lte: todayEnd },
        status: { in: ["scheduled", "in_progress", "awaiting_approval"] },
      },
      include: { customer: true, vehicle: true },
      orderBy: { startsAt: "asc" },
    }),
    // Unzugewiesen heute (kann jeder nehmen)
    prisma.appointment.findMany({
      where: {
        workshopId: ctx.workshopId,
        mechanicId: null,
        startsAt: { gte: todayStart, lte: todayEnd },
        status: "scheduled",
      },
      include: { customer: true, vehicle: true },
      orderBy: { startsAt: "asc" },
    }),
    // Mir zugewiesen, kommende tage
    prisma.appointment.findMany({
      where: {
        workshopId: ctx.workshopId,
        mechanicId: ctx.userId,
        startsAt: { gt: todayEnd },
        status: { in: ["scheduled", "in_progress"] },
      },
      include: { customer: true, vehicle: true },
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
  ]);

  const inProgress = mine.find((a) => a.status === "in_progress");

  return (
    <WerkstattShell>
      {/* Live-Timer wenn was läuft */}
      {inProgress && <LiveWorkBanner appointment={inProgress} />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-orange-500" />
          Heute · {now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}
        </h1>
      </div>

      {/* Meine Aufträge heute */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
          Meine Aufträge ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-8 text-center text-sm text-slate-500">
            Keine zugewiesenen Aufträge heute.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mine.map((a) => (
              <AppointmentCard key={a.id} appointment={a} isMine highlight={a.status === "in_progress"} />
            ))}
          </div>
        )}
      </section>

      {/* Frei zu übernehmen */}
      {unassigned.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
            Frei zu übernehmen ({unassigned.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unassigned.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        </section>
      )}

      {/* Kommende */}
      {later.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
            Kommende Tage ({later.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {later.map((a) => (
              <AppointmentCard key={a.id} appointment={a} isMine compact />
            ))}
          </div>
        </section>
      )}
    </WerkstattShell>
  );
}

function LiveWorkBanner({ appointment }: { appointment: any }) {
  return (
    <Link
      href={`/werkstatt/${appointment.id}`}
      className="block mb-6 p-4 bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl border-2 border-orange-500 shadow-2xl shadow-orange-600/30 hover:from-orange-700 hover:to-orange-800 transition"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
          <PlayCircle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-orange-200 font-semibold">Läuft gerade</div>
          <div className="font-bold text-lg text-white">{appointment.title}</div>
          <div className="text-sm text-orange-100">
            {customerDisplayName(appointment.customer)}
            {appointment.vehicle && ` · ${vehicleDisplayName(appointment.vehicle)}`}
          </div>
        </div>
        <TimerBadge startedAt={appointment.actualStartedAt} plannedStart={appointment.startsAt} plannedEnd={appointment.endsAt} />
      </div>
    </Link>
  );
}

function TimerBadge({ startedAt, plannedStart, plannedEnd }: { startedAt: Date | null; plannedStart: Date; plannedEnd: Date }) {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  const elapsedMs = Date.now() - start.getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const plannedMs = new Date(plannedEnd).getTime() - new Date(plannedStart).getTime();
  const plannedMin = Math.floor(plannedMs / 60000);
  const overrun = elapsedMin > plannedMin;
  return (
    <div className="text-right">
      <div className="text-2xl font-bold text-white tabular-nums">
        {Math.floor(elapsedMin / 60)}:{String(elapsedMin % 60).padStart(2, "0")}
      </div>
      <div className={`text-xs flex items-center gap-1 justify-end ${overrun ? "text-red-200" : "text-orange-200"}`}>
        {overrun ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {overrun ? `+${elapsedMin - plannedMin} min` : `${plannedMin - elapsedMin} min Puffer`}
      </div>
    </div>
  );
}

function AppointmentCard({ appointment, isMine, highlight, compact }: { appointment: any; isMine?: boolean; highlight?: boolean; compact?: boolean }) {
  const statusIcon = {
    scheduled: <Circle className="w-4 h-4 text-slate-500" />,
    in_progress: <PlayCircle className="w-4 h-4 text-orange-500" />,
    awaiting_approval: <Signature className="w-4 h-4 text-amber-500" />,
    approved: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  }[appointment.status as string] ?? <Circle className="w-4 h-4" />;
  const statusLabel = {
    scheduled: "Geplant",
    in_progress: "Läuft",
    awaiting_approval: "Kunden-Freigabe",
    approved: "Freigegeben",
    completed: "Fertig",
  }[appointment.status as string] ?? appointment.status;

  return (
    <Link
      href={`/werkstatt/${appointment.id}`}
      className={`block p-4 rounded-xl border transition ${
        highlight
          ? "bg-orange-950/50 border-orange-500/50"
          : "bg-slate-900 border-slate-800 hover:border-slate-700"
      } ${compact ? "text-sm" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Clock className="w-3 h-3" />
            {new Date(appointment.startsAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} –{" "}
            {new Date(appointment.endsAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            {compact && (
              <> · {new Date(appointment.startsAt).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</>
            )}
          </div>
          <div className={`font-bold text-white ${compact ? "text-sm" : "text-base"}`}>{appointment.title}</div>
        </div>
        <div className="flex items-center gap-1 text-xs bg-slate-800 rounded-full px-2 py-0.5 shrink-0">
          {statusIcon}
          <span className="text-slate-300">{statusLabel}</span>
        </div>
      </div>
      <div className="text-sm text-slate-400 truncate">
        {customerDisplayName(appointment.customer)}
        {appointment.vehicle && (
          <span className="text-slate-500"> · {vehicleDisplayName(appointment.vehicle)}</span>
        )}
      </div>
    </Link>
  );
}
