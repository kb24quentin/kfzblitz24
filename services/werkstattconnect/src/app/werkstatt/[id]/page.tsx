import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  Flag,
  Signature,
  CheckCircle2,
  Wrench,
  Package,
  Car,
  User,
  FileText,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { formatEur } from "@/lib/money";
import { WerkstattShell } from "../shell";
import {
  startWorkAction,
  pauseWorkAction,
  finishWorkAction,
  completeAppointmentAction,
} from "../actions";
import { WorkLogEditor } from "./work-log-editor";
import { CustomerSignaturePad } from "./customer-signature-pad";
import { LiveTimer } from "./live-timer";

export const dynamic = "force-dynamic";

export default async function AppointmentWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { id } = await params;

  const [appointment, services, workshop] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        mechanic: { select: { name: true } },
        workLog: { orderBy: { createdAt: "asc" }, include: {} },
      },
    }),
    prisma.serviceItem.findMany({
      where: { workshopId: ctx.workshopId, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.workshop.findUnique({
      where: { id: ctx.workshopId },
      select: { hourlyRateCent: true, partsMarkupPercent: true },
    }),
  ]);
  if (!appointment || appointment.workshopId !== ctx.workshopId) notFound();

  const hourlyRateCent = workshop?.hourlyRateCent ?? 9500;
  const isRunning = appointment.status === "in_progress";
  const awaitingApproval = appointment.status === "awaiting_approval";
  const approved = appointment.status === "approved" || appointment.status === "completed";

  // Live-Kalkulation aus workLog
  const laborLog = appointment.workLog.filter((w) => w.kind === "labor");
  const partLog = appointment.workLog.filter((w) => w.kind === "part");
  const noteLog = appointment.workLog.filter((w) => w.kind === "note");
  const laborSum = laborLog.reduce((s, w) => s + w.quantity * hourlyRateCent, 0);
  const partsSum = partLog.reduce((s, _w) => s + 0, 0); // Preise setzt büro
  const netTotal = laborSum + partsSum;
  const vatTotal = Math.round(netTotal * 0.19);
  const grossTotal = netTotal + vatTotal;

  return (
    <WerkstattShell>
      <Link href="/werkstatt" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
      </Link>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-3xl font-bold text-white">{appointment.title}</h1>
          <StatusPill status={appointment.status} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <User className="w-4 h-4" />
            {customerDisplayName(appointment.customer)}
          </span>
          {appointment.vehicle && (
            <span className="flex items-center gap-1.5">
              <Car className="w-4 h-4" />
              {vehicleDisplayName(appointment.vehicle)}
            </span>
          )}
          <span className="text-xs">
            {appointment.startsAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} –{" "}
            {appointment.endsAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Live-Timer wenn in progress */}
      {isRunning && appointment.actualStartedAt && (
        <LiveTimer
          startedAt={appointment.actualStartedAt.toISOString()}
          plannedStart={appointment.startsAt.toISOString()}
          plannedEnd={appointment.endsAt.toISOString()}
        />
      )}

      {/* Beschreibung vom Büro */}
      {appointment.description && (
        <div className="bg-slate-900 border-l-4 border-blue-500 rounded-r-lg p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-1">Auftrags-Beschreibung (vom Büro)</div>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{appointment.description}</p>
        </div>
      )}

      {/* Grosse Action-Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {appointment.status === "scheduled" && (
          <form action={startWorkAction} className="sm:col-span-2">
            <input type="hidden" name="id" value={appointment.id} />
            <button className="w-full inline-flex items-center justify-center gap-3 py-6 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white rounded-2xl font-bold text-xl shadow-2xl shadow-emerald-600/30 transition">
              <Play className="w-6 h-6" />
              Arbeit starten
            </button>
          </form>
        )}
        {isRunning && (
          <>
            <form action={pauseWorkAction}>
              <input type="hidden" name="id" value={appointment.id} />
              <button className="w-full inline-flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold border border-slate-700">
                <Pause className="w-5 h-5" /> Pausieren
              </button>
            </form>
            <form action={finishWorkAction}>
              <input type="hidden" name="id" value={appointment.id} />
              <button className="w-full inline-flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white rounded-xl font-bold shadow-lg">
                <Flag className="w-5 h-5" /> Fertig — Kunden-Freigabe
              </button>
            </form>
          </>
        )}
        {approved && (
          <form action={completeAppointmentAction} className="sm:col-span-2">
            <input type="hidden" name="id" value={appointment.id} />
            <button className="w-full inline-flex items-center justify-center gap-2 py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold">
              <CheckCircle2 className="w-5 h-5" /> Auftrag abschließen
            </button>
          </form>
        )}
      </div>

      {/* Kunden-Freigabe wenn awaiting_approval */}
      {awaitingApproval && (
        <div className="mb-8 bg-gradient-to-br from-amber-950/50 to-orange-950/50 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-amber-400 mb-3">
            <Signature className="w-5 h-5" />
            <h2 className="font-bold text-lg">Kunden-Freigabe einholen</h2>
          </div>
          <p className="text-sm text-amber-100/80 mb-4">
            Zeige dem Kunden den Betrag, lass ihn unterschreiben. Die Rechnung wird dann direkt bar/EC bezahlt.
          </p>
          <div className="mb-3 text-3xl font-bold text-white tabular-nums">
            {formatEur(grossTotal)}
          </div>
          <CustomerSignaturePad appointmentId={appointment.id} defaultAmount={(grossTotal / 100).toFixed(2)} />
        </div>
      )}

      {approved && appointment.approvedAmountCent != null && (
        <div className="mb-8 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="font-bold text-lg">Vom Kunden freigegeben</h2>
          </div>
          <div className="text-sm text-emerald-100/80 mb-3">
            Betrag: <strong className="text-white">{formatEur(appointment.approvedAmountCent)}</strong>
            {appointment.approvedAt && (
              <> · Am {appointment.approvedAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</>
            )}
          </div>
          {appointment.approvalSignatureSvg && (
            <div className="bg-white rounded-lg p-2 max-w-sm">
              <img src={appointment.approvalSignatureSvg} alt="Unterschrift" className="w-full h-24 object-contain" />
            </div>
          )}
        </div>
      )}

      {/* Work-Log Editor */}
      <div className="mb-8">
        <WorkLogEditor
          appointmentId={appointment.id}
          entries={appointment.workLog.map((w) => ({
            id: w.id,
            kind: w.kind as "labor" | "part" | "note",
            name: w.name,
            quantity: w.quantity,
            unit: w.unit,
            note: w.note,
          }))}
          services={services.map((s) => ({
            id: s.id,
            category: s.category,
            name: s.name,
            description: s.description,
            laborHours: s.laborHours,
            netPriceCent: s.netPriceCent,
            vatPercent: s.vatPercent,
            unit: s.unit,
            suggestedParts: Array.isArray(s.suggestedParts) ? (s.suggestedParts as string[]) : undefined,
          }))}
          hourlyRateCent={hourlyRateCent}
          readOnly={approved || appointment.status === "completed"}
        />
      </div>

      {/* Bar-Betrag Live-Kalkulation */}
      {(laborLog.length > 0 || partLog.length > 0) && !approved && (
        <div className="mb-6 grid grid-cols-2 gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div>
            <div className="text-xs text-slate-400">Arbeit</div>
            <div className="text-lg font-bold text-white tabular-nums">
              {laborLog.reduce((s, w) => s + w.quantity, 0).toFixed(1)} Std
            </div>
            <div className="text-xs text-slate-500">= {formatEur(laborSum)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Teile-Positionen</div>
            <div className="text-lg font-bold text-white tabular-nums">{partLog.length}</div>
            <div className="text-xs text-slate-500">Preise setzt Büro</div>
          </div>
        </div>
      )}
    </WerkstattShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-slate-800 text-slate-300",
    in_progress: "bg-orange-950/50 border-orange-500 text-orange-300 border",
    awaiting_approval: "bg-amber-950/50 border-amber-500 text-amber-300 border",
    approved: "bg-emerald-950/50 border-emerald-500 text-emerald-300 border",
    completed: "bg-emerald-950/50 border-emerald-500 text-emerald-300 border",
    cancelled: "bg-red-950/50 border-red-500 text-red-300 border",
  };
  const label: Record<string, string> = {
    scheduled: "Geplant",
    in_progress: "Läuft",
    awaiting_approval: "Wartet auf Freigabe",
    approved: "Freigegeben",
    completed: "Abgeschlossen",
    cancelled: "Storniert",
  };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${map[status] ?? ""}`}>
      {label[status] ?? status}
    </span>
  );
}
