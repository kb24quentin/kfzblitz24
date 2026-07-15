import Link from "next/link";
import { Search, Mail, User, Package, FileSignature, Archive, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { globalSearch, type SearchResult } from "@/lib/global-search";
import { STATUS_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const results = q.length >= 2 ? await globalSearch(q) : [];

  const tickets = results.filter((r): r is Extract<SearchResult, { kind: "ticket" }> => r.kind === "ticket");
  const contacts = results.filter((r): r is Extract<SearchResult, { kind: "contact" }> => r.kind === "contact");
  const orders = results.filter((r): r is Extract<SearchResult, { kind: "order" }> => r.kind === "order");
  const templates = results.filter((r): r is Extract<SearchResult, { kind: "template" }> => r.kind === "template");
  const totalHits = results.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Search className="w-5 h-5" /> Suche
        </h1>
        {q ? (
          <p className="text-sm text-text-light mt-1">
            {totalHits} Treffer für <span className="font-mono">&ldquo;{q}&rdquo;</span>
          </p>
        ) : (
          <p className="text-sm text-text-light mt-1">
            Gib in der Kopfzeile mindestens 2 Zeichen ein — durchsucht Tickets, Kontakte, Bestellungen und Templates.
          </p>
        )}
      </div>

      {q && q.length < 2 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning mb-4">
          Bitte mindestens 2 Zeichen eingeben.
        </div>
      )}

      {q && totalHits === 0 && q.length >= 2 && (
        <div className="bg-bg-card border border-border rounded-xl px-6 py-12 text-center">
          <Search className="w-8 h-8 text-text-light mx-auto mb-3" />
          <div className="text-text font-medium mb-1">Keine Treffer</div>
          <div className="text-sm text-text-light">
            Für <span className="font-mono">&ldquo;{q}&rdquo;</span> wurde nichts gefunden.
          </div>
        </div>
      )}

      {tickets.length > 0 && (
        <ResultsSection
          title="Tickets"
          icon={<Mail className="w-4 h-4" />}
          count={tickets.length}
        >
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-xs text-text-light">#{t.code}</span>
                  <span className="font-medium text-text truncate">{t.subject}</span>
                  {t.archived && (
                    <span className="inline-flex items-center gap-1 text-xs text-text-light">
                      <Archive className="w-3 h-3" /> Archiviert
                    </span>
                  )}
                  {t.snoozed && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <Bell className="w-3 h-3" /> Wiedervorlage
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-light mt-0.5">
                  {t.customerName} · {t.customerEmail} · {STATUS_LABEL[t.status] || t.status}
                </div>
              </div>
              <span className="text-xs text-text-light shrink-0">
                {formatDistanceToNow(t.lastActivityAt, { locale: de, addSuffix: true })}
              </span>
            </Link>
          ))}
        </ResultsSection>
      )}

      {contacts.length > 0 && (
        <ResultsSection
          title="Kontakte"
          icon={<User className="w-4 h-4" />}
          count={contacts.length}
        >
          {contacts.map((c) => (
            <Link
              key={c.id}
              href={`/contacts?q=${encodeURIComponent(c.email)}`}
              className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text">{c.name}</div>
                <div className="text-xs text-text-light">
                  {c.email}
                  {c.phone && ` · ${c.phone}`}
                </div>
              </div>
              <span className="text-xs text-text-light shrink-0">
                {c.ticketCount} Ticket(s)
              </span>
            </Link>
          ))}
        </ResultsSection>
      )}

      {orders.length > 0 && (
        <ResultsSection
          title="Bestellungen"
          icon={<Package className="w-4 h-4" />}
          count={orders.length}
        >
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/tickets/${o.ticketId}`}
              className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-text">{o.ref}</div>
                <div className="text-xs text-text-light">
                  Ticket #{o.ticketCode}
                  {o.status && ` · ${o.status}`}
                </div>
              </div>
              {o.totalBrutto !== null && (
                <span className="text-xs text-text tabular-nums shrink-0 font-medium">
                  {o.totalBrutto.toFixed(2).replace(".", ",")} €
                </span>
              )}
            </Link>
          ))}
        </ResultsSection>
      )}

      {templates.length > 0 && (
        <ResultsSection
          title="Templates"
          icon={<FileSignature className="w-4 h-4" />}
          count={templates.length}
        >
          {templates.map((t) => (
            <Link
              key={t.id}
              href="/settings"
              className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-secondary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text">{t.name}</div>
                <div className="text-xs text-text-light flex items-center gap-2">
                  {t.shortcode && <span className="font-mono">::{t.shortcode}</span>}
                  {t.category && <span>· {t.category}</span>}
                </div>
              </div>
            </Link>
          ))}
        </ResultsSection>
      )}
    </div>
  );
}

function ResultsSection({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl mb-4">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-text flex items-center gap-2">
          {icon} {title}
        </h2>
        <span className="text-xs text-text-light">{count}</span>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}
