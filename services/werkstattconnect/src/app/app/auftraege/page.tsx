import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName } from "@/lib/customer-name";
import { formatEur } from "@/lib/money";
import { WorkshopShell } from "../shell";

export const dynamic = "force-dynamic";

export default async function AuftraegePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { status } = await searchParams;
  const filter = status || "all";
  const orders = await prisma.order.findMany({
    where: {
      workshopId: ctx.workshopId,
      ...(filter === "all" ? {} : { status: filter }),
    },
    include: { customer: true, vehicle: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <WorkshopShell current="auftraege">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            Aufträge
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {orders.length} {orders.length === 1 ? "Auftrag" : "Aufträge"}
          </p>
        </div>
        <Link
          href="/app/auftraege/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Neuer Auftrag
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "draft", "sent_for_signature", "signed", "in_progress", "awaiting_reapproval", "completed", "invoiced", "cancelled"] as const).map((s) => (
          <Link
            key={s}
            href={`/app/auftraege?status=${s}`}
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

      {orders.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">Keine Aufträge.</p>
          <Link href="/app/auftraege/new" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold">
            <Plus className="w-4 h-4" />
            Ersten Auftrag anlegen
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nummer</th>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-right px-4 py-3 font-medium">Freigabe bis</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/app/auftraege/${o.id}`} className="font-mono text-xs font-semibold text-slate-900 hover:text-orange-600">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{o.createdAt.toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium text-sm">{customerDisplayName(o.customer)}</div>
                    {o.vehicle?.licensePlate && <div className="text-xs text-slate-500">{o.vehicle.licensePlate}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-sm tabular-nums">
                    {o.approvedAmountCent != null ? formatEur(o.approvedAmountCent) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
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

function statusLabel(s: string) {
  return {
    all: "Alle",
    draft: "Entwürfe",
    sent_for_signature: "Signatur angefragt",
    signed: "Signiert",
    in_progress: "In Arbeit",
    awaiting_reapproval: "Erneute Freigabe",
    completed: "Abgeschlossen",
    invoiced: "Berechnet",
    cancelled: "Storniert",
  }[s] ?? s;
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
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-slate-100"}`}>
      {statusLabel(status)}
    </span>
  );
}
