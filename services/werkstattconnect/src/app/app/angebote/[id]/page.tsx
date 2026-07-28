import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Send, ArrowRight, Check, X, Trash2, FileCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { formatEur, type InvoicePosition } from "@/lib/money";
import { WorkshopShell } from "../../shell";
import {
  sendQuoteAction,
  updateQuoteStatusAction,
  deleteQuoteAction,
} from "../actions";
import { convertQuoteToOrderAction } from "../../auftraege/actions";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { id } = await params;
  const q = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      creator: { select: { name: true, email: true } },
      convertedToInvoice: { select: { id: true, invoiceNumber: true } },
    },
  });
  if (!q || q.workshopId !== ctx.workshopId) notFound();

  const positions = q.positions as unknown as InvoicePosition[];
  const labor = positions.filter((p) => p.kind === "labor");
  const parts = positions.filter((p) => p.kind === "part");

  return (
    <WorkshopShell current="angebote">
      <div className="mb-6">
        <Link href="/app/angebote" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Alle Angebote
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-orange-600" />
              {q.quoteNumber}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {q.issuedAt.toLocaleDateString("de-DE")} · {customerDisplayName(q.customer)}
              {q.vehicle && ` · ${vehicleDisplayName(q.vehicle)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <a href={`/app/angebote/${q.id}/pdf`} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50">
              <Download className="w-3.5 h-3.5" />PDF
            </a>
            {q.status !== "converted" && q.customer.email && (
              <form action={sendQuoteAction}>
                <input type="hidden" name="id" value={q.id} />
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700">
                  <Send className="w-3.5 h-3.5" />Per E-Mail
                </button>
              </form>
            )}
            {q.status !== "converted" && q.status !== "rejected" && (
              <form action={convertQuoteToOrderAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                  <ArrowRight className="w-3.5 h-3.5" />In Auftrag umwandeln
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {labor.length > 0 && (
            <PositionsTable title="Arbeitsleistung" positions={labor} />
          )}
          {parts.length > 0 && (
            <PositionsTable title="Ersatzteile / Material" positions={parts} />
          )}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div />
              <div className="text-right space-y-1">
                <div><span className="text-slate-500">Netto:</span> <span className="font-medium ml-2 tabular-nums">{formatEur(q.subtotalNetCent)}</span></div>
                <div><span className="text-slate-500">MwSt:</span> <span className="font-medium ml-2 tabular-nums">{formatEur(q.totalVatCent)}</span></div>
                <div className="text-lg pt-1 border-t border-slate-200"><span className="text-slate-500">Brutto:</span> <span className="font-bold ml-2 text-orange-600 tabular-nums">{formatEur(q.totalGrossCent)}</span></div>
              </div>
            </div>
          </section>
          {q.notes && (
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Notiz</h2>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{q.notes}</p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Status</h2>
            <QuoteStatusBadge status={q.status} />
            {q.convertedToInvoice && (
              <p className="text-xs text-slate-500 mt-2">
                Konvertiert in{" "}
                <Link href={`/app/rechnungen/${q.convertedToInvoice.id}`} className="text-orange-600 hover:underline font-mono">
                  {q.convertedToInvoice.invoiceNumber}
                </Link>
              </p>
            )}
            {q.validUntil && (
              <p className="text-xs text-slate-500 mt-2">
                Gültig bis <strong className={q.validUntil < new Date() ? "text-red-600" : "text-slate-900"}>{q.validUntil.toLocaleDateString("de-DE")}</strong>
              </p>
            )}
            {q.status !== "converted" && (
              <div className="mt-4 space-y-2">
                {q.status !== "accepted" && (
                  <form action={updateQuoteStatusAction}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="status" value="accepted" />
                    <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                      <Check className="w-3.5 h-3.5" />Als angenommen markieren
                    </button>
                  </form>
                )}
                {q.status !== "rejected" && (
                  <form action={updateQuoteStatusAction}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50">
                      <X className="w-3.5 h-3.5" />Abgelehnt markieren
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Kunde</h2>
            <Link href={`/app/kunden/${q.customer.id}`} className="text-sm font-medium text-slate-900 hover:text-orange-600">
              {customerDisplayName(q.customer)}
            </Link>
            {q.customer.email && <div className="text-xs text-slate-500 mt-1">{q.customer.email}</div>}
          </section>
          {q.vehicle && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Fahrzeug</h2>
              <Link href={`/app/kunden/${q.customer.id}/fahrzeuge/${q.vehicle.id}`} className="text-sm font-medium text-slate-900 hover:text-orange-600">
                {vehicleDisplayName(q.vehicle)}
              </Link>
              {q.mileageAtIssue != null && (
                <div className="text-xs text-slate-500 mt-1">km bei Angebot: {q.mileageAtIssue.toLocaleString("de-DE")}</div>
              )}
            </section>
          )}
          {q.status !== "converted" && (
            <details className="bg-white border border-red-200 rounded-xl">
              <summary className="cursor-pointer list-none px-5 py-4">
                <span className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />Angebot löschen
                </span>
              </summary>
              <div className="border-t border-red-100 p-5">
                <form action={deleteQuoteAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <button type="submit" className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Wirklich löschen</button>
                </form>
              </div>
            </details>
          )}
        </div>
      </div>
    </WorkshopShell>
  );
}

function PositionsTable({ title, positions }: { title: string; positions: InvoicePosition[] }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <header className="px-6 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      </header>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {positions.map((p, idx) => (
            <tr key={idx}>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{p.name}</div>
                {p.description && <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>}
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums w-20">{p.quantity} {p.unit}</td>
              <td className="px-4 py-3 text-right text-sm tabular-nums w-24">{formatEur(p.netPriceCent)}</td>
              <td className="px-4 py-3 text-right text-sm w-14">{p.vatPercent}%</td>
              <td className="px-4 py-3 text-right font-semibold text-sm tabular-nums w-24">{formatEur(p.netTotalCent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function QuoteStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-50 text-blue-700",
    accepted: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    converted: "bg-indigo-50 text-indigo-700",
    expired: "bg-amber-50 text-amber-700",
  };
  const label: Record<string, string> = {
    draft: "Entwurf",
    sent: "Versendet",
    accepted: "Angenommen",
    rejected: "Abgelehnt",
    converted: "Konvertiert",
    expired: "Abgelaufen",
  };
  return (
    <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}
