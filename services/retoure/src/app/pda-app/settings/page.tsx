"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, setToken, getPdaId, setPdaId, api } from "../pda-client";

export default function PdaSettingsPage() {
  const [token, setTokenLocal] = useState("");
  const [pdaId, setPdaIdLocal] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setTokenLocal(getToken());
    setPdaIdLocal(getPdaId());
  }, []);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToken(token);
    setPdaId(pdaId);
    setStatus("Gespeichert.");
    setTimeout(() => router.push("/pda-app"), 700);
  };

  const onTestConnection = async () => {
    setError(null);
    setStatus("Teste…");
    setToken(token);
    setPdaId(pdaId);
    try {
      const data = await api<{ ok: boolean; serverTime: string }>(
        "/api/pda/health"
      );
      setStatus(`✓ Verbunden (Server ${data.serverTime})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-sm text-white/60 mt-1">
          API-Token + PDA-Identifikation. Lokal auf diesem Gerät gespeichert.
        </p>
      </div>

      <a
        href="/pda-app/pair"
        className="block bg-[#ff6600]/15 border border-[#ff6600]/40 rounded-xl p-4 active:bg-[#ff6600]/25"
      >
        <p className="text-sm font-semibold text-[#ff6600]">
          📱 QR-Code scannen zum Pairen
        </p>
        <p className="text-xs text-white/70 mt-1">
          Schneller als Token-Tippen — Admin generiert einen Code, du
          scannst ihn und die App ist fertig eingerichtet.
        </p>
      </a>

      <div className="text-xs text-white/40 uppercase tracking-wider pt-2">
        Oder manuell
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-sm text-white/80 mb-1">API-Token (Bearer)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setTokenLocal(e.target.value)}
            placeholder="610d1fec…"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm text-white/80 mb-1">PDA-ID (optional, für Audit)</label>
          <input
            type="text"
            value={pdaId}
            onChange={(e) => setPdaIdLocal(e.target.value)}
            placeholder="z.B. pda-01"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
            autoComplete="off"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-[#ff6600] text-white font-semibold py-3 rounded-xl active:bg-[#ff7a26]"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={onTestConnection}
            className="flex-1 bg-white/10 text-white font-semibold py-3 rounded-xl active:bg-white/20"
          >
            Verbinden
          </button>
        </div>
      </form>

      {status && (
        <div className="bg-green-500/20 border border-green-400/40 text-green-100 rounded-lg p-3 text-sm">
          {status}
        </div>
      )}
      {error && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <a
        href="/pda-app"
        className="block text-center text-xs text-white/60 underline pt-4"
      >
        Zurück
      </a>
    </div>
  );
}
