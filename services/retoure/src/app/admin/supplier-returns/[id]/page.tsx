export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Truck, PackageCheck, CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { SupplierReturnStatusBadge } from "@/components/supplier-return-status-badge";
import {
  markShippedAction,
  markReceivedAction,
  markRefundedAction,
  markRejectedAction,
  updateNotesAction,
} from "../actions";

/**
 * Detail-Ansicht einer Lieferanten-Retoure.
 *
 * Zeigt Lieferanten-Block, Container-Code, Tracking-Status und kontext-
 * sensitive Status-Buttons:
 *   - status=vorbereitet:           → "Versandt setzen"
 *   - status=versandt:               → "Bei Lieferant"
 *   - status=bei_lieferant:          → "Gutschrift erhalten" / "Ablehnen"
 *   - Endzustände (gutschrift/abgelehnt): keine Aktionen.
 */
export default async function SupplierReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ret = await prisma.supplierReturn.findUnique({
    where: { id },
    include: { supplier: true },
  });
  if (!ret) notFound();

  const isVorbereitet = ret.status === "vorbereitet";
  const isVersandt = ret.status === "versandt";
  const isBeiLieferant = ret.status === "bei_lieferant";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/admin/supplier-returns"
          className="inline-flex items-center gap-1 text-sm text-[#8a93a0] hover:text-[#0b3756]"
        >
          <ChevronLeft className="w-4 h-4" /> Zurück zur Liste
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#0b3756]">
            Lieferanten-Retoure
          </h1>
          <SupplierReturnStatusBadge status={ret.status} />
        </div>
        <p className="text-sm text-[#8a93a0] mt-1 font-mono">{ret.id}</p>
      </div>

      {/* Lieferant + Eckdaten */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Lieferant">
          <Link
            href={`/admin/suppliers/${ret.supplier.id}`}
            className="text-lg font-semibold text-[#0b3756] hover:underline"
          >
            {ret.supplier.name}
          </Link>
          <DetailLine label="Kontakt" value={ret.supplier.contactPerson} />
          <DetailLine label="E-Mail" value={ret.supplier.email} />
          <DetailLine label="Telefon" value={ret.supplier.phone} />
          <DetailLine
            label="Adresse"
            value={
              [
                ret.supplier.street,
                [ret.supplier.postalCode, ret.supplier.city]
                  .filter(Boolean)
                  .join(" "),
                ret.supplier.country,
              ]
                .filter(Boolean)
                .join(", ") || null
            }
          />
          {ret.supplier.rmaPolicy && (
            <div className="mt-3 p-3 bg-[#f4f5f7] rounded-lg">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#8a93a0] mb-1">
                RMA-Policy
              </div>
              <div className="text-sm text-[#3d4654] whitespace-pre-wrap">
                {ret.supplier.rmaPolicy}
              </div>
            </div>
          )}
        </Card>

        <Card title="Retoure">
          <DetailLine label="Container" value={ret.containerId} mono />
          <DetailLine label="Tracking" value={ret.trackingNumber} mono />
          <DetailLine
            label="Angelegt"
            value={ret.createdAt.toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          <DetailLine
            label="Versandt"
            value={
              ret.shippedAt
                ? ret.shippedAt.toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null
            }
          />
          <DetailLine
            label="Eingang Lieferant"
            value={
              ret.receivedAt
                ? ret.receivedAt.toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null
            }
          />
          <DetailLine
            label="Gutschrift am"
            value={
              ret.refundedAt
                ? ret.refundedAt.toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : null
            }
          />
          <DetailLine
            label="Gutschrift-Betrag"
            value={
              ret.refundAmount != null
                ? `${ret.refundAmount.toFixed(2).replace(".", ",")} €`
                : null
            }
          />
        </Card>
      </section>

      {/* Status-Buttons */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8a93a0] mb-3">
          Status-Aktionen
        </h2>
        <div className="bg-white rounded-xl border border-[#e6e8eb] p-4 space-y-4">
          {isVorbereitet && (
            <form
              action={markShippedAction}
              className="flex flex-col md:flex-row md:items-end gap-3"
            >
              <input type="hidden" name="id" value={ret.id} />
              <label className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a93a0]">
                  Tracking-Nummer <span className="text-[#ff6600]">*</span>
                </span>
                <input
                  autoFocus
                  name="trackingNumber"
                  required
                  maxLength={80}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40 font-mono"
                  placeholder="z. B. 1Z999AA10123456784"
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00] whitespace-nowrap"
              >
                <Truck className="w-4 h-4" /> Versandt setzen
              </button>
            </form>
          )}

          {isVersandt && (
            <form action={markReceivedAction}>
              <input type="hidden" name="id" value={ret.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00]"
              >
                <PackageCheck className="w-4 h-4" /> Bei Lieferant eingegangen
              </button>
            </form>
          )}

          {isBeiLieferant && (
            <div className="space-y-3">
              <form
                action={markRefundedAction}
                className="flex flex-col md:flex-row md:items-end gap-3"
              >
                <input type="hidden" name="id" value={ret.id} />
                <label className="flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a93a0]">
                    Gutschrift-Betrag (€){" "}
                    <span className="text-[#ff6600]">*</span>
                  </span>
                  <input
                    autoFocus
                    name="refundAmount"
                    required
                    inputMode="decimal"
                    pattern="[0-9]+([,\.][0-9]{1,2})?"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40 font-mono"
                    placeholder="z. B. 123,45"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00] whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" /> Gutschrift erhalten
                </button>
              </form>

              <form action={markRejectedAction} className="flex items-end gap-3">
                <input type="hidden" name="id" value={ret.id} />
                <input type="hidden" name="notes" value={ret.notes ?? ""} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4" /> Vom Lieferant abgelehnt
                </button>
              </form>
            </div>
          )}

          {!isVorbereitet && !isVersandt && !isBeiLieferant && (
            <p className="text-sm text-[#8a93a0]">
              Diese Retoure ist im Endzustand "
              {ret.status === "gutschrift_erhalten"
                ? "Gutschrift erhalten"
                : "Abgelehnt"}
              " — keine weiteren Status-Übergänge möglich.
            </p>
          )}
        </div>
      </section>

      {/* Notizen */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8a93a0] mb-3">
          Notizen
        </h2>
        <form
          action={updateNotesAction}
          className="bg-white rounded-xl border border-[#e6e8eb] p-4 space-y-3"
        >
          <input type="hidden" name="id" value={ret.id} />
          <textarea
            name="notes"
            rows={4}
            defaultValue={ret.notes ?? ""}
            className="w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm text-[#3d4654] focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40 resize-y"
            placeholder="z. B. Begleitschein-Nr., RMA-Referenz des Herstellers, Sonderabsprachen ..."
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#0b3756] text-white text-sm font-medium rounded-lg hover:bg-[#0e3f63]"
            >
              Speichern
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#e6e8eb] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8a93a0] mb-3">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailLine({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-32 shrink-0 text-xs text-[#8a93a0]">{label}</span>
      <span
        className={`${mono ? "font-mono text-xs" : ""} text-[#3d4654]`}
      >
        {value && value.trim() !== "" ? value : <span className="text-[#8a93a0]">—</span>}
      </span>
    </div>
  );
}
