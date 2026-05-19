"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  /** Vom Container vererbt sobald Item auf Palette liegt. */
  supplierId?: string | null;
  supplierName?: string | null;
  containerCode?: string | null;
  verdict?: "green" | "yellow" | "red" | null;
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

  // Inline-Picker-State: welches Item, welcher Supplier, welche Container
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  const [pickerSupplierId, setPickerSupplierId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [openContainers, setOpenContainers] = useState<OpenContainer[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Scan-to-Receive: oben auf der Page ein autofocused Input. Mitarbeiter
  // scannt Artikelnummer mit Q900 → Item wird automatisch als received
  // markiert. Funktioniert sobald Case `partnerReceivedAt` hat.
  const [scanInput, setScanInput] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{
    kind: "ok" | "miss" | "err";
    msg: string;
  } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

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

  // Suppliers cachen — werden bei jedem geöffneten Picker gebraucht.
  useEffect(() => {
    if (suppliers.length > 0) return;
    api<{ suppliers: Supplier[] }>("/api/pda/suppliers")
      .then((r) => setSuppliers(r.suppliers))
      .catch((e) => {
        console.warn("[case-detail] suppliers load failed:", e);
      });
  }, [suppliers.length]);

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

  /**
   * Scan-to-Receive: Mitarbeiter scannt eine Artikelnummer (Q900 tippt
   * sie ins Input + Enter), wir matchen gegen die items[] des Cases und
   * markieren das passende Item als received.
   *
   * Match-Strategie:
   *   - Exakter Artikelnummer-Match (case-insensitive, trim)
   *   - Wenn mehrere Items mit gleicher Artikelnummer existieren:
   *     erstes ungescanntes nehmen (status === "pending")
   *   - Kein Match → kurze rote Feedback-Toast, Input bleibt focused
   */
  const onScanBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = scanInput.trim();
    if (!raw) return;
    const norm = raw.toLowerCase();
    setScanFeedback(null);

    const candidates = (c?.items ?? []).filter(
      (it) => (it.artikelnummer ?? "").toLowerCase() === norm,
    );
    const target =
      candidates.find((it) => it.status === "pending") ?? candidates[0];

    if (!target) {
      setScanFeedback({
        kind: "miss",
        msg: `Kein Artikel mit Nummer "${raw}" in diesem Case.`,
      });
      setScanInput("");
      scanInputRef.current?.focus();
      return;
    }
    if (target.status === "received") {
      setScanFeedback({
        kind: "ok",
        msg: `✓ Bereits erfasst: ${target.beschreibung ?? raw}`,
      });
      setScanInput("");
      scanInputRef.current?.focus();
      return;
    }
    // ✓Da-Klick programmatisch ausführen
    setScanInput("");
    try {
      await onScanItem(target.id, true);
      setScanFeedback({
        kind: "ok",
        msg: `✓ ${target.beschreibung ?? raw} erfasst`,
      });
    } catch (err) {
      setScanFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      scanInputRef.current?.focus();
    }
  };

  /**
   * Öffnet die Inline-Auswahl "Auf Palette legen" für ein Item.
   * Wenn das Item schon eine Supplier-Vorbelegung hat (z. B. weil vorher
   * auf eine Palette gelegt und dort wieder runtergenommen), nutzen wir
   * die direkt. Sonst muss der Mitarbeiter erst den Supplier wählen.
   */
  const openPicker = (item: PdaItem) => {
    setPickerError(null);
    setPickerItemId(item.id);
    if (item.supplierId) {
      setPickerSupplierId(item.supplierId);
      void loadOpenContainers(item.supplierId);
    } else {
      setPickerSupplierId(null);
      setOpenContainers([]);
    }
  };

  const closePicker = () => {
    setPickerItemId(null);
    setPickerSupplierId(null);
    setOpenContainers([]);
    setPickerError(null);
  };

  const loadOpenContainers = async (supplierId: string) => {
    setPickerLoading(true);
    setPickerError(null);
    try {
      const r = await api<{ containers: OpenContainer[] }>(
        `/api/pda/containers?status=open&supplierId=${encodeURIComponent(supplierId)}&limit=20`,
      );
      setOpenContainers(r.containers);
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : String(err));
    } finally {
      setPickerLoading(false);
    }
  };

  const chooseSupplier = (supplierId: string) => {
    setPickerSupplierId(supplierId);
    void loadOpenContainers(supplierId);
  };

  /** Item auf existierenden offenen Container legen. */
  const linkToContainer = async (containerId: string) => {
    if (!pickerItemId) return;
    setActionBusy(`link-${pickerItemId}`);
    setPickerError(null);
    try {
      await api(`/api/pda/containers/${containerId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: pickerItemId, actor: getPdaId() }),
      });
      closePicker();
      await load();
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  };

  /** Neue Palette für den gewählten Supplier anlegen + Item direkt drauflegen. */
  const createPaletteAndLink = async () => {
    if (!pickerItemId || !pickerSupplierId) return;
    setActionBusy(`new-${pickerItemId}`);
    setPickerError(null);
    try {
      const r = await api<{ container: { id: string; code: string } }>(
        "/api/pda/containers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "palette",
            supplierId: pickerSupplierId,
            createdByPda: getPdaId(),
          }),
        },
      );
      // Direkt drauflegen
      await api(`/api/pda/containers/${r.container.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: pickerItemId, actor: getPdaId() }),
      });
      closePicker();
      await load();
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : String(err));
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

      {/* Scan-to-Receive: sobald Case received ist, hier oben scannen. */}
      {c.partnerReceivedAt && c.items.some((it) => it.status === "pending") && (
        <form onSubmit={onScanBarcode} className="space-y-2">
          <label className="block text-xs uppercase tracking-wider text-white/60">
            Artikel scannen
          </label>
          <input
            ref={scanInputRef}
            type="text"
            inputMode="text"
            autoFocus
            autoComplete="off"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Artikelnummer mit Q900 scannen…"
            className="w-full px-4 py-3 bg-white/10 border-2 border-[#ff6600]/50 rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#ff6600]"
          />
          {scanFeedback && (
            <div
              className={`text-xs rounded-lg p-2 ${
                scanFeedback.kind === "ok"
                  ? "bg-green-500/20 text-green-100 border border-green-400/40"
                  : scanFeedback.kind === "miss"
                    ? "bg-yellow-500/20 text-yellow-100 border border-yellow-400/40"
                    : "bg-red-500/20 text-red-100 border border-red-400/40"
              }`}
            >
              {scanFeedback.msg}
            </div>
          )}
        </form>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Artikel ({c.items.length})
        </h2>
        {c.items.map((it) => (
          <div key={it.id} className="space-y-2">
            <ItemRow
              item={it}
              busy={
                (actionBusy?.startsWith(`scan-${it.id}-`) ?? false) ||
                actionBusy === `link-${it.id}` ||
                actionBusy === `new-${it.id}`
              }
              onScan={(present) => onScanItem(it.id, present)}
              onPickContainer={() => openPicker(it)}
              caseId={id}
            />
            {pickerItemId === it.id && (
              <PalettePicker
                item={it}
                suppliers={suppliers}
                supplierId={pickerSupplierId}
                openContainers={openContainers}
                loading={pickerLoading}
                busy={
                  actionBusy === `link-${it.id}` || actionBusy === `new-${it.id}`
                }
                error={pickerError}
                onChooseSupplier={chooseSupplier}
                onLinkToContainer={linkToContainer}
                onCreatePaletteAndLink={createPaletteAndLink}
                onClose={closePicker}
              />
            )}
          </div>
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
  onPickContainer,
  caseId,
}: {
  item: PdaItem;
  busy: boolean;
  onScan: (present: boolean) => void;
  onPickContainer: () => void;
  caseId: string;
}) {
  const isReceived = item.status === "received";
  const isAssessed = item.status === "assessed";
  const isOnPallet = item.status === "on_pallet";
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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.source !== "registered" && (
              <span className="text-[10px] bg-[#ff6600]/30 text-[#ff6600] px-1.5 py-0.5 rounded uppercase">
                {item.source}
              </span>
            )}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                isOnPallet
                  ? "bg-blue-500/30 text-blue-200"
                  : isAssessed
                  ? "bg-purple-500/30 text-purple-200"
                  : isReceived
                  ? "bg-green-500/30 text-green-200"
                  : isMissing
                  ? "bg-red-500/30 text-red-200"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {item.status}
            </span>
            {item.verdict && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                  item.verdict === "green"
                    ? "bg-green-500/30 text-green-200"
                    : item.verdict === "yellow"
                    ? "bg-yellow-500/30 text-yellow-100"
                    : "bg-red-500/30 text-red-200"
                }`}
              >
                ● {item.verdict}
              </span>
            )}
            {item.containerCode && (
              <span className="text-[10px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded font-mono">
                {item.containerCode}
              </span>
            )}
          </div>
        </div>
        {item.gesamtpreis_brutto !== null && (
          <span className="text-sm font-mono text-white/70 shrink-0">
            {item.gesamtpreis_brutto.toFixed(2).replace(".", ",")} €
          </span>
        )}
      </div>

      {!isReceived && !isMissing && !isAssessed && !isOnPallet && (
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
          → Bewertung &amp; Fotos
        </a>
      )}

      {isAssessed && (
        <button
          onClick={onPickContainer}
          disabled={busy}
          className="w-full bg-[#ff6600] text-white text-sm font-semibold py-3 rounded-lg active:bg-[#ff7a26] disabled:opacity-40"
        >
          → Auf Palette legen
        </button>
      )}
    </div>
  );
}

/**
 * Inline-Picker für die Container-Auswahl. Erscheint unter dem Item nach
 * Tap auf "→ Auf Palette legen". Stufen:
 *   1. Falls Item noch keinen Supplier → Lieferanten-Liste zeigen
 *   2. Falls Supplier gewählt (oder vom Item geerbt) → offene Container
 *      dieses Suppliers + Option "Neue Palette anlegen"
 */
function PalettePicker({
  item,
  suppliers,
  supplierId,
  openContainers,
  loading,
  busy,
  error,
  onChooseSupplier,
  onLinkToContainer,
  onCreatePaletteAndLink,
  onClose,
}: {
  item: PdaItem;
  suppliers: Supplier[];
  supplierId: string | null;
  openContainers: OpenContainer[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  onChooseSupplier: (id: string) => void;
  onLinkToContainer: (containerId: string) => void;
  onCreatePaletteAndLink: () => void;
  onClose: () => void;
}) {
  const chosenSupplier = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="bg-white/10 border border-[#ff6600]/40 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#ff6600] uppercase tracking-wider">
          Auf Palette legen
        </p>
        <button
          onClick={onClose}
          className="text-xs text-white/60 underline"
        >
          Abbrechen
        </button>
      </div>

      {!supplierId && (
        <div className="space-y-2">
          <p className="text-xs text-white/70">
            An welchen Lieferanten geht dieser Artikel zurück?
          </p>
          {suppliers.length === 0 ? (
            <p className="text-xs text-yellow-200 bg-yellow-500/15 rounded p-2">
              Keine Lieferanten gepflegt. Bitte erst im Admin-Dashboard
              unter <span className="font-mono">/admin/suppliers</span> anlegen.
            </p>
          ) : (
            suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => onChooseSupplier(s.id)}
                className="w-full bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-left py-3 px-4 rounded-lg font-semibold text-sm"
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      )}

      {supplierId && (
        <div className="space-y-2">
          <p className="text-xs text-white/70">
            Lieferant:{" "}
            <span className="text-white font-semibold">
              {chosenSupplier?.name ?? supplierId}
            </span>
          </p>

          {loading ? (
            <p className="text-xs text-white/50 italic">Container laden…</p>
          ) : openContainers.length === 0 ? (
            <p className="text-xs text-white/60">
              Keine offene Palette für {chosenSupplier?.name ?? "diesen Lieferanten"}.
              Neue Palette anlegen?
            </p>
          ) : (
            <div className="space-y-1">
              {openContainers.map((cc) => (
                <button
                  key={cc.id}
                  onClick={() => onLinkToContainer(cc.id)}
                  disabled={busy}
                  className="w-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-white text-left py-3 px-4 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-2"
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
            onClick={onCreatePaletteAndLink}
            disabled={busy}
            className="w-full bg-[#ff6600] hover:bg-[#ff7a26] active:bg-[#e85f00] text-white font-semibold py-3 rounded-lg text-sm disabled:opacity-40 mt-2"
          >
            {busy
              ? "Lege an…"
              : `+ Neue Palette für ${chosenSupplier?.name ?? "Lieferant"}`}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-2 text-xs">
          {error}
        </div>
      )}

      <p className="text-[10px] text-white/40">
        Item: {[item.artikelnummer, item.hersteller].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
