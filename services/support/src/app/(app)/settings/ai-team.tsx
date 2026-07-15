"use client";

import { useState } from "react";
import { Users, Plus, Trash2, Check } from "lucide-react";
import {
  saveAiPersonaAction,
  deleteAiPersonaAction,
  saveAiAutosendDelayAction,
} from "./actions";

type Persona = {
  id: string;
  name: string;
  position: string;
  weight: number;
  active: boolean;
};

export function AiTeamSection({
  personas,
  delayMin,
  delayMax,
}: {
  personas: Persona[];
  delayMin: number;
  delayMax: number;
}) {
  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState("Kundenservice");
  const [newWeight, setNewWeight] = useState(20);

  const activeSum = personas.filter((p) => p.active).reduce((s, p) => s + p.weight, 0);
  const percent = (weight: number) => (activeSum > 0 ? Math.round((weight / activeSum) * 100) : 0);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-6 mb-6">
      <div className="mb-4">
        <h2 className="font-semibold text-text flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" /> AI-Team (Auto-Send-Signaturen)
        </h2>
        <p className="text-xs text-text-light mt-0.5">
          Fiktive Mitarbeiter-Namen die AI bei Auto-Send-Antworten in die Signatur setzt.
          Gewichte bestimmen wie häufig ein Name gewählt wird. Bei manuellem Draft-Approve
          erscheint stattdessen der Agent-Name.
        </p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-xs uppercase text-text-light">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Position</th>
              <th className="px-3 py-2 text-right font-medium w-24">Gewicht</th>
              <th className="px-3 py-2 text-right font-medium w-20">Anteil</th>
              <th className="px-3 py-2 text-center font-medium w-20">Aktiv</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {personas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-text-light italic">
                  Noch keine AI-Personas angelegt.
                </td>
              </tr>
            )}
            {personas.map((p) => (
              <PersonaRow key={p.id} p={p} percent={percent(p.weight)} />
            ))}
          </tbody>
        </table>
      </div>

      <form action={saveAiPersonaAction} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-6">
        <input
          name="name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Neuer Name"
          className="md:col-span-2 px-3 py-2 border border-border rounded text-sm"
        />
        <input
          name="position"
          value={newPosition}
          onChange={(e) => setNewPosition(e.target.value)}
          placeholder="Position"
          className="px-3 py-2 border border-border rounded text-sm"
        />
        <input
          type="number"
          name="weight"
          value={newWeight}
          onChange={(e) => setNewWeight(parseInt(e.target.value) || 0)}
          min={0}
          max={100}
          placeholder="Gewicht"
          className="px-3 py-2 border border-border rounded text-sm text-right tabular-nums"
        />
        <input type="hidden" name="active" value="on" />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Hinzufügen
        </button>
      </form>

      <div className="border-t border-border pt-4">
        <h3 className="font-medium text-text mb-2 text-sm">AI-Auto-Send Verzögerung</h3>
        <p className="text-xs text-text-light mb-3">
          Damit AI-Antworten nicht sofort raushusten und &ldquo;echter&rdquo; wirken, wird zwischen
          Draft-Erstellung und Versand eine zufällige Wartezeit im Bereich min–max eingelegt.
        </p>
        <form action={saveAiAutosendDelayAction} className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-text-light mb-1">Minimum (Sek.)</label>
            <input
              type="number"
              name="min"
              defaultValue={delayMin}
              min={0}
              max={3600}
              className="w-24 px-3 py-2 border border-border rounded text-sm text-right tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-text-light mb-1">Maximum (Sek.)</label>
            <input
              type="number"
              name="max"
              defaultValue={delayMax}
              min={0}
              max={3600}
              className="w-24 px-3 py-2 border border-border rounded text-sm text-right tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent-light transition-colors"
          >
            Speichern
          </button>
          <span className="text-xs text-text-light">
            Aktuell: {delayMin}–{delayMax} Sek ({Math.round(delayMin / 60)}–{Math.round(delayMax / 60)} Min)
          </span>
        </form>
      </div>
    </div>
  );
}

function PersonaRow({ p, percent }: { p: Persona; percent: number }) {
  return (
    <tr className={p.active ? "" : "opacity-50"}>
      <td colSpan={6} className="p-0">
        <form action={saveAiPersonaAction}>
          <div className="grid grid-cols-[1fr_1fr_6rem_5rem_5rem_4rem] gap-2 px-3 py-2 items-center">
            <input type="hidden" name="id" value={p.id} />
            <input
              name="name"
              defaultValue={p.name}
              className="px-2 py-1 border border-border rounded text-sm"
            />
            <input
              name="position"
              defaultValue={p.position}
              className="px-2 py-1 border border-border rounded text-sm"
            />
            <input
              type="number"
              name="weight"
              min={0}
              max={100}
              defaultValue={p.weight}
              className="px-2 py-1 border border-border rounded text-sm text-right tabular-nums"
            />
            <span className="text-right text-xs text-text-light tabular-nums">
              {p.active ? `${percent} %` : "—"}
            </span>
            <label className="flex justify-center">
              <input type="checkbox" name="active" defaultChecked={p.active} className="accent-accent" />
            </label>
            <div className="flex items-center justify-end gap-1">
              <button
                type="submit"
                className="p-1 text-text-light hover:text-success rounded"
                title="Speichern"
              >
                <Check className="w-4 h-4" />
              </button>
              <DeleteButton id={p.id} name={p.name} />
            </div>
          </div>
        </form>
      </td>
    </tr>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteAiPersonaAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`Persona "${name}" löschen?`)) e.preventDefault();
        }}
        className="p-1 text-text-light hover:text-danger rounded"
        title="Löschen"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </form>
  );
}
