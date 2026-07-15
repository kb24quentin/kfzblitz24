"use client";

import { useState, useTransition } from "react";
import { X, AlertCircle, CheckCircle2, Undo2, Loader2 } from "lucide-react";
import {
  createRetoureFromTicketAction,
  type CreateRetoureInput,
  type CreateRetoureResult,
} from "./actions";
import type { OrderCardData } from "./order-card";

const REASONS: Array<{ code: string; label: string }> = [
  { code: "passt_nicht_zum_fahrzeug", label: "Passt nicht zum Fahrzeug" },
  { code: "falsche_lieferung", label: "Falsche Lieferung" },
  { code: "defekt_oder_beschaedigt", label: "Defekt / beschädigt" },
  { code: "qualitaet_nicht_wie_erwartet", label: "Qualität nicht wie erwartet" },
  { code: "nicht_mehr_benoetigt", label: "Nicht mehr benötigt" },
  { code: "anders_entschieden", label: "Anders entschieden" },
  { code: "anderes", label: "Anderer Grund (Freitext)" },
];

type ItemState = {
  key: string;
  selected: boolean;
  menge: number;
  maxMenge: number;
  artikelnummer: string;
  hersteller: string;
  beschreibung: string;
  einzelpreis_brutto: number;
  grund_code: string;
  grund_freitext: string;
};

export function RetoureDialog({
  order,
  isAdmin,
  onClose,
  onCreated,
}: {
  order: OrderCardData | null;
  isAdmin: boolean;
  onClose: () => void;
  onCreated: (result: Extract<CreateRetoureResult, { ok: true }>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [labelRequested, setLabelRequested] = useState(true);
  const [freeLabel, setFreeLabel] = useState(false);
  const [kategorie, setKategorie] = useState<"widerruf" | "gewaehrleistung">("widerruf");

  const [items, setItems] = useState<ItemState[]>(() => {
    if (!order?.beleg?.positionen) return [];
    return order.beleg.positionen
      .filter((p) => p.typ === "artikel" || !p.typ)
      .map((p, i) => {
        const menge = Math.max(1, Math.floor(p.menge ?? 1));
        return {
          key: `${p.id ?? i}`,
          selected: false,
          menge,
          maxMenge: menge,
          artikelnummer: p.artikelnummer ?? "",
          hersteller: p.hersteller ?? "",
          beschreibung: p.beschreibung ?? "",
          einzelpreis_brutto: p.einzelpreis_brutto ?? 0,
          grund_code: "nicht_mehr_benoetigt",
          grund_freitext: "",
        };
      });
  });

  if (!order) return null;

  const selectedItems = items.filter((it) => it.selected);
  const canSubmit = selectedItems.length > 0 && !pending;

  const totalRefund = selectedItems.reduce(
    (sum, it) => sum + it.einzelpreis_brutto * it.menge,
    0,
  );
  const fmtEur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

  const toggleItem = (key: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, selected: !it.selected } : it)));
  const setMenge = (key: string, menge: number) =>
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, menge: Math.min(Math.max(1, menge), it.maxMenge) } : it)),
    );
  const setReason = (key: string, code: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, grund_code: code } : it)));
  const setFreetext = (key: string, txt: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, grund_freitext: txt } : it)));

  const handleSubmit = () => {
    setError(null);
    const payload: CreateRetoureInput = {
      orderId: order.id,
      items: selectedItems.map((it) => ({
        artikelnummer: it.artikelnummer,
        menge: it.menge,
        grund_code: it.grund_code,
        grund_freitext: it.grund_code === "anderes" ? it.grund_freitext.trim() || undefined : undefined,
        hersteller: it.hersteller,
        beschreibung: it.beschreibung,
        einzelpreis_brutto: it.einzelpreis_brutto,
      })),
      labelRequested,
      freeLabel: isAdmin ? freeLabel : false,
      kategorie,
    };
    startTransition(async () => {
      const result = await createRetoureFromTicketAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8 relative">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-3 border-b border-border rounded-t-xl">
          <h2 className="font-semibold text-text flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-accent" /> Kundenretoure für {order.ref}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-light hover:text-text hover:bg-bg-secondary rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-sm bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Fehler beim Anlegen</div>
                <div className="text-xs mt-0.5 break-all">{error}</div>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-text-light mb-1.5">
              Zurückzusendende Positionen ({selectedItems.length} von {items.length} gewählt)
            </div>
            <div className="border border-border rounded-lg divide-y divide-border/60">
              {items.length === 0 && (
                <div className="p-4 text-sm text-text-light italic text-center">
                  Keine retourfähigen Positionen in dieser Bestellung.
                </div>
              )}
              {items.map((it) => (
                <div key={it.key} className="p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={it.selected}
                      onChange={() => toggleItem(it.key)}
                      className="mt-1 accent-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text">
                        {it.beschreibung}
                      </div>
                      <div className="text-xs text-text-light flex items-center gap-2 flex-wrap">
                        {it.hersteller && <span className="font-medium">{it.hersteller}</span>}
                        {it.artikelnummer && <span className="font-mono">{it.artikelnummer}</span>}
                        <span className="tabular-nums">{fmtEur(it.einzelpreis_brutto)} / Stück</span>
                      </div>
                    </div>
                    <div className="text-xs text-text-light">max {it.maxMenge}</div>
                  </label>

                  {it.selected && (
                    <div className="mt-2 ml-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-text-light mb-0.5">
                          Menge
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={it.maxMenge}
                          value={it.menge}
                          onChange={(e) => setMenge(it.key, parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1 border border-border rounded text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-medium text-text-light mb-0.5">
                          Grund
                        </label>
                        <select
                          value={it.grund_code}
                          onChange={(e) => setReason(it.key, e.target.value)}
                          className="w-full px-2 py-1 border border-border rounded text-sm"
                        >
                          {REASONS.map((r) => (
                            <option key={r.code} value={r.code}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {it.grund_code === "anderes" && (
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            placeholder="Bitte Grund kurz beschreiben"
                            value={it.grund_freitext}
                            onChange={(e) => setFreetext(it.key, e.target.value)}
                            className="w-full px-2 py-1 border border-border rounded text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedItems.length > 0 && (
              <div className="text-xs text-text-light mt-2 text-right">
                Vorauss. Erstattung (Warenwert brutto):{" "}
                <span className="font-semibold text-text">{fmtEur(totalRefund)}</span>
              </div>
            )}
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-text-light">Optionen</div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={labelRequested}
                onChange={(e) => setLabelRequested(e.target.checked)}
                className="accent-accent"
              />
              <span>DHL-Versandlabel automatisch erzeugen (vorfrankiert)</span>
            </label>
            {labelRequested && (
              <div className="ml-6 text-xs text-text-light">
                {freeLabel
                  ? "Label ist für den Kunden kostenfrei."
                  : "Kunde trägt die Versandkosten von 5,50 € (wird von der Erstattung abgezogen)."}
              </div>
            )}
            {isAdmin && labelRequested && (
              <label className="flex items-center gap-2 text-sm text-warning">
                <input
                  type="checkbox"
                  checked={freeLabel}
                  onChange={(e) => setFreeLabel(e.target.checked)}
                  className="accent-warning"
                />
                <span className="font-medium">Label kostenfrei (Rückgabe+ / Kulanz)</span>
                <span className="text-[10px] text-text-light">nur Admin</span>
              </label>
            )}
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-text-light mb-0.5">
                  Retoure-Kategorie
                </label>
                <select
                  value={kategorie}
                  onChange={(e) => setKategorie(e.target.value as "widerruf" | "gewaehrleistung")}
                  className="w-full px-2 py-1 border border-border rounded text-sm"
                >
                  <option value="widerruf">Widerruf (§312g BGB, 14 Tage)</option>
                  <option value="gewaehrleistung">Gewährleistung (§437 BGB, 2 Jahre)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white z-10 flex items-center justify-end gap-2 px-5 py-3 border-t border-border rounded-b-xl">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-3 py-2 text-sm text-text-light hover:text-text hover:bg-bg-secondary rounded"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Retoure wird angelegt…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Retoure anlegen & PDF laden
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
