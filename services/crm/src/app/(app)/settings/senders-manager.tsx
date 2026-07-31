"use client";

import { useState } from "react";
import { Mail, Plus, Trash2, Edit, X, Check } from "lucide-react";
import { createSender, updateSender, deleteSender } from "./actions";

type Sender = {
  id: string;
  name: string;
  email: string;
  updatedAt: Date;
};

export function SendersManager({ senders }: { senders: Sender[] }) {
  const [editing, setEditing] = useState<Sender | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-text">Absender</h2>
          <p className="text-xs text-text-light mt-0.5">
            Absender-Adressen die pro Kampagne wählbar sind. Domain muss in Resend verified sein.
          </p>
        </div>
        {!creating && !editing && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" /> Neuer Absender
          </button>
        )}
      </div>

      {(creating || editing) && (
        <SenderForm
          sender={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {senders.length === 0 && !creating ? (
        <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
          <Mail className="w-8 h-8 text-text-light/40 mx-auto mb-2" />
          <p className="text-sm text-text-light">
            Noch keine Absender angelegt. Ohne Absender wird das globale Fallback (aus <code>.env</code>) benutzt.
          </p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          {senders.map((s, i) => (
            <div
              key={s.id}
              className={`p-4 flex items-center gap-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <Mail className="w-4 h-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{s.name}</p>
                <p className="text-xs text-text-light font-mono">{s.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(s)}
                className="p-1.5 hover:bg-bg-secondary rounded text-text-light hover:text-text"
                title="Bearbeiten"
              >
                <Edit className="w-4 h-4" />
              </button>
              <form
                action={deleteSender}
                onSubmit={(e) => {
                  if (!confirm(`Absender "${s.name}" wirklich löschen?`)) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  className="p-1.5 hover:bg-red-50 rounded text-text-light hover:text-danger transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SenderForm({
  sender,
  onClose,
}: {
  sender: Sender | null;
  onClose: () => void;
}) {
  const isEdit = !!sender;

  return (
    <form
      action={async (formData) => {
        if (isEdit) {
          formData.set("id", sender!.id);
          await updateSender(formData);
        } else {
          await createSender(formData);
        }
        onClose();
      }}
      className="bg-bg-card rounded-xl border border-accent/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text text-sm">
          {isEdit ? `Absender bearbeiten: ${sender.name}` : "Neuer Absender"}
        </h3>
        <button type="button" onClick={onClose} className="text-text-light hover:text-text p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-light mb-1">Anzeigename</label>
          <input
            name="name"
            required
            defaultValue={sender?.name ?? ""}
            placeholder="z.B. Corinna Wagner - kfzBlitz24"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-light mb-1">Email-Adresse</label>
          <input
            type="email"
            name="email"
            required
            defaultValue={sender?.email ?? ""}
            placeholder="corinna.wagner@kfzblitz24.de"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
          />
        </div>
      </div>

      <p className="text-xs text-text-light">
        Die Domain muss in Resend verified sein (aktuell: <code>kfzblitz24.de</code>).
        Empfänger sehen: <code className="font-mono">&quot;{'{Anzeigename}'}&quot; &lt;{'{Email}'}&gt;</code>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> {isEdit ? "Speichern" : "Erstellen"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-text-light hover:text-text text-sm"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
