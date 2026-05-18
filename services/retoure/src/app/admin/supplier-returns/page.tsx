export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  SupplierReturnStatusBadge,
  SUPPLIER_RETURN_STATUSES,
  SUPPLIER_RETURN_STATUS_META,
} from "@/components/supplier-return-status-badge";
import { PackageOpen, Plus } from "lucide-react";
import { listActiveSuppliers } from "@/lib/suppliers";
import { createSupplierReturnAction } from "./actions";

type Search = {
  status?: string;
  supplierId?: string;
  page?: string;
};

/**
 * Operations-Übersicht für alle Lieferanten-Retouren.
 *
 * - Filter-Chips nach Status (Default: alle "offenen" = nicht erstattet/abgelehnt).
 * - Schnellanlage-Form am Kopf, wenn aktive Lieferanten existieren.
 * - Pro Zeile: Lieferant, Container-Code, Tracking, Status, Datum.
 */
export default async function SupplierReturnsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const status = params.status?.trim() || "";
  const preselectSupplierId = params.supplierId?.trim() || "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);
  const PAGE_SIZE = 50;

  const where = status ? { status } : {};

  const [returns, total, statusCounts, suppliers] = await Promise.all([
    prisma.supplierReturn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { supplier: true },
    }),
    prisma.supplierReturn.count({ where }),
    prisma.supplierReturn.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    listActiveSuppliers(),
  ]);

  const countsByStatus: Record<string, number> = {};
  let totalAll = 0;
  for (const r of statusCounts) {
    countsByStatus[r.status] = r._count.status;
    totalAll += r._count.status;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b3756]">
            Lieferanten-Retouren
          </h1>
          <p className="text-sm text-[#8a93a0] mt-1">
            Alle Hersteller-Retouren über alle Lieferanten hinweg.
          </p>
        </div>
      </div>

      {/* Schnellanlage */}
      {suppliers.length > 0 ? (
        <form
          action={createSupplierReturnAction}
          className="bg-white rounded-xl border border-[#e6e8eb] p-4 flex flex-col md:flex-row md:items-end gap-3"
        >
          <label className="flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a93a0]">
              Lieferant <span className="text-[#ff6600]">*</span>
            </span>
            <select
              name="supplierId"
              required
              defaultValue={preselectSupplierId}
              autoFocus
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm text-[#3d4654] focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
            >
              <option value="">— wählen —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` · ${s.city}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a93a0]">
              Container-ID (optional)
            </span>
            <input
              name="containerId"
              maxLength={40}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm text-[#3d4654] focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
              placeholder="z. B. PAL-2026-000042"
            />
          </label>
          <label className="flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a93a0]">
              Notiz (optional)
            </span>
            <input
              name="notes"
              maxLength={500}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm text-[#3d4654] focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Retoure anlegen
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-dashed border-[#e6e8eb] bg-white p-6 text-sm text-[#8a93a0]">
          Noch keine aktiven Lieferanten.{" "}
          <Link
            href="/admin/suppliers/new"
            className="text-[#ff6600] hover:underline font-medium"
          >
            Ersten Lieferanten anlegen →
          </Link>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/supplier-returns"
          className={chip(!status)}
        >
          Alle <span className="opacity-60">({totalAll})</span>
        </Link>
        {SUPPLIER_RETURN_STATUSES.map((s) => {
          const c = countsByStatus[s] ?? 0;
          const active = status === s;
          return (
            <Link
              key={s}
              href={{
                pathname: "/admin/supplier-returns",
                query: { status: s },
              }}
              className={chip(active)}
            >
              {SUPPLIER_RETURN_STATUS_META[s]?.label ?? s}{" "}
              <span className="opacity-60">({c})</span>
            </Link>
          );
        })}
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
        {returns.length === 0 ? (
          <div className="p-12 text-center">
            <PackageOpen className="w-12 h-12 mx-auto text-[#8a93a0] mb-3" />
            <p className="text-[#3d4654] font-medium">
              Keine Lieferanten-Retouren gefunden
            </p>
            <p className="text-sm text-[#8a93a0] mt-1">
              {status
                ? "Filter zurücksetzen oder oben eine neue Retoure anlegen."
                : "Sobald die erste Hersteller-Retoure angelegt ist, erscheint sie hier."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#0b3756] text-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-3">Angelegt</th>
                <th className="px-4 py-3">Lieferant</th>
                <th className="px-4 py-3">Container</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Gutschrift</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8eb]">
              {returns.map((r) => (
                <tr key={r.id} className="hover:bg-[#f4f5f7]/60">
                  <td className="px-4 py-3 text-xs text-[#8a93a0]">
                    {r.createdAt.toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/suppliers/${r.supplier.id}`}
                      className="font-semibold text-[#0b3756] hover:underline"
                    >
                      {r.supplier.name}
                    </Link>
                    {r.supplier.city && (
                      <div className="text-xs text-[#8a93a0]">
                        {r.supplier.city}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#0b3756]">
                    {r.containerId ?? (
                      <span className="text-[#8a93a0]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.trackingNumber ?? (
                      <span className="text-[#8a93a0]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SupplierReturnStatusBadge status={r.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {r.refundAmount != null
                      ? `${r.refundAmount.toFixed(2).replace(".", ",")} €`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/supplier-returns/${r.id}`}
                      className="text-xs text-[#0b3756] hover:underline font-medium"
                    >
                      Öffnen →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#8a93a0]">
            {total} Retouren · Seite {page} von {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{
                  pathname: "/admin/supplier-returns",
                  query: {
                    ...(status && { status }),
                    page: page - 1,
                  },
                }}
                className="px-3 py-1.5 bg-white border border-[#e6e8eb] rounded-lg hover:bg-[#f4f5f7]"
              >
                ← Zurück
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{
                  pathname: "/admin/supplier-returns",
                  query: {
                    ...(status && { status }),
                    page: page + 1,
                  },
                }}
                className="px-3 py-1.5 bg-white border border-[#e6e8eb] rounded-lg hover:bg-[#f4f5f7]"
              >
                Weiter →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function chip(active: boolean) {
  return `px-3 py-1.5 rounded-full text-xs font-medium border ${
    active
      ? "bg-[#0b3756] text-white border-[#0b3756]"
      : "bg-white text-[#3d4654] border-[#e6e8eb] hover:bg-[#f4f5f7]"
  }`;
}
