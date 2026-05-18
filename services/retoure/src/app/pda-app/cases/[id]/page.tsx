"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { api, getPdaId } from "../../pda-client";

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
  const [actionBusy, setActionBusy] = useState<string | null>(null);

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

  const onReceive = async () => {
    setActionBusy("receive");
    try {
      await api(`/api/pda/cases/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdaId: getPdaId() }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  };

  const onScanItem = async (itemId: string, present: boolean) => {
    setActionBusy(`scan-${itemId}-${present}`);
    try {
      await api(`/api/pda/cases/${id}/items/${itemId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ present, pdaId: getPdaId() }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) return <p className="text-white/60 mt-8 text-center">Lade…</p>;
  if (error)
    return (
      <div className="space-y-3 mt-4">
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
        <button
          onClick={() => router.push("/pda-app")}
          className="w-full bg-white/10 text-white py-3 rounded-xl"
        >
          Zurück
        </button>
      </div>
    );
  if (!c) return null;

  const customer =
    [c.customer.anrede, c.customer.vorname, c.customer.name]
      .filter(Boolean)
      .join(" ") || "—";

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <p className="text-xs text-white/60 uppercase tracking-wider">Retoure</p>
        <p className="font-mono text-lg font-bold mt-1">{c.bestellnummer}</p>
        <p className="text-sm text-white/80 mt-2">{customer}</p>
        <p className="text-xs text-white/50">
          {[c.customer.plz, c.customer.ort].filter(Boolean).join(" ")}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <StatusChip>{c.status}</StatusChip>
        {c.carrierDeliveredAt && (
          <span className="text-white/50">
            DHL-Eingang: {new Date(c.carrierDeliveredAt).toLocaleDateString("de-DE")}
          </span>
        )}
      </div>

      {!c.partnerReceivedAt && (
        <button
          onClick={onReceive}
          disabled={actionBusy === "receive"}
          className="w-full bg-[#ff6600] text-white font-semibold py-4 rounded-xl text-lg active:bg-[#ff7a26] disabled:opacity-40"
        >
          {actionBusy === "receive" ? "…" : "Paket angenommen"}
        </button>
      )}
      {c.partnerReceivedAt && (
        <div className="bg-green-500/20 border border-green-400/40 text-green-100 rounded-lg p-3 text-sm">
          ✓ Eingang erfasst — {new Date(c.partnerReceivedAt).toLocaleString("de-DE")}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Artikel ({c.items.length})
        </h2>
        {c.items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            busy={actionBusy?.startsWith(`scan-${it.id}-`) ?? false}
            onScan={(present) => onScanItem(it.id, present)}
            caseId={id}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <a
          href={`/pda-app/cases/${id}/extra`}
          className="bg-white/10 text-white text-center text-sm font-medium py-3 rounded-xl active:bg-white/20"
        >
          + Extra-Artikel
        </a>
        <a
          href={`/pda-app/cases/${id}/photos`}
          className="bg-white/10 text-white text-center text-sm font-medium py-3 rounded-xl active:bg-white/20"
        >
          📷 Fotos
        </a>
      </div>

      <a
        href="/pda-app"
        className="block text-center text-xs text-white/60 underline pt-4"
      >
        Neue Annahme
      </a>
    </div>
  );
}

function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white/10 text-white text-xs font-semibold rounded-full px-2 py-0.5">
      {children}
    </span>
  );
}

function ItemRow({
  item,
  busy,
  onScan,
  caseId,
}: {
  item: PdaItem;
  busy: boolean;
  onScan: (present: boolean) => void;
  caseId: string;
}) {
  const isReceived = item.status === "received";
  const isMissing = item.status === "missing";

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">
            {item.menge}× {item.beschreibung ?? "—"}
          </p>
          <p className="text-xs text-white/60 mt-0.5 font-mono">
            {[item.artikelnummer, item.hersteller].filter(Boolean).join(" · ")}
          </p>
          {item.grund && (
            <p className="text-xs text-white/50 mt-0.5">{item.grund}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {item.source !== "registered" && (
              <span className="text-[10px] bg-[#ff6600]/30 text-[#ff6600] px-1.5 py-0.5 rounded uppercase">
                {item.source}
              </span>
            )}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                isReceived
                  ? "bg-green-500/30 text-green-200"
                  : isMissing
                  ? "bg-red-500/30 text-red-200"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {item.status}
            </span>
          </div>
        </div>
        {item.gesamtpreis_brutto !== null && (
          <span className="text-sm font-mono text-white/70 shrink-0">
            {item.gesamtpreis_brutto.toFixed(2).replace(".", ",")} €
          </span>
        )}
      </div>

      {!isReceived && !isMissing && (
        <div className="flex gap-2">
          <button
            onClick={() => onScan(true)}
            disabled={busy}
            className="flex-1 bg-green-600/80 text-white font-semibold py-2 rounded-lg active:bg-green-700 disabled:opacity-40 text-sm"
          >
            ✓ Da
          </button>
          <button
            onClick={() => onScan(false)}
            disabled={busy}
            className="flex-1 bg-red-600/80 text-white font-semibold py-2 rounded-lg active:bg-red-700 disabled:opacity-40 text-sm"
          >
            ✗ Fehlt
          </button>
        </div>
      )}

      {isReceived && (
        <a
          href={`/pda-app/cases/${caseId}/items/${item.id}/assess`}
          className="block text-center bg-[#ff6600]/20 text-[#ffb380] text-xs font-medium py-2 rounded-lg active:bg-[#ff6600]/30"
        >
          → Bewertung & Fotos
        </a>
      )}
    </div>
  );
}
