"use client";

import { useState } from "react";
import { Plus, Trash2, Wrench, Package, MessageSquare, Sparkles } from "lucide-react";
import { CatalogWizard } from "@/components/catalog-wizard";
import type { ServiceOpt } from "@/components/doc-composer";
import { formatEur } from "@/lib/money";
import { addWorkLogAction, addWorkLogFromServiceAction, deleteWorkLogAction } from "../actions";

type Entry = {
  id: string;
  kind: "labor" | "part" | "note";
  name: string;
  quantity: number;
  unit: string;
  note: string | null;
};

export function WorkLogEditor({
  appointmentId,
  entries,
  services,
  hourlyRateCent,
  readOnly,
}: {
  appointmentId: string;
  entries: Entry[];
  services: ServiceOpt[];
  hourlyRateCent: number;
  readOnly?: boolean;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showAddLabor, setShowAddLabor] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  const labor = entries.filter((e) => e.kind === "labor");
  const parts = entries.filter((e) => e.kind === "part");
  const notes = entries.filter((e) => e.kind === "note");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Was gemacht wurde</h2>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              Aus Katalog
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Alles was du machst wird hier festgehalten. Das Büro sieht das live und macht daraus die Rechnung.
        </p>
      </div>

      {/* Arbeit */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-white">Arbeitsleistung</h3>
            <span className="text-xs text-slate-400">
              {labor.reduce((s, e) => s + e.quantity, 0).toFixed(1)} Std ={" "}
              {formatEur(labor.reduce((s, e) => s + e.quantity * hourlyRateCent, 0))}
            </span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAddLabor((x) => !x)}
              className="text-xs px-2 py-1 border border-slate-700 rounded hover:bg-slate-800 text-slate-300"
            >
              <Plus className="w-3 h-3 inline mr-1" /> Manuell
            </button>
          )}
        </header>
        {labor.length === 0 && !showAddLabor && (
          <div className="p-6 text-center text-sm text-slate-500">Noch keine Arbeit erfasst.</div>
        )}
        {labor.map((e) => (
          <EntryRow key={e.id} entry={e} readOnly={readOnly} />
        ))}
        {showAddLabor && !readOnly && (
          <ManualAddForm
            appointmentId={appointmentId}
            kind="labor"
            onDone={() => setShowAddLabor(false)}
          />
        )}
      </section>

      {/* Teile */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white">Ersatzteile / Material</h3>
            <span className="text-xs text-slate-400">{parts.length} Positionen</span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAddPart((x) => !x)}
              className="text-xs px-2 py-1 border border-slate-700 rounded hover:bg-slate-800 text-slate-300"
            >
              <Plus className="w-3 h-3 inline mr-1" /> Manuell
            </button>
          )}
        </header>
        {parts.length === 0 && !showAddPart && (
          <div className="p-6 text-center text-sm text-slate-500">Noch keine Teile erfasst.</div>
        )}
        {parts.map((e) => (
          <EntryRow key={e.id} entry={e} readOnly={readOnly} />
        ))}
        {showAddPart && !readOnly && (
          <ManualAddForm
            appointmentId={appointmentId}
            kind="part"
            onDone={() => setShowAddPart(false)}
          />
        )}
      </section>

      {/* Notizen */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white">Notizen fürs Büro</h3>
            <span className="text-xs text-slate-400">{notes.length}</span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAddNote((x) => !x)}
              className="text-xs px-2 py-1 border border-slate-700 rounded hover:bg-slate-800 text-slate-300"
            >
              <Plus className="w-3 h-3 inline mr-1" /> Notiz
            </button>
          )}
        </header>
        {notes.length === 0 && !showAddNote && (
          <div className="p-6 text-center text-sm text-slate-500">Keine Notizen.</div>
        )}
        {notes.map((e) => (
          <div key={e.id} className="p-4 border-b border-slate-800 last:border-b-0 flex items-start justify-between gap-3">
            <p className="text-sm text-slate-200 flex-1">{e.name}</p>
            {!readOnly && (
              <form action={deleteWorkLogAction}>
                <input type="hidden" name="id" value={e.id} />
                <button className="text-slate-500 hover:text-red-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        ))}
        {showAddNote && !readOnly && (
          <ManualAddForm
            appointmentId={appointmentId}
            kind="note"
            onDone={() => setShowAddNote(false)}
          />
        )}
      </section>

      {wizardOpen && (
        <CatalogWizard
          services={services}
          hourlyRateCent={hourlyRateCent}
          onClose={() => setWizardOpen(false)}
          onSelect={async (payload) => {
            const fd = new FormData();
            fd.set("appointmentId", appointmentId);
            fd.set("serviceItemId", payload.labor.id);
            await addWorkLogFromServiceAction(fd);
            setWizardOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EntryRow({ entry, readOnly }: { entry: Entry; readOnly?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-800 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{entry.name}</div>
        {entry.note && <div className="text-xs text-slate-500 mt-0.5">{entry.note}</div>}
      </div>
      <div className="text-sm text-slate-300 tabular-nums whitespace-nowrap">
        {entry.quantity.toLocaleString("de-DE")} {entry.unit}
      </div>
      {!readOnly && (
        <form action={deleteWorkLogAction}>
          <input type="hidden" name="id" value={entry.id} />
          <button className="text-slate-500 hover:text-red-400 p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}

function ManualAddForm({
  appointmentId,
  kind,
  onDone,
}: {
  appointmentId: string;
  kind: "labor" | "part" | "note";
  onDone: () => void;
}) {
  return (
    <form
      action={async (fd) => {
        fd.set("appointmentId", appointmentId);
        fd.set("kind", kind);
        await addWorkLogAction(fd);
        onDone();
      }}
      className="p-4 border-b border-slate-800 last:border-b-0 bg-slate-950 space-y-2"
    >
      {kind === "note" ? (
        <textarea
          name="name"
          required
          rows={3}
          placeholder="z.B. Achtung: Rost am hinteren Radlauf, Kunde informiert"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
        />
      ) : (
        <>
          <input
            name="name"
            required
            placeholder={kind === "labor" ? "Was gemacht? z.B. Bremsen entlüftet" : "Teil, z.B. Bremsflüssigkeit DOT 4"}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="quantity"
              defaultValue="1"
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white text-right"
              placeholder="Menge"
            />
            <select
              name="unit"
              defaultValue={kind === "labor" ? "Std" : "Stk"}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
            >
              {kind === "labor" ? (
                <>
                  <option>Std</option>
                  <option>Pauschal</option>
                </>
              ) : (
                <>
                  <option>Stk</option>
                  <option>l</option>
                  <option>m</option>
                  <option>Pauschal</option>
                </>
              )}
            </select>
          </div>
        </>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="px-3 py-1.5 text-xs text-slate-400">
          Abbrechen
        </button>
        <button type="submit" className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-semibold">
          Speichern
        </button>
      </div>
    </form>
  );
}
