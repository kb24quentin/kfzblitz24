"use client";

import { useState } from "react";
import { Sparkles, Check, Info } from "lucide-react";
import { saveAiAutopilotAction } from "./actions";

export function AiAutopilotEditor({
  categories,
  allowedCategories,
  minConfidence,
}: {
  categories: { key: string; label: string }[];
  allowedCategories: string[];
  minConfidence: number;
}) {
  const [conf, setConf] = useState(Math.round(minConfidence * 100));

  return (
    <form action={saveAiAutopilotAction} className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <label className="text-xs font-medium text-text-light">
            Mindest-Confidence für Auto-Send
          </label>
          <span className="text-sm font-mono text-accent">{conf}%</span>
        </div>
        <input
          type="range"
          name="minConfidence"
          min={50}
          max={100}
          step={5}
          value={conf}
          onChange={(e) => setConf(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-xs text-text-light mt-1">
          <span>50 % (mehr auto)</span>
          <span>100 % (nur felsenfest)</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-light mb-2">
          Kategorien die AI ohne Review-Freigabe versenden darf
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {categories.map((cat) => {
            const checked = allowedCategories.includes(cat.key);
            return (
              <label
                key={cat.key}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm cursor-pointer hover:bg-bg-secondary transition-colors has-[:checked]:bg-accent/10 has-[:checked]:border-accent/40"
              >
                <input
                  type="checkbox"
                  name={`cat_${cat.key}`}
                  defaultChecked={checked}
                  className="w-4 h-4 accent-accent"
                />
                <span className="font-medium">{cat.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-info/5 border border-info/20 rounded-lg text-xs text-text-light">
        <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <div>
          Nur wenn <strong>beide</strong> Bedingungen zutreffen (Kategorie
          erlaubt UND Confidence hoch genug), sendet AI die Antwort automatisch
          ohne dass ein Mensch draufschaut. Sonst landet der Draft im
          Ticket-Detail und wartet auf Freigabe. <strong>Empfehlung fürs
          erste:</strong> keine Kategorien aktivieren, alles manuell reviewen.
          Nach ein paar Wochen mit AI-Drafts kannst du sehen was zuverlässig
          klappt und die einfachsten Kategorien freischalten.
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Autopilot speichern
        </button>
      </div>
    </form>
  );
}

export function AiAutopilotSection(props: {
  categories: { key: string; label: string }[];
  allowedCategories: string[];
  minConfidence: number;
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-6">
      <h2 className="font-semibold text-text flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-accent" /> AI-Autopilot
      </h2>
      <p className="text-xs text-text-light mb-4">
        Steuert wann AI-Drafts direkt an Kunden geschickt werden dürfen — ohne
        dass jemand reviewen muss.
      </p>
      <AiAutopilotEditor {...props} />
    </div>
  );
}
