"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { importContacts } from "../actions";

type ParsedRow = Record<string, string>;

const FIELD_OPTIONS = [
  { value: "", label: "— Nicht importieren —" },
  { value: "firstName", label: "Vorname" },
  { value: "lastName", label: "Nachname" },
  { value: "email", label: "Email" },
  { value: "company", label: "Firma" },
  { value: "position", label: "Position" },
  { value: "phone", label: "Telefon" },
  { value: "city", label: "Stadt" },
];

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });

      if (json.length === 0) {
        setError("Die Datei enthält keine Daten");
        return;
      }

      const cols = Object.keys(json[0]);
      setHeaders(cols);
      setRows(json);

      // Auto-map by common names
      const autoMap: Record<string, string> = {};
      for (const col of cols) {
        const lower = col.toLowerCase();
        if (lower.includes("vorname") || lower === "first_name" || lower === "firstname") autoMap[col] = "firstName";
        else if (lower.includes("nachname") || lower === "last_name" || lower === "lastname" || lower === "name") autoMap[col] = "lastName";
        else if (lower.includes("email") || lower.includes("mail")) autoMap[col] = "email";
        else if (lower.includes("firma") || lower.includes("company") || lower.includes("unternehmen")) autoMap[col] = "company";
        else if (lower.includes("position") || lower.includes("titel") || lower.includes("role")) autoMap[col] = "position";
        else if (lower.includes("telefon") || lower.includes("phone") || lower.includes("tel")) autoMap[col] = "phone";
        else if (lower.includes("stadt") || lower.includes("city") || lower.includes("ort")) autoMap[col] = "city";
      }
      setMapping(autoMap);
    } catch {
      setError("Fehler beim Lesen der Datei. Bitte eine gültige Excel/CSV Datei hochladen.");
    }
  }, []);

  const handleImport = async () => {
    if (!mapping.firstName || !mapping.lastName || !mapping.email) {
      setError("Vorname, Nachname und Email müssen zugeordnet werden");
      return;
    }

    setLoading(true);
    setError(null);

    // Reverse mapping: field -> column
    const reverseMap: Record<string, string> = {};
    for (const [col, field] of Object.entries(mapping)) {
      if (field) reverseMap[field] = col;
    }

    const contacts = rows.map((row) => ({
      firstName: String(row[reverseMap.firstName] || "").trim(),
      lastName: String(row[reverseMap.lastName] || "").trim(),
      email: String(row[reverseMap.email] || "").trim(),
      company: reverseMap.company ? String(row[reverseMap.company] || "").trim() : undefined,
      position: reverseMap.position ? String(row[reverseMap.position] || "").trim() : undefined,
      phone: reverseMap.phone ? String(row[reverseMap.phone] || "").trim() : undefined,
      city: reverseMap.city ? String(row[reverseMap.city] || "").trim() : undefined,
    })).filter((c) => c.firstName && c.lastName && c.email);

    try {
      const res = await importContacts(contacts);
      setResult(res);
    } catch {
      setError("Fehler beim Import");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contacts" className="p-2 hover:bg-bg-secondary rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-light" />
        </Link>
        <h2 className="text-lg font-bold text-text">Kontakte importieren</h2>
      </div>

      {/* Upload Area */}
      {rows.length === 0 && (
        <label className="block bg-bg-card rounded-xl border-2 border-dashed border-border hover:border-accent/50 p-12 text-center cursor-pointer transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <FileSpreadsheet className="w-12 h-12 text-text-light/40 mx-auto mb-3" />
          <p className="font-medium text-text">Excel oder CSV Datei hochladen</p>
          <p className="text-sm text-text-light mt-1">.xlsx, .xls oder .csv</p>
        </label>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-danger">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-success">
          <Check className="w-4 h-4 shrink-0" />
          {result.imported} Kontakte importiert, {result.skipped} übersprungen (Duplikate)
        </div>
      )}

      {/* Column Mapping */}
      {rows.length > 0 && !result && (
        <>
          <div className="bg-bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-text mb-4">
              Spalten zuordnen ({rows.length} Zeilen gefunden)
            </h3>
            <div className="space-y-3">
              {headers.map((header) => (
                <div key={header} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-text w-48 truncate">{header}</span>
                  <span className="text-text-light">→</span>
                  <select
                    value={mapping[header] || ""}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-text mb-4">Vorschau (erste 5 Zeilen)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {headers.map((h) => (
                      <th key={h} className="text-left p-2 text-text-light font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {headers.map((h) => (
                        <td key={h} className="p-2 text-text truncate max-w-[200px]">{String(row[h])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {loading ? "Importiere..." : `${rows.length} Kontakte importieren`}
          </button>
        </>
      )}
    </div>
  );
}
