import Link from "next/link";
import { FileText, Plus, Pencil, Trash2, Search, Info } from "lucide-react";
import { prisma } from "@/lib/db";
import { deleteTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  returns: "Retoure & Widerruf",
  shipping: "Versand & Bestellung",
  invoice: "Rechnung & Zahlung",
  advisory: "Beratung",
  complaint: "Reklamation",
  general: "Allgemein",
  other: "Sonstiges",
};

const CATEGORY_COLOR: Record<string, string> = {
  returns: "text-info bg-info/10 border-info/30",
  shipping: "text-accent bg-accent/10 border-accent/30",
  invoice: "text-warning bg-warning/10 border-warning/30",
  advisory: "text-success bg-success/10 border-success/30",
  complaint: "text-danger bg-danger/10 border-danger/30",
  general: "text-text-light bg-gray-100 border-border",
  other: "text-text-light bg-gray-100 border-border",
};

const CATEGORY_ORDER = [
  "returns",
  "shipping",
  "invoice",
  "complaint",
  "advisory",
  "general",
  "other",
  "",
];

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";

  const templates = await prisma.template.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { shortcode: { contains: q.toLowerCase(), mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
            { bodyHtml: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // Group by category
  const grouped = new Map<string, typeof templates>();
  for (const t of templates) {
    const key = t.category || "";
    const arr = grouped.get(key) || [];
    arr.push(t);
    grouped.set(key, arr);
  }
  const orderedGroups = CATEGORY_ORDER.filter((k) => grouped.has(k)).map(
    (k) => [k, grouped.get(k)!] as const
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FileText className="w-5 h-5" /> Antwort-Templates
          </h1>
          <p className="text-sm text-text-light mt-1">
            Bausteine für schnelle Antworten. Im Composer via{" "}
            <span className="font-mono text-accent">::kürzel</span> +{" "}
            <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border rounded text-xs">Enter</kbd>{" "}
            direkt einfügen.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" /> Neues Template
        </Link>
      </div>

      <form method="get" className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Templates durchsuchen: Name, Kürzel, Betreff, Body …"
            className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
      </form>

      {templates.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-text-light mx-auto mb-3" />
          <h3 className="text-base font-semibold text-text mb-1">
            {q ? "Keine Treffer" : "Noch keine Templates"}
          </h3>
          <p className="text-sm text-text-light">
            {q
              ? `Für "${q}" wurde nichts gefunden.`
              : "Lege häufige Antworten als Templates an — dann findest du sie im Composer per Dropdown ODER Kürzel."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {orderedGroups.map(([catKey, items]) => (
            <section key={catKey}>
              <div className="flex items-baseline gap-2 mb-3 pb-1 border-b border-border">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-text-light">
                  {CATEGORY_LABEL[catKey] || "Ohne Kategorie"}
                </h2>
                <span className="text-xs text-text-light">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((t) => {
                  const catCls = CATEGORY_COLOR[t.category || ""] || CATEGORY_COLOR.general;
                  return (
                    <div
                      key={t.id}
                      className="bg-bg-card border border-border rounded-xl p-4 flex flex-col hover:border-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-text truncate">{t.name}</h3>
                          {t.shortcode && (
                            <div className="mt-0.5 inline-flex items-center gap-1">
                              <span className="text-xs font-mono bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                                ::{t.shortcode}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Link
                            href={`/templates/${t.id}/edit`}
                            className="p-1.5 text-text-light hover:text-text hover:bg-bg-secondary rounded"
                            title="Bearbeiten"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>
                          <form
                            action={async () => {
                              "use server";
                              await deleteTemplateAction(t.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="p-1.5 text-text-light hover:text-danger hover:bg-danger/10 rounded"
                              title="Löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      </div>
                      <div className="text-xs text-text-light mb-2 line-clamp-1">
                        <strong className="text-text">Betreff:</strong> {t.subject}
                      </div>
                      <div
                        className="text-xs text-text-light line-clamp-4 mb-3 flex-1"
                        dangerouslySetInnerHTML={{ __html: t.bodyHtml }}
                      />
                      {t.category && (
                        <div className={`text-xs px-2 py-0.5 rounded-full border w-fit ${catCls}`}>
                          {CATEGORY_LABEL[t.category] || t.category}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-info/5 border border-info/20 rounded-lg text-xs text-text-light flex items-start gap-2">
        <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <div>
          <strong className="text-text">Variablen</strong> in Betreff und Body:{" "}
          <span className="font-mono">{"{{customer.first_name}}"}</span>,{" "}
          <span className="font-mono">{"{{customer.last_name}}"}</span>,{" "}
          <span className="font-mono">{"{{customer.email}}"}</span>,{" "}
          <span className="font-mono">{"{{customer.phone}}"}</span>,{" "}
          <span className="font-mono">{"{{ticket.code}}"}</span>,{" "}
          <span className="font-mono">{"{{ticket.subject}}"}</span>,{" "}
          <span className="font-mono">{"{{order.id}}"}</span> — werden beim Einfügen automatisch mit den Kontaktdaten des aktuellen Tickets ersetzt.
        </div>
      </div>
    </div>
  );
}
