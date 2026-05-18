"use client";

import { useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { api, getPdaId } from "../../../pda-client";

type Source = "extra" | "unknown";

export default function PdaAddExtraItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [source, setSource] = useState<Source>("extra");
  const [artikelnummer, setArtikelnummer] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [hersteller, setHersteller] = useState("");
  const [menge, setMenge] = useState(1);
  const [grund, setGrund] = useState("Im Paket gefunden");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api(`/api/pda/cases/${id}/items/extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          artikelnummer: artikelnummer.trim() || undefined,
          beschreibung: beschreibung.trim() || undefined,
          hersteller: hersteller.trim() || undefined,
          menge,
          grund,
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
    <div className="space-y-4 mt-2">
      <h1 className="text-2xl font-bold">Artikel ergänzen</h1>
      <p className="text-sm text-white/60">
        Du hast einen Artikel im Paket gefunden, der nicht angemeldet war.
      </p>

      <div className="flex gap-2">
        {(["extra", "unknown"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold ${
              source === s
                ? "bg-[#ff6600] text-white"
                : "bg-white/10 text-white/70"
            }`}
          >
            {s === "extra" ? "Aus dieser Order" : "Unbekannt"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-white/70 mb-1">Artikelnummer</label>
          <input
            type="text"
            value={artikelnummer}
            onChange={(e) => setArtikelnummer(e.target.value)}
            placeholder="z.B. 311404"
            className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
          />
        </div>
        <div>
          <label className="block text-xs text-white/70 mb-1">Beschreibung</label>
          <input
            type="text"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            placeholder="z.B. Stoßdämpfer"
            className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
          />
        </div>
        <div>
          <label className="block text-xs text-white/70 mb-1">Hersteller</label>
          <input
            type="text"
            value={hersteller}
            onChange={(e) => setHersteller(e.target.value)}
            placeholder="optional"
            className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-white/70 mb-1">Menge</label>
            <input
              type="number"
              min={1}
              value={menge}
              onChange={(e) => setMenge(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">Grund</label>
            <input
              type="text"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6600] text-white font-semibold py-4 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
        >
          {loading ? "Speichere…" : "Hinzufügen"}
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
          Abbrechen
        </a>
      </form>
    </div>
  );
}
