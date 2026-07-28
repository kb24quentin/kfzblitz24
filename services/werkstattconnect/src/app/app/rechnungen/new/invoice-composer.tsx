"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { customerDisplayName } from "@/lib/customer-name";
import { formatEur, calcPosition, parseEurToCent } from "@/lib/money";
import { createInvoiceAction } from "../actions";

type CustomerOpt = {
  id: string;
  type: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  vehicles: { id: string; brand: string | null; model: string | null; licensePlate: string | null }[];
};

type ServiceOpt = {
  id: string;
  name: string;
  description: string | null;
  netPriceCent: number;
  vatPercent: number;
  unit: string;
};

type Position = {
  key: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  netPrice: string; // string wegen komma-eingabe
  vatPercent: number;
};

function emptyPosition(): Position {
  return {
    key: Math.random().toString(36).slice(2),
    name: "",
    description: "",
    quantity: "1",
    unit: "Stk",
    netPrice: "0,00",
    vatPercent: 19,
  };
}

export function InvoiceComposer({
  customers,
  services,
  defaultCustomerId,
  defaultVehicleId,
}: {
  customers: CustomerOpt[];
  services: ServiceOpt[];
  defaultCustomerId: string;
  defaultVehicleId: string;
}) {
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [positions, setPositions] = useState<Position[]>([emptyPosition()]);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const totals = useMemo(() => {
    return positions.reduce(
      (acc, p) => {
        const qty = parseFloat(p.quantity.replace(",", ".")) || 0;
        const netCent = parseEurToCent(p.netPrice);
        const c = calcPosition(qty, netCent, p.vatPercent);
        return {
          net: acc.net + c.netTotalCent,
          vat: acc.vat + c.vatTotalCent,
          gross: acc.gross + c.grossTotalCent,
        };
      },
      { net: 0, vat: 0, gross: 0 }
    );
  }, [positions]);

  function addPosition() {
    setPositions((p) => [...p, emptyPosition()]);
  }
  function removePosition(key: string) {
    setPositions((p) => p.filter((x) => x.key !== key));
  }
  function updatePosition(key: string, patch: Partial<Position>) {
    setPositions((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }
  function loadService(key: string, s: ServiceOpt) {
    updatePosition(key, {
      name: s.name,
      description: s.description ?? "",
      unit: s.unit,
      netPrice: (s.netPriceCent / 100).toFixed(2).replace(".", ","),
      vatPercent: s.vatPercent,
    });
  }

  return (
    <form action={createInvoiceAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Kunde & Fahrzeug</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kunde *</label>
            <select
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setVehicleId("");
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Bitte wählen…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Fahrzeug (optional)</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!selectedCustomer}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
            >
              <option value="">—</option>
              {selectedCustomer?.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.brand, v.model].filter(Boolean).join(" ")} {v.licensePlate ? `(${v.licensePlate})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Positionen</h2>
          <button
            type="button"
            onClick={addPosition}
            className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
          >
            <Plus className="w-3 h-3" />
            Position
          </button>
        </div>

        <div className="space-y-4">
          {positions.map((p, idx) => (
            <div key={p.key} className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Position {idx + 1}</span>
                <div className="flex items-center gap-2">
                  {services.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const s = services.find((s) => s.id === e.target.value);
                        if (s) loadService(p.key, s);
                      }}
                      className="text-xs px-2 py-1 border border-slate-300 rounded"
                    >
                      <option value="">↳ aus Katalog…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} — {formatEur(s.netPriceCent)}</option>
                      ))}
                    </select>
                  )}
                  {positions.length > 1 && (
                    <button type="button" onClick={() => removePosition(p.key)} className="p-1 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <input type="hidden" name="pos_name" value={p.name} />
              <input type="hidden" name="pos_description" value={p.description} />
              <input type="hidden" name="pos_quantity" value={p.quantity} />
              <input type="hidden" name="pos_unit" value={p.unit} />
              <input type="hidden" name="pos_netPrice" value={p.netPrice} />
              <input type="hidden" name="pos_vatPercent" value={String(p.vatPercent)} />

              <input
                required
                value={p.name}
                onChange={(e) => updatePosition(p.key, { name: e.target.value })}
                placeholder="Bezeichnung"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
              />
              <textarea
                value={p.description}
                onChange={(e) => updatePosition(p.key, { description: e.target.value })}
                placeholder="Beschreibung (optional, wird in PDF angezeigt)"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mb-2"
              />
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Menge</label>
                  <input
                    value={p.quantity}
                    onChange={(e) => updatePosition(p.key, { quantity: e.target.value })}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Einheit</label>
                  <select
                    value={p.unit}
                    onChange={(e) => updatePosition(p.key, { unit: e.target.value })}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  >
                    <option>Stk</option>
                    <option>Std</option>
                    <option>Pauschal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Netto €</label>
                  <input
                    value={p.netPrice}
                    onChange={(e) => updatePosition(p.key, { netPrice: e.target.value })}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">MwSt</label>
                  <select
                    value={p.vatPercent}
                    onChange={(e) => updatePosition(p.key, { vatPercent: parseInt(e.target.value, 10) })}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  >
                    <option value={19}>19 %</option>
                    <option value={7}>7 %</option>
                  </select>
                </div>
              </div>
              <div className="text-right mt-2 text-sm">
                <span className="text-slate-500">Summe:</span>{" "}
                <span className="font-semibold">
                  {(() => {
                    const qty = parseFloat(p.quantity.replace(",", ".")) || 0;
                    const netCent = parseEurToCent(p.netPrice);
                    return formatEur(qty * netCent);
                  })()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Zahlung & Notizen</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Fällig am</label>
            <input type="date" name="dueAt" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">Notiz auf Rechnung</label>
          <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid grid-cols-2 gap-6">
          <div />
          <div className="text-sm text-right space-y-1">
            <div><span className="text-slate-500">Netto:</span> <span className="font-medium ml-2">{formatEur(totals.net)}</span></div>
            <div><span className="text-slate-500">MwSt:</span> <span className="font-medium ml-2">{formatEur(totals.vat)}</span></div>
            <div className="text-lg pt-1 border-t border-slate-200"><span className="text-slate-500">Brutto:</span> <span className="font-bold ml-2 text-orange-600">{formatEur(totals.gross)}</span></div>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="submit" name="action" value="draft" className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">
          Als Entwurf speichern
        </button>
        <button type="submit" name="action" value="finalize" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
          Rechnung anlegen
        </button>
      </div>
    </form>
  );
}
