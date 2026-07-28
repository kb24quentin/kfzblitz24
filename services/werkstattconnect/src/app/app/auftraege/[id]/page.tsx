import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Send,
  Signature,
  Mail,
  Phone,
  Tablet,
  Play,
  CheckCircle2,
  FileText,
  Ban,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { formatEur, type InvoicePosition } from "@/lib/money";
import { WorkshopShell } from "../../shell";
import {
  cancelOrderAction,
  completeOrderAction,
  convertOrderToInvoiceAction,
  requestSignatureEmailAction,
  requestSignatureInPersonAction,
  requestSignatureSmsAction,
  startOrderWorkAction,
  updateOrderApprovalAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { id } = await params;
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      creator: { select: { name: true } },
      quote: { select: { id: true, quoteNumber: true } },
      convertedToInvoice: { select: { id: true, invoiceNumber: true } },
      signatureRequests: { orderBy: { requestedAt: "desc" } },
    },
  });
  if (!o || o.workshopId !== ctx.workshopId) notFound();

  const positions = o.positions as unknown as InvoicePosition[];
  const labor = positions.filter((p) => p.kind === "labor");
  const parts = positions.filter((p) => p.kind === "part");
  const currentReq = o.signatureRequests.find((r) => r.status === "pending");
  const canRequestSignature = ["draft", "sent_for_signature", "in_progress", "awaiting_reapproval"].includes(o.status);
  const isSigned = o.signedAt != null;
  const overBudget = o.approvedAmountCent != null && o.totalGrossCent > o.approvedAmountCent;

  return (
    <WorkshopShell current="auftraege">
      <div className="mb-6">
        <Link href="/app/auftraege" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Alle Aufträge
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-orange-600" />
              {o.orderNumber}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {o.createdAt.toLocaleDateString("de-DE")} · {customerDisplayName(o.customer)}
              {o.vehicle && ` · ${vehicleDisplayName(o.vehicle)}`}
              {o.quote && <> · aus <Link href={`/app/angebote/${o.quote.id}`} className="text-orange-600 hover:underline">{o.quote.quoteNumber}</Link></>}
            </p>
          </div>
          <StatusBadge status={o.status} />
        </div>
      </div>

      {overBudget && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">
              Aktueller Betrag ({formatEur(o.totalGrossCent)}) über dem Freigabe-Rahmen ({formatEur(o.approvedAmountCent!)})
            </div>
            <div className="text-sm text-amber-800 mt-0.5">
              Vor Ausführung neue Freigabe vom Kunden einholen.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Positions + Freigabe + Signatur-Request-Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Freigabe-rahmen (editierbar wenn nicht signiert oder wenn reapproval nötig) */}
          <section className="bg-white border-l-4 border-orange-500 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Freigabe-Rahmen</h2>
              {isSigned && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">✓ Signiert</span>}
            </div>
            <form action={updateOrderApprovalAction} className="space-y-3">
              <input type="hidden" name="id" value={o.id} />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Maximaler Betrag (EUR)</label>
                <input
                  name="approvedAmount"
                  defaultValue={((o.approvedAmountCent ?? o.totalGrossCent) / 100).toFixed(2).replace(".", ",")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-2xl font-bold text-right tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vereinbarung (was darf gemacht werden?)
                </label>
                <textarea
                  name="approvalFreetext"
                  rows={3}
                  defaultValue={o.approvalFreetext ?? ""}
                  placeholder="z.B. Diagnose + Reparatur bis 500€. Darüber hinaus vorher telefonisch anrufen."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <button type="submit" className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800">
                Speichern
              </button>
            </form>
          </section>

          {/* Signatur einholen */}
          {canRequestSignature && (
            <section className="bg-gradient-to-br from-orange-50 to-white border border-orange-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Signature className="w-5 h-5 text-orange-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  {isSigned ? "Neue Freigabe einholen" : "Signatur einholen"}
                </h2>
              </div>
              {isSigned && (
                <p className="text-xs text-slate-600 mb-4">
                  Die vorherige Signatur bleibt im Audit-Trail. Der neue Rahmen ersetzt sie erst nach der Freigabe.
                </p>
              )}

              <div className="grid md:grid-cols-3 gap-2">
                {/* In Person */}
                <form action={requestSignatureInPersonAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="w-full inline-flex flex-col items-center gap-1 p-4 border border-slate-300 rounded-lg hover:border-orange-500 hover:bg-white transition text-slate-900">
                    <Tablet className="w-5 h-5 text-orange-600" />
                    <span className="text-xs font-semibold">Vor Ort (Tablet)</span>
                    <span className="text-[10px] text-slate-500">Kunde signiert hier</span>
                  </button>
                </form>
                {/* Email */}
                <form action={requestSignatureEmailAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <div className="border border-slate-300 rounded-lg p-3 hover:border-orange-500 transition">
                    <div className="flex flex-col items-center gap-1 mb-2">
                      <Mail className="w-5 h-5 text-orange-600" />
                      <span className="text-xs font-semibold">Per E-Mail</span>
                    </div>
                    <input
                      type="email"
                      name="email"
                      required
                      defaultValue={o.customer.email ?? ""}
                      placeholder="kunde@example.de"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs mb-2"
                    />
                    <button className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-orange-600 text-white rounded text-xs font-semibold">
                      <Send className="w-3 h-3" /> Link senden
                    </button>
                  </div>
                </form>
                {/* SMS */}
                <form action={requestSignatureSmsAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <div className="border border-slate-300 rounded-lg p-3 hover:border-orange-500 transition">
                    <div className="flex flex-col items-center gap-1 mb-2">
                      <Phone className="w-5 h-5 text-orange-600" />
                      <span className="text-xs font-semibold">Per SMS</span>
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      required
                      defaultValue={o.customer.phone ?? ""}
                      placeholder="+49 176 12345"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs mb-2"
                    />
                    <button className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-orange-600 text-white rounded text-xs font-semibold">
                      <Send className="w-3 h-3" /> SMS senden
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Positions */}
          {(labor.length > 0 || parts.length > 0) && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <header className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Positionen</h2>
              </header>
              {labor.length > 0 && <PosTable title="Arbeitsleistung" positions={labor} />}
              {parts.length > 0 && <PosTable title="Ersatzteile / Material" positions={parts} />}
              <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
                <span className="text-sm text-slate-500">Kalkuliert (brutto)</span>
                <span className="text-xl font-bold text-slate-900 tabular-nums">{formatEur(o.totalGrossCent)}</span>
              </div>
            </section>
          )}

          {/* Signatur-History */}
          {o.signatureRequests.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <header className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Signatur-Historie ({o.signatureRequests.length})
                </h2>
              </header>
              <ul className="divide-y divide-slate-100">
                {o.signatureRequests.map((r) => (
                  <li key={r.id} className="px-6 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-slate-900">
                          {sentViaLabel(r.sentVia)}
                          {r.sentTo && ` an ${r.sentTo}`}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          {r.requestedAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                        {r.approvedAmountCent != null && (
                          <span className="text-xs text-slate-600 ml-2">
                            · Rahmen {formatEur(r.approvedAmountCent)}
                          </span>
                        )}
                      </div>
                      <SignReqStatus status={r.status} respondedAt={r.respondedAt} name={r.signedByName} />
                    </div>
                    {r.status === "pending" && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <code className="px-2 py-0.5 bg-slate-100 rounded font-mono truncate flex-1 max-w-md">
                          {`/sign/${r.token}`}
                        </code>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* RIGHT: Actions + Kunde + Signatur-Info */}
        <div className="space-y-4">
          {/* Kunde */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Kunde</h2>
            <Link href={`/app/kunden/${o.customer.id}`} className="text-sm font-medium text-slate-900 hover:text-orange-600">
              {customerDisplayName(o.customer)}
            </Link>
            {o.customer.email && <div className="text-xs text-slate-500 mt-1">{o.customer.email}</div>}
            {o.customer.phone && <div className="text-xs text-slate-500">{o.customer.phone}</div>}
          </section>

          {/* Signatur-Info */}
          {isSigned && (
            <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-emerald-700 font-semibold mb-2">
                ✓ Signiert
              </h2>
              <div className="text-sm font-medium text-emerald-900">{o.signedByName}</div>
              {o.signedAt && (
                <div className="text-xs text-emerald-700">
                  {o.signedAt.toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
                </div>
              )}
              {o.signatureSvg && (
                <div className="mt-3 bg-white rounded p-2 border border-emerald-100">
                  <img src={o.signatureSvg} alt="Unterschrift" className="w-full h-16 object-contain" />
                </div>
              )}
            </section>
          )}

          {/* Actions */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Aktionen</h2>
            {o.status === "signed" && (
              <form action={startOrderWorkAction}>
                <input type="hidden" name="id" value={o.id} />
                <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
                  <Play className="w-4 h-4" /> Arbeit beginnen
                </button>
              </form>
            )}
            {(o.status === "in_progress" || o.status === "signed") && (
              <form action={completeOrderAction}>
                <input type="hidden" name="id" value={o.id} />
                <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Auftrag abschließen
                </button>
              </form>
            )}
            {o.status === "completed" && (
              <form action={convertOrderToInvoiceAction}>
                <input type="hidden" name="id" value={o.id} />
                <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
                  <FileText className="w-4 h-4" /> Rechnung erstellen
                </button>
              </form>
            )}
            {o.convertedToInvoice && (
              <Link
                href={`/app/rechnungen/${o.convertedToInvoice.id}`}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
              >
                <FileText className="w-4 h-4" /> Zur Rechnung {o.convertedToInvoice.invoiceNumber}
              </Link>
            )}
          </section>

          {/* Danger */}
          {o.status !== "cancelled" && o.status !== "invoiced" && (
            <details className="bg-white border border-red-200 rounded-xl">
              <summary className="cursor-pointer list-none px-5 py-4">
                <span className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <Ban className="w-3.5 h-3.5" /> Auftrag stornieren
                </span>
              </summary>
              <div className="border-t border-red-100 p-5">
                <form action={cancelOrderAction} className="space-y-2">
                  <input type="hidden" name="id" value={o.id} />
                  <textarea
                    name="reason"
                    rows={2}
                    placeholder="Grund (optional)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button type="submit" className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold">
                    Stornieren
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

function PosTable({ title, positions }: { title: string; positions: InvoicePosition[] }) {
  return (
    <div>
      <div className="px-6 pt-3 pb-1 text-xs font-semibold text-slate-500">{title}</div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {positions.map((p, i) => (
            <tr key={i}>
              <td className="px-6 py-2.5">
                <div className="font-medium text-slate-900">{p.name}</div>
                {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-slate-600 w-24">{p.quantity} {p.unit}</td>
              <td className="px-4 py-2.5 text-right text-sm tabular-nums w-24">{formatEur(p.netTotalCent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sentViaLabel(v: string) {
  return { in_person: "Vor Ort (Tablet)", email: "E-Mail", sms: "SMS" }[v] ?? v;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent_for_signature: "bg-blue-50 text-blue-700",
    signed: "bg-emerald-50 text-emerald-700",
    in_progress: "bg-orange-50 text-orange-700",
    awaiting_reapproval: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-100 text-emerald-800",
    invoiced: "bg-indigo-50 text-indigo-700",
    cancelled: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    draft: "Entwurf",
    sent_for_signature: "Signatur angefragt",
    signed: "Signiert",
    in_progress: "In Arbeit",
    awaiting_reapproval: "Erneute Freigabe",
    completed: "Abgeschlossen",
    invoiced: "In Rechnung",
    cancelled: "Storniert",
  };
  return (
    <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}

function SignReqStatus({ status, respondedAt, name }: { status: string; respondedAt: Date | null; name: string | null }) {
  if (status === "signed") return <span className="text-xs text-emerald-700 font-medium">✓ {name} · {respondedAt?.toLocaleDateString("de-DE")}</span>;
  if (status === "pending") return <span className="text-xs text-amber-700 font-medium">Ausstehend</span>;
  if (status === "expired") return <span className="text-xs text-slate-500">Abgelaufen</span>;
  if (status === "cancelled") return <span className="text-xs text-slate-500">Zurückgezogen</span>;
  return <span className="text-xs">{status}</span>;
}
