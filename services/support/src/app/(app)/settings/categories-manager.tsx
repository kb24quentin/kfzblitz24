"use client";

import { useState } from "react";
import { Tag, Plus, Trash2, Save } from "lucide-react";
import { saveCategoriesAction } from "./actions";

type Category = { key: string; label: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

export function CategoriesManager({
  initial,
}: {
  initial: Category[];
}) {
  const [cats, setCats] = useState<Category[]>(initial);
  const [newLabel, setNewLabel] = useState("");

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = slugify(label);
    if (!key) return;
    if (cats.some((c) => c.key === key)) return;
    setCats([...cats, { key, label }]);
    setNewLabel("");
  };

  const remove = (key: string) => {
    setCats(cats.filter((c) => c.key !== key));
  };

  const updateLabel = (key: string, newLabelText: string) => {
    setCats(cats.map((c) => (c.key === key ? { ...c, label: newLabelText } : c)));
  };

  return (
    <div className="bg-bg-card rounded-xl border border-border p-6">
      <h2 className="font-semibold text-text flex items-center gap-2 mb-1">
        <Tag className="w-4 h-4 text-accent" /> Ticket-Kategorien
      </h2>
      <p className="text-xs text-text-light mb-4">
        Welche Kategorien darf AI beim Klassifizieren vergeben, welche siehst du
        im Dropdown. Änderungen wirken ab dem nächsten AI-Draft.
      </p>

      <form action={saveCategoriesAction} className="space-y-3">
        <input type="hidden" name="categories" value={JSON.stringify(cats)} />

        <div className="space-y-2">
          {cats.map((cat) => (
            <div
              key={cat.key}
              className="flex items-center gap-2 bg-bg-secondary/40 rounded-lg p-2"
            >
              <span className="font-mono text-xs text-text-light bg-white px-2 py-1 rounded border border-border min-w-[110px]">
                {cat.key}
              </span>
              <input
                type="text"
                value={cat.label}
                onChange={(e) => updateLabel(cat.key, e.target.value)}
                className="flex-1 px-3 py-1.5 border border-border rounded text-sm bg-white"
              />
              <button
                type="button"
                onClick={() => remove(cat.key)}
                className="p-1.5 text-text-light hover:text-danger hover:bg-danger/10 rounded"
                title="Entfernen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {cats.length === 0 && (
            <div className="text-xs text-text-light italic p-3">
              Noch keine Kategorien. AI kann dann nichts sinnvolles klassifizieren.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Neue Kategorie …"
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-white"
          />
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm text-text-light hover:bg-bg-secondary"
          >
            <Plus className="w-3.5 h-3.5" /> Hinzufügen
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> Kategorien speichern
          </button>
        </div>
      </form>
    </div>
  );
}
