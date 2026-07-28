"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Wrench, Package, Sparkles } from "lucide-react";
import { SearchableSelect, type Option } from "./searchable-select";
import { CatalogWizard } from "./catalog-wizard";
import { customerDisplayName } from "@/lib/customer-name";
import { formatEur, calcPosition, parseEurToCent } from "@/lib/money";

export type CustomerOpt = {
  id: string;
  type: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  vehicles: { id: string; brand: string | null; model: string | null; licensePlate: string | null; mileage: number | null }[];
};

export type ServiceOpt = {
  id: string;
  category: string | null;
  name: string;
  description: string | null;
  laborHours: number | null;
  netPriceCent: number;
  vatPercent: number;
  unit: string;
  suggestedParts?: string[];
};

type Position = {
  key: string;
  kind: "labor" | "part";
  name: string;
  description: string;
  quantity: string;
  unit: string;
  netPrice: string;
  vatPercent: number;
};

function empty(kind: "labor" | "part"): Position {
  return {
    key: Math.random().toString(36).slice(2),
    kind,
    name: "",
    description: "",
    quantity: "1",
    unit: kind === "labor" ? "Std" : "Stk",
    netPrice: "0,00",
    vatPercent: 19,
  };
}

export function DocComposer({
  kind,
  action,
  customers,
  services,
  hourlyRateCent,
  partsMarkupPercent,
  defaultCustomerId,
  defaultVehicleId,
  defaultDueDays,
}: {
  kind: "invoice" | "quote";
  action: (fd: FormData) => Promise<void>;
  customers: CustomerOpt[];
  services: ServiceOpt[];
  hourlyRateCent: number;
  partsMarkupPercent: number;
  defaultCustomerId: string;
  defaultVehicleId: string;
  defaultDueDays?: number; // wenn gesetzt: due-at default = heute + N tage
}) {
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [mileageAtIssue, setMileageAtIssue] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    if (!defaultDueDays) return "";
    const d = new Date();
    d.setDate(d.getDate() + defaultDueDays);
    return d.toISOString().slice(0, 10);
  });
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [markPaid, setMarkPaid] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedVehicle = selectedCustomer?.vehicles.find((v) => v.id === vehicleId);

  const customerOptions: Option[] = customers.map((c) => ({
    value: c.id,
    label: customerDisplayName(c),
    sublabel: [c.type === "b2b" ? "B2B" : "B2C", c.email].filter(Boolean).join(" · "),
  }));
  const vehicleOptions: Option[] = (selectedCustomer?.vehicles ?? []).map((v) => ({
    value: v.id,
    label: [v.brand, v.model].filter(Boolean).join(" ") || "Fahrzeug",
    sublabel: [v.licensePlate, v.mileage != null ? `${v.mileage.toLocaleString("de-DE")} km` : null].filter(Boolean).join(" · "),
  }));

  const laborPositions = positions.filter((p) => p.kind === "labor");
  const partPositions = positions.filter((p) => p.kind === "part");

  const totals = useMemo(() => {
    return positions.reduce(
      (acc, p) => {
        const qty = parseFloat(p.quantity.replace(",", ".")) || 0;
        const netCent = parseEurToCent(p.netPrice);
        const c = calcPosition(qty, netCent, p.vatPercent);
        return { net: acc.net + c.netTotalCent, vat: acc.vat + c.vatTotalCent, gross: acc.gross + c.grossTotalCent };
      },
      { net: 0, vat: 0, gross: 0 }
    );
  }, [positions]);

  function addPosition(k: "labor" | "part") {
    setPositions((p) => [...p, empty(k)]);
  }
  function removePosition(key: string) {
    setPositions((p) => p.filter((x) => x.key !== key));
  }
  function update(key: string, patch: Partial<Position>) {
    setPositions((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }
  function loadService(key: string, s: ServiceOpt) {
    const isLaborItem = s.laborHours != null && s.laborHours > 0;
    update(key, {
      kind: isLaborItem ? "labor" : positions.find((p) => p.key === key)?.kind ?? "labor",
      name: s.name,
      description: s.description ?? "",
      unit: isLaborItem ? "Std" : s.unit,
      quantity: isLaborItem && s.laborHours ? String(s.laborHours).replace(".", ",") : "1",
      netPrice: isLaborItem
        ? (hourlyRateCent / 100).toFixed(2).replace(".", ",")
        : (s.netPriceCent / 100).toFixed(2).replace(".", ","),
      vatPercent: s.vatPercent,
    });
  }

  /**
   * Wizard-callback: fügt eine Labor-position + N Teile-positionen ein.
   * Preise für teile bleiben bei 0€ (user setzt einkaufspreis danach).
   */
  function insertFromWizard(payload: { labor: ServiceOpt; partsToAdd: { name: string; quantity: number }[] }) {
    const laborPos: Position = {
      key: Math.random().toString(36).slice(2),
      kind: "labor",
      name: payload.labor.name,
      description: payload.labor.description ?? "",
      quantity: payload.labor.laborHours ? String(payload.labor.laborHours).replace(".", ",") : "1",
      unit: "Std",
      netPrice: (hourlyRateCent / 100).toFixed(2).replace(".", ","),
      vatPercent: payload.labor.vatPercent,
    };
    const partPositions: Position[] = payload.partsToAdd.map((p) => ({
      key: Math.random().toString(36).slice(2),
      kind: "part",
      name: p.name,
      description: "",
      quantity: String(p.quantity),
      unit: p.name.toLowerCase().includes("(") && p.name.toLowerCase().includes("l)") ? "l" : "Stk",
      netPrice: "0,00",
      vatPercent: 19,
    }));
    setPositions((prev) => [...prev, laborPos, ...partPositions]);
    setWizardOpen(false);
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="mileageAtIssue" value={mileageAtIssue} />

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Kunde &amp; Fahrzeug</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kunde *</label>
            <SearchableSelect
              options={customerOptions}
              value={customerId}
              onChange={(v) => {
                setCustomerId(v);
                setVehicleId("");
                setMileageAtIssue("");
              }}
              placeholder="Kunde suchen…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Fahrzeug</label>
            <SearchableSelect
              options={vehicleOptions}
              value={vehicleId}
              onChange={(v) => {
                setVehicleId(v);
                const veh = selectedCustomer?.vehicles.find((x) => x.id === v);
                if (veh?.mileage != null) setMileageAtIssue(String(veh.mileage));
              }}
              disabled={!selectedCustomer}
              placeholder={selectedCustomer ? "Fahrzeug suchen…" : "Zuerst Kunde wählen"}
              emptyText="Kein Fahrzeug beim Kunden"
            />
          </div>
        </div>
        {selectedVehicle && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                km-Stand jetzt (aktualisiert das Fahrzeug automatisch)
              </label>
              <input
                type="number"
                value={mileageAtIssue}
                onChange={(e) => setMileageAtIssue(e.target.value)}
                placeholder={selectedVehicle.mileage != null ? String(selectedVehicle.mileage) : "z.B. 84500"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              {selectedVehicle.mileage != null && (
                <p className="text-xs text-slate-500 mt-1">
                  Bisher: {selectedVehicle.mileage.toLocaleString("de-DE")} km
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border-2 border-orange-200 rounded-xl p-6 bg-gradient-to-br from-orange-50/40 to-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-600" />
              Aus Katalog wählen
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kategorie → Leistung → typische Teile werden automatisch vorgeschlagen
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Katalog öffnen
          </button>
        </div>
      </section>

      {wizardOpen && (
        <CatalogWizard
          services={services}
          hourlyRateCent={hourlyRateCent}
          onClose={() => setWizardOpen(false)}
          onSelect={insertFromWizard}
        />
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Arbeitsleistung</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Stundenlohn: <strong>{formatEur(hourlyRateCent)}/Std</strong> — änderbar in Einstellungen
            </p>
          </div>
          <button
            type="button"
            onClick={() => addPosition("labor")}
            className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
          >
            <Plus className="w-3 h-3" />
            Manuell
          </button>
        </div>
        {laborPositions.length === 0 && (
          <p className="text-xs text-slate-400 italic mb-2">Keine Arbeitsposition.</p>
        )}
        {laborPositions.map((p, idx) => (
          <PositionRow
            key={p.key}
            p={p}
            idx={idx}
            services={services.filter((s) => s.laborHours != null && s.laborHours > 0)}
            onChange={(patch) => update(p.key, patch)}
            onRemove={() => removePosition(p.key)}
            onLoadService={(s) => loadService(p.key, s)}
            iconColor="text-blue-500"
            icon={<Wrench className="w-3 h-3" />}
          />
        ))}
        <input type="hidden" />
        {laborPositions.map((p) => (
          <HiddenFields key={`hf-${p.key}`} p={p} />
        ))}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Ersatzteile / Material</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Einkaufspreis + {partsMarkupPercent}% Aufschlag (änderbar in Einstellungen)
            </p>
          </div>
          <button
            type="button"
            onClick={() => addPosition("part")}
            className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
          >
            <Plus className="w-3 h-3" />
            Manuell
          </button>
        </div>
        {partPositions.length === 0 && (
          <p className="text-xs text-slate-400 italic mb-2">Keine Teile-Position.</p>
        )}
        {partPositions.map((p, idx) => (
          <PositionRow
            key={p.key}
            p={p}
            idx={idx}
            services={services.filter((s) => !s.laborHours && s.netPriceCent > 0)}
            onChange={(patch) => update(p.key, patch)}
            onRemove={() => removePosition(p.key)}
            onLoadService={(s) => loadService(p.key, s)}
            iconColor="text-emerald-500"
            icon={<Package className="w-3 h-3" />}
            partsMarkupPercent={partsMarkupPercent}
          />
        ))}
        {partPositions.map((p) => (
          <HiddenFields key={`hf-${p.key}`} p={p} />
        ))}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">
          {kind === "invoice" ? "Zahlung & Notizen" : "Gültigkeit & Notizen"}
        </h2>
        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <input type="hidden" name="markPaid" value={markPaid ? "true" : "false"} />

        {kind === "invoice" && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">Zahlungsart</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "bank_transfer", label: "Überweisung", desc: "Standard, Fällig-Datum unten" },
                { value: "cash", label: "Bar (vor Ort)", desc: "Direkt bezahlt" },
                { value: "card", label: "EC / Karte", desc: "Direkt bezahlt" },
                { value: "sepa", label: "SEPA-Lastschrift", desc: "Kunde hat Mandat" },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.value);
                    // Bar/Karte → default markPaid=true
                    setMarkPaid(m.value === "cash" || m.value === "card");
                  }}
                  className={`p-2 text-left rounded-lg border ${
                    paymentMethod === m.value
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">{m.label}</div>
                  <div className="text-[10px] text-slate-500">{m.desc}</div>
                </button>
              ))}
            </div>
            {(paymentMethod === "cash" || paymentMethod === "card") && (
              <label className="flex items-center gap-2 mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                />
                <span className="text-emerald-900">
                  <strong>Bereits bezahlt</strong> — Rechnung dient nur als Nachweis, Status direkt „bezahlt"
                </span>
              </label>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {kind === "invoice" ? "Fällig am" : "Gültig bis"}
            </label>
            <input
              type="date"
              name={kind === "invoice" ? "dueAt" : "validUntil"}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={markPaid}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
            />
            {defaultDueDays != null && !markPaid && (
              <p className="text-xs text-slate-400 mt-1">Default: {defaultDueDays} Tage (in Einstellungen anpassen)</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">Notiz</label>
          <textarea
            name="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid grid-cols-2 gap-6">
          <div />
          <div className="text-sm text-right space-y-1">
            <div>
              <span className="text-slate-500">Netto:</span>{" "}
              <span className="font-medium ml-2">{formatEur(totals.net)}</span>
            </div>
            <div>
              <span className="text-slate-500">MwSt:</span>{" "}
              <span className="font-medium ml-2">{formatEur(totals.vat)}</span>
            </div>
            <div className="text-lg pt-1 border-t border-slate-200">
              <span className="text-slate-500">Brutto:</span>{" "}
              <span className="font-bold ml-2 text-orange-600">{formatEur(totals.gross)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="submit" name="action" value="draft" className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">
          Als Entwurf speichern
        </button>
        <button type="submit" name="action" value="finalize" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
          {kind === "invoice" ? "Rechnung anlegen" : "Angebot anlegen"}
        </button>
      </div>
    </form>
  );
}

function HiddenFields({ p }: { p: Position }) {
  return (
    <>
      <input type="hidden" name="pos_kind" value={p.kind} />
      <input type="hidden" name="pos_name" value={p.name} />
      <input type="hidden" name="pos_description" value={p.description} />
      <input type="hidden" name="pos_quantity" value={p.quantity} />
      <input type="hidden" name="pos_unit" value={p.unit} />
      <input type="hidden" name="pos_netPrice" value={p.netPrice} />
      <input type="hidden" name="pos_vatPercent" value={String(p.vatPercent)} />
    </>
  );
}

function PositionRow({
  p,
  idx,
  services,
  onChange,
  onRemove,
  onLoadService,
  icon,
  iconColor,
  partsMarkupPercent,
}: {
  p: Position;
  idx: number;
  services: ServiceOpt[];
  onChange: (patch: Partial<Position>) => void;
  onRemove: () => void;
  onLoadService: (s: ServiceOpt) => void;
  icon: React.ReactNode;
  iconColor: string;
  partsMarkupPercent?: number;
}) {
  const qty = parseFloat(p.quantity.replace(",", ".")) || 0;
  const netCent = parseEurToCent(p.netPrice);
  const rowTotal = qty * netCent;

  // Group services by category
  const grouped = useMemo(() => {
    const map = new Map<string, ServiceOpt[]>();
    for (const s of services) {
      const cat = s.category ?? "Andere";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services]);

  const [purchasePrice, setPurchasePrice] = useState("");

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${iconColor}`}>
          {icon} #{idx + 1}
        </span>
        <div className="flex items-center gap-2">
          {services.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const s = services.find((x) => x.id === e.target.value);
                if (s) onLoadService(s);
              }}
              className="text-xs px-2 py-1 border border-slate-300 rounded max-w-[240px]"
            >
              <option value="">↳ aus Katalog…</option>
              {grouped.map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.laborHours ? ` (${s.laborHours} Std)` : ` — ${formatEur(s.netPriceCent)}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          <button type="button" onClick={onRemove} className="p-1 text-slate-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <input
        required
        value={p.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder={p.kind === "labor" ? "Arbeitsleistung, z.B. Bremsbeläge tauschen" : "Ersatzteil, z.B. Bremsbeläge vorne"}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
      />
      <textarea
        value={p.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Beschreibung (optional, im PDF sichtbar)"
        rows={2}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mb-2"
      />
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Menge</label>
          <input
            value={p.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Einheit</label>
          <select
            value={p.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
          >
            <option>Stk</option>
            <option>Std</option>
            <option>Pauschal</option>
            <option>l</option>
            <option>m</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Netto/Einh. €</label>
          <input
            value={p.netPrice}
            onChange={(e) => onChange({ netPrice: e.target.value })}
            className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase text-slate-500 mb-0.5">MwSt</label>
          <select
            value={p.vatPercent}
            onChange={(e) => onChange({ vatPercent: parseInt(e.target.value, 10) })}
            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
          >
            <option value={19}>19 %</option>
            <option value={7}>7 %</option>
          </select>
        </div>
      </div>
      {p.kind === "part" && partsMarkupPercent != null && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-slate-500">Einkaufspreis:</span>
          <input
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0,00"
            className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right"
          />
          <button
            type="button"
            onClick={() => {
              const pp = parseEurToCent(purchasePrice);
              if (pp > 0) {
                const withMarkup = Math.round(pp * (1 + partsMarkupPercent / 100));
                onChange({ netPrice: (withMarkup / 100).toFixed(2).replace(".", ",") });
              }
            }}
            className="px-2 py-1 bg-slate-900 text-white rounded text-xs font-semibold"
          >
            +{partsMarkupPercent}% aufschlagen
          </button>
        </div>
      )}
      <div className="text-right mt-2 text-sm">
        <span className="text-slate-500">Summe:</span> <span className="font-semibold">{formatEur(rowTotal)}</span>
      </div>
    </div>
  );
}
