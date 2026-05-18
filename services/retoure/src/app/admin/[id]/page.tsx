export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Package,
  Truck,
  User,
  Mail,
  Phone,
  Hash,
  MapPin,
  Clock,
  StickyNote,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { StatusBadge, STATUSES, STATUS_META } from "@/components/status-badge";
import {
  updateStatusAction,
  addNoteAction,
  setCustomerTrackingAction,
} from "./actions";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await prisma.retoureCase.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) notFound();

  type Item = {
    artikelnummer?: string;
    hersteller?: string;
    beschreibung?: string;
    menge: number;
    grund: string;
    einzelpreis_brutto?: number;
    gesamtpreis_brutto?: number;
    einzelgewicht_g?: number;
    source?: string;
    status?: string;
    verdict?: string | null;
  };

  // Items aus der echten RetoureItem-Tabelle.
  // Bei sehr alten Cases noch ohne Item-Rows: Fallback auf JSON-Snapshot.
  let items: Item[];
  if (c.items.length > 0) {
    items = c.items.map((it) => ({
      artikelnummer: it.artikelnummer ?? undefined,
      hersteller: it.hersteller ?? undefined,
      beschreibung: it.beschreibung ?? undefined,
      menge: it.menge,
      grund: it.grund ?? "",
      einzelpreis_brutto: it.einzelpreis_brutto ?? undefined,
      gesamtpreis_brutto: it.gesamtpreis_brutto ?? undefined,
      einzelgewicht_g: it.einzelgewicht_g ?? undefined,
      source: it.source,
      status: it.status,
      verdict: it.verdict,
    }));
  } else {
    try {
      items = JSON.parse(c.itemsJson) as Item[];
    } catch {
      items = [];
    }
  }

  const customer = [c.customerVorname, c.customerName].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="text-sm text-[#0b3756] hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Alle Cases
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.status} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e6e8eb] p-5">
        <p className="text-xs text-[#8a93a0] uppercase tracking-wide font-semibold">
          Retoure
        </p>
        <p className="font-mono text-2xl font-bold text-[#0b3756] mt-1">
          {c.bestellnummer}
        </p>
        <p className="text-xs text-[#8a93a0] mt-1">
          Angemeldet am{" "}
          {c.createdAt.toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {c.belegnummer && (
            <>
              {" "}
              · Belegnummer{" "}
              <span className="font-mono">{c.belegnummer}</span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: items + customer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <section className="bg-white rounded-xl border border-[#e6e8eb] p-5">
            <h2 className="font-semibold text-[#0b3756] mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Kunde
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <Field label="Name" value={[c.customerAnrede, customer].filter(Boolean).join(" ")} />
              <Field
                label="Email"
                value={c.customerEmail}
                icon={<Mail className="w-3 h-3" />}
              />
              <Field
                label="Adresse"
                value={[
                  c.customerStrasse,
                  [c.customerPlz, c.customerOrt].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(", ")}
                icon={<MapPin className="w-3 h-3" />}
              />
              <Field
                label="Telefon"
                value={c.customerTelefon || c.customerHandy}
                icon={<Phone className="w-3 h-3" />}
              />
            </div>
          </section>

          {/* Items */}
          <section className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e6e8eb] flex items-center gap-2">
              <Package className="w-4 h-4 text-[#0b3756]" />
              <h2 className="font-semibold text-[#0b3756]">
                Zurückzusendende Artikel ({items.length})
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[#f4f5f7] text-xs uppercase tracking-wide text-[#8a93a0]">
                <tr>
                  <th className="px-4 py-2 text-left">Menge</th>
                  <th className="px-4 py-2 text-left">Artikel</th>
                  <th className="px-4 py-2 text-left">Grund</th>
                  <th className="px-4 py-2 text-right">Summe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8eb]">
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-semibold text-[#0b3756]">
                      {it.menge}x
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#3d4654]">{it.beschreibung}</p>
                      <p className="text-xs text-[#8a93a0] mt-0.5">
                        {[it.artikelnummer, it.hersteller].filter(Boolean).join(" · ")}
                        {it.einzelgewicht_g
                          ? ` · ${(it.einzelgewicht_g / 1000).toFixed(2).replace(".", ",")} kg/Stk`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#3d4654]">{it.grund}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#3d4654]">
                      {(it.gesamtpreis_brutto ?? 0).toFixed(2).replace(".", ",")} €
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#f4f5f7]">
                <tr>
                  <td className="px-4 py-2 text-sm" colSpan={3}>
                    <span className="text-[#3d4654]">Warenwert</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-[#3d4654]">
                    {c.warenwertBrutto.toFixed(2).replace(".", ",")} €
                  </td>
                </tr>
                {c.labelFeeBrutto > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-sm" colSpan={3}>
                      <span className="text-[#3d4654]">DHL-Label-Kosten</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-red-700">
                      – {c.labelFeeBrutto.toFixed(2).replace(".", ",")} €
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-3 font-semibold text-[#0b3756]" colSpan={3}>
                    Voraussichtliche Erstattung
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-lg text-[#0b3756]">
                    {c.voraussichtlicheErstattung.toFixed(2).replace(".", ",")} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Timeline */}
          <section className="bg-white rounded-xl border border-[#e6e8eb] p-5">
            <h2 className="font-semibold text-[#0b3756] mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Timeline ({c.events.length})
            </h2>
            <ul className="space-y-3">
              {c.events.map((e) => (
                <li
                  key={e.id}
                  className="flex gap-3 text-sm border-l-2 border-[#ff6600] pl-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#ff6600] uppercase">
                        {e.type}
                      </span>
                      <span className="text-xs text-[#8a93a0]">
                        {e.createdAt.toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-xs text-[#8a93a0]">· {e.actor}</span>
                    </div>
                    {e.message && (
                      <p className="text-[#3d4654] mt-0.5">{e.message}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right: actions + tracking + meta */}
        <aside className="space-y-6">
          {/* Status change */}
          <section className="bg-white rounded-xl border border-[#e6e8eb] p-5 space-y-3">
            <h2 className="font-semibold text-[#0b3756]">Status ändern</h2>
            <form action={updateStatusAction} className="space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <select
                name="status"
                defaultValue={c.status}
                className="w-full px-3 py-2 border border-[#e6e8eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="message"
                placeholder="Notiz zum Statuswechsel (optional)"
                className="w-full px-3 py-2 border border-[#e6e8eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#ff6600] text-white text-sm font-semibold rounded-lg hover:bg-[#ff7a26]"
              >
                Speichern
              </button>
            </form>
          </section>

          {/* Tracking */}
          <section className="bg-white rounded-xl border border-[#e6e8eb] p-5 space-y-3">
            <h2 className="font-semibold text-[#0b3756] flex items-center gap-2">
              <Truck className="w-4 h-4" /> Versand
            </h2>
            <div className="text-sm space-y-2">
              <Field
                label="Modus"
                value={
                  c.shippingMode === "sicher"
                    ? "Sichere Rückgabe"
                    : "Standard"
                }
              />
              <Field
                label="Label über uns"
                value={
                  c.labelRequested
                    ? c.labelPaid
                      ? `Ja (5,50 € abgezogen)`
                      : "Ja (kostenfrei)"
                    : "Nein"
                }
              />
              {c.weightSentKg && (
                <Field
                  label="Gewicht an DHL"
                  value={`${c.weightSentKg.toFixed(2).replace(".", ",")} kg`}
                />
              )}
              {c.dhlTrackingNumber ? (
                <div>
                  <p className="text-xs text-[#8a93a0]">DHL-Tracking</p>
                  <a
                    href={`https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${c.dhlTrackingNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-[#ff6600] hover:underline inline-flex items-center gap-1"
                  >
                    {c.dhlTrackingNumber}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {c.dhlShipmentId && (
                    <p className="text-xs text-[#8a93a0] mt-1">
                      dodajpaczke ID: {c.dhlShipmentId}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#8a93a0]">Kein DHL-Label über uns.</p>
              )}
            </div>

            <form action={setCustomerTrackingAction} className="pt-3 border-t border-[#e6e8eb] space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <label className="text-xs text-[#8a93a0]">
                Kunden-Tracking-Nummer (selbst versendet)
              </label>
              <input
                type="text"
                name="tracking"
                defaultValue={c.customerTrackingNumber ?? ""}
                placeholder="z.B. 1234567890"
                className="w-full px-3 py-2 border border-[#e6e8eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40 font-mono"
              />
              <button
                type="submit"
                className="w-full px-3 py-1.5 bg-[#0b3756] text-white text-xs rounded-lg hover:bg-[#0e3f63]"
              >
                Speichern
              </button>
            </form>
          </section>

          {/* Add note */}
          <section className="bg-white rounded-xl border border-[#e6e8eb] p-5">
            <h2 className="font-semibold text-[#0b3756] mb-3 flex items-center gap-2">
              <StickyNote className="w-4 h-4" /> Notiz hinzufügen
            </h2>
            <form action={addNoteAction} className="space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <textarea
                name="note"
                rows={3}
                required
                placeholder="Interne Notiz..."
                className="w-full px-3 py-2 border border-[#e6e8eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#0b3756] text-white text-sm rounded-lg hover:bg-[#0e3f63]"
              >
                Notiz speichern
              </button>
            </form>
          </section>

          {/* Meta */}
          <section className="bg-white rounded-xl border border-[#e6e8eb] p-5 text-xs space-y-1 text-[#8a93a0]">
            <p>
              <span className="text-[#3d4654] font-mono">Case-ID:</span>{" "}
              {c.id}
            </p>
            {c.belegId && (
              <p>
                <span className="text-[#3d4654] font-mono">Abisco Beleg-ID:</span>{" "}
                {c.belegId}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-[#8a93a0]">{label}</p>
      <p className="text-sm text-[#3d4654] flex items-center gap-1">
        {icon}
        {value || <span className="text-[#8a93a0]">—</span>}
      </p>
    </div>
  );
}
