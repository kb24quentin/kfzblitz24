"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken, setPdaId } from "../pda-client";

/**
 * Pairing-Seite — Endpunkt der QR-Code-URL aus dem Admin-Dashboard.
 *
 * Flow:
 *   1. Wenn `?code=...` in der URL → direkt exchangen, token+pdaId
 *      speichern, redirect zur Home.
 *   2. Sonst Input-Feld autofocused — Mitarbeiter scannt den QR (Q900
 *      tippt URL oder nur den Code ins Feld) + Enter → exchange.
 */
export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PairInner />
    </Suspense>
  );
}

function PairInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCode = searchParams.get("code");
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paired, setPaired] = useState<{ pdaId: string } | null>(null);

  const exchange = async (rawCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pda/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rawCode }),
        cache: "no-store",
      });
      const data: { ok?: boolean; token?: string; pdaId?: string; error?: string } =
        await res.json();
      if (!res.ok || !data.token || !data.pdaId) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setToken(data.token);
      setPdaId(data.pdaId);
      setPaired({ pdaId: data.pdaId });
      // Kurze Erfolgs-Anzeige, dann zur Home
      setTimeout(() => router.push("/pda-app"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Auto-Exchange wenn ?code=... in URL
  useEffect(() => {
    if (urlCode && !paired && !loading) {
      void exchange(urlCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = input.trim();
    if (!c) return;
    void exchange(c);
  };

  if (paired) {
    return (
      <div className="space-y-4 mt-12 text-center">
        <div className="text-6xl">✓</div>
        <h1 className="text-2xl font-bold text-green-300">Gerät gepairt</h1>
        <p className="text-sm text-white/70">
          PDA-ID:{" "}
          <span className="font-mono font-semibold text-white">
            {paired.pdaId}
          </span>
        </p>
        <p className="text-xs text-white/50">Leite zur App weiter …</p>
      </div>
    );
  }

  if (urlCode && loading) {
    return (
      <div className="space-y-4 mt-12 text-center">
        <div className="text-6xl animate-pulse">⏳</div>
        <h1 className="text-xl font-bold">Pairen läuft …</h1>
        <p className="text-sm text-white/60">
          Tausche Code gegen Zugriffs-Token.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h1 className="text-2xl font-bold">Gerät pairen</h1>
        <p className="text-sm text-white/60 mt-1">
          QR-Code aus dem Admin-Dashboard scannen oder Code per Hand
          eintippen.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoFocus
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="PDA-XXXX-XXXX"
          disabled={loading}
          className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60 focus:border-[#ff6600] disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-full bg-[#ff6600] text-white font-semibold py-4 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
        >
          {loading ? "Pairing läuft …" : "Pairen"}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-white/60 space-y-2">
        <p className="font-semibold text-white/80">So gehts:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Auf dem Admin-Dashboard ein neues PDA anlegen.</li>
          <li>QR-Code wird angezeigt — mit dem Scanner direkt scannen.</li>
          <li>App pairt sich automatisch, fertig.</li>
        </ol>
      </div>

      <a
        href="/pda-app/settings"
        className="block text-center text-xs text-white/60 underline pt-2"
      >
        Stattdessen manuell konfigurieren
      </a>
    </div>
  );
}
