"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { customerDisplayName } from "@/lib/customer-name";
import { SearchableSelect } from "@/components/searchable-select";
import { createReminderAction } from "./actions";

type CustomerOpt = {
  id: string;
  type: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  vehicles: { id: string; brand: string | null; model: string | null; licensePlate: string | null }[];
};

export function ReminderCreateButton({ customers }: { customers: CustomerOpt[] }) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: customerDisplayName(c),
    sublabel: c.type === "b2b" ? "B2B" : "B2C",
  }));
  const vehicleOptions = (selectedCustomer?.vehicles ?? []).map((v) => ({
    value: v.id,
    label: [v.brand, v.model].filter(Boolean).join(" ") || "Fahrzeug",
    sublabel: v.licensePlate ?? undefined,
  }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
      >
        <Plus className="w-4 h-4" />
        Neue Erinnerung
      </button>
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Neue Erinnerung</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </header>
            <form action={createReminderAction} className="p-5 space-y-3">
              <input type="hidden" name="customerId" value={customerId} required />
              <input type="hidden" name="vehicleId" value={vehicleId} />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kunde *</label>
                <SearchableSelect
                  options={customerOptions}
                  value={customerId}
                  onChange={(v) => { setCustomerId(v); setVehicleId(""); }}
                  placeholder="Kunde suchen…"
                  required
                />
              </div>
              {selectedCustomer && selectedCustomer.vehicles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fahrzeug (optional)</label>
                  <SearchableSelect
                    options={vehicleOptions}
                    value={vehicleId}
                    onChange={setVehicleId}
                    placeholder="Fahrzeug suchen…"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Art *</label>
                <select name="type" defaultValue="tuev" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="tuev">HU/TÜV</option>
                  <option value="inspection">Inspektion</option>
                  <option value="oil_change">Ölwechsel</option>
                  <option value="custom">Sonstige</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Titel *</label>
                <input name="title" required placeholder="TÜV läuft ab, Ölwechsel fällig…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fällig am *</label>
                  <input type="date" name="dueDate" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Erinnern Tage vorher</label>
                  <input type="number" name="notifyDaysBefore" defaultValue="30" min="0" max="365" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notiz</label>
                <textarea name="note" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-600">Abbrechen</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">Erinnerung speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
