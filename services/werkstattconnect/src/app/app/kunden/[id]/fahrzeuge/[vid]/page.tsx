import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Car, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { WorkshopShell } from "../../../../shell";
import { updateVehicleAction, deleteVehicleAction } from "../../../actions";
import { VehicleFormFields } from "../../vehicle-form-fields";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { id, vid } = await params;
  const [vehicle, appointments, invoices] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: vid }, include: { customer: true } }),
    prisma.appointment.findMany({
      where: { vehicleId: vid, workshopId: ctx.workshopId },
      orderBy: { startsAt: "desc" },
      take: 10,
      include: { mechanic: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { vehicleId: vid, workshopId: ctx.workshopId },
      orderBy: { issuedAt: "desc" },
      take: 10,
    }),
  ]);
  if (!vehicle || vehicle.workshopId !== ctx.workshopId || vehicle.customerId !== id) notFound();

  return (
    <WorkshopShell current="kunden">
      <div className="mb-6">
        <Link
          href={`/app/kunden/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {customerDisplayName(vehicle.customer)}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Car className="w-6 h-6 text-orange-600" />
          {vehicleDisplayName(vehicle)}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Fahrzeugdaten bearbeiten</h2>
            <form action={updateVehicleAction} className="space-y-3">
              <input type="hidden" name="id" value={vehicle.id} />
              <VehicleFormFields init={vehicle} />
              <div className="flex justify-end pt-3 border-t border-slate-100 mt-3">
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
                  Speichern
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Werkstatt-Historie</h2>
              <p className="text-xs text-slate-500 mt-1">
                Termine + Rechnungen für dieses Fahrzeug — das ist die Basis für das virtuelle Wartungsheft.
              </p>
            </header>
            {appointments.length === 0 && invoices.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Noch keine Historie.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <div key={a.id} className="p-4">
                    <div className="text-xs text-slate-500">
                      {a.startsAt.toLocaleDateString("de-DE")} · Termin{a.mechanic && ` · ${a.mechanic.name}`}
                    </div>
                    <div className="font-medium text-sm text-slate-900">{a.title}</div>
                    {a.description && <div className="text-xs text-slate-600 mt-1">{a.description}</div>}
                  </div>
                ))}
                {invoices.map((i) => (
                  <Link key={i.id} href={`/app/rechnungen/${i.id}`} className="block p-4 hover:bg-slate-50">
                    <div className="text-xs text-slate-500">{i.issuedAt.toLocaleDateString("de-DE")} · Rechnung</div>
                    <div className="font-medium text-sm text-slate-900">{i.invoiceNumber}</div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Wartungshinweise</h2>
            <dl className="space-y-3 text-sm">
              {vehicle.mileage != null && (
                <div>
                  <dt className="text-xs text-slate-500">km-Stand</dt>
                  <dd className="text-slate-900 font-medium">{vehicle.mileage.toLocaleString("de-DE")} km</dd>
                  {vehicle.mileageUpdatedAt && (
                    <div className="text-xs text-slate-400">Stand: {vehicle.mileageUpdatedAt.toLocaleDateString("de-DE")}</div>
                  )}
                </div>
              )}
              {vehicle.nextTuev && (
                <div>
                  <dt className="text-xs text-slate-500">Nächste HU</dt>
                  <dd className={overdueClass(vehicle.nextTuev)}>{vehicle.nextTuev.toLocaleDateString("de-DE")}</dd>
                </div>
              )}
              {vehicle.nextInspection && (
                <div>
                  <dt className="text-xs text-slate-500">Nächste Wartung</dt>
                  <dd className={overdueClass(vehicle.nextInspection)}>{vehicle.nextInspection.toLocaleDateString("de-DE")}</dd>
                </div>
              )}
            </dl>
          </section>

          <details className="bg-white border border-red-200 rounded-xl">
            <summary className="cursor-pointer list-none px-5 py-4">
              <span className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                Fahrzeug löschen
              </span>
            </summary>
            <div className="border-t border-red-100 p-5">
              <p className="text-xs text-slate-600 mb-3">
                Termine bleiben erhalten (verlieren nur die Fahrzeug-Referenz), Rechnungen können nicht gelöscht werden.
              </p>
              <form action={deleteVehicleAction}>
                <input type="hidden" name="id" value={vehicle.id} />
                <button type="submit" className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                  Fahrzeug löschen
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </WorkshopShell>
  );
}

function overdueClass(d: Date) {
  const days = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "text-red-600 font-semibold";
  if (days < 30) return "text-amber-600 font-semibold";
  return "text-slate-900 font-medium";
}
