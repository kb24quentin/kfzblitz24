export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Factory, Plus } from "lucide-react";

/**
 * Lieferanten-Stammdaten — Übersichtsseite.
 *
 * Tabelle: Name, Stadt, Active-Flag, Anzahl offene Retouren.
 * "Offen" = Status ist NICHT eines von ["gutschrift_erhalten", "abgelehnt"].
 */
export default async function SuppliersListPage() {
  // Zwei separate Queries — `_count` mit `where`-Filter ist Prisma-Preview-
  // Feature (`filteredRelationCount`) und in unserer Konfiguration nicht
  // aktiviert. Stattdessen: alle Lieferanten + groupBy über offene Retouren.
  const [suppliers, openCounts] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.supplierReturn.groupBy({
      by: ["supplierId"],
      where: {
        status: { notIn: ["gutschrift_erhalten", "abgelehnt"] },
      },
      _count: { _all: true },
    }),
  ]);

  const openBySupplier: Record<string, number> = {};
  for (const r of openCounts) {
    openBySupplier[r.supplierId] = r._count._all;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b3756]">Lieferanten</h1>
          <p className="text-sm text-[#8a93a0] mt-1">
            Stammdaten für Hersteller-Retouren. Pro Lieferant lassen sich
            mehrere Retoure-Sendungen anlegen.
          </p>
        </div>
        <Link
          href="/admin/suppliers/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00]"
        >
          <Plus className="w-4 h-4" /> Neuer Lieferant
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Factory className="w-12 h-12 mx-auto text-[#8a93a0] mb-3" />
            <p className="text-[#3d4654] font-medium">
              Noch keine Lieferanten angelegt
            </p>
            <p className="text-sm text-[#8a93a0] mt-1">
              Lege den ersten Hersteller / Lieferanten an, um Retouren
              zuordnen zu können.
            </p>
            <Link
              href="/admin/suppliers/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00]"
            >
              <Plus className="w-4 h-4" /> Ersten Lieferanten anlegen
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#0b3756] text-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Stadt</th>
                <th className="px-4 py-3">Kontakt</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Offene Retouren</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8eb]">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-[#f4f5f7]/60">
                  <td className="px-4 py-3 font-semibold text-[#0b3756]">
                    <span className="inline-flex items-center gap-2">
                      {s.shortCode && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0b3756] text-white text-[10px] font-mono font-bold tracking-wider">
                          {s.shortCode}
                        </span>
                      )}
                      {s.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#3d4654]">
                    {[s.postalCode, s.city].filter(Boolean).join(" ") || (
                      <span className="text-[#8a93a0]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#3d4654]">
                    {s.contactPerson || s.email || (
                      <span className="text-[#8a93a0]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.active ? (
                      <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Aktiv
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                        Inaktiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {(openBySupplier[s.id] ?? 0) > 0 ? (
                      <span className="font-semibold text-[#ff6600]">
                        {openBySupplier[s.id]}
                      </span>
                    ) : (
                      <span className="text-[#8a93a0]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/suppliers/${s.id}`}
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
    </div>
  );
}
