"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createVehicleAction } from "../actions";
import { VehicleFormFields } from "./vehicle-form-fields";

export function AddVehicleButton({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
      >
        <Plus className="w-3.5 h-3.5" />
        Fahrzeug hinzufügen
      </button>
      {open && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Fahrzeug hinzufügen</h2>
                <p className="text-xs text-slate-500 mt-0.5">Alle Felder außer Kennzeichen sind optional.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </header>
            <form
              action={async (fd) => {
                await createVehicleAction(fd);
                setOpen(false);
              }}
              className="p-6 space-y-3"
            >
              <input type="hidden" name="customerId" value={customerId} />
              <VehicleFormFields />
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
                  Abbrechen
                </button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
                  Fahrzeug speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
