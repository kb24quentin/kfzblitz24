"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { api, openAuthenticatedPdf } from "../../pda-client";

interface PdaContainerDetail {
  id: string;
  code: string;
  type: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  maxOpenUntil: string | null;
  supplierId: string | null;
  supplierName: string | null;
  items: Array<{
    id: string;
    artikelnummer: string | null;
    beschreibung: string | null;
    status: string;
    case?: { id: string; bestellnummer: string };
  }>;
}

export default function PdaContainerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setC] = useState<PdaContainerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<PdaContainerDetail>(`/api/pda/containers/${id}`);
      setC(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    setLinking(true);
    setError(null);
    try {
      // Erst: Item-Code (cuid) lookup. Wenn der Mitarbeiter ein RMA-Code
      // scannt, müssten wir erst den Case finden — für den Demo-Flow
      // erwarten wir hier eine Item-ID direkt vom Case-Detail. Der echte
      // PDA-Workflow wäre: vom Case-Detail aus "→ auf Container legen"
      // Button mit Container-Auswahl.
      await api(`/api/pda/containers/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: scanCode.trim() }),
      });
      setScanCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLinking(false);
      inputRef.current?.focus();
    }
  };

  const onClose = async () => {
    if (!confirm(`Container ${c?.code} schließen?`)) return;
    setClosing(true);
    try {
      await api(`/api/pda/containers/${id}/close`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <p className="text-white/60 mt-8 text-center">Lade…</p>;
  if (!c)
    return (
      <div className="space-y-3 mt-4">
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error ?? "Nicht gefunden"}
        </div>
        <button
          onClick={() => router.push("/pda-app/containers")}
          className="w-full bg-white/10 text-white py-3 rounded-xl"
        >
          Zurück
        </button>
      </div>
    );

  return (
    <div className="space-y-4 mt-2">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <p className="text-xs text-white/60 uppercase tracking-wider">{c.type}</p>
        <p className="font-mono text-xl font-bold mt-1">{c.code}</p>
        {c.supplierName && (
          <p className="text-sm text-[#ffae80] mt-1">
            → Lieferant: <span className="font-semibold">{c.supplierName}</span>
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span
            className={`px-2 py-0.5 rounded-full font-semibold ${
              c.status === "open"
                ? "bg-green-500/20 text-green-100"
                : "bg-yellow-500/20 text-yellow-100"
            }`}
          >
            {c.status}
          </span>
          {c.maxOpenUntil && (
            <span className="text-white/50">
              bis {new Date(c.maxOpenUntil).toLocaleDateString("de-DE")}
            </span>
          )}
        </div>
      </div>

      {c.status === "open" && (
        <form onSubmit={onLink} className="space-y-2">
          <label className="block text-sm text-white/80">
            Artikel-ID scannen / eingeben
          </label>
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoFocus
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder="z.B. cmpb…"
            className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
          />
          <button
            type="submit"
            disabled={linking || !scanCode.trim()}
            className="w-full bg-[#ff6600] text-white font-semibold py-3 rounded-xl active:bg-[#ff7a26] disabled:opacity-40"
          >
            {linking ? "…" : "Auf Container legen"}
          </button>
        </form>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Artikel ({c.items.length})
        </h2>
        {c.items.length === 0 ? (
          <p className="text-white/50 text-sm italic">Noch keine Artikel verlinkt.</p>
        ) : (
          c.items.map((it) => (
            <div key={it.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-sm font-medium">{it.beschreibung ?? "—"}</p>
              <p className="text-xs text-white/60 mt-0.5 font-mono">
                {it.artikelnummer}
                {it.case && ` · ${it.case.bestellnummer}`}
              </p>
              <p className="text-xs text-white/40 mt-0.5">Status: {it.status}</p>
            </div>
          ))
        )}
      </div>

      {c.status === "open" && (
        <button
          onClick={onClose}
          disabled={closing}
          className="w-full bg-white/10 text-white font-semibold py-3 rounded-xl active:bg-white/20 disabled:opacity-40"
        >
          {closing ? "…" : "Container schließen"}
        </button>
      )}

      <button
        onClick={async () => {
          try {
            await openAuthenticatedPdf(
              `/api/admin/containers/${c.id}/label-pdf`,
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
        className="w-full bg-white/5 text-white/80 font-medium py-2.5 rounded-xl active:bg-white/10 text-sm"
      >
        📄 Label-PDF öffnen / drucken
      </button>

      <a
        href="/pda-app/containers"
        className="block text-center text-xs text-white/60 underline pt-4"
      >
        Zurück
      </a>
    </div>
  );
}
