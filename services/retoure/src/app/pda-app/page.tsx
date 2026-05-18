"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, getPdaId } from "./pda-client";

interface CaseLookupResponse {
  matchedBy: "id" | "bestellnummer" | "tracking";
  case: {
    id: string;
    bestellnummer: string;
    status: string;
    customer: { vorname?: string | null; name?: string | null };
  };
}

export default function PdaHomePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenSet, setTokenSet] = useState(true);
  const [pdaIdSet, setPdaIdSet] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setTokenSet(!!getToken());
    setPdaIdSet(!!getPdaId());
    inputRef.current?.focus();
  }, []);

  const onScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api<CaseLookupResponse>(
        `/api/pda/cases/lookup?code=${encodeURIComponent(c)}`
      );
      router.push(`/pda-app/cases/${data.case.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCode("");
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!tokenSet) {
    return (
      <div className="space-y-4 mt-8">
        <p className="text-white/80 text-sm">
          Diese App ist noch nicht eingerichtet.
        </p>
        <a
          href="/pda-app/settings"
          className="block w-full bg-[#ff6600] text-white font-semibold text-center py-4 rounded-xl active:bg-[#ff7a26]"
        >
          Einrichten
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h1 className="text-2xl font-bold">Wareneingang</h1>
        <p className="text-sm text-white/60 mt-1">
          RMA-Code oder Bestellnummer scannen
        </p>
      </div>

      <form onSubmit={onScan} className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="KB24-… oder RMA-Code"
          className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60 focus:border-[#ff6600]"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full bg-[#ff6600] text-white font-semibold py-4 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
        >
          {loading ? "Suche…" : "Suchen"}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {!pdaIdSet && (
        <a
          href="/pda-app/settings"
          className="block text-center text-xs text-[#ff6600] underline"
        >
          PDA-ID setzen für Audit
        </a>
      )}

      <div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/10">
        <a
          href="/pda-app/containers"
          className="bg-white/5 border border-white/10 rounded-xl py-5 text-center active:bg-white/10"
        >
          <div className="text-2xl">📦</div>
          <div className="text-sm mt-1">Container</div>
        </a>
        <a
          href="/pda-app/containers/new"
          className="bg-white/5 border border-white/10 rounded-xl py-5 text-center active:bg-white/10"
        >
          <div className="text-2xl">＋</div>
          <div className="text-sm mt-1">Neue Palette</div>
        </a>
      </div>
    </div>
  );
}
