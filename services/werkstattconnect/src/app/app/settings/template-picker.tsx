"use client";

import { useState } from "react";
import type { TemplateDef } from "@/lib/pdf/types";

const CATEGORIES = ["Modern", "Klassisch", "Minimal", "Bold", "Farbig"] as const;

export function TemplatePicker({
  templates,
  currentTemplate,
  primary,
  logoDataUrl,
  workshopName,
}: {
  templates: TemplateDef[];
  currentTemplate: string;
  primary: string;
  logoDataUrl: string | null;
  workshopName: string;
}) {
  const [selected, setSelected] = useState(currentTemplate);
  const [category, setCategory] = useState<string>("all");

  const filtered = category === "all" ? templates : templates.filter((t) => t.category === category);

  return (
    <>
      <input type="hidden" name="letterheadTemplate" value={selected} />
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`px-3 py-1 rounded-lg text-xs font-medium border ${
            category === "all" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Alle ({templates.length})
        </button>
        {CATEGORIES.map((c) => {
          const count = templates.filter((t) => t.category === c).length;
          if (count === 0) return null;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                category === c ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSelected(t.key)}
            className={`text-left rounded-lg overflow-hidden border transition ${
              selected === t.key ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-300 hover:border-slate-400"
            }`}
          >
            <TemplatePreview templateKey={t.key} primary={primary} logoDataUrl={logoDataUrl} workshopName={workshopName} />
            <div className="p-2 bg-white">
              <div className="text-xs font-semibold text-slate-900 truncate">{t.label}</div>
              <div className="text-[10px] text-slate-500 truncate">{t.description}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Mini SVG-preview je template — zeigt schematisch das layout.
 * Aspect ratio 210:297 (A4).
 */
function TemplatePreview({
  templateKey,
  primary,
  logoDataUrl,
  workshopName,
}: {
  templateKey: string;
  primary: string;
  logoDataUrl: string | null;
  workshopName: string;
}) {
  const p = primary || "#fe6503";
  const gray = "#e2e8f0";
  const dark = "#0f172a";

  const commonBody = (
    <>
      <rect x="14" y="130" width="120" height="4" rx="1" fill={gray} />
      <rect x="14" y="140" width="80" height="3" rx="1" fill={gray} />
      <rect x="14" y="146" width="90" height="3" rx="1" fill={gray} />
      <rect x="14" y="155" width="180" height="3" rx="1" fill={gray} />
      <rect x="14" y="162" width="180" height="3" rx="1" fill={gray} />
      <rect x="14" y="169" width="160" height="3" rx="1" fill={gray} />
      <rect x="14" y="176" width="180" height="3" rx="1" fill={gray} />
      <rect x="14" y="183" width="140" height="3" rx="1" fill={gray} />
      <rect x="14" y="230" width="120" height="3" rx="1" fill={gray} />
      <rect x="150" y="230" width="46" height="3" rx="1" fill={dark} />
    </>
  );

  const logoBox = logoDataUrl ? (
    <image href={logoDataUrl} x="14" y="14" height="18" preserveAspectRatio="xMinYMid meet" />
  ) : (
    <rect x="14" y="14" width="40" height="18" rx="1" fill={gray} />
  );

  const wsName = (
    <text x="196" y="20" fontSize="6" fill={dark} textAnchor="end" fontWeight="bold">
      {workshopName.slice(0, 22)}
    </text>
  );

  switch (templateKey) {
    case "modern-orange":
    case "modern-blue":
    case "modern-black":
    case "modern-green":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoBox}
          {wsName}
          <text x="196" y="28" fontSize="4" fill="#666" textAnchor="end">strasse · plz ort</text>
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "classic-serif":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoBox}
          {wsName}
          <text x="14" y="120" fontSize="10" fontWeight="bold" fill="#000">Rechnung RE-26-0042</text>
          <line x1="14" y1="123" x2="196" y2="123" stroke={p} strokeWidth="1" />
          {commonBody}
        </svg>
      );
    case "classic-lines":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <line x1="6" y1="8" x2="204" y2="8" stroke={p} strokeWidth="2" />
          <line x1="6" y1="12" x2="204" y2="12" stroke={p} strokeWidth="0.4" />
          {logoBox}
          <text x="105" y="35" fontSize="6" fill={dark} textAnchor="middle" fontWeight="bold">{workshopName.slice(0, 30)}</text>
          <line x1="14" y1="50" x2="196" y2="50" stroke={gray} strokeWidth="0.3" />
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "minimal-thin":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoBox}
          {wsName}
          <line x1="14" y1="50" x2="196" y2="50" stroke={gray} strokeWidth="0.3" />
          <text x="14" y="115" fontSize="11" fill={p}>RECHNUNG</text>
          <text x="14" y="128" fontSize="6" fill="#999">RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "minimal-mono":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoBox}
          <text x="196" y="20" fontSize="5" fill={dark} textAnchor="end" fontFamily="monospace" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <text x="14" y="120" fontSize="7" fontWeight="bold" fill={p} fontFamily="monospace">RECHNUNG // RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "bold-band":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="210" height="30" fill={p} />
          <text x="14" y="15" fontSize="8" fill="#fff" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <text x="14" y="24" fontSize="4" fill="#fff" opacity="0.8">strasse · kontakt</text>
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "bold-sidebar":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="60" height="297" fill={p} />
          {logoDataUrl ? (
            <image href={logoDataUrl} x="6" y="10" height="18" width="45" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <rect x="6" y="10" width="45" height="18" rx="1" fill="#fff" opacity="0.3" />
          )}
          <text x="6" y="42" fontSize="5" fill="#fff" fontWeight="bold">{workshopName.slice(0, 12)}</text>
          <text x="6" y="52" fontSize="3.5" fill="#fff" opacity="0.85">strasse</text>
          <text x="6" y="58" fontSize="3.5" fill="#fff" opacity="0.85">plz ort</text>
          <text x="70" y="120" fontSize="9" fontWeight="bold" fill={p}>RE-26-0042</text>
          <rect x="70" y="130" width="120" height="3" rx="1" fill={gray} />
          <rect x="70" y="140" width="100" height="3" rx="1" fill={gray} />
          <rect x="70" y="150" width="120" height="3" rx="1" fill={gray} />
          <rect x="70" y="160" width="120" height="3" rx="1" fill={gray} />
        </svg>
      );
    case "bold-centered":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoDataUrl ? (
            <image href={logoDataUrl} x="85" y="10" height="20" width="40" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <rect x="85" y="10" width="40" height="20" rx="1" fill={gray} />
          )}
          <text x="105" y="45" fontSize="7" fill={dark} textAnchor="middle" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <line x1="60" y1="55" x2="150" y2="55" stroke={p} strokeWidth="1.2" />
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "farbig-corners":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="100" height="30" fill={p} />
          <rect x="110" y="290" width="100" height="7" fill={p} />
          {logoBox}
          <text x="196" y="20" fontSize="5" fill={dark} textAnchor="end" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "farbig-gradient":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <defs>
            <linearGradient id={`grad-${templateKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p} stopOpacity="1" />
              <stop offset="100%" stopColor={p} stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="210" height="30" fill={`url(#grad-${templateKey})`} />
          {logoBox}
          <text x="196" y="20" fontSize="5" fill="#fff" textAnchor="end" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "farbig-frame":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="4" y="4" width="202" height="289" fill="none" stroke={p} strokeWidth="1.5" />
          {logoBox}
          {wsName}
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "farbig-split":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="0" y="0" width="210" height="35" fill={p} opacity="0.15" />
          {logoBox}
          <text x="196" y="20" fontSize="6" fill={p} textAnchor="end" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "workshop-tools":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoBox}
          <text x="196" y="20" fontSize="5" fill={dark} textAnchor="end" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <rect x="195" y="30" width="3" height="20" fill={p} />
          <circle cx="196.5" cy="53" r="4" fill={p} />
          <text x="14" y="120" fontSize="9" fontWeight="bold" fill={p}>Rechnung RE-26-0042</text>
          {commonBody}
        </svg>
      );
    case "compact-dense":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoBox}
          <text x="196" y="20" fontSize="4" fill={dark} textAnchor="end" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <text x="14" y="95" fontSize="7" fontWeight="bold" fill={p}>RE-26-0042</text>
          <rect x="14" y="105" width="180" height="2" rx="1" fill={gray} />
          <rect x="14" y="112" width="180" height="2" rx="1" fill={gray} />
          <rect x="14" y="119" width="180" height="2" rx="1" fill={gray} />
          <rect x="14" y="126" width="180" height="2" rx="1" fill={gray} />
          <rect x="14" y="133" width="180" height="2" rx="1" fill={gray} />
          <rect x="14" y="140" width="180" height="2" rx="1" fill={gray} />
          <rect x="14" y="147" width="180" height="2" rx="1" fill={gray} />
        </svg>
      );
    case "elegant-margins":
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          <rect x="24" y="14" width="30" height="12" rx="1" fill={gray} />
          <text x="186" y="20" fontSize="5" fill={dark} textAnchor="end" fontWeight="bold">{workshopName.slice(0, 22)}</text>
          <text x="24" y="120" fontSize="9" fontWeight="bold" fill={p}>RECHNUNG</text>
          <text x="24" y="130" fontSize="5" fill="#999">RE-26-0042</text>
          <rect x="24" y="140" width="130" height="3" rx="1" fill={gray} />
          <rect x="24" y="147" width="130" height="3" rx="1" fill={gray} />
          <rect x="24" y="154" width="130" height="3" rx="1" fill={gray} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 210 297" className="w-full aspect-[210/297] bg-white">
          {logoBox}
          {wsName}
          {commonBody}
        </svg>
      );
  }
}
