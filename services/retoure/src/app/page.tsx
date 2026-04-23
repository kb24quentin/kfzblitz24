"use client";

import { useMemo, useState } from "react";
import {
  Search,
  AlertCircle,
  Package,
  User,
  MapPin,
  Mail,
  Phone,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Truck,
  Shield,
  Download,
  CheckCircle2,
  FileText,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────
// Types (mirror of src/lib/webisco.ts for the client)
// ────────────────────────────────────────────────────────────────────────
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

type ShippingMode = "standard" | "sicher" | "unknown";

type Selection = {
  menge: number;
  grund: string;
};

const RETOURE_GRUENDE = [
  "Falscher Artikel bestellt",
  "Artikel falsch geliefert",
  "Artikel defekt / beschädigt",
  "Nicht wie beschrieben",
  "Qualität ungenügend",
  "Zu spät geliefert",
  "Artikel passt nicht",
  "Sonstiges",
];

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────
function detectShippingMode(beleg: Beleg): ShippingMode {
  const zustellungen = beleg.positionen.filter((p) => p.typ === "zustellung");
  if (zustellungen.length === 0) return "unknown";
  const sicher = zustellungen.some((z) => {
    const s = (z.beschreibung ?? "").toLowerCase();
    return s.includes("sichere rückgabe") || s.includes("sichere rueckgabe") || s.includes("gratis rücksendung");
  });
  return sicher ? "sicher" : "standard";
}

function maxMenge(p: Position): number {
  if (p.offene_gutschriftsmenge !== undefined && p.offene_gutschriftsmenge > 0) {
    return p.offene_gutschriftsmenge;
  }
  const m = Math.abs(p.menge ?? 0);
  return m > 0 ? m : 0;
}

/**
 * All article positions on the beleg (including drop-shipments, already-
 * retourned etc.). The UI marks each entry with its own disabled reason.
 */
function allArticles(beleg: Beleg): Position[] {
  return beleg.positionen.filter((p) => p.typ === "artikel");
}

type DisabledReason = null | "bereits_retourniert" | "storniert";

function disabledReason(p: Position): DisabledReason {
  if (p.status === "storniert" || p.status === "geloescht") return "storniert";
  if (maxMenge(p) <= 0) return "bereits_retourniert";
  return null;
}

const DISABLED_REASON_TEXT: Record<Exclude<DisabledReason, null>, string> = {
  bereits_retourniert: "bereits retourniert",
  storniert: "storniert",
};

// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────
type Step = "search" | "select" | "review" | "done";

export default function Home() {
  const [step, setStep] = useState<Step>("search");
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [selections, setSelections] = useState<Record<number, Selection>>({});
  const [requestDHLLabel, setRequestDHLLabel] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const shippingMode = beleg ? detectShippingMode(beleg) : "unknown";
  const articles = beleg ? allArticles(beleg) : [];

  const reset = () => {
    setStep("search");
    setBeleg(null);
    setSelections({});
    setRequestDHLLabel(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Retouren-Portal</h1>
          <p className="text-sm text-text-light">
            Registriere deine Rücksendung in wenigen Schritten.
          </p>
        </div>
        {step !== "search" && (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-text-light hover:text-text"
          >
            Von vorn beginnen
          </button>
        )}
      </div>

      <Stepper step={step} />

      {step === "search" && (
        <SearchStep
          onFound={(b) => {
            setBeleg(b);
            setStep("select");
          }}
        />
      )}

      {step === "select" && beleg && (
        <SelectStep
          beleg={beleg}
          articles={articles}
          selections={selections}
          setSelections={setSelections}
          onBack={() => setStep("search")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && beleg && (
        <ReviewStep
          beleg={beleg}
          articles={articles}
          selections={selections}
          shippingMode={shippingMode}
          requestDHLLabel={requestDHLLabel}
          setRequestDHLLabel={setRequestDHLLabel}
          onBack={() => setStep("select")}
          onDone={(url) => {
            setPdfUrl(url);
            setStep("done");
          }}
        />
      )}

      {step === "done" && pdfUrl && (
        <DoneStep pdfUrl={pdfUrl} onReset={reset} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stepper indicator
// ────────────────────────────────────────────────────────────────────────
function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "search", label: "Bestellung finden" },
    { key: "select", label: "Artikel wählen" },
    { key: "review", label: "Prüfen & Absenden" },
    { key: "done", label: "Fertig" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-1 text-xs">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="flex items-center gap-1">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                done ? "bg-success text-white"
                : active ? "bg-accent text-white"
                : "bg-bg-secondary text-text-light"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`${
                active ? "text-text font-medium" : "text-text-light"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-text-light/60 mx-1" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 1: Search
// ────────────────────────────────────────────────────────────────────────
function SearchStep({ onFound }: { onFound: (b: Beleg) => void }) {
  const [bestellnummer, setBestellnummer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!bestellnummer.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestellnummer: bestellnummer.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Unbekannter Fehler");
        return;
      }
      const belege = (json.belege ?? []) as Beleg[];
      if (belege.length === 0) {
        setError("Keine Bestellung zu dieser Nummer gefunden.");
        return;
      }
      // Pick the beleg with the most article positions so the customer
      // sees something even if everything's a drop-shipment.
      const best =
        [...belege].sort(
          (a, b) => allArticles(b).length - allArticles(a).length
        )[0] ?? belege[0];
      onFound(best);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
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
            {loading ? "Suche..." : "Weiter"}
          </button>
        </div>
        <p className="text-xs text-text-light mt-1.5">
          Du findest die Bestellnummer in deiner Bestellbestätigung (beginnt mit KB24-).
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 2: Article selection
// ────────────────────────────────────────────────────────────────────────
function SelectStep({
  beleg,
  articles,
  selections,
  setSelections,
  onBack,
  onNext,
}: {
  beleg: Beleg;
  articles: Position[];
  selections: Record<number, Selection>;
  setSelections: (s: Record<number, Selection>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const toggle = (p: Position) => {
    if (disabledReason(p) !== null) return; // not selectable
    const next = { ...selections };
    if (next[p.id]) {
      delete next[p.id];
    } else {
      next[p.id] = { menge: maxMenge(p), grund: RETOURE_GRUENDE[0] };
    }
    setSelections(next);
  };

  const updateMenge = (p: Position, menge: number) => {
    setSelections({
      ...selections,
      [p.id]: { ...selections[p.id], menge: Math.max(1, Math.min(maxMenge(p), menge)) },
    });
  };

  const updateGrund = (p: Position, grund: string) => {
    setSelections({
      ...selections,
      [p.id]: { ...selections[p.id], grund },
    });
  };

  const selectedCount = Object.keys(selections).length;

  return (
    <div className="space-y-6">
      <BelegCard beleg={beleg} />

      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-bg-secondary/50">
          <h3 className="font-semibold text-text">Welche Artikel möchtest du zurücksenden?</h3>
          <p className="text-xs text-text-light mt-0.5">
            Wähle die Artikel aus und gib Menge + Grund an. Nicht-retourfähige Positionen werden ausgeblendet.
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-light">
            Diese Bestellung enthält keine Artikel-Positionen.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {articles.map((p) => {
              const sel = selections[p.id];
              const max = maxMenge(p);
              const reason = disabledReason(p);
              const disabled = reason !== null;
              return (
                <label
                  key={p.id}
                  className={`block p-4 transition-colors ${
                    disabled
                      ? "opacity-60 cursor-not-allowed bg-bg-secondary/30"
                      : sel
                      ? "bg-accent/5 cursor-pointer"
                      : "cursor-pointer hover:bg-bg-secondary/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!sel}
                      disabled={disabled}
                      onChange={() => toggle(p)}
                      className="mt-1 rounded border-border"
                    />
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">
                        {p.beschreibung ?? "(ohne Beschreibung)"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-text-light">
                        {p.artikelnummer && <span className="font-mono">{p.artikelnummer}</span>}
                        {p.hersteller && <span>· {p.hersteller}</span>}
                        {reason ? (
                          <span className="text-text-light italic">· {DISABLED_REASON_TEXT[reason]}</span>
                        ) : (
                          <span>· max {max} Stk</span>
                        )}
                        {p.einzelpreis_brutto !== undefined && (
                          <span className="font-medium text-text">
                            · {Math.abs(p.einzelpreis_brutto).toFixed(2).replace(".", ",")} € / Stk
                          </span>
                        )}
                      </div>

                      {sel && (
                        <div
                          className="mt-3 grid grid-cols-1 md:grid-cols-[110px,1fr] gap-3"
                          onClick={(e) => e.preventDefault()}
                        >
                          <div>
                            <label className="block text-xs font-medium text-text-light mb-1">
                              Menge
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={max}
                              value={sel.menge}
                              onChange={(e) => updateMenge(p, parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-light mb-1">
                              Grund
                            </label>
                            <select
                              value={sel.grund}
                              onChange={(e) => updateGrund(p, e.target.value)}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-accent/50"
                            >
                              {RETOURE_GRUENDE.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-bg-card border border-border text-text rounded-lg text-sm font-medium hover:bg-bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50"
        >
          Weiter ({selectedCount} ausgewählt)
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 3: Review + submit
// ────────────────────────────────────────────────────────────────────────
function ReviewStep({
  beleg,
  articles,
  selections,
  shippingMode,
  requestDHLLabel,
  setRequestDHLLabel,
  onBack,
  onDone,
}: {
  beleg: Beleg;
  articles: Position[];
  selections: Record<number, Selection>;
  shippingMode: ShippingMode;
  requestDHLLabel: boolean;
  setRequestDHLLabel: (b: boolean) => void;
  onBack: () => void;
  onDone: (pdfUrl: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => {
    return articles
      .filter((a) => selections[a.id])
      .map((a) => {
        const menge = selections[a.id].menge;
        const unit = a.einzelpreis_brutto !== undefined ? Math.abs(a.einzelpreis_brutto) : undefined;
        return {
          artikelnummer: a.artikelnummer,
          hersteller: a.hersteller,
          beschreibung: a.beschreibung,
          menge,
          grund: selections[a.id].grund,
          einzelpreis_brutto: unit,
          gesamtpreis_brutto: unit !== undefined ? unit * menge : undefined,
        };
      });
  }, [articles, selections]);

  const erstattungSumme = selected.reduce(
    (sum, it) => sum + (it.gesamtpreis_brutto ?? 0),
    0
  );

  const addr = beleg.rechnungsadresse;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bestellnummer: beleg.bestellnummer,
          belegnummer: beleg.belegnummer,
          belegdatum: beleg.belegdatum,
          rechnungsadresse: addr,
          items: selected,
          shippingMode,
          requestDHLLabel,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`PDF konnte nicht erstellt werden: ${txt}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      onDone(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <BelegCard beleg={beleg} />

      {/* Shipping-specific block */}
      {shippingMode === "sicher" ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Shield className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Sichere Rückgabe aktiv</p>
              <p className="text-sm">
                Mit deiner Bestellung hast du die &ldquo;Sichere Rückgabe&rdquo; gewählt — die Rücksendung ist für dich kostenfrei. Wir erstellen dir ein DHL-Retourenlabel.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={requestDHLLabel}
              onChange={(e) => setRequestDHLLabel(e.target.checked)}
              className="rounded border-emerald-300"
            />
            <span>DHL-Retourenlabel anfordern (kostenfrei)</span>
          </label>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Truck className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="font-semibold">Standard-Rücksendung</p>
              <p className="text-sm">
                Für diese Bestellung wurde die &ldquo;Sichere Rückgabe&rdquo; nicht gebucht. Bitte sende die Ware auf eigene Kosten an folgende Adresse:
              </p>
              <div className="text-sm bg-white rounded-lg p-3 border border-amber-200 font-mono">
                kfzBlitz24 GmbH<br />
                c/o RETOURE<br />
                Musterstraße 1<br />
                12345 Musterstadt
              </div>
              <p className="text-xs">
                Lege den ausgedruckten Retourenschein (siehe Schritt 4) bitte der Sendung bei.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selection summary */}
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-bg-secondary/50">
          <h3 className="font-semibold text-text">Deine Retoure</h3>
          <p className="text-xs text-text-light mt-0.5">
            {selected.length} {selected.length === 1 ? "Artikel" : "Artikel"} zurücksenden
          </p>
        </div>
        <div className="divide-y divide-border">
          {selected.map((it, i) => (
            <div key={i} className="p-4 flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold shrink-0">
                {it.menge}×
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{it.beschreibung}</p>
                <p className="text-xs text-text-light mt-0.5">
                  {it.artikelnummer} {it.hersteller && `· ${it.hersteller}`}
                </p>
                <p className="text-xs text-text-light mt-0.5">
                  <span className="font-medium">Grund:</span> {it.grund}
                </p>
              </div>
              {it.gesamtpreis_brutto !== undefined && (
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-text">
                    {it.gesamtpreis_brutto.toFixed(2).replace(".", ",")} €
                  </p>
                  {it.einzelpreis_brutto !== undefined && it.menge > 1 && (
                    <p className="text-xs text-text-light">
                      {it.einzelpreis_brutto.toFixed(2).replace(".", ",")} € / Stk
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {erstattungSumme > 0 && (
            <div className="p-4 bg-bg-secondary/40 flex items-center justify-between">
              <span className="text-sm font-semibold text-text">Voraussichtliche Erstattung</span>
              <span className="text-lg font-bold text-text">
                {erstattungSumme.toFixed(2).replace(".", ",")} €
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Refund hint */}
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Die Erstattung erfolgt auf das ursprüngliche Zahlungsmittel.
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-bg-card border border-border text-text rounded-lg text-sm font-medium hover:bg-bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          {submitting ? "Erstelle PDF..." : "Retourenschein erstellen"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 4: Done
// ────────────────────────────────────────────────────────────────────────
function DoneStep({ pdfUrl, onReset }: { pdfUrl: string; onReset: () => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-6 flex items-start gap-3">
        <CheckCircle2 className="w-6 h-6 mt-0.5 shrink-0" />
        <div className="space-y-3">
          <div>
            <p className="font-bold text-lg">Retoure angemeldet</p>
            <p className="text-sm">
              Dein Retourenschein ist bereit. Bitte drucke ihn aus und lege ihn der Sendung bei.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={pdfUrl}
              download="retourenschein.pdf"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
            >
              <Download className="w-4 h-4" /> Retourenschein herunterladen
            </a>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50"
            >
              In neuem Tab öffnen
            </a>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="text-sm text-text-light hover:text-text"
      >
        Weitere Retoure anmelden →
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Order overview card (shared between select + review)
// ────────────────────────────────────────────────────────────────────────
function BelegCard({ beleg }: { beleg: Beleg }) {
  const addr = beleg.rechnungsadresse;
  const fullName =
    addr?.vorname || addr?.name
      ? [addr.vorname, addr.name].filter(Boolean).join(" ")
      : beleg.bestellername;
  return (
    <div className="bg-bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-text-light">Bestellung</p>
          <p className="font-bold text-text font-mono">
            {beleg.bestellnummer ?? "—"}
          </p>
          {beleg.belegdatum && (
            <p className="text-xs text-text-light mt-1">Bestellt am {beleg.belegdatum}</p>
          )}
        </div>
        {fullName && (
          <div className="text-right text-sm">
            <p className="text-xs text-text-light flex items-center gap-1 justify-end">
              <User className="w-3 h-3" /> Rechnungsadresse
            </p>
            <p className="font-medium text-text">{fullName}</p>
            {addr?.strasse && (
              <p className="text-xs text-text-light">{addr.strasse}</p>
            )}
            {(addr?.plz || addr?.ort) && (
              <p className="text-xs text-text-light">
                {[addr.plz, addr.ort].filter(Boolean).join(" ")}
              </p>
            )}
            {addr?.email && (
              <p className="text-xs text-accent">
                <Mail className="w-3 h-3 inline mr-0.5" /> {addr.email}
              </p>
            )}
            {(addr?.telefon || addr?.handy) && (
              <p className="text-xs text-text-light">
                <Phone className="w-3 h-3 inline mr-0.5" /> {addr.telefon || addr.handy}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
