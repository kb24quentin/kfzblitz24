import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { WorkshopShell } from "../../shell";
import { deleteAppointmentAction, updateAppointmentStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { id } = await params;
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: { customer: true, vehicle: true, mechanic: true },
  });
  if (!a || a.workshopId !== ctx.workshopId) notFound();

  return (
    <WorkshopShell current="kalender">
      <div className="mb-6">
        <Link href="/app/kalender" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück zum Kalender
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{a.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {a.startsAt.toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" })} –{" "}
          {a.endsAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Beschreibung</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {a.description || <span className="text-slate-400">Keine Beschreibung</span>}
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Status ändern</h2>
            <div className="flex flex-wrap gap-2">
              {(["scheduled", "in_progress", "completed", "cancelled"] as const).map((s) => (
                <form key={s} action={updateAppointmentStatusAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value={s} />
                  <button
                    type="submit"
                    disabled={a.status === s}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      a.status === s
                        ? "bg-orange-600 text-white border-orange-600 cursor-default"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {statusLabel(s)}
                  </button>
                </form>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Kunde</h2>
            <Link href={`/app/kunden/${a.customer.id}`} className="text-sm font-medium text-slate-900 hover:text-orange-600">
              {customerDisplayName(a.customer)}
            </Link>
            {a.customer.phone && <div className="text-xs text-slate-500 mt-1">{a.customer.phone}</div>}
            {a.customer.email && <div className="text-xs text-slate-500">{a.customer.email}</div>}
          </section>
          {a.vehicle && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Fahrzeug</h2>
              <Link
                href={`/app/kunden/${a.customer.id}/fahrzeuge/${a.vehicle.id}`}
                className="text-sm font-medium text-slate-900 hover:text-orange-600"
              >
                {vehicleDisplayName(a.vehicle)}
              </Link>
              {a.vehicle.mileage != null && (
                <div className="text-xs text-slate-500 mt-1">
                  km: {a.vehicle.mileage.toLocaleString("de-DE")}
                </div>
              )}
            </section>
          )}
          {a.mechanic && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Mechaniker</h2>
              <div className="text-sm font-medium text-slate-900">{a.mechanic.name}</div>
            </section>
          )}
          <details className="bg-white border border-red-200 rounded-xl">
            <summary className="cursor-pointer list-none px-5 py-4">
              <span className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                Termin löschen
              </span>
            </summary>
            <div className="border-t border-red-100 p-5">
              <form action={deleteAppointmentAction}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                  Wirklich löschen
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </WorkshopShell>
  );
}

function statusLabel(s: string) {
  return { scheduled: "geplant", in_progress: "läuft", completed: "erledigt", cancelled: "storniert" }[s] ?? s;
}
