export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Printer,
  Lock,
  StickyNote,
  Clock,
  Package,
} from "lucide-react";
import { prisma } from "@/lib/db";
import {
  closeContainerAction,
  reprintContainerLabelAction,
  updateContainerNotesAction,
} from "./actions";

/** Status-Meta wie auf der Liste — kompakt dupliziert, sonst Cross-Imports. */
const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Offen", bg: "bg-blue-100", text: "text-blue-800" },
  closed: { label: "Geschlossen", bg: "bg-amber-100", text: "text-amber-800" },
  shipped: { label: "Versandt", bg: "bg-purple-100", text: "text-purple-800" },
  received_supplier: {
    label: "Beim Lieferanten",
    bg: "bg-green-100",
    text: "text-green-800",
  },
};

const TYPE_LABEL: Record<string, string> = {
  palette: "Palette",
  carton: "Karton",
  bag: "Beutel",
};

const VERDICT_META: Record<string, { label: string; bg: string; text: string }> = {
  green: { label: "Grün", bg: "bg-green-100", text: "text-green-800" },
  yellow: { label: "Gelb", bg: "bg-yellow-100", text: "text-yellow-800" },
  red: { label: "Rot", bg: "bg-red-100", text: "text-red-800" },
};

export default async function ContainerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await prisma.container.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          case: {
            select: {
              id: true,
              bestellnummer: true,
              customerVorname: true,
              customerName: true,
            },
          },
        },
      },
    },
  });
  if (!c) notFound();

  const meta = STATUS_META[c.status] ?? {
    label: c.status,
    bg: "bg-gray-100",
    text: "text-gray-700",
  };
  const now = Date.now();
  const isOpen = c.status === "open";
  const overdue =
    isOpen && c.maxOpenUntil != null && c.maxOpenUntil.getTime() < now;
  const soonOverdue =
    isOpen &&
    !overdue &&
    c.maxOpenUntil != null &&
    c.maxOpenUntil.getTime() < now + 2 * 24 * 60 * 60 * 1000;
  const printerConfigured = Boolean(process.env.PRINTER_HOST?.trim());

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/admin/containers"
          className="inline-flex items-center gap-1.5 text-sm text-[#8a93a0] hover:text-[#0b3756]"
        >
          <ArrowLeft className="w-4 h-4" /> Container-Liste
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-[#e6e8eb] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="w-5 h-5 text-[#0b3756]" />
              <h1 className="text-xl font-bold text-[#0b3756] font-mono">
                {c.code}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${meta.bg} ${meta.text}`}
              >
                {meta.label}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-red-100 text-red-800">
                  Überfällig
                </span>
              )}
              {soonOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-[#ff6600]/15 text-[#ff6600]">
                  Bald überfällig
                </span>
              )}
            </div>
            <div className="text-sm text-[#3d4654]">
              {TYPE_LABEL[c.type] ?? c.type}
              {c.partnerId && (
                <>
                  {" · "}
                  <span className="text-[#0b3756] font-medium">
                    {c.partnerId}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-[#8a93a0] space-y-0.5">
            <div>
              Geöffnet:{" "}
              <span className="text-[#3d4654]">
                {c.openedAt.toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {c.maxOpenUntil && (
              <div>
                Max. offen bis:{" "}
                <span className="text-[#3d4654]">
                  {c.maxOpenUntil.toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {c.closedAt && (
              <div>
                Geschlossen:{" "}
                <span className="text-[#3d4654]">
                  {c.closedAt.toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {c.createdByPda && (
              <div>
                Angelegt von:{" "}
                <span className="text-[#3d4654]">{c.createdByPda}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body: Items table + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Items */}
        <div className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e6e8eb] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0b3756] inline-flex items-center gap-2">
              <Package className="w-4 h-4" /> Verlinkte Artikel
              <span className="text-[#8a93a0] font-normal">
                ({c.items.length})
              </span>
            </h2>
          </div>
          {c.items.length === 0 ? (
            <div className="p-10 text-center">
              <Package className="w-10 h-10 mx-auto text-[#8a93a0] mb-2" />
              <p className="text-sm text-[#3d4654]">Noch keine Artikel</p>
              <p className="text-xs text-[#8a93a0] mt-1">
                Mitarbeiter linkt Artikel über die PDA-App auf diesen Container.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#f4f5f7] border-b border-[#e6e8eb]">
                <tr className="text-left text-xs font-semibold text-[#8a93a0] uppercase tracking-wide">
                  <th className="px-4 py-3">Artikel-Nr.</th>
                  <th className="px-4 py-3">Beschreibung</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3">Case</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e8eb]">
                {c.items.map((it) => {
                  const verdict = it.verdict
                    ? VERDICT_META[it.verdict]
                    : undefined;
                  return (
                    <tr key={it.id} className="hover:bg-[#f4f5f7]/60">
                      <td className="px-4 py-3 font-mono text-xs text-[#3d4654]">
                        {it.artikelnummer ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#3d4654]">
                        <div className="font-medium">
                          {it.beschreibung ?? "—"}
                        </div>
                        {it.hersteller && (
                          <div className="text-[10px] text-[#8a93a0]">
                            {it.hersteller}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#3d4654]">
                        {it.source}
                      </td>
                      <td className="px-4 py-3">
                        {verdict ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${verdict.bg} ${verdict.text}`}
                          >
                            {verdict.label}
                          </span>
                        ) : (
                          <span className="text-xs text-[#8a93a0]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Link
                          href={`/admin/${it.case.id}`}
                          className="font-mono text-[#0b3756] hover:underline"
                        >
                          {it.case.bestellnummer}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Re-Print */}
          <div className="bg-white rounded-xl border border-[#e6e8eb] p-4">
            <h3 className="text-xs font-semibold text-[#0b3756] uppercase tracking-wide mb-3 inline-flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Label
            </h3>
            <form action={reprintContainerLabelAction}>
              <input type="hidden" name="id" value={c.id} />
              <button
                type="submit"
                disabled={!printerConfigured}
                className="w-full px-3 py-2 bg-[#0b3756] text-white text-sm rounded-lg hover:bg-[#0e3f63] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Label erneut drucken
              </button>
              {!printerConfigured && (
                <p className="text-[10px] text-[#8a93a0] mt-2">
                  PRINTER_HOST nicht konfiguriert
                </p>
              )}
            </form>
          </div>

          {/* Close */}
          {isOpen && (
            <div className="bg-white rounded-xl border border-[#e6e8eb] p-4">
              <h3 className="text-xs font-semibold text-[#0b3756] uppercase tracking-wide mb-3 inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Container schließen
              </h3>
              <p className="text-xs text-[#8a93a0] mb-3">
                Nach dem Schließen können keine weiteren Artikel mehr auf diesen
                Container gelegt werden.
              </p>
              <form action={closeContainerAction}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="w-full px-3 py-2 bg-[#ff6600] text-white text-sm rounded-lg hover:bg-[#e65a00]"
                >
                  Container schließen
                </button>
              </form>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-xl border border-[#e6e8eb] p-4">
            <h3 className="text-xs font-semibold text-[#0b3756] uppercase tracking-wide mb-3 inline-flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Notizen
            </h3>
            <form action={updateContainerNotesAction} className="space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <textarea
                name="notes"
                defaultValue={c.notes ?? ""}
                rows={4}
                placeholder="Interne Notiz zum Container…"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#e6e8eb] bg-white focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
              />
              <button
                type="submit"
                className="w-full px-3 py-2 bg-white border border-[#e6e8eb] text-[#3d4654] text-sm rounded-lg hover:bg-[#f4f5f7]"
              >
                Notizen speichern
              </button>
            </form>
          </div>

          {/* Meta */}
          <div className="bg-white rounded-xl border border-[#e6e8eb] p-4 text-xs space-y-1.5 text-[#3d4654]">
            <div className="inline-flex items-center gap-1.5 text-[#0b3756] font-semibold mb-2">
              <Clock className="w-3.5 h-3.5" /> Lebenszyklus
            </div>
            <div>
              <span className="text-[#8a93a0]">Status:</span> {meta.label}
            </div>
            {c.shippedTrackingNumber && (
              <div>
                <span className="text-[#8a93a0]">Tracking:</span>{" "}
                <span className="font-mono">{c.shippedTrackingNumber}</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
