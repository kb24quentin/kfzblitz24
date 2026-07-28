import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings, Palette, Building2, CreditCard, Hash, Wrench, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../shell";
import {
  updateBankAction,
  updateInvoicePrefixAction,
  updateQuotePrefixAction,
  updatePricingAction,
  updateWorkshopBasicsAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireWorkshopUser();
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/app");

  const w = await prisma.workshop.findUnique({ where: { id: ctx.workshopId } });
  if (!w) return null;

  return (
    <WorkshopShell current="settings">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-600" />
          Einstellungen
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Werkstatt-Daten
          </h2>
          <form action={updateWorkshopBasicsAction} className="space-y-3">
            <Field label="Kontakt-Email" name="contactEmail" defaultValue={w.contactEmail} type="email" />
            <Field label="Telefon" name="contactPhone" defaultValue={w.contactPhone ?? ""} />
            <Field label="Straße" name="street" defaultValue={w.street ?? ""} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="PLZ" name="zip" defaultValue={w.zip ?? ""} />
              <div className="col-span-2">
                <Field label="Ort" name="city" defaultValue={w.city ?? ""} />
              </div>
            </div>
            <Field label="USt-IdNr." name="taxId" defaultValue={w.taxId ?? ""} />
            <button type="submit" className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">Speichern</button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Preise & Aufschläge
          </h2>
          <form action={updatePricingAction} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stundenlohn (netto €)</label>
              <input
                name="hourlyRate"
                defaultValue={(w.hourlyRateCent / 100).toFixed(2).replace(".", ",")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Basis für alle Stunden-basierten Leistungen im Katalog.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Aufschlag auf Teile-Einkaufspreis (%)</label>
              <input
                type="number"
                min="0"
                max="500"
                name="partsMarkupPercent"
                defaultValue={w.partsMarkupPercent}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Im Rechnungs-Composer: Einkaufspreis eingeben, mit einem Klick automatisch aufschlagen.
              </p>
            </div>
            <button type="submit" className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
              Speichern
            </button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Bankverbindung
          </h2>
          <p className="text-xs text-slate-500 mb-3">Erscheint als Zahlungshinweis auf jeder Rechnung.</p>
          <form action={updateBankAction} className="space-y-3">
            <Field label="Bank" name="bankName" defaultValue={w.bankName ?? ""} placeholder="Sparkasse Musterstadt" />
            <Field label="IBAN" name="iban" defaultValue={w.iban ?? ""} placeholder="DE00 0000 0000 0000 0000 00" />
            <Field label="BIC" name="bic" defaultValue={w.bic ?? ""} placeholder="XXXDEXXXXX" />
            <button type="submit" className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">Speichern</button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Nummernkreise
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Format: <span className="font-mono">{`{Präfix}{JJ}-0001`}</span> — Rechnungen gapless (GoBD), Angebote fortlaufend.
          </p>
          <form action={updateInvoicePrefixAction} className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">Präfix Rechnungen</label>
              <input name="invoicePrefix" defaultValue={w.invoicePrefix} maxLength={8} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
            <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold">Speichern</button>
          </form>
          <div className="text-xs text-slate-500 mb-4">
            Nächste Rechnungs-Nr.:{" "}
            <span className="font-mono font-semibold text-slate-900">
              {w.invoicePrefix}
              {String(new Date().getFullYear()).slice(-2)}-
              {String((w.invoiceNumberYear === new Date().getFullYear() ? w.invoiceNumberLast : 0) + 1).padStart(4, "0")}
            </span>
          </div>
          <form action={updateQuotePrefixAction} className="flex items-end gap-3 pt-3 border-t border-slate-100">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">Präfix Angebote</label>
              <input name="quotePrefix" defaultValue={w.quotePrefix} maxLength={8} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
            <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold">Speichern</button>
          </form>
          <div className="text-xs text-slate-500 mt-2">
            Nächste Angebots-Nr.:{" "}
            <span className="font-mono font-semibold text-slate-900">
              {w.quotePrefix}
              {String(new Date().getFullYear()).slice(-2)}-
              {String((w.quoteNumberYear === new Date().getFullYear() ? w.quoteNumberLast : 0) + 1).padStart(4, "0")}
            </span>
          </div>
        </section>
      </div>

      <Link
        href="/app/settings/briefpapier"
        className="block bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-6 hover:from-orange-600 hover:to-orange-700 transition group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette className="w-6 h-6" />
            <div>
              <h2 className="text-base font-semibold">Briefpapier & Design bearbeiten</h2>
              <p className="text-sm text-orange-100 mt-0.5">
                18 Templates · Live-Vorschau · Logo · Farben · 3-Spalten-Fußzeile
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
        </div>
      </Link>

    </WorkshopShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
      />
    </div>
  );
}
