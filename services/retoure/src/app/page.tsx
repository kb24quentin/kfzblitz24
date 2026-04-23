"use client";

import { useState } from "react";
import { Search, AlertCircle, CheckCircle2, Package, User, MapPin, Mail, Phone } from "lucide-react";

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

type Adresse = {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  email?: string;
  telefon?: string;
  handy?: string;
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
  mitarbeiter?: string;
  rechnungsadresse?: Adresse;
  lieferadresse?: Adresse;
  positionen: Position[];
};

// Positions with these statuses are internal and shouldn't be shown to
// the customer (drop-shipments, text-only lines, etc).
const HIDDEN_POSITION_STATUSES = new Set(["geliefertstreckengeschaeft"]);
const HIDDEN_POSITION_TYPES = new Set(["text"]);

function humanStatus(s?: string): string {
  if (!s) return "";
  const map: Record<string, string> = {
    geliefert: "Geliefert",
    bestellt: "Bestellt",
    reserviert: "Reserviert",
    rueckstand: "Rückstand",
    angefragt: "Angefragt",
    storniert: "Storniert",
    geloescht: "Gelöscht",
    neinverkauf: "Nein-Verkauf",
  };
  return map[s] ?? s;
}

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

              {result.belege.map((beleg) => {
                const visiblePositions = beleg.positionen.filter(
                  (p) =>
                    !HIDDEN_POSITION_TYPES.has(p.typ) &&
                    !(p.status && HIDDEN_POSITION_STATUSES.has(p.status))
                );
                const addr = beleg.rechnungsadresse;
                const fullName =
                  addr?.vorname || addr?.name
                    ? [addr.vorname, addr.name].filter(Boolean).join(" ")
                    : beleg.bestellername;

                return (
                  <div
                    key={beleg.id}
                    className="bg-bg-card rounded-xl border border-border overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-5 border-b border-border bg-bg-secondary/50">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-bold text-text">
                              {beleg.bestellnummer ?? beleg.belegnummer ?? `#${beleg.id}`}
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                              {beleg.typ}
                            </span>
                            {beleg.status && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                                {humanStatus(beleg.status)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-light mt-1">
                            {beleg.belegnummer && `${beleg.belegnummer}`}
                            {beleg.belegdatum && ` · ${beleg.belegdatum}`}
                            {beleg.mitarbeiter && ` · Bearbeiter: ${beleg.mitarbeiter}`}
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

                    {/* Kunden-Info */}
                    {addr && (fullName || addr.email || addr.strasse) && (
                      <div className="p-4 border-b border-border bg-white">
                        <p className="text-xs font-medium text-text-light mb-2 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Kundendaten
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          {fullName && (
                            <div>
                              {addr.anrede && (
                                <span className="text-text-light">{addr.anrede} </span>
                              )}
                              <span className="font-medium">{fullName}</span>
                            </div>
                          )}
                          {(addr.strasse || addr.plz || addr.ort) && (
                            <div className="flex items-start gap-1.5 text-text">
                              <MapPin className="w-3.5 h-3.5 text-text-light mt-0.5 shrink-0" />
                              <span>
                                {addr.strasse && <>{addr.strasse}<br /></>}
                                {[addr.plz, addr.ort].filter(Boolean).join(" ")}
                              </span>
                            </div>
                          )}
                          {addr.email && (
                            <div className="flex items-center gap-1.5 text-text">
                              <Mail className="w-3.5 h-3.5 text-text-light" />
                              <a href={`mailto:${addr.email}`} className="text-accent hover:underline">
                                {addr.email}
                              </a>
                            </div>
                          )}
                          {(addr.telefon || addr.handy) && (
                            <div className="flex items-center gap-1.5 text-text">
                              <Phone className="w-3.5 h-3.5 text-text-light" />
                              <span>{addr.telefon || addr.handy}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Positionen */}
                    <div className="divide-y divide-border">
                      {visiblePositions.length === 0 ? (
                        <div className="p-5 text-sm text-text-light text-center">
                          Keine retourfähigen Positionen in diesem Beleg.
                        </div>
                      ) : (
                        visiblePositions.map((pos) => (
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
                                    {humanStatus(pos.status)}
                                  </span>
                                )}
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
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
