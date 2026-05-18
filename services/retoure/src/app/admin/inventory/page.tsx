export const dynamic = "force-dynamic";

import Link from "next/link";
import { Boxes, Search, Package, Factory, Truck, CheckCircle2, XCircle } from "lucide-react";
import { getInventorySummary, findItemsByArtikelnummer } from "@/lib/inventory";

interface SearchParams {
  q?: string;
}

const BUCKET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  im_versand: Truck,
  eingang_partner_offen: Package,
  auf_palette_offen: Boxes,
  palette_geschlossen: Boxes,
  unterwegs_zum_lieferanten: Truck,
  beim_lieferanten: Factory,
  erstattet: CheckCircle2,
  abgelehnt: XCircle,
};

const BUCKET_COLORS: Record<string, string> = {
  im_versand: "bg-blue-100 text-blue-800",
  eingang_partner_offen: "bg-purple-100 text-purple-800",
  auf_palette_offen: "bg-yellow-100 text-yellow-800",
  palette_geschlossen: "bg-amber-100 text-amber-800",
  unterwegs_zum_lieferanten: "bg-cyan-100 text-cyan-800",
  beim_lieferanten: "bg-indigo-100 text-indigo-800",
  erstattet: "bg-green-100 text-green-800",
  abgelehnt: "bg-red-100 text-red-800",
};

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const [buckets, searchResults] = await Promise.all([
    getInventorySummary(),
    q ? findItemsByArtikelnummer(q) : Promise.resolve([]),
  ]);

  const totalItems = buckets.reduce((s, b) => s + b.itemCount, 0);
  const totalWarenwert = buckets.reduce((s, b) => s + b.warenwertBrutto, 0);
  const ekShown = buckets.some((b) => b.ekWertBrutto !== null && b.ekWertBrutto > 0);
  const totalEk = ekShown
    ? buckets.reduce((s, b) => s + (b.ekWertBrutto ?? 0), 0)
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#0b3756]">Inventory</h1>
        <p className="text-sm text-[#8a93a0] mt-1">
          Wo ist welche Ware aktuell? — Live-Aggregation aus allen Cases, Containern und Lieferanten-Retouren.
        </p>
      </header>

      {/* Summary-Tiles */}
      <div className="bg-white rounded-xl border border-[#e6e8eb] p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-[#8a93a0] uppercase tracking-wide">Items insgesamt</p>
            <p className="text-2xl font-bold text-[#0b3756] mt-1">{totalItems}</p>
          </div>
          <div>
            <p className="text-xs text-[#8a93a0] uppercase tracking-wide">Warenwert Brutto</p>
            <p className="text-2xl font-bold text-[#0b3756] mt-1">{fmtEur(totalWarenwert)}</p>
          </div>
          <div>
            <p className="text-xs text-[#8a93a0] uppercase tracking-wide">EK-Wert Brutto</p>
            <p className="text-2xl font-bold text-[#0b3756] mt-1">
              {totalEk !== null ? fmtEur(totalEk) : "—"}
            </p>
            {totalEk === null && (
              <p className="text-[10px] text-[#8a93a0] mt-0.5">
                Noch keine EK-Preise gepflegt
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {buckets.map((b) => {
          const Icon = BUCKET_ICONS[b.key] ?? Boxes;
          return (
            <div
              key={b.key}
              className="bg-white rounded-xl border border-[#e6e8eb] p-4 flex items-start gap-3"
            >
              <span
                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${
                  BUCKET_COLORS[b.key] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0b3756]">{b.label}</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <p className="text-2xl font-bold text-[#3d4654]">{b.itemCount}</p>
                  <p className="text-sm text-[#8a93a0]">{fmtEur(b.warenwertBrutto)}</p>
                </div>
                {b.ekWertBrutto !== null && b.ekWertBrutto > 0 && (
                  <p className="text-xs text-[#8a93a0] mt-0.5">
                    EK: {fmtEur(b.ekWertBrutto)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Artikel-Suche */}
      <section className="bg-white rounded-xl border border-[#e6e8eb] p-5 space-y-3">
        <h2 className="font-semibold text-[#0b3756] flex items-center gap-2">
          <Search className="w-4 h-4" /> Artikel suchen
        </h2>
        <form className="flex gap-2" method="GET">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Artikelnummer eingeben…"
            className="flex-1 px-3 py-2 border border-[#e6e8eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#0b3756] text-white text-sm rounded-lg hover:bg-[#0e3f63]"
          >
            Suchen
          </button>
        </form>

        {q && (
          <div className="pt-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-[#8a93a0] italic">Keine Treffer für "{q}"</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#f4f5f7] text-xs uppercase tracking-wide text-[#8a93a0]">
                  <tr>
                    <th className="px-3 py-2 text-left">Artikel</th>
                    <th className="px-3 py-2 text-left">Bestellung</th>
                    <th className="px-3 py-2 text-left">Kunde</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Container</th>
                    <th className="px-3 py-2 text-right">Wert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e8eb]">
                  {searchResults.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs text-[#0b3756] font-semibold">
                          {it.artikelnummer}
                        </div>
                        <div className="text-xs text-[#8a93a0]">{it.beschreibung}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/${it.case.id}`}
                          className="text-[#ff6600] hover:underline text-xs font-mono"
                        >
                          {it.case.bestellnummer}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {[it.case.customerVorname, it.case.customerName]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#e6e8eb] text-[#3d4654] font-semibold">
                          {it.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {it.container ? (
                          <Link
                            href={`/admin/containers/${it.container.id}`}
                            className="text-xs font-mono text-[#0b3756] hover:underline"
                          >
                            {it.container.code}
                          </Link>
                        ) : (
                          <span className="text-xs text-[#8a93a0]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">
                        {it.gesamtpreis_brutto !== null
                          ? fmtEur(it.gesamtpreis_brutto)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
