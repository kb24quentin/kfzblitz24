"use client";

import { useState, useTransition } from "react";
import { Check, Building2, Car, AlertCircle } from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";
import { formatEur, type InvoicePosition } from "@/lib/money";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";
import { submitSignatureAction } from "@/app/app/auftraege/actions";

export function SignFlow({
  token,
  order,
  customer,
  vehicle,
  workshop,
  logoDataUrl,
}: {
  token: string;
  order: {
    id: string;
    orderNumber: string;
    approvedAmountCent: number;
    approvalFreetext: string;
    positions: any[];
    totalGrossCent: number;
    notes: string | null;
  };
  customer: any;
  vehicle: any;
  workshop: {
    name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
    contactEmail: string;
    contactPhone: string | null;
    brandPrimary: string | null;
  };
  logoDataUrl: string | null;
}) {
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const labor = (order.positions as InvoicePosition[]).filter((p) => p.kind === "labor");
  const parts = (order.positions as InvoicePosition[]).filter((p) => p.kind === "part");
  const primary = workshop.brandPrimary || "#fe6503";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signature) {
      setError("Bitte unterschreiben Sie im Feld");
      return;
    }
    if (name.trim().length < 2) {
      setError("Bitte tippen Sie Ihren vollständigen Namen ein");
      return;
    }
    startSubmit(async () => {
      try {
        const fd = new FormData();
        fd.set("token", token);
        fd.set("signatureSvg", signature);
        fd.set("signedByName", name.trim());
        await submitSignatureAction(fd);
        setDone(true);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (done) {
    return (
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-4 flex items-center justify-center text-3xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Freigabe erteilt</h1>
        <p className="text-slate-600 mb-2">
          Vielen Dank, {name}. Die Werkstatt kann jetzt mit den Arbeiten beginnen.
        </p>
        <p className="text-xs text-slate-400">Bei Rückfragen kontaktieren Sie {workshop.name}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Werkstatt-header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt={workshop.name} className="h-10 w-auto" />
            ) : (
              <Building2 className="w-8 h-8 text-slate-400" />
            )}
            <div>
              <div className="font-bold text-slate-900">{workshop.name}</div>
              <div className="text-xs text-slate-500">
                {workshop.street} · {workshop.zip} {workshop.city}
              </div>
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Auftrag {order.orderNumber}</h1>
        <div className="text-sm text-slate-600 mt-1">
          für <strong>{customerDisplayName(customer)}</strong>
          {vehicle && (
            <>
              {" "}· <Car className="w-3.5 h-3.5 inline" /> {vehicleDisplayName(vehicle)}
            </>
          )}
        </div>
      </div>

      {/* Freigabe-rahmen — dick hervorgehoben */}
      <div className="bg-white border-l-4 rounded-2xl p-6 shadow-sm" style={{ borderColor: primary }}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: primary }} />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: primary }}>
              Freigabe-Rahmen
            </div>
            <div className="text-3xl font-extrabold text-slate-900 tabular-nums mb-2">
              bis {formatEur(order.approvedAmountCent)}
            </div>
            {order.approvalFreetext && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.approvalFreetext}</p>
            )}
          </div>
        </div>
      </div>

      {/* Positionen */}
      {(labor.length > 0 || parts.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Positionen</h2>
          {labor.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-600 mb-1">Arbeitsleistung</div>
              {labor.map((p, i) => (
                <PosRow key={i} p={p} />
              ))}
            </div>
          )}
          {parts.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-600 mb-1">Ersatzteile</div>
              {parts.map((p, i) => (
                <PosRow key={i} p={p} />
              ))}
            </div>
          )}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between mt-3">
            <span className="text-sm text-slate-500">Kalkulierter Betrag (brutto)</span>
            <span className="text-lg font-bold text-slate-900 tabular-nums">{formatEur(order.totalGrossCent)}</span>
          </div>
        </div>
      )}

      {/* Signatur-formular */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Freigabe erteilen</h2>
        <p className="text-sm text-slate-600 mb-5">
          Mit Ihrer Unterschrift bestätigen Sie den oben genannten Freigabe-Rahmen. Bei Mehrkosten wird die
          Werkstatt Sie <strong>vorher</strong> kontaktieren.
        </p>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Vor- und Nachname *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Max Mustermann"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Unterschrift *</label>
          <SignaturePad onChange={setSignature} height={140} />
          <p className="text-xs text-slate-400 mt-1">
            Signieren Sie mit Finger, Stift oder Maus. Rechtsverbindlich auf mobilem Gerät oder Tablet.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !signature || name.trim().length < 2}
          className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg text-white shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: primary }}
        >
          <Check className="w-5 h-5" />
          {submitting ? "Wird gespeichert…" : "Freigabe erteilen"}
        </button>
      </form>

      <div className="text-center text-xs text-slate-400 pt-4">
        Powered by{" "}
        <a href="https://connect.kfzblitz24-group.com" className="underline">
          WerkstattConnect
        </a>{" "}
        · kfzBlitz24 GmbH
      </div>
    </div>
  );
}

function PosRow({ p }: { p: InvoicePosition }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-slate-100 last:border-b-0">
      <span className="text-slate-700 truncate">{p.name}</span>
      <span className="text-slate-500 tabular-nums text-xs whitespace-nowrap ml-2">
        {p.quantity} {p.unit}
      </span>
    </div>
  );
}
