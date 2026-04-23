"use client";

import { useState } from "react";
import { Search, AlertCircle, CheckCircle2, Package } from "lucide-react";

type Position = {
  id: number;
  typ: string;
  artikelnummer?: string;
  hersteller?: string;
  herstellernummer?: string;
  beschreibung?: string;
  menge?: number;
  einzelpreis_brutto?: number;
  positionspreis_brutto?: number;
  status?: string;
  lieferdatum?: string;
  offene_gutschriftsmenge?: number;
};

type Beleg = {
  typ: string;
  id: number;
  belegnummer?: string;
  belegdatum?: string;
  status?: string;
  bestellnummer?: string;
  bestellername?: string;
  endpreis_brutto?: number;
  positionen: Position[];
};

type LookupResponse =
  | { ok: true; mode: "live" | "demo"; belege: Beleg[]; hint?: string }
  | { ok: false; mode?: string; error: string };

export default function Home() {
  const [bestellnummer, setBestellnummer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!bestellnummer.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestellnummer: bestellnummer.trim() }),
      });
      const json = (await res.json()) as LookupResponse;
      setResult(json);
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text mb-2">Retouren-Portal</h1>
        <p className="text-sm text-text-light">
          Gib deine Bestellnummer ein um alle Artikel anzusehen und Retouren zu starten.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-bg-card rounded-xl border border-border p-6 shadow-sm space-y-3"
      >
        <div>
          <label className="block text-sm font-medium text-text mb-1">Bestellnummer</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={bestellnummer}
              onChange={(e) => setBestellnummer(e.target.value)}
              placeholder="z. B. KB24-73627372300 oder A243775523"
              className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="submit"
              disabled={loading || !bestellnummer.trim()}
              className="bg-accent text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {loading ? "Suche..." : "Suchen"}
            </button>
          </div>
          <p className="text-xs text-text-light mt-1.5">
            Du findest die Bestellnummer in deiner Bestellbestätigung (beginnt mit KB24-).
          </p>
        </div>
      </form>

      {result && (
        <div className="space-y-4">
          {!result.ok ? (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Fehler</p>
                <p className="text-sm">{result.error}</p>
              </div>
            </div>
          ) : result.belege.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Kein Beleg gefunden</p>
                <p className="text-sm">
                  Keine Bestellung zu &ldquo;{bestellnummer}&rdquo; gefunden. Prüfe die Nummer oder den Beleg-Typ.
                </p>
              </div>
            </div>
          ) : (
            <>
              {result.mode === "demo" && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    <strong>Demo-Modus:</strong>{" "}
                    {result.hint ?? "Mock-Daten, keine Verbindung zu Webisco."}
                  </span>
                </div>
              )}

              {result.belege.map((beleg) => (
                <div
                  key={beleg.id}
                  className="bg-bg-card rounded-xl border border-border overflow-hidden"
                >
                  <div className="p-5 border-b border-border bg-bg-secondary/50">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-text">
                            {beleg.belegnummer ?? `#${beleg.id}`}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                            {beleg.typ}
                          </span>
                          {beleg.status && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                              {beleg.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-light mt-1">
                          {beleg.belegdatum && `vom ${beleg.belegdatum}`}
                          {beleg.bestellername && ` · ${beleg.bestellername}`}
                        </p>
                      </div>
                      {beleg.endpreis_brutto !== undefined && (
                        <div className="text-right">
                          <p className="text-xs text-text-light">Gesamt (brutto)</p>
                          <p className="font-bold text-text">
                            {beleg.endpreis_brutto.toFixed(2)} €
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {beleg.positionen.length === 0 ? (
                      <div className="p-5 text-sm text-text-light text-center">
                        Keine Positionen im Beleg.
                      </div>
                    ) : (
                      beleg.positionen.map((pos) => (
                        <div key={pos.id} className="p-4 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text">
                              {pos.beschreibung ?? "(ohne Beschreibung)"}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-text-light">
                              {pos.artikelnummer && (
                                <span className="font-mono">{pos.artikelnummer}</span>
                              )}
                              {pos.hersteller && <span>· {pos.hersteller}</span>}
                              {pos.status && (
                                <span className="px-1.5 rounded bg-bg-secondary text-text-light">
                                  {pos.status}
                                </span>
                              )}
                              {pos.lieferdatum && <span>· Lieferdatum: {pos.lieferdatum}</span>}
                              {pos.offene_gutschriftsmenge !== undefined &&
                                pos.offene_gutschriftsmenge > 0 && (
                                  <span className="text-success font-medium">
                                    · retourfähig: {pos.offene_gutschriftsmenge}
                                  </span>
                                )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-text">
                              {pos.menge ?? 1} ×
                            </p>
                            {pos.positionspreis_brutto !== undefined && (
                              <p className="text-xs text-text-light">
                                {pos.positionspreis_brutto.toFixed(2)} €
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
