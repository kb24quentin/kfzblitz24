"use client";

import { useState } from "react";
import {
  Package,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Trash2,
  MapPin,
  Undo2,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

type BelegPosition = {
  id?: number;
  typ?: string;
  artikelnummer?: string;
  hersteller?: string;
  herstellernummer?: string;
  beschreibung?: string;
  menge?: number;
  einzelpreis_brutto?: number;
  positionspreis_brutto?: number;
  status?: string;
};

type BelegAddress = {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
  telefon?: string;
};

type Beleg = {
  typ?: string;
  belegnummer?: string;
  belegdatum?: string;
  status?: string;
  bestellnummer?: string;
  endpreis_brutto?: number;
  endpreis_netto?: number;
  rechnungsadresse?: BelegAddress;
  lieferadresse?: BelegAddress;
  positionen?: BelegPosition[];
};

export type OrderCardData = {
  id: string;
  ref: string;
  note: string | null;
  source: string;
  emailMatched: boolean;
  status: string | null;
  totalBrutto: number | null;
  fetchedAt: string | null;
  createdAt: string;
  beleg: Beleg | null;
  retoureCaseId?: string | null;
  retoureAnmeldungUrl?: string | null;
  retoureLabelUrl?: string | null;
  retoureCreatedAt?: string | null;
  retoureFreeLabel?: boolean;
  lastLookupError?: string | null;
  lastLookupAt?: string | null;
};

/** Menschliche Übersetzung der Webisco-Error-Codes für die Sidebar. */
function humanizeLookupError(err: string | null): { title: string; hint: string } {
  if (!err) return { title: "Noch nicht aus Webisco geladen", hint: "Klick auf Refresh um zu laden." };
  if (err === "not_found") {
    return {
      title: "In Webisco nicht auffindbar",
      hint: "Wahrscheinlich Streckengeschäft/Marktplatz-Bestellung — solche Belege sind nicht in der öffentlichen Query-API indexiert. Details manuell im ERP prüfen.",
    };
  }
  if (err.startsWith("http_5") || err.startsWith("fetch_failed")) {
    return { title: "Webisco nicht erreichbar", hint: "Später erneut versuchen." };
  }
  if (err === "lookup_not_configured") {
    return { title: "Order-Lookup nicht konfiguriert", hint: "RETOURE_API_URL/TOKEN fehlt." };
  }
  return { title: "Lookup fehlgeschlagen", hint: err };
}

// Age-Gate laut Fachvorgabe: ab Zustellungsdatum.
// - Agent ohne Rückgabe+ → 14 Tage (BGB §312g Widerruf)
// - Agent mit Rückgabe+ → 30 Tage (Premium-Service)
// - Admin → 730 Tage (§437 Gewährleistung)
const AGENT_STANDARD_DAYS = 14;
const AGENT_RUECKGABE_PLUS_DAYS = 30;
const ADMIN_MAX_DAYS = 730;

const NON_RETURNABLE_TYPES = new Set([
  "versand",
  "zustellung",
  "rabatt",
  "textposition",
  "gutschrift",
]);

function detectSichereRueckgabe(beleg: Beleg | null): boolean {
  if (!beleg?.positionen) return false;
  const keywords = ["sichere rückgabe", "sichere rueckgabe", "gratis rücksendung", "rückgabe+"];
  return beleg.positionen
    .filter((p) => (p.typ ?? "").toLowerCase() === "zustellung")
    .some((z) => {
      const label = (z.beschreibung ?? "").toLowerCase();
      return keywords.some((k) => label.includes(k));
    });
}

function detectDeliveryDate(beleg: Beleg | null): Date | null {
  if (!beleg?.positionen) return beleg?.belegdatum ? new Date(beleg.belegdatum) : null;
  const times = beleg.positionen
    .map((p) => (p as { lieferdatum?: string }).lieferdatum)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map((s) => new Date(s).getTime())
    .filter((t) => !isNaN(t));
  if (times.length > 0) return new Date(Math.max(...times));
  return beleg.belegdatum ? new Date(beleg.belegdatum) : null;
}

export function OrderCard({
  order,
  isAdmin,
  pending,
  onRefresh,
  onRemove,
  onCreateRetoure,
}: {
  order: OrderCardData;
  isAdmin: boolean;
  pending: boolean;
  onRefresh: () => void;
  onRemove: () => void;
  onCreateRetoure: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const beleg = order.beleg;

  const belegDate = beleg?.belegdatum ? new Date(beleg.belegdatum) : null;
  const deliveryDate = detectDeliveryDate(beleg);
  const referenceDate = deliveryDate ?? belegDate;
  const hasRueckgabePlus = detectSichereRueckgabe(beleg);

  const ageDays = referenceDate
    ? Math.floor((Date.now() - referenceDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const maxDaysForAgent = hasRueckgabePlus ? AGENT_RUECKGABE_PLUS_DAYS : AGENT_STANDARD_DAYS;
  const maxDays = isAdmin ? ADMIN_MAX_DAYS : maxDaysForAgent;
  const isTooOld = ageDays !== null && ageDays > maxDays;
  const canRetoure = beleg !== null && !isTooOld;

  const fmtEur = (n: number | undefined | null) =>
    typeof n === "number" ? `${n.toFixed(2).replace(".", ",")} €` : "—";

  return (
    <div className="border border-border/60 rounded-lg p-2.5 text-sm bg-white/60">
      <div className="flex items-center justify-between gap-2 mb-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 flex-1 min-w-0 text-left hover:text-accent transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="font-mono text-text truncate">{order.ref}</span>
          {order.fetchedAt && order.emailMatched && (
            <span title="Email-Match bestätigt (Webisco)">
              <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" />
            </span>
          )}
          {order.fetchedAt && !order.emailMatched && (
            <span title="Bestellung existiert, aber Email stimmt nicht mit Kunde überein">
              <ShieldAlert className="w-3.5 h-3.5 text-warning shrink-0" />
            </span>
          )}
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onRefresh}
            disabled={pending}
            className="p-1 text-text-light hover:text-accent hover:bg-accent/10 rounded transition-colors"
            title="Aus Webisco neu laden"
          >
            <RefreshCw className={`w-3 h-3 ${pending ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onRemove}
            disabled={pending}
            className="p-1 text-text-light hover:text-danger hover:bg-danger/10 rounded transition-colors"
            title="Entfernen"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-light ml-4 mb-1 flex-wrap">
        {order.status && (
          <span className="px-1.5 py-0.5 bg-bg-secondary rounded font-medium">
            {order.status}
          </span>
        )}
        {order.totalBrutto !== null && (
          <span className="tabular-nums font-medium text-text">
            {fmtEur(order.totalBrutto)}
          </span>
        )}
        {belegDate && (
          <span title={format(belegDate, "PPPP", { locale: de })}>
            {format(belegDate, "dd.MM.yyyy")}
            {ageDays !== null && ` · vor ${ageDays}d`}
          </span>
        )}
        {hasRueckgabePlus && (
          <span
            title="Kunde hat Sichere Rückgabe / Rückgabe+ gebucht — 30-Tage-Frist + kostenfreies Label"
            className="px-1.5 py-0.5 bg-success/15 text-success rounded font-medium"
          >
            Rückgabe+
          </span>
        )}
      </div>

      {!order.fetchedAt && (() => {
        const diag = humanizeLookupError(order.lastLookupError ?? null);
        const isNotFound = order.lastLookupError === "not_found";
        return (
          <div
            className={`ml-4 mt-1 text-xs px-2 py-1.5 rounded ${
              isNotFound
                ? "bg-warning/10 text-warning border border-warning/30"
                : order.lastLookupError
                  ? "bg-danger/10 text-danger border border-danger/30"
                  : "text-text-light italic"
            }`}
          >
            <div className="font-medium">{diag.title}</div>
            <div className={isNotFound ? "opacity-80" : "text-text-light"}>{diag.hint}</div>
          </div>
        );
      })()}

      {order.note && (
        <div className="ml-4 text-xs text-text-light">— {order.note}</div>
      )}

      {expanded && beleg && (
        <div className="mt-2 ml-4 pl-3 border-l-2 border-accent/20 space-y-3">
          {beleg.lieferadresse && (
            <div>
              <div className="text-xs font-semibold text-text-light flex items-center gap-1 mb-0.5">
                <MapPin className="w-3 h-3" /> Lieferadresse
              </div>
              <div className="text-xs text-text leading-relaxed">
                <div>
                  {[beleg.lieferadresse.anrede, beleg.lieferadresse.vorname, beleg.lieferadresse.name]
                    .filter(Boolean)
                    .join(" ")}
                </div>
                <div>{beleg.lieferadresse.strasse}</div>
                <div>
                  {beleg.lieferadresse.plz} {beleg.lieferadresse.ort}
                  {beleg.lieferadresse.land && beleg.lieferadresse.land !== "DEU" && (
                    <span className="ml-1 text-text-light">({beleg.lieferadresse.land})</span>
                  )}
                </div>
                {beleg.lieferadresse.telefon && (
                  <div className="text-text-light">Tel: {beleg.lieferadresse.telefon}</div>
                )}
              </div>
            </div>
          )}

          {(beleg.positionen ?? []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-text-light mb-1">
                Positionen ({beleg.positionen?.length})
              </div>
              <div className="space-y-1.5">
                {beleg.positionen!.map((p, i) => (
                  <div
                    key={p.id ?? i}
                    className="text-xs bg-bg-secondary/50 rounded px-2 py-1.5"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="tabular-nums font-medium text-text w-6 shrink-0">
                        {p.menge}×
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-text truncate" title={p.beschreibung}>
                          {p.beschreibung || "—"}
                        </div>
                        <div className="text-text-light flex items-center gap-1 flex-wrap">
                          {p.hersteller && <span className="font-medium">{p.hersteller}</span>}
                          {p.artikelnummer && (
                            <span className="font-mono">{p.artikelnummer}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        {fmtEur(p.positionspreis_brutto)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 pt-1.5 border-t border-border/60 text-xs">
                <span className="text-text-light">Gesamt (brutto):</span>
                <span className="font-semibold text-text tabular-nums">
                  {fmtEur(beleg.endpreis_brutto)}
                </span>
              </div>
            </div>
          )}

          <div className="pt-1">
            {order.retoureCaseId ? (
              <div className="bg-success/10 border border-success/30 rounded p-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-success">
                  <ShieldCheck className="w-3.5 h-3.5" /> Retoure angelegt
                  {order.retoureFreeLabel && (
                    <span className="text-[10px] px-1 py-0.5 bg-warning/20 text-warning rounded">Rückgabe+</span>
                  )}
                </div>
                {order.retoureAnmeldungUrl && (
                  <a
                    href={order.retoureAnmeldungUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-accent hover:underline break-all"
                  >
                    ↓ Retoure-Anmeldung (PDF)
                  </a>
                )}
                {order.retoureLabelUrl && (
                  <a
                    href={order.retoureLabelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-accent hover:underline break-all"
                  >
                    ↓ DHL-Label (PDF)
                  </a>
                )}
              </div>
            ) : canRetoure ? (
              <button
                onClick={onCreateRetoure}
                disabled={pending}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded text-xs font-medium transition-colors"
              >
                <Undo2 className="w-3 h-3" /> Kundenretoure erstellen
              </button>
            ) : isTooOld ? (
              <div className="flex items-center gap-1.5 text-xs text-text-light bg-bg-secondary/60 rounded px-2 py-1.5">
                <Lock className="w-3 h-3" />
                {isAdmin
                  ? `Bestellung > ${ADMIN_MAX_DAYS}d alt (${ageDays}d)`
                  : `Zu alt (${ageDays}d, max ${maxDaysForAgent}d${
                      hasRueckgabePlus ? " mit Rückgabe+" : ""
                    }) — Admin bitten`}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
