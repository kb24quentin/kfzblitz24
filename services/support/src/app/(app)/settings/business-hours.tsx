"use client";

import { Calendar, Check } from "lucide-react";
import { saveBusinessHoursAction } from "./actions";
import type { BusinessHours } from "@/lib/settings";

const DAYS: { key: keyof Omit<BusinessHours, "timezone">; label: string }[] = [
  { key: "mon", label: "Montag" },
  { key: "tue", label: "Dienstag" },
  { key: "wed", label: "Mittwoch" },
  { key: "thu", label: "Donnerstag" },
  { key: "fri", label: "Freitag" },
  { key: "sat", label: "Samstag" },
  { key: "sun", label: "Sonntag" },
];

export function BusinessHoursEditor({ initial }: { initial: BusinessHours }) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-6">
      <h2 className="font-semibold text-text flex items-center gap-2 mb-1">
        <Calendar className="w-4 h-4 text-accent" /> Geschäftszeiten
      </h2>
      <p className="text-xs text-text-light mb-4">
        Wird künftig für SLA-Berechnung genutzt: Zeit außerhalb dieser Slots
        (Feierabend, Wochenende) zählt nicht gegen die Erstantwort-Uhr. Bis das
        aktiv ist, dient's als Referenz auf dem Dashboard.
      </p>

      <form action={saveBusinessHoursAction} className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {DAYS.map((d) => {
            const day = initial[d.key];
            return (
              <div
                key={d.key}
                className="flex items-center gap-3 bg-bg-secondary/40 rounded-lg p-2.5"
              >
                <label className="flex items-center gap-2 min-w-[140px] cursor-pointer">
                  <input
                    type="checkbox"
                    name={`${d.key}_active`}
                    defaultChecked={day.active}
                    className="w-4 h-4 accent-accent"
                  />
                  <span className="font-medium text-text text-sm">{d.label}</span>
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    name={`${d.key}_from`}
                    defaultValue={day.from}
                    className="px-2 py-1 border border-border rounded bg-white"
                  />
                  <span className="text-text-light">bis</span>
                  <input
                    type="time"
                    name={`${d.key}_to`}
                    defaultValue={day.to}
                    className="px-2 py-1 border border-border rounded bg-white"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <label className="text-xs text-text-light">Zeitzone:</label>
          <input
            type="text"
            name="timezone"
            defaultValue={initial.timezone || "Europe/Berlin"}
            className="px-2 py-1 border border-border rounded text-xs bg-white font-mono"
            placeholder="Europe/Berlin"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Geschäftszeiten speichern
          </button>
        </div>
      </form>
    </div>
  );
}
