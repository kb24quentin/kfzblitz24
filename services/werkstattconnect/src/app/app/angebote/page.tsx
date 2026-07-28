import Link from "next/link";
import { FileCheck, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName } from "@/lib/customer-name";
import { formatEur } from "@/lib/money";
import { WorkshopShell } from "../shell";

export const dynamic = "force-dynamic";

export default async function AngeboteListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; customerId?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { status, customerId } = await searchParams;
  const filter = status || "all";

  const quotes = await prisma.quote.findMany({
    where: {
      workshopId: ctx.workshopId,
      ...(filter === "all" ? {} : { status: filter }),
      ...(customerId ? { customerId } : {}),
    },
    include: { customer: true, vehicle: true },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  return (
    <WorkshopShell current="angebote">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-orange-600" />
            Angebote
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {quotes.length} {quotes.length === 1 ? "Angebot" : "Angebote"}
          </p>
        </div>
        <Link
          href="/app/angebote/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Neues Angebot
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "draft", "sent", "accepted", "rejected", "converted"] as const).map((s) => (
          <Link
            key={s}
            href={`/app/angebote?status=${s}`}
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

      {quotes.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
          <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">Keine Angebote.</p>
          <Link href="/app/angebote/new" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold">
            <Plus className="w-4 h-4" />
            Erstes Angebot erstellen
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nummer</th>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Gültig bis</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-right px-4 py-3 font-medium">Brutto</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/app/angebote/${q.id}`} className="font-mono text-xs font-semibold text-slate-900 hover:text-orange-600">
                      {q.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {q.issuedAt.toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {q.validUntil ? (
                      <span className={q.validUntil < new Date() ? "text-red-600 font-medium" : "text-slate-600"}>
                        {q.validUntil.toLocaleDateString("de-DE")}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium text-sm">{customerDisplayName(q.customer)}</div>
                    {q.vehicle?.licensePlate && (
                      <div className="text-xs text-slate-500">{q.vehicle.licensePlate}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 text-sm tabular-nums">{formatEur(q.totalGrossCent)}</td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={q.status} />
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
  return { all: "Alle", draft: "Entwürfe", sent: "Versendet", accepted: "Angenommen", rejected: "Abgelehnt", converted: "Konvertiert", expired: "Abgelaufen" }[s] ?? s;
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
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {statusLabel(status)}
    </span>
  );
}
