import Link from "next/link";
import { prisma } from "@/lib/db";
import { DollarSign, Zap, TrendingUp, Sparkles } from "lucide-react";

export async function AiCostsSection() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7d = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const start30d = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);

  const [aggAll, aggToday, agg7d, agg30d, byModel, recent, days30] = await Promise.all([
    prisma.aiUsage.aggregate({
      _sum: { totalCostUsd: true, totalTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: startOfToday } },
      _sum: { totalCostUsd: true, totalTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: start7d } },
      _sum: { totalCostUsd: true, totalTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: start30d } },
      _sum: { totalCostUsd: true, totalTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.groupBy({
      by: ["model"],
      _sum: { totalCostUsd: true, totalTokens: true },
      _count: { _all: true },
      orderBy: { _sum: { totalCostUsd: "desc" } },
    }),
    prisma.aiUsage.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { ticket: { select: { code: true, subject: true } } },
    }),
    prisma.$queryRaw<Array<{ day: Date; cost: number; calls: bigint }>>`
      SELECT
        date_trunc('day', "createdAt") AS day,
        SUM("totalCostUsd")::float AS cost,
        COUNT(*) AS calls
      FROM "AiUsage"
      WHERE "createdAt" >= ${start30d}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const totalCalls = aggAll._count._all;
  const totalCost = aggAll._sum.totalCostUsd ?? 0;
  const avgPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;

  const usdToEur = 0.92; // rough conversion — user can adjust ENV later if needed
  const fmtUsd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
  const fmtEur = (n: number) => `${(n * usdToEur).toFixed(n < 1 ? 4 : 2)} €`;

  const days = fillMissingDays(days30, start30d, now);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="font-semibold text-text flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> AI-Kosten
        </h2>
        <span className="text-xs text-text-light">
          Ø {fmtUsd(avgPerCall)} pro Ticket-Response
        </span>
      </div>
      <p className="text-xs text-text-light mb-4">
        Was jeder OpenAI-Call kostet — Tokens, USD, EUR. Wird bei jeder AI-Antwort
        automatisch mitgeloggt.
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Heute"
          cost={aggToday._sum.totalCostUsd ?? 0}
          calls={aggToday._count._all}
          fmtUsd={fmtUsd}
          fmtEur={fmtEur}
        />
        <StatCard
          label="7 Tage"
          cost={agg7d._sum.totalCostUsd ?? 0}
          calls={agg7d._count._all}
          fmtUsd={fmtUsd}
          fmtEur={fmtEur}
        />
        <StatCard
          label="30 Tage"
          cost={agg30d._sum.totalCostUsd ?? 0}
          calls={agg30d._count._all}
          fmtUsd={fmtUsd}
          fmtEur={fmtEur}
        />
        <StatCard
          label="Gesamt"
          cost={totalCost}
          calls={totalCalls}
          fmtUsd={fmtUsd}
          fmtEur={fmtEur}
        />
      </div>

      {days.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-medium text-text-light mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Kosten pro Tag (30 Tage)
          </div>
          <DailyChart days={days} />
        </div>
      )}

      {byModel.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-medium text-text-light mb-2">Pro Modell</div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary">
                <tr className="text-xs text-text-light">
                  <th className="text-left px-3 py-2 font-medium">Modell</th>
                  <th className="text-right px-3 py-2 font-medium">Calls</th>
                  <th className="text-right px-3 py-2 font-medium">Tokens</th>
                  <th className="text-right px-3 py-2 font-medium">Kosten USD</th>
                  <th className="text-right px-3 py-2 font-medium">Kosten EUR</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((m) => (
                  <tr key={m.model} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{m.model}</td>
                    <td className="text-right px-3 py-2 tabular-nums">
                      {m._count._all}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-text-light">
                      {(m._sum.totalTokens ?? 0).toLocaleString("de-DE")}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums">
                      {fmtUsd(m._sum.totalCostUsd ?? 0)}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-text-light">
                      {fmtEur(m._sum.totalCostUsd ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-text-light mb-2 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Letzte 50 Calls
        </div>
        {recent.length === 0 ? (
          <div className="text-sm text-text-light border border-dashed border-border rounded-lg p-6 text-center">
            Noch keine AI-Calls geloggt.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary">
                <tr className="text-xs text-text-light">
                  <th className="text-left px-3 py-2 font-medium">Zeit</th>
                  <th className="text-left px-3 py-2 font-medium">Ticket</th>
                  <th className="text-left px-3 py-2 font-medium">Modell</th>
                  <th className="text-left px-3 py-2 font-medium">Zweck</th>
                  <th className="text-right px-3 py-2 font-medium">In</th>
                  <th className="text-right px-3 py-2 font-medium">Cache</th>
                  <th className="text-right px-3 py-2 font-medium">Out</th>
                  <th className="text-right px-3 py-2 font-medium">USD</th>
                  <th className="text-right px-3 py-2 font-medium">EUR</th>
                  <th className="text-right px-3 py-2 font-medium">ms</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((u) => (
                  <tr key={u.id} className="border-t border-border/60 hover:bg-bg-secondary/50">
                    <td className="px-3 py-2 text-xs text-text-light whitespace-nowrap">
                      {formatShortTime(u.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {u.ticket ? (
                        <Link
                          href={`/tickets/${u.ticketId}`}
                          className="font-mono text-accent hover:underline"
                          title={u.ticket.subject}
                        >
                          #{u.ticket.code}
                        </Link>
                      ) : (
                        <span className="text-text-light">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-text-light">{u.model}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          u.purpose === "regenerate"
                            ? "bg-info/10 text-info"
                            : "bg-bg-secondary text-text-light"
                        }`}
                      >
                        {u.purpose}
                      </span>
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-xs">
                      {u.promptTokens.toLocaleString("de-DE")}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-xs text-text-light">
                      {u.cachedTokens > 0 ? u.cachedTokens.toLocaleString("de-DE") : "—"}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-xs">
                      {u.completionTokens.toLocaleString("de-DE")}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-xs font-medium">
                      {fmtUsd(u.totalCostUsd)}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-xs text-text-light">
                      {fmtEur(u.totalCostUsd)}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-xs text-text-light">
                      {u.latencyMs ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  cost,
  calls,
  fmtUsd,
  fmtEur,
}: {
  label: string;
  cost: number;
  calls: number;
  fmtUsd: (n: number) => string;
  fmtEur: (n: number) => string;
}) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="text-xs text-text-light">{label}</div>
      <div className="text-lg font-bold text-text mt-1 flex items-baseline gap-1">
        <DollarSign className="w-3.5 h-3.5 text-text-light" />
        <span className="tabular-nums">{fmtUsd(cost).replace("$", "")}</span>
      </div>
      <div className="text-xs text-text-light tabular-nums">
        {fmtEur(cost)} · {calls} {calls === 1 ? "Call" : "Calls"}
      </div>
    </div>
  );
}

type DayPoint = { day: Date; cost: number; calls: number };

function fillMissingDays(
  raw: Array<{ day: Date; cost: number; calls: bigint }>,
  from: Date,
  to: Date,
): DayPoint[] {
  const byIso = new Map<string, { cost: number; calls: number }>();
  for (const r of raw) {
    const iso = new Date(r.day).toISOString().slice(0, 10);
    byIso.set(iso, { cost: Number(r.cost) || 0, calls: Number(r.calls) || 0 });
  }
  const out: DayPoint[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    const iso = cursor.toISOString().slice(0, 10);
    const v = byIso.get(iso);
    out.push({
      day: new Date(cursor),
      cost: v?.cost ?? 0,
      calls: v?.calls ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function DailyChart({ days }: { days: DayPoint[] }) {
  const width = 720;
  const height = 140;
  const padTop = 8;
  const padBottom = 22;
  const padLeft = 40;
  const padRight = 8;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const max = Math.max(...days.map((d) => d.cost), 0.001);
  const barW = innerW / days.length;

  return (
    <div className="border border-border rounded-lg p-3 bg-bg-secondary/30">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={padTop + innerH}
          y2={padTop + innerH}
          stroke="currentColor"
          strokeOpacity="0.15"
        />
        <text
          x={padLeft - 6}
          y={padTop + 4}
          textAnchor="end"
          className="fill-current text-[9px] opacity-60"
        >
          ${max.toFixed(2)}
        </text>
        <text
          x={padLeft - 6}
          y={padTop + innerH}
          textAnchor="end"
          className="fill-current text-[9px] opacity-60"
        >
          $0
        </text>
        {days.map((d, i) => {
          const h = (d.cost / max) * innerH;
          const x = padLeft + i * barW + 1;
          const y = padTop + innerH - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={Math.max(barW - 2, 1)}
                height={h}
                className="fill-accent"
                opacity={d.cost > 0 ? 0.85 : 0.15}
              >
                <title>
                  {d.day.toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                  {": $"}
                  {d.cost.toFixed(4)} · {d.calls} Calls
                </title>
              </rect>
            </g>
          );
        })}
        {days.map((d, i) => {
          if (i % 5 !== 0 && i !== days.length - 1) return null;
          const x = padLeft + i * barW + barW / 2;
          return (
            <text
              key={`l${i}`}
              x={x}
              y={height - 6}
              textAnchor="middle"
              className="fill-current text-[9px] opacity-60"
            >
              {d.day.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
              })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function formatShortTime(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
