"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Search, Sparkles, Wrench, X } from "lucide-react";
import { formatEur } from "@/lib/money";
import type { ServiceOpt } from "./doc-composer";

export function CatalogWizard({
  services,
  hourlyRateCent,
  onClose,
  onSelect,
}: {
  services: ServiceOpt[];
  hourlyRateCent: number;
  onClose: () => void;
  onSelect: (payload: {
    labor: ServiceOpt;
    partsToAdd: { name: string; quantity: number }[];
  }) => void;
}) {
  const [step, setStep] = useState<"category" | "service">("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const laborServices = useMemo(
    () => services.filter((s) => s.laborHours != null && s.laborHours > 0),
    [services]
  );

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of laborServices) {
      const cat = s.category ?? "Sonstige";
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [laborServices]);

  const servicesInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    const q = query.trim().toLowerCase();
    return laborServices
      .filter((s) => (s.category ?? "Sonstige") === selectedCategory)
      .filter((s) =>
        q ? s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q) : true
      );
  }, [laborServices, selectedCategory, query]);

  const globalSearchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || step !== "category") return null;
    return laborServices
      .filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [laborServices, query, step]);

  function pickService(s: ServiceOpt) {
    const partsToAdd = (s.suggestedParts ?? []).map((name) => ({
      name,
      quantity: inferQuantityFromName(name),
    }));
    onSelect({ labor: s, partsToAdd });
  }

  function inferQuantityFromName(name: string): number {
    const lower = name.toLowerCase();
    if (/\bpaar\b/.test(lower)) return 2;
    const stkMatch = lower.match(/\((\d+)\s*stk/);
    if (stkMatch) return parseInt(stkMatch[1], 10);
    const litMatch = lower.match(/\((\d+)\s*l\b/);
    if (litMatch) return parseInt(litMatch[1], 10);
    return 1;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {step !== "category" && (
              <button
                type="button"
                onClick={() => {
                  setStep("category");
                  setSelectedCategory(null);
                  setQuery("");
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-600" />
                {step === "category" ? "Aus Katalog wählen" : `Leistung wählen — ${selectedCategory}`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === "category"
                  ? `${laborServices.length} Leistungen · ${categories.length} Kategorien`
                  : `${servicesInCategory.length} Leistungen — mit Klick werden Teile automatisch mit übernommen`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-3 border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Leistung, Kategorie, Beschreibung…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "category" && !globalSearchResults && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map(([cat, count]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setStep("service");
                    setQuery("");
                  }}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-slate-200 rounded-xl bg-white hover:border-orange-500 hover:bg-orange-50 transition group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center transition">
                    <Wrench className="w-6 h-6 text-slate-500 group-hover:text-orange-600 transition" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900 text-sm">{cat}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{count} Leistungen</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "category" && globalSearchResults && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 mb-3">
                {globalSearchResults.length} Treffer für „{query}"
              </div>
              {globalSearchResults.map((s) => (
                <ServiceCard key={s.id} service={s} hourlyRateCent={hourlyRateCent} onClick={() => pickService(s)} />
              ))}
              {globalSearchResults.length === 0 && (
                <div className="text-center text-sm text-slate-400 py-8">Kein Treffer</div>
              )}
            </div>
          )}

          {step === "service" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {servicesInCategory.map((s) => (
                <ServiceCard key={s.id} service={s} hourlyRateCent={hourlyRateCent} onClick={() => pickService(s)} />
              ))}
              {servicesInCategory.length === 0 && (
                <div className="col-span-full text-center text-sm text-slate-400 py-8">Kein Treffer</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  hourlyRateCent,
  onClick,
}: {
  service: ServiceOpt;
  hourlyRateCent: number;
  onClick: () => void;
}) {
  const price = service.laborHours ? Math.round(service.laborHours * hourlyRateCent) : service.netPriceCent;
  const hasSuggested = (service.suggestedParts?.length ?? 0) > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start justify-between gap-3 p-3 border border-slate-200 rounded-lg bg-white hover:border-orange-500 hover:bg-orange-50 text-left transition"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-slate-900 truncate">{service.name}</div>
        {service.description && (
          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{service.description}</div>
        )}
        {hasSuggested && (
          <div className="text-[10px] text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 inline-block mt-1.5">
            + {service.suggestedParts!.length} Teil{service.suggestedParts!.length > 1 ? "e" : ""} auto
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        {service.laborHours ? (
          <>
            <div className="text-xs text-slate-500">{service.laborHours} Std</div>
            <div className="text-sm font-semibold text-slate-900">{formatEur(price)}</div>
          </>
        ) : (
          <div className="text-sm font-semibold text-slate-900">{formatEur(price)}</div>
        )}
      </div>
    </button>
  );
}
