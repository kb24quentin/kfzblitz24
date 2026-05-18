export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { SupplierForm } from "../supplier-form";
import { updateSupplierAction } from "../actions";
import { SupplierReturnStatusBadge } from "@/components/supplier-return-status-badge";

export default async function SupplierEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [supplier, returns] = await Promise.all([
    prisma.supplier.findUnique({ where: { id } }),
    prisma.supplierReturn.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (!supplier) notFound();

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <Link
          href="/admin/suppliers"
          className="inline-flex items-center gap-1 text-sm text-[#8a93a0] hover:text-[#0b3756]"
        >
          <ChevronLeft className="w-4 h-4" /> Zurück zur Liste
        </Link>
        <h1 className="text-2xl font-bold text-[#0b3756] mt-2">
          {supplier.name}
        </h1>
        <p className="text-sm text-[#8a93a0] mt-1">
          Lieferanten-Stammdaten · {returns.length} Retoure
          {returns.length === 1 ? "" : "n"}
        </p>
      </div>

      {/* Edit-Form */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8a93a0] mb-3">
          Stammdaten bearbeiten
        </h2>
        <SupplierForm
          action={updateSupplierAction}
          cancelHref="/admin/suppliers"
          initial={supplier}
          submitLabel="Speichern"
        />
      </section>

      {/* Retouren dieses Lieferanten */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8a93a0]">
            Lieferanten-Retouren
          </h2>
          <Link
            href={{
              pathname: "/admin/supplier-returns",
              query: { supplierId: supplier.id },
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff6600] text-white text-xs font-medium rounded-lg hover:bg-[#e65a00]"
          >
            <Plus className="w-3.5 h-3.5" /> Neue Retoure anlegen
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
          {returns.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#8a93a0]">
              Noch keine Retouren an diesen Lieferanten.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#0b3756] text-white">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                  <th className="px-4 py-3">Angelegt</th>
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
      </section>
    </div>
  );
}
