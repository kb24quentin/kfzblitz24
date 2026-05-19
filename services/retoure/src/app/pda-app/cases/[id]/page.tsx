"use client";

/**
 * PDA Case-Wizard.
 *
 * Step-by-Step-Workflow statt Alles-auf-einmal. Welcher Step gerade
 * dran ist, leitet sich aus den Case-/Item-Statuses ab — Reload landet
 * immer am richtigen Punkt.
 *
 * Phases:
 *   receive   — Case noch nicht angenommen → "Paket entgegennehmen"
 *   scan      — registered/extra Items mit status=pending → Scanner-Eingabe
 *   assess    — Items mit status=received → ein Item nach dem anderen bewerten
 *   palette   — Items mit status=assessed UND verdict ∈ {green, yellow}
 *               → Supplier wählen + Container scannen/anlegen
 *   done      — alles durch → Summary + "Kundenmail senden"
 *
 * Items mit verdict=red bleiben "assessed" und gehen NICHT auf eine
 * Palette (kein Lieferant nimmt sie zurück). Der Mitarbeiter klärt das
 * mit dem Kunden ab — Finalize-Mail listet sie als nicht-erstattbar.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { api, getPdaId } from "../../pda-client";

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

interface PdaItem {
  id: string;
  source: "registered" | "extra" | "unknown" | string;
  status: string;
  artikelnummer: string | null;
  hersteller: string | null;
  beschreibung: string | null;
  menge: number;
  grund: string | null;
  einzelpreis_brutto: number | null;
  gesamtpreis_brutto: number | null;
  einzelgewicht_g: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
  containerId?: string | null;
  containerCode?: string | null;
  verdict?: "green" | "yellow" | "red" | null;
  photoCount?: number;
}

interface CaseDetail {
  id: string;
  bestellnummer: string;
  belegnummer: string | null;
  status: string;
  carrierDeliveredAt: string | null;
  partnerReceivedAt: string | null;
  customer: {
    anrede?: string | null;
    vorname?: string | null;
    name?: string | null;
    plz?: string | null;
    ort?: string | null;
    email?: string | null;
  };
  items: PdaItem[];
}

interface Supplier {
  id: string;
  name: string;
}

interface OpenContainer {
  id: string;
  code: string;
  supplierId: string | null;
  supplierName: string | null;
  items: { id: string }[];
}

type Step = "receive" | "scan" | "assess" | "palette" | "done";

// ───────────────────────────────────────────────────────────────────────
// State-Maschine: aus Case-Daten den aktuellen Schritt ableiten.
// ───────────────────────────────────────────────────────────────────────
function deriveStep(c: CaseDetail): Step {
  if (!c.partnerReceivedAt) return "receive";
  if (c.items.some((it) => it.status === "pending")) return "scan";
  if (
    c.items.some(
      (it) => it.status === "received" || it.status === "photographed",
    )
  ) {
    return "assess";
  }
  if (
    c.items.some(
      (it) => it.status === "assessed" && it.verdict !== "red",
    )
  ) {
    return "palette";
  }
  return "done";
}

function stepLabel(s: Step): string {
  return {
    receive: "Eingang",
    scan: "Scannen",
    assess: "Bewerten",
    palette: "Palette",
    done: "Fertig",
  }[s];
}

const STEPS: Step[] = ["receive", "scan", "assess", "palette", "done"];

// ───────────────────────────────────────────────────────────────────────
// Root
// ───────────────────────────────────────────────────────────────────────

export default function CasePdaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setCase] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<CaseDetail>(`/api/pda/cases/${id}`);
      setCase(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (suppliers.length > 0) return;
    api<{ suppliers: Supplier[] }>("/api/pda/suppliers")
      .then((r) => setSuppliers(r.suppliers))
      .catch(() => {
        /* still works without — picker zeigt dann Fehler */
      });
  }, [suppliers.length]);

  if (loading)
    return <p className="text-white/60 mt-8 text-center">Lade…</p>;
  if (error || !c)
    return (
      <div className="space-y-3 mt-4">
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error ?? "Nicht gefunden"}
        </div>
        <button
          onClick={() => router.push("/pda-app")}
          className="w-full bg-white/10 text-white py-3 rounded-xl"
        >
          Zurück
        </button>
      </div>
    );

  const step = deriveStep(c);
  const customer =
    [c.customer.anrede, c.customer.vorname, c.customer.name]
      .filter(Boolean)
      .join(" ") || "—";

  return (
    <div className="space-y-4">
      {/* Header — kompakt, Kunden-Info auf einen Blick */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <p className="font-mono text-base font-bold">{c.bestellnummer}</p>
        <p className="text-xs text-white/60">
          {customer} ·{" "}
          {[c.customer.plz, c.customer.ort].filter(Boolean).join(" ")}
        </p>
      </div>

      {/* Progress-Bar */}
      <StepProgress current={step} />

      {/* Body — Schritt-spezifisch */}
      {step === "receive" && <ReceiveStep caseId={id} onDone={load} />}
      {step === "scan" && (
        <ScanStep caseId={id} c={c} onChange={load} />
      )}
      {step === "assess" && (
        <AssessStep caseId={id} c={c} onChange={load} />
      )}
      {step === "palette" && (
        <PaletteStep
          caseId={id}
          c={c}
          suppliers={suppliers}
          onChange={load}
        />
      )}
      {step === "done" && (
        <DoneStep caseId={id} c={c} onChange={load} />
      )}

      {/* Footer — Notausgang */}
      <a
        href="/pda-app"
        className="block text-center text-xs text-white/40 underline pt-4"
      >
        Abbrechen / zurück zur Startseite
      </a>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Progress-Indikator
// ───────────────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const currentIdx = STEPS.indexOf(current);
  return (
    <ol className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
      {STEPS.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <li key={s} className="flex-1">
            <div
              className={`text-center py-1.5 rounded-md font-semibold ${
                active
                  ? "bg-[#ff6600] text-white"
                  : done
                    ? "bg-green-500/30 text-green-100"
                    : "bg-white/5 text-white/40"
              }`}
            >
              {i + 1}. {stepLabel(s)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 1: Receive
// ───────────────────────────────────────────────────────────────────────

function ReceiveStep({
  caseId,
  onDone,
}: {
  caseId: string;
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onReceive = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/pda/cases/${caseId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdaId: getPdaId() }),
      });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center pt-6">
        <div className="text-5xl">📦</div>
        <h1 className="text-xl font-bold mt-2">Paket entgegennehmen?</h1>
        <p className="text-sm text-white/60 mt-1">
          Bestätige mit dem Button, dass das Paket im Lager angekommen ist.
        </p>
      </div>

      <button
        onClick={onReceive}
        disabled={busy}
        className="w-full bg-[#ff6600] text-white font-bold py-5 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
      >
        {busy ? "…" : "✓ Paket angenommen"}
      </button>

      {err && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {err}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 2: Scan — alle Items abscannen oder als "fehlt" markieren
// ───────────────────────────────────────────────────────────────────────

function ScanStep({
  caseId,
  c,
  onChange,
}: {
  caseId: string;
  c: CaseDetail;
  onChange: () => void | Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "miss" | "err";
    msg: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = c.items.filter((it) => it.status === "pending");
  const total = c.items.length;
  const erfasst = c.items.filter(
    (it) => it.status !== "pending" && it.status !== "missing",
  ).length;

  const onScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    const norm = raw.toLowerCase();
    setFeedback(null);

    const candidates = c.items.filter(
      (it) => (it.artikelnummer ?? "").toLowerCase() === norm,
    );
    const target =
      candidates.find((it) => it.status === "pending") ?? candidates[0];

    if (!target) {
      setFeedback({
        kind: "miss",
        msg: `Kein Artikel mit Nummer "${raw}" in diesem Case.`,
      });
      setInput("");
      inputRef.current?.focus();
      return;
    }
    if (target.status === "received") {
      setFeedback({
        kind: "ok",
        msg: `Bereits erfasst: ${target.beschreibung ?? raw}`,
      });
      setInput("");
      inputRef.current?.focus();
      return;
    }
    setInput("");
    setBusy(true);
    try {
      await api(`/api/pda/cases/${caseId}/items/${target.id}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ present: true, pdaId: getPdaId() }),
      });
      await onChange();
      setFeedback({
        kind: "ok",
        msg: `✓ ${target.beschreibung ?? raw} erfasst`,
      });
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const markMissing = async (itemId: string) => {
    setBusy(true);
    try {
      await api(`/api/pda/cases/${caseId}/items/${itemId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ present: false, pdaId: getPdaId() }),
      });
      await onChange();
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Artikel scannen</h1>
        <p className="text-sm text-white/60 mt-1">
          {erfasst} von {total} erfasst · noch {pending.length} offen
        </p>
      </div>

      <form onSubmit={onScan} className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoFocus
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Artikelnummer scannen…"
          disabled={busy}
          className="w-full px-4 py-4 bg-white/10 border-2 border-[#ff6600]/50 rounded-xl text-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6600] disabled:opacity-40"
        />
        {feedback && (
          <div
            className={`text-sm rounded-lg p-2 ${
              feedback.kind === "ok"
                ? "bg-green-500/20 text-green-100 border border-green-400/40"
                : feedback.kind === "miss"
                  ? "bg-yellow-500/20 text-yellow-100 border border-yellow-400/40"
                  : "bg-red-500/20 text-red-100 border border-red-400/40"
            }`}
          >
            {feedback.msg}
          </div>
        )}
      </form>

      {/* Offene Items — können als "fehlt" markiert werden */}
      <div className="space-y-2 pt-2">
        <p className="text-xs uppercase tracking-wider text-white/50">
          Erwartet ({pending.length})
        </p>
        {pending.map((it) => (
          <div
            key={it.id}
            className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {it.menge}× {it.beschreibung ?? "—"}
              </p>
              <p className="text-xs text-white/60 mt-0.5 font-mono">
                {it.artikelnummer}
              </p>
            </div>
            <button
              onClick={() => markMissing(it.id)}
              disabled={busy}
              className="bg-red-600/30 text-red-100 text-xs font-semibold py-1.5 px-3 rounded-lg active:bg-red-600/50 disabled:opacity-40 shrink-0"
            >
              fehlt
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <a
          href={`/pda-app/cases/${caseId}/extra`}
          className="bg-white/10 text-white text-center text-xs font-medium py-3 rounded-xl active:bg-white/20"
        >
          + Extra-Artikel
        </a>
        <button
          onClick={onChange}
          disabled={busy}
          className="bg-white/5 text-white/70 text-center text-xs font-medium py-3 rounded-xl active:bg-white/10 disabled:opacity-40"
        >
          ↻ Aktualisieren
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 3: Assess — pro Item: Fotos + Bewertung
// ───────────────────────────────────────────────────────────────────────

function AssessStep({
  caseId,
  c,
  onChange,
}: {
  caseId: string;
  c: CaseDetail;
  onChange: () => void | Promise<void>;
}) {
  const queue = c.items.filter(
    (it) => it.status === "received" || it.status === "photographed",
  );
  const current = queue[0];
  const completed = c.items.filter(
    (it) => it.status === "assessed" || it.status === "on_pallet",
  ).length;
  const totalToAssess = queue.length + completed;

  const [score, setScore] = useState(85);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Beim Item-Wechsel: Slider zurücksetzen
  useEffect(() => {
    setScore(85);
    setReason("");
    setErr(null);
  }, [current?.id]);

  if (!current) {
    return (
      <div className="text-white/60 text-sm">
        Kein Artikel zu bewerten — weiter zum nächsten Schritt.
      </div>
    );
  }

  const verdictLabel =
    score >= 85
      ? "GRÜN — Ware OK, Erstattung freigeben"
      : score >= 50
        ? "GELB — Hersteller-Prüfung nötig"
        : "ROT — Ware kann nicht zurückgenommen werden";
  const verdictColor =
    score >= 85 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

  const onSave = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/pda/cases/${caseId}/items/${current.id}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeScore: score,
          verdictReason: reason.trim() || undefined,
          pdaId: getPdaId(),
        }),
      });
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Artikel bewerten</h1>
        <p className="text-sm text-white/60 mt-1">
          {completed + 1} von {totalToAssess}
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <p className="font-semibold text-white text-sm">
          {current.menge}× {current.beschreibung ?? "—"}
        </p>
        <p className="text-xs text-white/60 mt-0.5 font-mono">
          {[current.artikelnummer, current.hersteller].filter(Boolean).join(" · ")}
        </p>
        {current.grund && (
          <p className="text-xs text-white/50 mt-1">
            Retoure-Grund: {current.grund}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <a
            href={`/pda-app/cases/${caseId}/items/${current.id}/photos`}
            className="inline-flex items-center gap-1 bg-white/10 text-white text-xs font-medium py-1.5 px-3 rounded-lg active:bg-white/20"
          >
            📷 Fotos ({current.photoCount ?? 0})
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <div
          className={`${verdictColor} text-white text-center font-bold py-3 rounded-xl text-lg`}
        >
          {score}/100
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(parseInt(e.target.value))}
          className="w-full h-3 accent-[#ff6600]"
        />
        <div className="text-center text-sm text-white/80">
          {verdictLabel}
        </div>
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Begründung (optional, z. B. „OVP beschädigt")"
        className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
      />

      <button
        onClick={onSave}
        disabled={busy}
        className="w-full bg-[#ff6600] text-white font-bold py-4 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
      >
        {busy ? "Speichere…" : "Speichern + weiter"}
      </button>

      {err && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {err}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 4: Palette — pro Item: Supplier + Container picken oder neu anlegen
// ───────────────────────────────────────────────────────────────────────

function PaletteStep({
  caseId,
  c,
  suppliers,
  onChange,
}: {
  caseId: string;
  c: CaseDetail;
  suppliers: Supplier[];
  onChange: () => void | Promise<void>;
}) {
  const queue = c.items.filter(
    (it) => it.status === "assessed" && it.verdict !== "red",
  );
  const current = queue[0];
  const completed = c.items.filter((it) => it.status === "on_pallet").length;
  const totalToPalettize = queue.length + completed;

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [openContainers, setOpenContainers] = useState<OpenContainer[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset bei Item-Wechsel
  useEffect(() => {
    setSupplierId(current?.supplierId ?? null);
    setOpenContainers([]);
    setErr(null);
  }, [current?.id, current?.supplierId]);

  // Wenn Supplier (neu) gewählt: offene Container laden
  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    setLoadingContainers(true);
    api<{ containers: OpenContainer[] }>(
      `/api/pda/containers?status=open&supplierId=${encodeURIComponent(supplierId)}&limit=20`,
    )
      .then((r) => {
        if (cancelled) return;
        setOpenContainers(r.containers);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingContainers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (!current) {
    return (
      <div className="text-white/60 text-sm">
        Keine Artikel mehr für Paletten — weiter.
      </div>
    );
  }

  const linkToContainer = async (containerId: string) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/pda/containers/${containerId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: current.id,
          actor: getPdaId(),
        }),
      });
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createPaletteAndLink = async () => {
    if (!supplierId) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ container: { id: string; code: string } }>(
        "/api/pda/containers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "palette",
            supplierId,
            createdByPda: getPdaId(),
          }),
        },
      );
      await api(`/api/pda/containers/${r.container.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: current.id,
          actor: getPdaId(),
        }),
      });
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const chosen = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Auf Palette legen</h1>
        <p className="text-sm text-white/60 mt-1">
          {completed + 1} von {totalToPalettize}
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <p className="font-semibold text-white text-sm">
          {current.menge}× {current.beschreibung ?? "—"}
        </p>
        <p className="text-xs text-white/60 mt-0.5 font-mono">
          {[current.artikelnummer, current.hersteller].filter(Boolean).join(" · ")}
        </p>
        {current.verdict && (
          <span
            className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mt-2 ${
              current.verdict === "green"
                ? "bg-green-500/30 text-green-200"
                : "bg-yellow-500/30 text-yellow-100"
            }`}
          >
            ● {current.verdict}
          </span>
        )}
      </div>

      {/* Stufe 1: Supplier wählen */}
      {!supplierId && (
        <div className="space-y-2">
          <p className="text-sm text-white/70">
            An welchen Lieferanten geht der Artikel zurück?
          </p>
          {suppliers.length === 0 ? (
            <p className="text-sm text-yellow-200 bg-yellow-500/15 rounded p-2">
              Keine Lieferanten gepflegt — bitte im Admin-Dashboard
              anlegen.
            </p>
          ) : (
            suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSupplierId(s.id)}
                className="w-full bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-left py-4 px-4 rounded-xl font-semibold"
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      )}

      {/* Stufe 2: Container wählen oder neu anlegen */}
      {supplierId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70">
              Lieferant:{" "}
              <span className="text-white font-semibold">
                {chosen?.name ?? supplierId}
              </span>
            </p>
            <button
              onClick={() => setSupplierId(null)}
              className="text-xs text-white/50 underline"
            >
              ändern
            </button>
          </div>

          {loadingContainers ? (
            <p className="text-sm text-white/50 italic">Container laden…</p>
          ) : openContainers.length === 0 ? (
            <p className="text-sm text-white/60">
              Keine offene Palette für {chosen?.name ?? "diesen Lieferanten"}.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/50">
                Offene Paletten
              </p>
              {openContainers.map((cc) => (
                <button
                  key={cc.id}
                  onClick={() => linkToContainer(cc.id)}
                  disabled={busy}
                  className="w-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-white text-left py-3 px-4 rounded-xl disabled:opacity-40 flex items-center justify-between gap-2"
                >
                  <span className="font-mono font-semibold text-sm">
                    {cc.code}
                  </span>
                  <span className="text-[10px] text-white/50">
                    {cc.items.length} Artikel
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={createPaletteAndLink}
            disabled={busy || loadingContainers}
            className="w-full bg-[#ff6600] hover:bg-[#ff7a26] active:bg-[#e85f00] text-white font-bold py-4 rounded-xl text-base disabled:opacity-40 mt-2"
          >
            {busy
              ? "Lege an…"
              : `+ Neue Palette für ${chosen?.name ?? "Lieferant"}`}
          </button>
        </div>
      )}

      {err && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {err}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 5: Done — Summary + Customer-Mail
// ───────────────────────────────────────────────────────────────────────

function DoneStep({
  caseId,
  c,
  onChange,
}: {
  caseId: string;
  c: CaseDetail;
  onChange: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(false);

  const onPallet = c.items.filter((it) => it.status === "on_pallet");
  const missing = c.items.filter((it) => it.status === "missing");
  const red = c.items.filter(
    (it) => it.status === "assessed" && it.verdict === "red",
  );
  const refunded = c.items.filter((it) => it.status === "refunded");
  const rejected = c.items.filter((it) => it.status === "rejected");

  const alreadyFinalized =
    c.status === "erstattet" ||
    c.status === "abgelehnt" ||
    c.status === "pruefung";

  const onFinalize = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/pda/cases/${caseId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdaId: getPdaId() }),
      });
      setFinalized(true);
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center pt-2">
        <div className="text-5xl">✓</div>
        <h1 className="text-xl font-bold mt-2">Annahme abgeschlossen</h1>
        <p className="text-sm text-white/60 mt-1">
          {c.bestellnummer} ist komplett bearbeitet.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
        <SummaryRow
          label="Auf Palette"
          count={onPallet.length}
          color="green"
        />
        {missing.length > 0 && (
          <SummaryRow
            label="Fehlend"
            count={missing.length}
            color="yellow"
          />
        )}
        {red.length > 0 && (
          <SummaryRow
            label="Nicht zurücknehmbar"
            count={red.length}
            color="red"
          />
        )}
        {refunded.length > 0 && (
          <SummaryRow
            label="Bereits erstattet"
            count={refunded.length}
            color="green"
          />
        )}
        {rejected.length > 0 && (
          <SummaryRow
            label="Abgelehnt"
            count={rejected.length}
            color="red"
          />
        )}
      </div>

      {/* Container-Übersicht */}
      {onPallet.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-white/50">
            Paletten
          </p>
          {Array.from(
            new Set(onPallet.map((it) => it.containerCode).filter(Boolean)),
          ).map((code) => (
            <div
              key={code}
              className="bg-white/5 border border-white/10 rounded-lg p-2 font-mono text-sm"
            >
              {code}
            </div>
          ))}
        </div>
      )}

      {/* Kundenmail */}
      {!alreadyFinalized && !finalized && (
        <button
          onClick={onFinalize}
          disabled={busy}
          className="w-full bg-[#ff6600] text-white font-bold py-4 rounded-xl text-base active:bg-[#ff7a26] disabled:opacity-40"
        >
          {busy ? "Sende…" : "📧 Bestätigungs-Mail an Kunden senden"}
        </button>
      )}
      {(alreadyFinalized || finalized) && (
        <div className="bg-green-500/20 border border-green-400/40 text-green-100 rounded-lg p-3 text-sm">
          ✓ Kunden-Mail wurde verschickt (Case-Status: {c.status})
        </div>
      )}

      {err && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {err}
        </div>
      )}

      <button
        onClick={() => router.push("/pda-app")}
        className="w-full bg-white/10 text-white font-semibold py-4 rounded-xl active:bg-white/20"
      >
        Nächste Annahme
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "green" | "yellow" | "red";
}) {
  const dot =
    color === "green"
      ? "bg-green-400"
      : color === "yellow"
        ? "bg-yellow-400"
        : "bg-red-400";
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-white/80">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono font-bold text-white">{count}</span>
    </div>
  );
}
