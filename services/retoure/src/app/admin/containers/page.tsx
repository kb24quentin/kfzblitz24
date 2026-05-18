export const dynamic = "force-dynamic";

import Link from "next/link";
import { Boxes, Filter } from "lucide-react";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Search = {
  status?: string;
  type?: string;
  page?: string;
};

/** Filterbare Container-Status-Werte. */
const STATUSES = ["open", "closed", "shipped", "received_supplier"] as const;
type ContainerStatus = (typeof STATUSES)[number];

const STATUS_META: Record<
  ContainerStatus,
  { label: string; bg: string; text: string }
> = {
  open: { label: "Offen", bg: "bg-blue-100", text: "text-blue-800" },
  closed: { label: "Geschlossen", bg: "bg-amber-100", text: "text-amber-800" },
  shipped: { label: "Versandt", bg: "bg-purple-100", text: "text-purple-800" },
  received_supplier: {
    label: "Beim Lieferanten",
    bg: "bg-green-100",
    text: "text-green-800",
  },
};

const TYPES = ["palette", "carton", "bag"] as const;
type ContainerType = (typeof TYPES)[number];
const TYPE_LABEL: Record<ContainerType, string> = {
  palette: "Palette",
  carton: "Karton",
  bag: "Beutel",
};

/** "Bald überfällig" Schwelle in Tagen (siehe CLAUDE.md §11). */
const SOON_OVERDUE_DAYS = 2;

export default async function ContainersListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const status = (params.status?.trim() as ContainerStatus | "") || "";
  const type = (params.type?.trim() as ContainerType | "") || "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);
  const PAGE_SIZE = 30;

  const where: Prisma.ContainerWhereInput = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const [containers, total, statusCounts, itemCounts] = await Promise.all([
    prisma.container.findMany({
      where,
      orderBy: { openedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.container.count({ where }),
    prisma.container.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.retoureItem.groupBy({
      by: ["containerId"],
      where: { containerId: { not: null } },
      _count: { containerId: true },
    }),
  ]);

  const countsByStatus: Record<string, number> = {};
  let totalAll = 0;
  for (const r of statusCounts) {
    countsByStatus[r.status] = r._count.status;
    totalAll += r._count.status;
  }

  const itemsByContainer: Record<string, number> = {};
  for (const r of itemCounts) {
    if (r.containerId) itemsByContainer[r.containerId] = r._count.containerId;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = Date.now();
  const soonThreshold = now + SOON_OVERDUE_DAYS * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      {/* Filter: status chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={{ pathname: "/admin/containers", query: type ? { type } : {} }}
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
              href={{
                pathname: "/admin/containers",
                query: { status: s, ...(type ? { type } : {}) },
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                active
                  ? "bg-[#0b3756] text-white border-[#0b3756]"
                  : "bg-white text-[#3d4654] border-[#e6e8eb] hover:bg-[#f4f5f7]"
              }`}
            >
              {STATUS_META[s].label} <span className="opacity-60">({c})</span>
            </Link>
          );
        })}
      </div>

      {/* Filter: type */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[#8a93a0] inline-flex items-center gap-1">
          <Filter className="w-3 h-3" /> Typ:
        </span>
        <Link
          href={{
            pathname: "/admin/containers",
            query: status ? { status } : {},
          }}
          className={`px-2.5 py-1 rounded-full font-medium border ${
            !type
              ? "bg-[#ff6600] text-white border-[#ff6600]"
              : "bg-white text-[#3d4654] border-[#e6e8eb] hover:bg-[#f4f5f7]"
          }`}
        >
          Alle
        </Link>
        {TYPES.map((t) => {
          const active = type === t;
          return (
            <Link
              key={t}
              href={{
                pathname: "/admin/containers",
                query: { type: t, ...(status ? { status } : {}) },
              }}
              className={`px-2.5 py-1 rounded-full font-medium border ${
                active
                  ? "bg-[#ff6600] text-white border-[#ff6600]"
                  : "bg-white text-[#3d4654] border-[#e6e8eb] hover:bg-[#f4f5f7]"
              }`}
            >
              {TYPE_LABEL[t]}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
        {containers.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes className="w-12 h-12 mx-auto text-[#8a93a0] mb-3" />
            <p className="text-[#3d4654] font-medium">
              Keine Container gefunden
            </p>
            <p className="text-sm text-[#8a93a0] mt-1">
              {status || type
                ? "Filter ändern oder zurücksetzen."
                : "Sobald ein PDA einen Container öffnet, erscheint er hier."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f4f5f7] border-b border-[#e6e8eb]">
              <tr className="text-left text-xs font-semibold text-[#8a93a0] uppercase tracking-wide">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Geöffnet</th>
                <th className="px-4 py-3">Max. offen bis</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8eb]">
              {containers.map((c) => {
                const meta =
                  STATUS_META[c.status as ContainerStatus] ?? {
                    label: c.status,
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                const itemCount = itemsByContainer[c.id] ?? 0;
                const soonOverdue =
                  c.status === "open" &&
                  c.maxOpenUntil != null &&
                  c.maxOpenUntil.getTime() < soonThreshold;
                const alreadyOverdue =
                  c.status === "open" &&
                  c.maxOpenUntil != null &&
                  c.maxOpenUntil.getTime() < now;
                return (
                  <tr key={c.id} className="hover:bg-[#f4f5f7]/60">
                    <td className="px-4 py-3 font-mono text-xs text-[#0b3756] font-semibold">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3d4654]">
                      {TYPE_LABEL[c.type as ContainerType] ?? c.type}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3d4654]">
                      {c.partnerId ?? (
                        <span className="text-[#8a93a0]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${meta.bg} ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                      {alreadyOverdue && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-red-100 text-red-800">
                          Überfällig
                        </span>
                      )}
                      {!alreadyOverdue && soonOverdue && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-[#ff6600]/15 text-[#ff6600]">
                          Bald überfällig
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8a93a0]">
                      {c.openedAt.toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3d4654]">
                      {c.maxOpenUntil
                        ? c.maxOpenUntil.toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#3d4654] font-semibold">
                      {itemCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/containers/${c.id}`}
                        className="text-xs text-[#0b3756] hover:underline font-medium"
                      >
                        Detail →
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
            {total} Container · Seite {page} von {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{
                  pathname: "/admin/containers",
                  query: {
                    ...(status && { status }),
                    ...(type && { type }),
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
                  pathname: "/admin/containers",
                  query: {
                    ...(status && { status }),
                    ...(type && { type }),
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
