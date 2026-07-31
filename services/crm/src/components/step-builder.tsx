"use client";

import { useState } from "react";
import {
  Mail, FileText, Phone, Plus, X, Clock, Calendar,
  Zap, Palette, AlertCircle, ChevronUp, ChevronDown, Timer,
} from "lucide-react";
import type { StepInput } from "@/app/(app)/campaigns/actions";

type Template = { id: string; name: string; subject: string; type?: string | null };

const DAYS: { label: string; value: number }[] = [
  { label: "Mo", value: 1 },
  { label: "Di", value: 2 },
  { label: "Mi", value: 3 },
  { label: "Do", value: 4 },
  { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
  { label: "So", value: 0 },
];

type SendWindow = { days: number[]; slots: { from: string; to: string }[] };

function parseWin(raw: string | null): SendWindow {
  if (!raw) return { days: [], slots: [] };
  try {
    const w = JSON.parse(raw) as Partial<SendWindow>;
    return {
      days: Array.isArray(w.days) ? w.days : [],
      slots: Array.isArray(w.slots) ? w.slots : [],
    };
  } catch {
    return { days: [], slots: [] };
  }
}

function stringifyWin(w: SendWindow): string | null {
  if (w.days.length === 0 && w.slots.length === 0) return null;
  return JSON.stringify(w);
}

// Blank template for a new step
function newStep(channel: StepInput["channel"], isFirst: boolean): StepInput {
  return {
    channel,
    triggerType: "relative",
    delayDays: isFirst ? 0 : 7,
    scheduledAt: null,
    sendWindow: null,
    maxPerDay: null,
    emailTemplateAId: null,
    emailTemplateBId: null,
    abSplitRatio: 50,
    letterTemplateAId: null,
    letterTemplateBId: null,
    letterAbSplitRatio: 50,
    letterColor: null,
    callNote: null,
  };
}

export function StepBuilder({
  templates,
  value,
  onChange,
}: {
  templates: Template[];
  value: StepInput[];
  onChange: (steps: StepInput[]) => void;
}) {
  const emailTemplates = templates.filter((t) => (t.type ?? "email") === "email");
  const letterTemplates = templates.filter((t) => t.type === "letter");
  const [addOpen, setAddOpen] = useState(false);

  const updateStep = (idx: number, patch: Partial<StepInput>) => {
    const next = [...value];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeStep = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addStep = (channel: StepInput["channel"]) => {
    onChange([...value, newStep(channel, value.length === 0)]);
    setAddOpen(false);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="text-center py-8 bg-bg-secondary/40 rounded-lg border-2 border-dashed border-border">
          <p className="text-sm text-text-light mb-2">Noch keine Schritte in dieser Kadenz</p>
          <p className="text-xs text-text-light">Klick unten auf „+ Schritt hinzufügen"</p>
        </div>
      )}

      {value.map((step, idx) => (
        <StepCard
          key={idx}
          index={idx}
          step={step}
          isFirst={idx === 0}
          isLast={idx === value.length - 1}
          emailTemplates={emailTemplates}
          letterTemplates={letterTemplates}
          onUpdate={(patch) => updateStep(idx, patch)}
          onRemove={() => removeStep(idx)}
          onMoveUp={() => moveStep(idx, -1)}
          onMoveDown={() => moveStep(idx, +1)}
        />
      ))}

      {/* Add-step controls */}
      <div className="relative">
        {!addOpen ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-sm text-text-light hover:border-accent hover:text-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schritt hinzufügen
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "email" as const, label: "E-Mail", icon: Mail },
                { id: "letter" as const, label: "Brief", icon: FileText },
                { id: "call" as const, label: "Anruf", icon: Phone },
              ]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => addStep(id)}
                className="flex items-center justify-center gap-2 py-3 border-2 border-accent bg-accent/5 rounded-lg text-sm text-accent font-medium hover:bg-accent/10 transition-colors"
              >
                <Icon className="w-4 h-4" /> {label} anhängen
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Single step card
// ────────────────────────────────────────────────────────────────────────
function StepCard({
  index, step, isFirst, isLast,
  emailTemplates, letterTemplates,
  onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  index: number;
  step: StepInput;
  isFirst: boolean;
  isLast: boolean;
  emailTemplates: Template[];
  letterTemplates: Template[];
  onUpdate: (patch: Partial<StepInput>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [showWindow, setShowWindow] = useState(!!step.sendWindow);
  const window = parseWin(step.sendWindow);

  const Icon = step.channel === "email" ? Mail : step.channel === "letter" ? FileText : Phone;
  const label = step.channel === "email" ? "E-Mail" : step.channel === "letter" ? "Brief" : "Anruf";

  const showAB = step.channel === "email" || step.channel === "letter";
  const hasAB = step.channel === "email" ? !!step.emailTemplateBId : !!step.letterTemplateBId;

  const setWindowDay = (d: number, on: boolean) => {
    const next = on ? [...window.days, d] : window.days.filter((x) => x !== d);
    onUpdate({ sendWindow: stringifyWin({ ...window, days: next }) });
  };
  const setWindowSlot = (i: number, key: "from" | "to", v: string) => {
    const slots = [...window.slots];
    slots[i] = { ...slots[i], [key]: v };
    onUpdate({ sendWindow: stringifyWin({ ...window, slots }) });
  };
  const addSlot = () => {
    onUpdate({
      sendWindow: stringifyWin({
        ...window,
        slots: [...window.slots, { from: "09:00", to: "17:00" }],
      }),
    });
  };
  const removeSlot = (i: number) => {
    onUpdate({
      sendWindow: stringifyWin({
        ...window,
        slots: window.slots.filter((_, x) => x !== i),
      }),
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-bg-secondary/60 border-b border-border">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold">
          {index + 1}
        </div>
        <Icon className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-text flex-1">
          Schritt {index + 1}: {label}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1 hover:bg-bg-secondary rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1 hover:bg-bg-secondary rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Timing */}
        <div>
          <label className="block text-xs font-medium text-text-light mb-2 flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5" /> Wann?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Trigger type */}
            <select
              value={step.triggerType}
              onChange={(e) => onUpdate({ triggerType: e.target.value as "relative" | "absolute" })}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="relative">
                {isFirst ? "Nach Kampagnenstart" : "Nach vorherigem Schritt"}
              </option>
              <option value="absolute">Zu festem Datum/Zeit</option>
            </select>

            {step.triggerType === "relative" ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={step.delayDays}
                  onChange={(e) => onUpdate({ delayDays: parseInt(e.target.value) || 0 })}
                  className="w-24 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <span className="text-sm text-text-light">
                  {step.delayDays === 0 ? "Tage → sofort" : "Tage warten"}
                </span>
              </div>
            ) : (
              <input
                type="datetime-local"
                value={step.scheduledAt ?? ""}
                onChange={(e) => onUpdate({ scheduledAt: e.target.value || null })}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            )}
          </div>
        </div>

        {/* Channel-specific config */}
        {step.channel === "email" && (
          <EmailStepConfig
            step={step}
            templates={emailTemplates}
            onUpdate={onUpdate}
          />
        )}
        {step.channel === "letter" && (
          <LetterStepConfig
            step={step}
            templates={letterTemplates}
            onUpdate={onUpdate}
          />
        )}
        {step.channel === "call" && (
          <CallStepConfig step={step} onUpdate={onUpdate} />
        )}

        {/* Send-window + max-per-day (only for email/letter — calls fire once per contact) */}
        {(step.channel === "email" || step.channel === "letter") && (
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                if (showWindow) {
                  onUpdate({ sendWindow: null, maxPerDay: null });
                }
                setShowWindow(!showWindow);
              }}
              className="flex items-center gap-2 text-xs font-medium text-text-light hover:text-accent"
            >
              <Clock className="w-3.5 h-3.5" />
              Sendefenster & Volumen-Limit
              {showWindow ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showWindow && (
              <div className="mt-3 p-3 bg-bg-secondary/40 rounded-lg space-y-3">
                {/* Days */}
                <div>
                  <p className="text-xs text-text-light mb-1.5">Wochentage (leer = alle)</p>
                  <div className="flex gap-1.5">
                    {DAYS.map((d) => {
                      const on = window.days.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setWindowDay(d.value, !on)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            on
                              ? "bg-accent text-white border-accent"
                              : "bg-bg-card text-text-light border-border hover:border-accent"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots */}
                <div>
                  <p className="text-xs text-text-light mb-1.5">Zeitfenster (leer = ganztägig)</p>
                  {window.slots.length === 0 && (
                    <p className="text-xs text-text-light italic mb-1.5">Keine Zeitfenster gesetzt</p>
                  )}
                  <div className="space-y-1.5">
                    {window.slots.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={s.from}
                          onChange={(e) => setWindowSlot(i, "from", e.target.value)}
                          className="px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                        <span className="text-xs text-text-light">bis</span>
                        <input
                          type="time"
                          value={s.to}
                          onChange={(e) => setWindowSlot(i, "to", e.target.value)}
                          className="px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                        <button
                          type="button"
                          onClick={() => removeSlot(i)}
                          className="p-1 hover:bg-red-50 hover:text-red-600 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addSlot}
                    className="mt-2 text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Fenster hinzufügen
                  </button>
                </div>

                {/* Max per day */}
                <div>
                  <p className="text-xs text-text-light mb-1.5">Max pro Tag (leer = kein Limit)</p>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={step.maxPerDay ?? ""}
                    onChange={(e) =>
                      onUpdate({ maxPerDay: e.target.value ? parseInt(e.target.value) : null })
                    }
                    placeholder="z.B. 30"
                    className="w-32 px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>

                <p className="text-[11px] text-text-light">
                  Wenn ein Kontakt außerhalb des Fensters fällig wird oder das Tageslimit voll ist,
                  wartet der Cron bis zum nächsten passenden Zeitpunkt.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Auto-stop hint */}
        {index === 0 && (
          <div className="flex items-start gap-2 text-[11px] text-text-light bg-blue-50 border border-blue-100 rounded p-2">
            <AlertCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
            <span>
              Wenn ein Kontakt <b>vor</b> dem nächsten Schritt per E-Mail antwortet, wird
              die Kadenz für diesen Kontakt automatisch <b>gestoppt</b> — es geht keine
              weitere E-Mail und kein Brief mehr raus.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Channel-specific config blocks
// ────────────────────────────────────────────────────────────────────────
function EmailStepConfig({
  step, templates, onUpdate,
}: {
  step: StepInput;
  templates: Template[];
  onUpdate: (patch: Partial<StepInput>) => void;
}) {
  const [ab, setAb] = useState(!!step.emailTemplateBId);

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-text-light mb-1">Template A *</label>
        <select
          value={step.emailTemplateAId ?? ""}
          onChange={(e) => onUpdate({ emailTemplateAId: e.target.value || null })}
          required
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">Template wählen...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} – {t.subject}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <input
          type="checkbox"
          checked={ab}
          onChange={(e) => {
            setAb(e.target.checked);
            if (!e.target.checked) onUpdate({ emailTemplateBId: null });
          }}
          className="rounded border-border"
        />
        <Zap className="w-3 h-3 text-accent" />
        <span className="font-medium">A/B Testing</span>
      </label>

      {ab && (
        <div className="pl-5 space-y-2">
          <select
            value={step.emailTemplateBId ?? ""}
            onChange={(e) => onUpdate({ emailTemplateBId: e.target.value || null })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">Template B wählen...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} – {t.subject}</option>
            ))}
          </select>
          <div>
            <p className="text-xs text-text-light">Split: {step.abSplitRatio}% A / {100 - (step.abSplitRatio ?? 50)}% B</p>
            <input
              type="range"
              min={10}
              max={90}
              step={10}
              value={step.abSplitRatio ?? 50}
              onChange={(e) => onUpdate({ abSplitRatio: parseInt(e.target.value) })}
              className="w-full accent-accent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LetterStepConfig({
  step, templates, onUpdate,
}: {
  step: StepInput;
  templates: Template[];
  onUpdate: (patch: Partial<StepInput>) => void;
}) {
  const [ab, setAb] = useState(!!step.letterTemplateBId);

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-text-light mb-1">Brief-Template A *</label>
        <select
          value={step.letterTemplateAId ?? ""}
          onChange={(e) => onUpdate({ letterTemplateAId: e.target.value || null })}
          required
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">Brief-Template wählen...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} – {t.subject}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <input
          type="checkbox"
          checked={ab}
          onChange={(e) => {
            setAb(e.target.checked);
            if (!e.target.checked) onUpdate({ letterTemplateBId: null });
          }}
          className="rounded border-border"
        />
        <Zap className="w-3 h-3 text-accent" />
        <span className="font-medium">A/B Testing (Brief)</span>
      </label>

      {ab && (
        <div className="pl-5 space-y-2">
          <select
            value={step.letterTemplateBId ?? ""}
            onChange={(e) => onUpdate({ letterTemplateBId: e.target.value || null })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">Template B wählen...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} – {t.subject}</option>
            ))}
          </select>
          <div>
            <p className="text-xs text-text-light">
              Split: {step.letterAbSplitRatio}% A / {100 - (step.letterAbSplitRatio ?? 50)}% B
            </p>
            <input
              type="range"
              min={10}
              max={90}
              step={10}
              value={step.letterAbSplitRatio ?? 50}
              onChange={(e) => onUpdate({ letterAbSplitRatio: parseInt(e.target.value) })}
              className="w-full accent-accent"
            />
          </div>
        </div>
      )}

      <div className="pt-2">
        <label className="block text-xs font-medium text-text-light mb-1 flex items-center gap-1.5">
          <Palette className="w-3 h-3" /> Druck
        </label>
        <div className="flex gap-2">
          {(
            [
              { v: null, label: "Standard (aus Config)" },
              { v: "4", label: "Farbig" },
              { v: "1", label: "S/W" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onUpdate({ letterColor: opt.v })}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                step.letterColor === opt.v
                  ? "bg-accent text-white border-accent"
                  : "bg-bg-card text-text-light border-border hover:border-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CallStepConfig({
  step, onUpdate,
}: {
  step: StepInput;
  onUpdate: (patch: Partial<StepInput>) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-light mb-1">
        Notiz für den Anrufer (optional)
      </label>
      <textarea
        value={step.callNote ?? ""}
        onChange={(e) => onUpdate({ callNote: e.target.value || null })}
        placeholder="z.B. „Nachfassen zum Angebot Radabwicklung, Bezug auf Brief vom letzten Monat"
        rows={2}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
      />
      <p className="text-[11px] text-text-light mt-1">
        Erzeugt eine Wiedervorlage für den zugewiesenen Nutzer (oder ein Admin).
      </p>
    </div>
  );
}
