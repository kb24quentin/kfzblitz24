"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Save, Trash2, Upload } from "lucide-react";
import type { TemplateDef } from "@/lib/pdf/types";
import { saveBriefpapierAction } from "./actions";

const CATEGORIES = ["Modern", "Klassisch", "Minimal", "Bold", "Farbig"] as const;

const PRESET_COLORS = [
  "#fe6503", "#092c43", "#1f6feb", "#7c3aed", "#e11d48",
  "#16a34a", "#0891b2", "#f59e0b", "#0f172a", "#6b7280",
];

export type BriefpapierState = {
  letterheadTemplate: string;
  brandPrimary: string;
  brandAccent: string;
  brandFooterText: string;
  footerCol1: string;
  footerCol2: string;
  footerCol3: string;
  brandFontFamily: string;
  brandTableStyle: string;
  brandDensity: string;
};

const FONT_OPTIONS = [
  { value: "helvetica", label: "Helvetica (Standard, sans-serif)" },
  { value: "times", label: "Times (klassisch, serif)" },
  { value: "courier", label: "Courier (monospace, technisch)" },
];

const TABLE_STYLES = [
  { value: "colored", label: "Farbig", desc: "Header-Zeile in Primärfarbe" },
  { value: "bordered", label: "Umrandet", desc: "Rahmen um jede Zeile" },
  { value: "zebra", label: "Zebra", desc: "Abwechselnd grauer Hintergrund" },
  { value: "minimal", label: "Minimal", desc: "Nur eine Linie unter Header" },
];

const DENSITIES = [
  { value: "compact", label: "Kompakt", desc: "Wenig Platz zwischen Zeilen" },
  { value: "normal", label: "Normal", desc: "Standard-Abstand" },
  { value: "spacious", label: "Luftig", desc: "Viel Weißraum" },
];

export function BriefpapierEditor({
  templates,
  initial,
  logoDataUrl,
  workshopName,
}: {
  templates: TemplateDef[];
  initial: BriefpapierState;
  logoDataUrl: string | null;
  workshopName: string;
}) {
  const [state, setState] = useState<BriefpapierState>(initial);
  const [category, setCategory] = useState<string>("all");
  const [saved, setSaved] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoState, setLogoState] = useState<"keep" | "new" | "clear">("keep");
  const [logoPreview, setLogoPreview] = useState<string | null>(logoDataUrl);

  const filtered = category === "all" ? templates : templates.filter((t) => t.category === category);

  // Debounced iframe-url — vermeidet zu viele PDF-renders bei tippen
  const [debouncedState, setDebouncedState] = useState(state);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedState(state), 400);
    return () => clearTimeout(t);
  }, [state]);

  const previewUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("template", debouncedState.letterheadTemplate);
    p.set("primary", debouncedState.brandPrimary);
    if (debouncedState.brandAccent) p.set("accent", debouncedState.brandAccent);
    p.set("footerCol1", debouncedState.footerCol1);
    p.set("footerCol2", debouncedState.footerCol2);
    p.set("footerCol3", debouncedState.footerCol3);
    p.set("font", debouncedState.brandFontFamily);
    p.set("tableStyle", debouncedState.brandTableStyle);
    p.set("density", debouncedState.brandDensity);
    p.set("_r", String(refreshKey));
    return `/app/settings/preview-pdf?${p.toString()}`;
  }, [debouncedState, refreshKey]);

  const isDirty = JSON.stringify(state) !== JSON.stringify(saved) || logoState !== "keep";

  function update<K extends keyof BriefpapierState>(key: K, value: BriefpapierState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      alert("Logo zu groß (max 500 KB)");
      e.target.value = "";
      return;
    }
    setLogoState("new");
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoState("clear");
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function save() {
    const file = fileInputRef.current?.files?.[0] ?? null;
    startSaving(async () => {
      const fd = new FormData();
      fd.set("letterheadTemplate", state.letterheadTemplate);
      fd.set("brandPrimary", state.brandPrimary);
      fd.set("brandAccent", state.brandAccent);
      fd.set("brandFooterText", state.brandFooterText);
      fd.set("footerCol1", state.footerCol1);
      fd.set("footerCol2", state.footerCol2);
      fd.set("footerCol3", state.footerCol3);
      fd.set("brandFontFamily", state.brandFontFamily);
      fd.set("brandTableStyle", state.brandTableStyle);
      fd.set("brandDensity", state.brandDensity);
      fd.set("logoState", logoState);
      if (file && logoState === "new") fd.set("letterheadLogo", file);
      await saveBriefpapierAction(fd);
      setSaved(state);
      setLogoState("keep");
      setSavedAt(new Date());
      // Force iframe reload so logo-upload sofort sichtbar wird
      setRefreshKey((r) => r + 1);
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-6 items-start">
      {/* ---------- LINKE SEITE: LIVE-PREVIEW ---------- */}
      <div className="bg-slate-100 rounded-xl border border-slate-200 sticky top-4">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Live-Vorschau</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">Musterrechnung mit deinen Werkstatt-Daten</span>
          </div>
          <a href={previewUrl} target="_blank" rel="noopener" className="text-xs text-orange-600 hover:underline">
            In neuem Tab öffnen ↗
          </a>
        </div>
        <div className="flex items-center justify-center p-4">
          <iframe
            src={previewUrl}
            className="w-full bg-white shadow-lg rounded"
            style={{ aspectRatio: "210/297", maxHeight: "calc(100vh - 200px)" }}
            title="Briefpapier Live-Vorschau"
          />
        </div>
      </div>

      {/* ---------- RECHTE SEITE: CONTROLS ---------- */}
      <div className="space-y-4">
        {/* Save-bar */}
        <div className="sticky top-4 z-10 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || saving}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              isDirty
                ? "bg-orange-600 text-white hover:bg-orange-700"
                : "bg-slate-100 text-slate-400 cursor-default"
            } disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Speichern…" : isDirty ? "Änderungen speichern" : "Alles gespeichert"}
          </button>
          {savedAt && !isDirty && (
            <p className="text-xs text-emerald-600 text-center mt-2 flex items-center justify-center gap-1">
              <Check className="w-3 h-3" />
              Gespeichert um {savedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Template-picker */}
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Template</h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <CatChip active={category === "all"} onClick={() => setCategory("all")}>
              Alle ({templates.length})
            </CatChip>
            {CATEGORIES.map((c) => {
              const count = templates.filter((t) => t.category === c).length;
              if (count === 0) return null;
              return (
                <CatChip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c} ({count})
                </CatChip>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto -mx-1 px-1">
            {filtered.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => update("letterheadTemplate", t.key)}
                className={`text-left rounded-lg overflow-hidden border transition ${
                  state.letterheadTemplate === t.key
                    ? "border-orange-500 ring-2 ring-orange-200"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <MiniPreview templateKey={t.key} primary={state.brandPrimary} />
                <div className="p-2">
                  <div className="text-xs font-semibold text-slate-900 truncate">{t.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Typografie & Layout */}
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Typografie &amp; Layout</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Schriftart</label>
              <select
                value={state.brandFontFamily}
                onChange={(e) => update("brandFontFamily", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tabellen-Stil</label>
              <div className="grid grid-cols-2 gap-2">
                {TABLE_STYLES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update("brandTableStyle", t.value)}
                    className={`p-2 text-left rounded-lg border transition ${
                      state.brandTableStyle === t.value
                        ? "border-orange-500 bg-orange-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900">{t.label}</div>
                    <div className="text-[10px] text-slate-500">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Dichte</label>
              <div className="grid grid-cols-3 gap-2">
                {DENSITIES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => update("brandDensity", d.value)}
                    className={`p-2 text-center rounded-lg border transition ${
                      state.brandDensity === d.value
                        ? "border-orange-500 bg-orange-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-900">{d.label}</div>
                    <div className="text-[10px] text-slate-500">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Farben */}
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Farben</h2>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Primärfarbe</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={state.brandPrimary}
                onChange={(e) => update("brandPrimary", e.target.value)}
                className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
              />
              <input
                type="text"
                value={state.brandPrimary}
                onChange={(e) => update("brandPrimary", e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update("brandPrimary", c)}
                  title={c}
                  className={`w-6 h-6 rounded border-2 ${
                    state.brandPrimary.toLowerCase() === c ? "border-slate-900" : "border-white shadow"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Akzentfarbe (optional)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={state.brandAccent || "#000000"}
                onChange={(e) => update("brandAccent", e.target.value)}
                className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
              />
              <input
                type="text"
                value={state.brandAccent}
                onChange={(e) => update("brandAccent", e.target.value)}
                placeholder="leer = wie Primär"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
        </section>

        {/* Logo */}
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Logo</h2>
          {logoPreview && logoState !== "clear" ? (
            <div className="mb-3 border border-slate-200 rounded p-3 bg-slate-50 flex items-center justify-between">
              <img src={logoPreview} alt="Logo" className="h-12 object-contain" />
              <button
                type="button"
                onClick={clearLogo}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3 h-3" />
                Entfernen
              </button>
            </div>
          ) : (
            <div className="mb-3 border border-slate-200 border-dashed rounded p-4 text-center text-xs text-slate-400">
              Kein Logo hinterlegt
            </div>
          )}
          <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-slate-300 border-dashed rounded-lg text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Upload className="w-4 h-4" />
            {logoState === "new" ? "Anderes Logo wählen" : "Neues Logo hochladen"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <p className="text-xs text-slate-400 mt-2">PNG/JPG, max. 500 KB. Erscheint erst nach Speichern in der Vorschau.</p>
        </section>

        {/* Fußzeile */}
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Fußzeile</h2>
          <p className="text-xs text-slate-500 mb-3">3 Spalten nebeneinander. Leer lassen → nutzt Freitext (unten).</p>
          <div className="space-y-2">
            <FooterCol label="Spalte 1 — Firma" name="footerCol1" value={state.footerCol1} onChange={(v) => update("footerCol1", v)} placeholder="Auto Meier GmbH&#10;Hauptstr. 12&#10;80331 München" />
            <FooterCol label="Spalte 2 — Kontakt" name="footerCol2" value={state.footerCol2} onChange={(v) => update("footerCol2", v)} placeholder="Tel: 089/12345&#10;info@auto-meier.de&#10;www.auto-meier.de" />
            <FooterCol label="Spalte 3 — Bank" name="footerCol3" value={state.footerCol3} onChange={(v) => update("footerCol3", v)} placeholder="Sparkasse München&#10;IBAN: DE00…&#10;USt-IdNr. DE123…" />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-500 mb-1">Freitext-Fußzeile (Fallback wenn Spalten leer)</label>
            <input
              value={state.brandFooterText}
              onChange={(e) => update("brandFooterText", e.target.value)}
              placeholder={`${workshopName} · USt-IdNr. DE…`}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function FooterCol({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <textarea
        name={name}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
      />
    </div>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition ${
        active ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function MiniPreview({ templateKey, primary }: { templateKey: string; primary: string }) {
  const p = primary || "#fe6503";
  const gray = "#e2e8f0";

  const body = (
    <>
      <rect x="14" y="130" width="90" height="3" rx="1" fill={gray} />
      <rect x="14" y="137" width="70" height="3" rx="1" fill={gray} />
      <rect x="14" y="150" width="180" height="3" rx="1" fill={gray} />
      <rect x="14" y="157" width="170" height="3" rx="1" fill={gray} />
      <rect x="14" y="164" width="160" height="3" rx="1" fill={gray} />
      <rect x="14" y="171" width="170" height="3" rx="1" fill={gray} />
    </>
  );

  switch (templateKey) {
    case "bold-band":
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <rect x="0" y="0" width="210" height="30" fill={p} />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {body}
        </svg>
      );
    case "bold-sidebar":
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <rect x="0" y="0" width="60" height="210" fill={p} />
          <rect x="70" y="120" width="80" height="4" rx="1" fill={p} />
        </svg>
      );
    case "farbig-frame":
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <rect x="4" y="4" width="202" height="202" fill="none" stroke={p} strokeWidth="1.5" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {body}
        </svg>
      );
    case "farbig-split":
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <rect x="0" y="0" width="210" height="35" fill={p} opacity="0.15" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {body}
        </svg>
      );
    case "farbig-corners":
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <rect x="0" y="0" width="100" height="30" fill={p} />
          <rect x="110" y="203" width="100" height="7" fill={p} />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {body}
        </svg>
      );
    case "classic-lines":
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <line x1="6" y1="8" x2="204" y2="8" stroke={p} strokeWidth="2" />
          <line x1="6" y1="12" x2="204" y2="12" stroke={p} strokeWidth="0.4" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {body}
        </svg>
      );
    case "bold-centered":
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <rect x="85" y="10" width="40" height="15" rx="1" fill={gray} />
          <line x1="60" y1="55" x2="150" y2="55" stroke={p} strokeWidth="1.2" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {body}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 210 210" className="w-full aspect-square bg-white">
          <rect x="14" y="14" width="40" height="18" rx="1" fill={gray} />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {body}
        </svg>
      );
  }
}
