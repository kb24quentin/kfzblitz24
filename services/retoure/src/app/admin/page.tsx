export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { StatusBadge, STATUS_META, STATUSES } from "@/components/status-badge";
import { Search, Package, ExternalLink } from "lucide-react";

type Search = { status?: string; q?: string; page?: string };

export default async function AdminListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const status = params.status?.trim() || "";
  const q = params.q?.trim() || "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);
  const PAGE_SIZE = 30;

  const where: Prisma.RetoureCaseWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { bestellnummer: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerVorname: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { dhlTrackingNumber: { contains: q } },
      // Auch customer-eingegebene Tracking-Nummern matchen — wichtig
      // wenn das Paket-Label im PDA gescannt wurde und dort gespeichert ist.
      { customerTrackingNumber: { contains: q } },
      // Multi-Paket-Trackings (JSON-Array als String gespeichert).
      // Substring-Match auf `"<code>"` damit wir nicht zufällig auf
      // Teilstrings matchen.
      { additionalTrackings: { contains: `"${q}"` } },
    ];
  }

  const [cases, total, statusCounts] = await Promise.all([
    prisma.retoureCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.retoureCase.count({ where }),
    prisma.retoureCase.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
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
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={{ pathname: "/admin", query: q ? { q } : {} }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            !status
              ? "bg-[#0b3756] text-white border-[#0b3756]"
              : "bg-white text-[#3d4654] border-[#e6e8eb] hover:bg-[#f4f5f7]"
          }`}
        >
          Alle <span className="opacity-60">({totalAll})</span>
        </Link>
        {STATUSES.map((s) => {
          const c = countsByStatus[s] ?? 0;
          const active = status === s;
          return (
            <Link
              key={s}
              href={{ pathname: "/admin", query: { status: s, ...(q ? { q } : {}) } }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                active
                  ? "bg-[#0b3756] text-white border-[#0b3756]"
                  : "bg-white text-[#3d4654] border-[#e6e8eb] hover:bg-[#f4f5f7]"
              }`}
            >
              {STATUS_META[s]?.label ?? s}{" "}
              <span className="opacity-60">({c})</span>
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form className="flex gap-2" method="GET">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a93a0]" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Bestellnummer, Kunde, Email, Tracking-Nr."
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[#0b3756] text-white text-sm rounded-lg hover:bg-[#0e3f63]"
        >
          Suchen
        </button>
        {(q || status) && (
          <Link
            href="/admin"
            className="px-3 py-2 text-sm text-[#8a93a0] hover:text-[#0b3756]"
          >
            Zurücksetzen
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
        {cases.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-[#8a93a0] mb-3" />
            <p className="text-[#3d4654] font-medium">Keine Retouren gefunden</p>
            <p className="text-sm text-[#8a93a0] mt-1">
              {q || status
                ? "Filter ändern oder zurücksetzen."
                : "Sobald ein Kunde eine Retoure anmeldet, erscheint sie hier."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f4f5f7] border-b border-[#e6e8eb]">
              <tr className="text-left text-xs font-semibold text-[#8a93a0] uppercase tracking-wide">
                <th className="px-4 py-3">Bestellung</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Versand</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3 text-right">Erstattung</th>
                <th className="px-4 py-3">Eingang</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8eb]">
              {cases.map((c) => {
                const customer = [c.customerVorname, c.customerName]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr key={c.id} className="hover:bg-[#f4f5f7]/60">
                    <td className="px-4 py-3 font-mono text-xs text-[#0b3756] font-semibold">
                      {c.bestellnummer}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#3d4654]">
                        {customer || "—"}
                      </div>
                      {(c.customerPlz || c.customerOrt) && (
                        <div className="text-xs text-[#8a93a0]">
                          {[c.customerPlz, c.customerOrt].filter(Boolean).join(" ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3d4654]">
                      {c.shippingMode === "sicher" ? "Sichere Rückgabe" : "Standard"}
                      {c.labelPaid && (
                        <span className="ml-1 text-[#ff6600]">· Label</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {/*
                        Tracking-Spalte zeigt dhlTrackingNumber ODER
                        customerTrackingNumber + Badge wenn weitere
                        Pakete (additionalTrackings) drin sind. Letzteres
                        wird vom PDA beim Paket-Scan gesetzt — Worker
                        scannt Carrier-Label, Backend hängt's automatisch
                        an den Case.
                      */}
                      {(() => {
                        const trk = c.dhlTrackingNumber ?? c.customerTrackingNumber;
                        let extras: string[] = [];
                        try {
                          const parsed = JSON.parse(c.additionalTrackings ?? "[]");
                          if (Array.isArray(parsed)) {
                            extras = parsed.filter(
                              (s: unknown) => typeof s === "string",
                            );
                          }
                        } catch {}
                        if (!trk && extras.length === 0) {
                          return <span className="text-[#8a93a0]">—</span>;
                        }
                        const primary = trk ?? extras[0];
                        const extrasAfter = trk ? extras : extras.slice(1);
                        const tooltip = [
                          c.dhlTrackingNumber
                            ? `DHL: ${c.dhlTrackingNumber}`
                            : c.customerTrackingNumber
                              ? `Kunde: ${c.customerTrackingNumber}`
                              : null,
                          ...extrasAfter.map((e, i) => `Paket ${i + 2}: ${e}`),
                        ]
                          .filter(Boolean)
                          .join("\n");
                        return (
                          <span className="inline-flex items-center gap-1">
                            <a
                              href={`https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${primary}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#ff6600] hover:underline inline-flex items-center gap-1"
                              title={tooltip}
                            >
                              {primary}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {extrasAfter.length > 0 && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-[#ff6600] text-white text-[10px] font-bold"
                                title={tooltip}
                              >
                                +{extrasAfter.length}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-[#0b3756]">
                        {c.voraussichtlicheErstattung.toFixed(2).replace(".", ",")} €
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8a93a0]">
                      {c.createdAt.toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/${c.id}`}
                        className="text-xs text-[#0b3756] hover:underline font-medium"
                      >
                        Öffnen →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#8a93a0]">
            {total} Cases · Seite {page} von {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{
                  pathname: "/admin",
                  query: { ...(status && { status }), ...(q && { q }), page: page - 1 },
                }}
                className="px-3 py-1.5 bg-white border border-[#e6e8eb] rounded-lg hover:bg-[#f4f5f7]"
              >
                ← Zurück
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{
                  pathname: "/admin",
                  query: { ...(status && { status }), ...(q && { q }), page: page + 1 },
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
