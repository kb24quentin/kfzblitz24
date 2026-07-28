import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName } from "@/lib/customer-name";
import { formatEur } from "@/lib/money";
import { WorkshopShell } from "../shell";

export const dynamic = "force-dynamic";

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; customerId?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { status, customerId } = await searchParams;
  const filter = status || "all";

  const invoices = await prisma.invoice.findMany({
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
    <WorkshopShell current="rechnungen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-orange-600" />
            Rechnungen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {invoices.length} {invoices.length === 1 ? "Rechnung" : "Rechnungen"} · GoBD-konforme Nummerierung
          </p>
        </div>
        <Link
          href="/app/rechnungen/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Neue Rechnung
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "draft", "sent", "paid", "cancelled"] as const).map((s) => (
          <Link
            key={s}
            href={`/app/rechnungen?status=${s}`}
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

      {invoices.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">Keine Rechnungen.</p>
          <Link href="/app/rechnungen/new" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold">
            <Plus className="w-4 h-4" />
            Erste Rechnung erstellen
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
                <th className="text-right px-4 py-3 font-medium">Netto</th>
                <th className="text-right px-4 py-3 font-medium">Brutto</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/app/rechnungen/${i.id}`} className="font-mono text-xs font-semibold text-slate-900 hover:text-orange-600">
                      {i.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {i.issuedAt.toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium text-sm">{customerDisplayName(i.customer)}</div>
                    {i.vehicle?.licensePlate && (
                      <div className="text-xs text-slate-500">{i.vehicle.licensePlate}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 text-xs tabular-nums">{formatEur(i.subtotalNetCent)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 text-sm tabular-nums">{formatEur(i.totalGrossCent)}</td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={i.status} />
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
  return { all: "Alle", draft: "Entwürfe", sent: "Versendet", paid: "Bezahlt", cancelled: "Storniert" }[s] ?? s;
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
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {label[status] ?? status}
    </span>
  );
}
