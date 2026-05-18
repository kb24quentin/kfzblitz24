"use client";

import { useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { api, getPdaId } from "../../../../../pda-client";

export default function PdaAssessItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = use(params);
  const router = useRouter();
  const [score, setScore] = useState(85);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verdictLabel =
    score >= 85 ? "GRÜN — Ware OK, Erstattung freigeben" :
    score >= 50 ? "GELB — Hersteller-Prüfung nötig" :
    "ROT — Ware kann nicht zurückgenommen werden";
  const verdictColor = score >= 85 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api(`/api/pda/cases/${id}/items/${itemId}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeScore: score,
          verdictReason: reason.trim() || undefined,
          pdaId: getPdaId(),
        }),
      });
      router.push(`/pda-app/cases/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-2">
      <h1 className="text-2xl font-bold">Bewertung</h1>
      <p className="text-sm text-white/60">
        Wie gut ist der Zustand des Artikels?
      </p>

      <div className="space-y-4">
        <div className={`${verdictColor} text-white text-center font-bold py-3 rounded-xl text-lg`}>
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
        <div className="text-center text-sm text-white/80">{verdictLabel}</div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-white/70 mb-1">
            Begründung (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="z.B. „OVP beschädigt aber Artikel original"
            className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6600] text-white font-semibold py-4 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
        >
          {loading ? "Speichere…" : "Bewertung speichern"}
        </button>

        {error && (
          <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <a
          href={`/pda-app/cases/${id}`}
          className="block text-center text-xs text-white/60 underline pt-2"
        >
          Zurück
        </a>
      </form>
    </div>
  );
}
