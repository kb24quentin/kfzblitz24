import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Send,
  CheckCircle,
  Ban,
  RefreshCw,
  FileText,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { formatEur, type InvoicePosition } from "@/lib/money";
import { WorkshopShell } from "../../shell";
import {
  cancelInvoiceAction,
  markPaidAction,
  regeneratePdfAction,
  sendInvoiceAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      creator: { select: { name: true, email: true } },
      journalEntries: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!inv || inv.workshopId !== ctx.workshopId) notFound();

  let cancelledBy = null as null | { id: string; invoiceNumber: string };
  if (inv.cancelledById) {
    const c = await prisma.invoice.findUnique({
      where: { id: inv.cancelledById },
      select: { id: true, invoiceNumber: true },
    });
    if (c) cancelledBy = c;
  }

  const positions = inv.positions as unknown as InvoicePosition[];

  return (
    <WorkshopShell current="rechnungen">
      <div className="mb-6">
        <Link href="/app/rechnungen" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Alle Rechnungen
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="w-6 h-6 text-orange-600" />
              {inv.invoiceNumber}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {inv.issuedAt.toLocaleDateString("de-DE")} · {customerDisplayName(inv.customer)}
              {inv.vehicle && ` · ${vehicleDisplayName(inv.vehicle)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <a
              href={`/app/rechnungen/${inv.id}/pdf`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              PDF öffnen
            </a>
            {inv.status !== "cancelled" && (
              <form action={regeneratePdfAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50">
                  <RefreshCw className="w-3.5 h-3.5" />
                  PDF neu bauen
                </button>
              </form>
            )}
            {inv.status !== "cancelled" && inv.customer.email && (
              <form action={sendInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700">
                  <Send className="w-3.5 h-3.5" />
                  Per E-Mail senden
                </button>
              </form>
            )}
            {inv.status === "sent" && (
              <form action={markPaidAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Als bezahlt markieren
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Position</th>
                  <th className="text-right px-4 py-3 font-medium">Menge</th>
                  <th className="text-right px-4 py-3 font-medium">Netto/Einh.</th>
                  <th className="text-right px-4 py-3 font-medium">MwSt</th>
                  <th className="text-right px-4 py-3 font-medium">Summe netto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positions.map((p, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      {p.description && <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {p.quantity.toLocaleString("de-DE")} {p.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">{formatEur(p.netPriceCent)}</td>
                    <td className="px-4 py-3 text-right text-sm">{p.vatPercent} %</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatEur(p.netTotalCent)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-2 text-right text-sm text-slate-500" colSpan={4}>Zwischensumme netto</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatEur(inv.subtotalNetCent)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-right text-sm text-slate-500" colSpan={4}>MwSt gesamt</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatEur(inv.totalVatCent)}</td>
                </tr>
                <tr className="bg-orange-50">
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700" colSpan={4}>Gesamtbetrag</td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-orange-700 tabular-nums">
                    {formatEur(inv.totalGrossCent)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {inv.notes && (
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Notiz</h2>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{inv.notes}</p>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">GoBD-Journal ({inv.journalEntries.length})</h2>
              <p className="text-xs text-slate-500 mt-1">
                Alle Statusänderungen sind unveränderbar protokolliert.
              </p>
            </header>
            <ul className="divide-y divide-slate-100 text-sm">
              {inv.journalEntries.map((e) => (
                <li key={e.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-900">{journalEventLabel(e.event)}</span>
                    {e.actorName && (
                      <span className="text-xs text-slate-500 ml-2">von {e.actorName}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {e.createdAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Status</h2>
            <InvoiceStatusBadge status={inv.status} />
            {cancelledBy && (
              <p className="text-xs text-slate-500 mt-2">
                Storniert durch{" "}
                <Link href={`/app/rechnungen/${cancelledBy.id}`} className="text-orange-600 hover:underline font-mono">
                  {cancelledBy.invoiceNumber}
                </Link>
              </p>
            )}
          </section>
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Kunde</h2>
            <Link href={`/app/kunden/${inv.customer.id}`} className="text-sm font-medium text-slate-900 hover:text-orange-600">
              {customerDisplayName(inv.customer)}
            </Link>
            {inv.customer.email && <div className="text-xs text-slate-500 mt-1">{inv.customer.email}</div>}
            {inv.customer.street && <div className="text-xs text-slate-500 mt-1">{inv.customer.street}</div>}
            {(inv.customer.zip || inv.customer.city) && (
              <div className="text-xs text-slate-500">{inv.customer.zip} {inv.customer.city}</div>
            )}
          </section>
          {inv.vehicle && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Fahrzeug</h2>
              <Link href={`/app/kunden/${inv.customer.id}/fahrzeuge/${inv.vehicle.id}`} className="text-sm font-medium text-slate-900 hover:text-orange-600">
                {vehicleDisplayName(inv.vehicle)}
              </Link>
              {inv.vehicle.vin && <div className="text-xs text-slate-500 mt-1">FIN: {inv.vehicle.vin}</div>}
            </section>
          )}
          {inv.creator && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Erstellt von</h2>
              <div className="text-sm text-slate-900">{inv.creator.name}</div>
              <div className="text-xs text-slate-500">{inv.creator.email}</div>
            </section>
          )}
          {inv.status !== "cancelled" && (
            <details className="bg-white border border-red-200 rounded-xl">
              <summary className="cursor-pointer list-none px-5 py-4">
                <span className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <Ban className="w-3.5 h-3.5" />
                  Rechnung stornieren (GoBD)
                </span>
              </summary>
              <div className="border-t border-red-100 p-5">
                <p className="text-xs text-slate-600 mb-3">
                  Statt zu löschen wird eine <strong>Stornorechnung</strong> mit negativen Beträgen angelegt.
                  Die Original-Rechnung bleibt für die Buchhaltung bestehen.
                </p>
                <form action={cancelInvoiceAction} className="space-y-2">
                  <input type="hidden" name="id" value={inv.id} />
                  <textarea name="reason" rows={2} placeholder="Grund (wird auf Stornorechnung vermerkt)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <button type="submit" className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                    Stornorechnung anlegen
                  </button>
                </form>
              </div>
            </details>
          )}
        </div>
      </div>
    </WorkshopShell>
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
    <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${map[status] ?? ""}`}>
      {label[status] ?? status}
    </span>
  );
}

function journalEventLabel(e: string) {
  return (
    { created: "Angelegt", sent: "Versendet", paid: "Bezahlt markiert", cancelled: "Storniert", note: "Notiz" }[
      e
    ] ?? e
  );
}
