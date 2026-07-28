"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Package,
  Search,
  Sparkles,
  Wrench,
  X,
  Check,
  Plus,
} from "lucide-react";
import { formatEur } from "@/lib/money";
import type { ServiceOpt } from "./doc-composer";

/**
 * Wizard-modal für Katalog-auswahl.
 * Screen 1: Kategorien als kacheln
 * Screen 2 (nach kategorie-klick): Leistungen der kategorie als kacheln
 * Nach klick: suggested-parts als vorschlags-kacheln (multi-select)
 * "Übernehmen" → onSelect(labor, parts) → DocComposer fügt beide ein
 */
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

  // Global search across all categories
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

  const suggestedParts = useMemo(() => {
    if (!selectedService?.suggestedParts) return [];
    return selectedService.suggestedParts;
  }, [selectedService]);

  function pickService(s: ServiceOpt) {
    // Immer direkt einfügen — alle vorgeschlagenen teile mit smarter default-menge
    // Wenn user was ändern will, macht er das in den positionen im composer selbst.
    const partsToAdd = (s.suggestedParts ?? []).map((name) => ({
      name,
      quantity: inferQuantityFromName(name),
    }));
    onSelect({ labor: s, partsToAdd });
  }

  /**
   * Extrahiert menge aus dem teile-namen:
   *   "Bremsscheiben vorne (Paar)"        → 2
   *   "Zündkerzen-Satz (4 Stk)"           → 4
   *   "Motoröl (5L)" / "Kühlflüssigkeit (5L)" → 5
   *   sonst                                → 1
   */
  function inferQuantityFromName(name: string): number {
    const lower = name.toLowerCase();
    if (/\bpaar\b/.test(lower)) return 2;
    const stkMatch = lower.match(/\((\d+)\s*stk/);
    if (stkMatch) return parseInt(stkMatch[1], 10);
    const litMatch = lower.match(/\((\d+)\s*l\b/);
    if (litMatch) return parseInt(litMatch[1], 10);
    return 1;
  }

  function toggleFooterPart(name: string) {
    setSelectedParts((prev) => {
      const copy = { ...prev };
      if (name in copy) delete copy[name];
      else copy[name] = 1;
      return copy;
    });
  }

  function updatePartQty(name: string, qty: number) {
    setSelectedParts((prev) => ({ ...prev, [name]: Math.max(1, qty) }));
  }

  function confirm() {
    if (!selectedService) return;
    const partsToAdd = Object.entries(selectedParts).map(([name, quantity]) => ({ name, quantity }));
    onSelect({ labor: selectedService, partsToAdd });
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
                  if (step === "parts") setStep("service");
                  else {
                    setStep("category");
                    setSelectedCategory(null);
                    setQuery("");
                  }
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-600" />
                {step === "category" && "Aus Katalog wählen"}
                {step === "service" && `Leistung wählen — ${selectedCategory}`}
                {step === "parts" && `Teile für „${selectedService?.name}"`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === "category" && `${laborServices.length} Leistungen · ${categories.length} Kategorien`}
                {step === "service" && `${servicesInCategory.length} Leistungen`}
                {step === "parts" && `${suggestedParts.length} typische Teile vorgeschlagen — anpassen und übernehmen`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </header>

        {(step === "category" || step === "service") && (
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
        )}

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

          {step === "parts" && selectedService && (
            <div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 flex items-center gap-3">
                <Wrench className="w-4 h-4 text-orange-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{selectedService.name}</div>
                  <div className="text-xs text-slate-600">
                    {selectedService.laborHours} Std × {formatEur(hourlyRateCent)}/Std ={" "}
                    <strong>{formatEur(Math.round((selectedService.laborHours ?? 0) * hourlyRateCent))}</strong>
                  </div>
                </div>
              </div>

              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" />
                Typischerweise benötigte Ersatzteile
                <span className="ml-auto text-[10px] font-normal normal-case bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  Später: kfzBlitz24-Artikel-Suche
                </span>
              </h3>

              {suggestedParts.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-4">
                  Diese Leistung braucht typischerweise keine Ersatzteile.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  {suggestedParts.map((part) => {
                    const selected = part in selectedParts;
                    return (
                      <button
                        key={part}
                        type="button"
                        onClick={() => toggleFooterPart(part)}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg text-left transition ${
                          selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-400 bg-white"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                            selected ? "bg-emerald-500 text-white" : "border-2 border-slate-300"
                          }`}
                        >
                          {selected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 text-sm text-slate-900">{part}</div>
                        {selected && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min="1"
                              value={selectedParts[part]}
                              onChange={(e) => updatePartQty(part, parseInt(e.target.value, 10) || 1)}
                              className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-right"
                            />
                            <span className="text-xs text-slate-500">×</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-slate-500 mb-4">
                Preise für die Teile setzt du danach im Formular (Einkaufspreis + {" "}
                <strong>+Aufschlag</strong>-Button).
              </p>
            </div>
          )}
        </div>

        {step === "parts" && selectedService && (
          <footer className="px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
            <div className="text-xs text-slate-600">
              {Object.keys(selectedParts).length} von {suggestedParts.length} Teilen ausgewählt
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedParts({})}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Keine
              </button>
              <button
                type="button"
                onClick={() => {
                  const all: Record<string, number> = {};
                  for (const p of suggestedParts) all[p] = 1;
                  setSelectedParts(all);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Alle
              </button>
              <button
                type="button"
                onClick={confirm}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Übernehmen
              </button>
            </div>
          </footer>
        )}
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
            + {service.suggestedParts!.length} Teil{service.suggestedParts!.length > 1 ? "e" : ""}
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
