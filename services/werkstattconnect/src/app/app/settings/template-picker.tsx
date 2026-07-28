"use client";

import { useMemo, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { TemplateDef } from "@/lib/pdf/types";

const CATEGORIES = ["Modern", "Klassisch", "Minimal", "Bold", "Farbig"] as const;

export function TemplatePicker({
  templates,
  currentTemplate,
  primary,
}: {
  templates: TemplateDef[];
  currentTemplate: string;
  primary: string;
}) {
  const [selected, setSelected] = useState(currentTemplate);
  const [previewPrimary, setPreviewPrimary] = useState(primary);
  const [category, setCategory] = useState<string>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const filtered = category === "all" ? templates : templates.filter((t) => t.category === category);

  const previewUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("template", selected);
    p.set("primary", previewPrimary);
    p.set("_r", String(refreshKey));
    return `/app/settings/preview-pdf?${p.toString()}`;
  }, [selected, previewPrimary, refreshKey]);

  return (
    <>
      <input type="hidden" name="letterheadTemplate" value={selected} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
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

          <div className="grid grid-cols-2 gap-2 max-h-[700px] overflow-y-auto pr-1">
            {filtered.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelected(t.key)}
                className={`text-left rounded-lg overflow-hidden border transition ${
                  selected === t.key ? "border-orange-500 ring-2 ring-orange-200 bg-orange-50/30" : "border-slate-300 hover:border-slate-400 bg-white"
                }`}
              >
                <MiniPreview templateKey={t.key} primary={previewPrimary} />
                <div className="p-2">
                  <div className="text-xs font-semibold text-slate-900 truncate">{t.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Live-Vorschau (mit Musterdaten)
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Vorschau nutzt aktuelle Werkstatt-Daten, Bank + Logo. Farbe/Fußzeile ändern → „Aktualisieren".
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRefreshKey((r) => r + 1)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
              >
                <RefreshCw className="w-3 h-3" />
                Aktualisieren
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
              >
                <ExternalLink className="w-3 h-3" />
                Groß öffnen
              </a>
            </div>
          </div>
          <div className="bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
            <iframe
              src={previewUrl}
              className="w-full block bg-white"
              style={{ height: "800px" }}
              title="Briefpapier-Vorschau"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Hinweis: Änderungen an <strong>Farbe/Fußzeile</strong> werden erst nach dem Speichern des Formulars in die Vorschau übernommen (dann „Aktualisieren" drücken).
          </p>
        </div>
      </div>
    </>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
        active ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/** Kleine SVG-schematik für kachel-übersicht (nur groove-check). */
function MiniPreview({ templateKey, primary }: { templateKey: string; primary: string }) {
  const p = primary || "#fe6503";
  const gray = "#e2e8f0";

  switch (templateKey) {
    case "bold-band":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="210" height="30" fill={p} />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray)}
        </svg>
      );
    case "bold-sidebar":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="60" height="297" fill={p} />
          <rect x="70" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray, 70, 130)}
        </svg>
      );
    case "farbig-frame":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="4" y="4" width="202" height="289" fill="none" stroke={p} strokeWidth="1.5" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray)}
        </svg>
      );
    case "farbig-split":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="210" height="35" fill={p} opacity="0.15" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray)}
        </svg>
      );
    case "farbig-corners":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="100" height="30" fill={p} />
          <rect x="110" y="290" width="100" height="7" fill={p} />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray)}
        </svg>
      );
    case "classic-lines":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <line x1="6" y1="8" x2="204" y2="8" stroke={p} strokeWidth="2" />
          <line x1="6" y1="12" x2="204" y2="12" stroke={p} strokeWidth="0.4" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray)}
        </svg>
      );
    case "bold-centered":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="85" y="10" width="40" height="15" rx="1" fill={gray} />
          <line x1="60" y1="55" x2="150" y2="55" stroke={p} strokeWidth="1.2" />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray)}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="14" y="14" width="40" height="18" rx="1" fill={gray} />
          <rect x="14" y="120" width="80" height="4" rx="1" fill={p} />
          {commonRows(gray)}
        </svg>
      );
  }
}

function commonRows(gray: string, x = 14, y = 130) {
  return (
    <>
      <rect x={x} y={y + 10} width="90" height="3" rx="1" fill={gray} />
      <rect x={x} y={y + 16} width="70" height="3" rx="1" fill={gray} />
      <rect x={x} y={y + 25} width="180 - x" height="3" rx="1" fill={gray} />
      <rect x={x} y={y + 32} width="170" height="3" rx="1" fill={gray} />
      <rect x={x} y={y + 39} width="160" height="3" rx="1" fill={gray} />
      <rect x={x} y={y + 46} width="170" height="3" rx="1" fill={gray} />
      <rect x={x} y={y + 53} width="130" height="3" rx="1" fill={gray} />
      <rect x={x} y={y + 60} width="170" height="3" rx="1" fill={gray} />
    </>
  );
}
