import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  LayoutDashboard,
  Inbox,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Bell,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { fullNameOf } from "@/lib/name-parse";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 3600_000;

function fmtDurationMs(ms: number | null): string {
  if (ms == null || !isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export default async function DashboardPage() {
  const now = Date.now();
  const dayAgo = new Date(now - DAY_MS);
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);

  const [
    openCount,
    urgentOpenCount,
    overdueCount,
    createdToday,
    createdLast7,
    createdLast30,
    resolvedToday,
    firstResponseSample,
    pendingAiDrafts,
    snoozeDueCount,
    snoozeUpcoming,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: { notIn: ["resolved", "closed"] } } }),
    prisma.ticket.count({ where: { status: { notIn: ["resolved", "closed"] }, priority: "urgent" } }),
    prisma.ticket.count({
      where: {
        status: { notIn: ["resolved", "closed"] },
        firstResponseAt: null,
        firstResponseDueAt: { lt: new Date(now) },
      },
    }),
    prisma.ticket.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.ticket.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.ticket.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.ticket.count({ where: { resolvedAt: { gte: dayAgo } } }),
    prisma.ticket.findMany({
      where: {
        firstResponseAt: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, firstResponseAt: true, firstResponseDueAt: true },
    }),
    prisma.aiDraft.count({ where: { status: "pending" } }),
    prisma.ticket.count({
      where: {
        snoozedUntil: { lte: new Date(now), not: null },
        status: { notIn: ["resolved", "closed"] },
      },
    }),
    prisma.ticket.findMany({
      where: {
        snoozedUntil: { gt: new Date(now) },
        status: { notIn: ["resolved", "closed"] },
      },
      orderBy: { snoozedUntil: "asc" },
      take: 5,
      include: { contact: true },
    }),
    prisma.ticket.findMany({
      where: {
        status: { notIn: ["resolved", "closed"] },
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date(now) } }],
      },
      orderBy: [{ priority: "desc" }, { firstResponseDueAt: "asc" }],
      take: 5,
      include: { contact: true },
    }),
  ]);

  const responseTimes = firstResponseSample.map(
    (t) => t.firstResponseAt!.getTime() - t.createdAt.getTime()
  );
  const avgResponseMs =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

  const withinSla = firstResponseSample.filter(
    (t) => t.firstResponseAt!.getTime() <= t.firstResponseDueAt.getTime()
  ).length;
  const slaRate =
    firstResponseSample.length > 0
      ? (withinSla / firstResponseSample.length) * 100
      : null;

  const perDayLast30 = createdLast30 / 30;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5" /> Dashboard
        </h1>
        <p className="text-sm text-text-light mt-1">
          Übersicht über offene Tickets und Kennzahlen der letzten 30 Tage.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Offene Tickets"
          value={openCount.toString()}
          detail={urgentOpenCount > 0 ? `${urgentOpenCount} dringend` : "kein dringendes"}
          tone={urgentOpenCount > 0 ? "warning" : "info"}
          icon={<Inbox className="w-4 h-4" />}
          href="/tickets"
        />
        <KpiCard
          label="SLA-überschritten"
          value={overdueCount.toString()}
          detail={overdueCount > 0 ? "sofort bearbeiten" : "alles im grünen Bereich"}
          tone={overdueCount > 0 ? "danger" : "success"}
          icon={<AlertCircle className="w-4 h-4" />}
          href="/tickets?status=all"
        />
        <KpiCard
          label="Neu heute"
          value={createdToday.toString()}
          detail={`${createdLast7} in 7 Tagen · ⌀ ${perDayLast30.toFixed(1)}/Tag`}
          tone="info"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KpiCard
          label="Gelöst heute"
          value={resolvedToday.toString()}
          detail=""
          tone="success"
          icon={<CheckCircle2 className="w-4 h-4" />}
          href="/tickets/archive"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Wiedervorlage jetzt fällig"
          value={snoozeDueCount.toString()}
          detail={snoozeDueCount > 0 ? "warten auf dich" : "keine offen"}
          tone={snoozeDueCount > 0 ? "warning" : "info"}
          icon={<Bell className="w-4 h-4" />}
          href="/tickets/snoozed"
        />
        <KpiCard
          label="⌀ Erstantwortzeit (30 T.)"
          value={fmtDurationMs(avgResponseMs)}
          detail={`Basis: ${firstResponseSample.length} Tickets mit Antwort`}
          tone="info"
          icon={<Clock className="w-4 h-4" />}
        />
        <KpiCard
          label="SLA-Trefferquote (30 T.)"
          value={slaRate == null ? "—" : `${slaRate.toFixed(0)} %`}
          detail={
            firstResponseSample.length > 0
              ? `${withinSla} von ${firstResponseSample.length} in SLA`
              : "keine Daten"
          }
          tone={slaRate == null ? "info" : slaRate >= 90 ? "success" : slaRate >= 70 ? "warning" : "danger"}
          icon={<Clock className="w-4 h-4" />}
        />
        <KpiCard
          label="AI-Entwürfe wartend"
          value={pendingAiDrafts.toString()}
          detail="im Review-Backlog"
          tone={pendingAiDrafts > 0 ? "warning" : "info"}
          icon={<Sparkles className="w-4 h-4" />}
        />
      </div>

      {snoozeUpcoming.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl mb-6">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-text flex items-center gap-2">
              <Bell className="w-4 h-4 text-warning" /> Kommende Wiedervorlagen
            </h2>
            <Link href="/tickets/snoozed" className="text-xs text-accent hover:underline">
              Alle →
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {snoozeUpcoming.map((t) => {
              const displayName = fullNameOf(t.contact);
              return (
                <li key={t.id}>
                  <Link
                    href={`/tickets/${t.id}`}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-text-light">#{t.code}</span>
                        <span className="font-medium text-text truncate">{t.subject}</span>
                      </div>
                      <div className="text-xs text-text-light mt-0.5">
                        {displayName || t.contact.email}
                        {t.snoozedReason && ` · ${t.snoozedReason}`}
                      </div>
                    </div>
                    <span className="text-xs text-warning shrink-0">
                      {formatDistanceToNow(t.snoozedUntil!, { locale: de, addSuffix: true })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="bg-bg-card border border-border rounded-xl">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text">Nächste 5 nach Priorität + SLA</h2>
          <Link href="/tickets" className="text-xs text-accent hover:underline">
            Alle Tickets →
          </Link>
        </div>
        {recentTickets.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-light">
            Nichts zu tun — alles gelöst.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recentTickets.map((t) => {
              const overdue = t.firstResponseDueAt.getTime() < now;
              const displayName = fullNameOf(t.contact);
              return (
                <li key={t.id}>
                  <Link
                    href={`/tickets/${t.id}`}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-text-light">
                          #{t.code}
                        </span>
                        <span className="font-medium text-text truncate">
                          {t.subject}
                        </span>
                      </div>
                      <div className="text-xs text-text-light mt-0.5">
                        {displayName || t.contact.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                          t.priority === "urgent"
                            ? "bg-danger/15 text-danger"
                            : t.priority === "high"
                              ? "bg-warning/15 text-warning"
                              : "bg-info/10 text-info"
                        }`}
                      >
                        {t.priority}
                      </span>
                      <span className={overdue ? "text-danger font-semibold" : "text-text-light"}>
                        {formatDistanceToNow(t.firstResponseDueAt, { locale: de, addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone,
  icon,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "info" | "success" | "warning" | "danger";
  icon: React.ReactNode;
  href?: string;
}) {
  const toneClass = {
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  const inner = (
    <>
      <div className="flex items-center justify-between text-text-light text-xs mb-1">
        <span className="uppercase tracking-wide">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-text">{value}</div>
      <div className="text-xs text-text-light mt-1">{detail}</div>
    </>
  );

  const clsBase = "bg-bg-card border border-border rounded-xl p-4 block";
  return href ? (
    <Link href={href} className={`${clsBase} hover:border-accent/30 transition-colors`}>
      {inner}
    </Link>
  ) : (
    <div className={clsBase}>{inner}</div>
  );
}
