import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Car, Edit3, Trash2, Calendar as CalendarIcon, FileText, Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { formatEur } from "@/lib/money";
import { WorkshopShell } from "../../shell";
import { deleteCustomerAction, updateCustomerAction } from "../actions";
import { CustomerFormFields } from "../customer-form-fields";
import { AddVehicleButton } from "./add-vehicle-button";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 5,
        include: { vehicle: true, mechanic: { select: { name: true } } },
      },
      invoices: { orderBy: { issuedAt: "desc" }, take: 5 },
      reminders: { where: { status: { in: ["pending", "sent"] } }, orderBy: { dueDate: "asc" }, take: 5 },
    },
  });
  if (!customer || customer.workshopId !== ctx.workshopId) notFound();

  const cName = customerDisplayName(customer);

  return (
    <WorkshopShell current="kunden">
      <div className="mb-6">
        <Link href="/app/kunden" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Alle Kunden
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{cName}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {customer.type === "b2b" ? "Firmenkunde" : "Privatkunde"} · Kunde seit{" "}
              {customer.createdAt.toLocaleDateString("de-DE")}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/app/rechnungen/new?customerId=${customer.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700"
            >
              <FileText className="w-3.5 h-3.5" />
              Rechnung erstellen
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Fahrzeuge */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Fahrzeuge ({customer.vehicles.length})
                </h2>
              </div>
              <AddVehicleButton customerId={customer.id} />
            </header>
            {customer.vehicles.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Noch kein Fahrzeug angelegt.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.vehicles.map((v) => (
                  <li key={v.id}>
                    <Link href={`/app/kunden/${customer.id}/fahrzeuge/${v.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-slate-900">{vehicleDisplayName(v)}</div>
                        <div className="text-xs text-slate-500 flex gap-3 mt-1">
                          {v.year && <span>{v.year}</span>}
                          {v.mileage != null && <span>{v.mileage.toLocaleString("de-DE")} km</span>}
                          {v.fuelType && <span className="capitalize">{v.fuelType}</span>}
                          {v.nextTuev && (
                            <span className={overdueClass(v.nextTuev)}>
                              HU: {v.nextTuev.toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Edit3 className="w-4 h-4 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Termine */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Letzte Termine ({customer.appointments.length})
              </h2>
              <Link href="/app/kalender" className="text-xs text-orange-600 hover:underline">Zum Kalender</Link>
            </header>
            {customer.appointments.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Noch kein Termin.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.appointments.map((a) => (
                  <li key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{a.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {a.startsAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                        {a.vehicle && ` · ${vehicleDisplayName(a.vehicle)}`}
                        {a.mechanic && ` · ${a.mechanic.name}`}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rechnungen */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Letzte Rechnungen ({customer.invoices.length})
              </h2>
              <Link href={`/app/rechnungen?customerId=${customer.id}`} className="text-xs text-orange-600 hover:underline">Alle</Link>
            </header>
            {customer.invoices.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Noch keine Rechnung.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.invoices.map((i) => (
                  <li key={i.id}>
                    <Link href={`/app/rechnungen/${i.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{i.invoiceNumber}</div>
                        <div className="text-xs text-slate-500 mt-1">{i.issuedAt.toLocaleDateString("de-DE")}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900 text-sm">{formatEur(i.totalGrossCent)}</div>
                        <InvoiceStatusBadge status={i.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Kontakt</h2>
            <dl className="space-y-2 text-sm">
              {customer.email && (
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="text-slate-900">
                    <a href={`mailto:${customer.email}`} className="hover:text-orange-600">{customer.email}</a>
                  </dd>
                </div>
              )}
              {customer.phone && (
                <div>
                  <dt className="text-xs text-slate-500">Telefon</dt>
                  <dd className="text-slate-900">
                    <a href={`tel:${customer.phone}`} className="hover:text-orange-600">{customer.phone}</a>
                  </dd>
                </div>
              )}
              {(customer.street || customer.city) && (
                <div>
                  <dt className="text-xs text-slate-500">Adresse</dt>
                  <dd className="text-slate-900">
                    {customer.street && <div>{customer.street}</div>}
                    {(customer.zip || customer.city) && <div>{customer.zip} {customer.city}</div>}
                  </dd>
                </div>
              )}
              {customer.taxId && (
                <div>
                  <dt className="text-xs text-slate-500">USt-IdNr.</dt>
                  <dd className="text-slate-900">{customer.taxId}</dd>
                </div>
              )}
              {customer.notes && (
                <div>
                  <dt className="text-xs text-slate-500">Notizen</dt>
                  <dd className="text-slate-700 whitespace-pre-wrap">{customer.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          {customer.reminders.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5" />
                Anstehende Erinnerungen
              </h2>
              <ul className="space-y-2 text-sm">
                {customer.reminders.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span className="text-slate-700">{r.title}</span>
                    <span className={overdueClass(r.dueDate)}>{r.dueDate.toLocaleDateString("de-DE")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="bg-white border border-slate-200 rounded-xl">
            <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5" />
                Bearbeiten
              </span>
              <span className="text-xs text-slate-500">Klicken zum Öffnen</span>
            </summary>
            <div className="border-t border-slate-100 p-5">
              <form action={updateCustomerAction} className="space-y-3">
                <input type="hidden" name="id" value={customer.id} />
                <CustomerFormFields init={customer} />
                <button type="submit" className="w-full mt-3 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
                  Speichern
                </button>
              </form>
            </div>
          </details>

          <details className="bg-white border border-red-200 rounded-xl">
            <summary className="cursor-pointer list-none px-5 py-4">
              <span className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                Gefahrenzone
              </span>
            </summary>
            <div className="border-t border-red-100 p-5">
              <p className="text-xs text-slate-600 mb-3">
                Kunden mit Rechnungen können nicht gelöscht werden (GoBD).
              </p>
              <form action={deleteCustomerAction}>
                <input type="hidden" name="id" value={customer.id} />
                <button type="submit" className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                  Kunde löschen
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
  if (days < 0) return "text-red-600 font-medium";
  if (days < 30) return "text-amber-600 font-medium";
  return "text-slate-500";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    scheduled: "geplant",
    in_progress: "läuft",
    completed: "erledigt",
    cancelled: "storniert",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {label[status] ?? status}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-50 text-blue-700",
    paid: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    draft: "Entwurf",
    sent: "Versendet",
    paid: "Bezahlt",
    cancelled: "Storniert",
  };
  return (
    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {label[status] ?? status}
    </span>
  );
}
