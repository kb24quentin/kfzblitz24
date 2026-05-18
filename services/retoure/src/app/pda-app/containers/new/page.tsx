"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getPdaId } from "../../pda-client";

interface CreateContainerResponse {
  container: {
    id: string;
    code: string;
    type: string;
    status: string;
    supplierId: string | null;
    supplierName: string | null;
    maxOpenUntil: string | null;
  };
  printResult: { ok: boolean; error?: string; durationMs?: number };
}

interface SuppliersResponse {
  suppliers: Array<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
  }>;
}

export default function NewContainerPage() {
  const router = useRouter();
  const [type, setType] = useState<"palette" | "carton" | "bag">("palette");
  const [suppliers, setSuppliers] = useState<SuppliersResponse["suppliers"]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateContainerResponse | null>(null);

  // Suppliers laden — wir brauchen mind. einen aktiven Lieferanten,
  // sonst kann kein Container angelegt werden.
  useEffect(() => {
    let mounted = true;
    api<SuppliersResponse>("/api/pda/suppliers")
      .then((data) => {
        if (!mounted) return;
        setSuppliers(data.suppliers);
        // Default auf den ersten Supplier setzen, damit der Mitarbeiter
        // nicht extra tippen muss wenn aktuell eh nur Interparts da ist.
        if (data.suppliers.length > 0) setSupplierId(data.suppliers[0].id);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(`Lieferanten laden fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
      })
      .finally(() => mounted && setLoadingSuppliers(false));
    return () => {
      mounted = false;
    };
  }, []);

  const onCreate = async () => {
    if (!supplierId) {
      setError("Bitte Lieferant wählen");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<CreateContainerResponse>("/api/pda/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, supplierId, createdByPda: getPdaId() }),
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
          {result.container.supplierName && (
            <p className="text-xs mt-1 text-green-50/90">
              → Lieferant: <span className="font-semibold">{result.container.supplierName}</span>
            </p>
          )}
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
        Wähle Lieferant + Typ — Label wird automatisch gedruckt.
      </p>

      {/* Lieferanten-Picker — "Container = 1 Lieferant" */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-white/50">Lieferant</p>
        {loadingSuppliers ? (
          <div className="py-4 text-sm text-white/50">Lieferanten laden…</div>
        ) : suppliers.length === 0 ? (
          <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
            Keine aktiven Lieferanten gepflegt. Bitte zuerst im
            Admin-Dashboard unter <span className="font-mono">/admin/suppliers</span>{" "}
            anlegen (z. B. Interparts, Autopartner).
          </div>
        ) : (
          suppliers.map((s) => (
            <button
              key={s.id}
              onClick={() => setSupplierId(s.id)}
              className={`w-full py-3 rounded-xl text-left px-4 ${
                supplierId === s.id
                  ? "bg-[#ff6600] text-white"
                  : "bg-white/5 border border-white/10 text-white/80"
              }`}
            >
              <div className="font-semibold">{s.name}</div>
              {(s.city || s.country) && (
                <div className="text-xs opacity-70 mt-0.5">
                  {[s.city, s.country].filter(Boolean).join(", ")}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <div className="space-y-2 pt-2">
        <p className="text-xs uppercase tracking-wide text-white/50">Container-Typ</p>
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
        disabled={loading || loadingSuppliers || !supplierId}
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
