import { redirect } from "next/navigation";
import { Settings, Palette, Building2, CreditCard, Hash, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../shell";
import {
  updateBankAction,
  updateBrandingAction,
  updateInvoicePrefixAction,
  updateQuotePrefixAction,
  updatePricingAction,
  updateWorkshopBasicsAction,
} from "./actions";
import { TEMPLATES } from "@/lib/pdf/types";
import { TemplatePicker } from "./template-picker";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireWorkshopUser();
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/app");

  const w = await prisma.workshop.findUnique({ where: { id: ctx.workshopId } });
  if (!w) return null;

  const logoDataUrl =
    w.letterheadLogo && w.letterheadLogoMime
      ? `data:${w.letterheadLogoMime};base64,${Buffer.from(w.letterheadLogo).toString("base64")}`
      : null;

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

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Briefpapier & Corporate Identity
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Wird für alle Rechnungen, Angebote und Wartungshefte verwendet. 18 Templates zur Auswahl.
        </p>
        <form action={updateBrandingAction} encType="multipart/form-data" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo hochladen (PNG/JPG, max 500 KB)</label>
                <input type="file" name="letterheadLogo" accept="image/png,image/jpeg" className="w-full text-xs" />
                <p className="text-xs text-slate-400 mt-1">Leer lassen = bestehendes Logo behalten.</p>
                {logoDataUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={logoDataUrl} alt="Aktuelles Logo" className="h-12 object-contain border border-slate-200 rounded p-1" />
                    <label className="text-xs text-red-600 flex items-center gap-1">
                      <input type="checkbox" name="clearLogo" /> Logo entfernen
                    </label>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primärfarbe</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="brandPrimary"
                      defaultValue={w.brandPrimary ?? "#fe6503"}
                      placeholder="#fe6503"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                    <span className="w-8 h-8 rounded border border-slate-300" style={{ background: w.brandPrimary ?? "#fe6503" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Akzentfarbe</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="brandAccent"
                      defaultValue={w.brandAccent ?? ""}
                      placeholder="optional"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                    {w.brandAccent && <span className="w-8 h-8 rounded border border-slate-300" style={{ background: w.brandAccent }} />}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fußzeile (3 Spalten)</label>
              <div className="space-y-2">
                <textarea
                  name="footerCol1"
                  rows={4}
                  defaultValue={w.footerCol1 ?? ""}
                  placeholder="Spalte 1 — z.B. Firma&#10;Auto Meier GmbH&#10;Hauptstr. 1&#10;80331 München"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
                <textarea
                  name="footerCol2"
                  rows={4}
                  defaultValue={w.footerCol2 ?? ""}
                  placeholder="Spalte 2 — z.B. Kontakt&#10;Tel: 089/12345&#10;info@auto-meier.de&#10;www.auto-meier.de"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
                <textarea
                  name="footerCol3"
                  rows={4}
                  defaultValue={w.footerCol3 ?? ""}
                  placeholder="Spalte 3 — z.B. Bank / USt-IdNr.&#10;Sparkasse München&#10;IBAN: DE00…&#10;USt-IdNr. DE123…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">Nutze diese Spalten, wenn du eine strukturierte Fußzeile willst. Sonst wird der Freitext unten verwendet.</p>
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Freitext-Fußzeile (Fallback)</label>
                <input
                  name="brandFooterText"
                  defaultValue={w.brandFooterText ?? ""}
                  placeholder={`${w.name}${w.taxId ? ` · USt-IdNr. ${w.taxId}` : ""}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Template wählen ({TEMPLATES.length} verfügbar)</label>
            <TemplatePicker
              templates={TEMPLATES}
              currentTemplate={w.letterheadTemplate}
              primary={w.brandPrimary ?? "#fe6503"}
              logoDataUrl={logoDataUrl}
              workshopName={w.name}
            />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button type="submit" className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
              Briefpapier speichern
            </button>
          </div>
        </form>
      </section>
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
