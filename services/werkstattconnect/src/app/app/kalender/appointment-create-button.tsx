"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { customerDisplayName } from "@/lib/customer-name";
import { SearchableSelect } from "@/components/searchable-select";
import { createAppointmentAction } from "./actions";

type CustomerOpt = {
  id: string;
  type: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  vehicles: { id: string; brand: string | null; model: string | null; licensePlate: string | null }[];
};

export function AppointmentCreateButton({
  customers,
  mechanics,
  defaultDate,
  defaultCustomerId,
  defaultTime,
}: {
  customers: CustomerOpt[];
  mechanics: { id: string; name: string }[];
  defaultDate: string;
  defaultCustomerId?: string;
  defaultTime?: string;
}) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(defaultCustomerId || "");
  const [vehicleId, setVehicleId] = useState("");
  const [mechanicId, setMechanicId] = useState("");
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
  const mechanicOptions = mechanics.map((m) => ({ value: m.id, label: m.name }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
      >
        <Plus className="w-4 h-4" />
        Neuer Termin
      </button>
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Neuer Termin</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </header>
            <form action={createAppointmentAction} className="p-5 space-y-3">
              <input type="hidden" name="customerId" value={customerId} required />
              <input type="hidden" name="vehicleId" value={vehicleId} />
              <input type="hidden" name="mechanicId" value={mechanicId} />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kunde *</label>
                <SearchableSelect
                  options={customerOptions}
                  value={customerId}
                  onChange={(v) => {
                    setCustomerId(v);
                    setVehicleId("");
                  }}
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
                    emptyText="Keine Fahrzeuge"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Titel *</label>
                <input name="title" required placeholder="Ölwechsel, HU, Bremsen…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Beschreibung</label>
                <textarea name="description" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Datum *</label>
                  <input type="date" name="date" required defaultValue={defaultDate} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Start *</label>
                  <input type="time" name="startTime" required defaultValue={defaultTime || "09:00"} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ende *</label>
                  <input type="time" name="endTime" required defaultValue="10:00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mechaniker</label>
                <SearchableSelect
                  options={mechanicOptions}
                  value={mechanicId}
                  onChange={setMechanicId}
                  placeholder="Mechaniker suchen…"
                  emptyText="Keine Mechaniker"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-600">Abbrechen</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">Termin speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
