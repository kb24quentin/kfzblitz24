"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { createReminder } from "./actions";

export function ReminderForm({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-info/10 text-info rounded-lg text-sm font-medium hover:bg-info/20 transition-colors"
      >
        <Bell className="w-4 h-4" /> Wiedervorlage
      </button>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm text-text flex items-center gap-2">
          <Bell className="w-4 h-4 text-info" /> Wiedervorlage anlegen
        </h4>
        <button onClick={() => setOpen(false)} className="p-1 hover:bg-bg-secondary rounded-lg">
          <X className="w-4 h-4 text-text-light" />
        </button>
      </div>
      <form
        action={async (formData) => {
          await createReminder(formData);
          setOpen(false);
        }}
        className="space-y-3"
      >
        <input type="hidden" name="contactId" value={contactId} />
        <div>
          <input
            name="title"
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            placeholder="z.B. Nachfassen zum Angebot"
          />
        </div>
        <div>
          <textarea
            name="description"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            placeholder="Beschreibung (optional)"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-light mb-1">Faellig am</label>
          <input
            name="dueDate"
            type="date"
            required
            min={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          Wiedervorlage erstellen
        </button>
      </form>
    </div>
  );
}
