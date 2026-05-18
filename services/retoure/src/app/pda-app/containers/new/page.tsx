"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, getPdaId } from "../../pda-client";

interface CreateContainerResponse {
  container: {
    id: string;
    code: string;
    type: string;
    status: string;
    maxOpenUntil: string | null;
  };
  printResult: { ok: boolean; error?: string; durationMs?: number };
}

export default function NewContainerPage() {
  const router = useRouter();
  const [type, setType] = useState<"palette" | "carton" | "bag">("palette");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateContainerResponse | null>(null);

  const onCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<CreateContainerResponse>("/api/pda/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, createdByPda: getPdaId() }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4 mt-4">
        <div className="bg-green-500/20 border border-green-400/40 text-green-100 rounded-xl p-4">
          <p className="text-sm">Container angelegt:</p>
          <p className="font-mono text-xl font-bold mt-1">{result.container.code}</p>
          {result.container.maxOpenUntil && (
            <p className="text-xs mt-2">
              Max. offen bis{" "}
              {new Date(result.container.maxOpenUntil).toLocaleDateString("de-DE")}
            </p>
          )}
        </div>

        <div
          className={`rounded-xl p-3 text-sm ${
            result.printResult.ok
              ? "bg-white/10 text-white/80"
              : "bg-yellow-500/20 text-yellow-100"
          }`}
        >
          {result.printResult.ok
            ? `✓ Label gedruckt (${result.printResult.durationMs ?? "?"} ms)`
            : `⚠ Druck übersprungen: ${result.printResult.error ?? "?"}`}
        </div>

        <button
          onClick={() => router.push(`/pda-app/containers/${result.container.id}`)}
          className="w-full bg-[#ff6600] text-white font-semibold py-4 rounded-xl active:bg-[#ff7a26]"
        >
          Öffnen
        </button>
        <button
          onClick={() => router.push("/pda-app")}
          className="w-full bg-white/10 text-white py-3 rounded-xl"
        >
          Zurück zur Startseite
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <h1 className="text-2xl font-bold">Neuer Container</h1>
      <p className="text-sm text-white/60">
        Wähle den Typ — Label wird automatisch gedruckt.
      </p>

      <div className="space-y-2">
        {(["palette", "carton", "bag"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`w-full py-4 rounded-xl text-left px-4 font-semibold ${
              type === t
                ? "bg-[#ff6600] text-white"
                : "bg-white/5 border border-white/10 text-white/80"
            }`}
          >
            {t === "palette" ? "📦 Palette" : t === "carton" ? "📦 Karton" : "👜 Beutel"}
          </button>
        ))}
      </div>

      <button
        onClick={onCreate}
        disabled={loading}
        className="w-full bg-[#ff6600] text-white font-semibold py-4 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
      >
        {loading ? "Lege an…" : "Anlegen + Label drucken"}
      </button>

      {error && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <a
        href="/pda-app"
        className="block text-center text-xs text-white/60 underline pt-4"
      >
        Abbrechen
      </a>
    </div>
  );
}
