import { redirect } from "next/navigation";
import { Settings, Palette, Building2, CreditCard, Hash } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../shell";
import {
  updateBankAction,
  updateBrandingAction,
  updateInvoicePrefixAction,
  updateWorkshopBasicsAction,
} from "./actions";

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <button type="submit" className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
              Speichern
            </button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Briefpapier & Corporate Identity
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Wird für alle PDF-Rechnungen verwendet. Logo max. 500 KB (PNG/JPG).
          </p>
          <form action={updateBrandingAction} encType="multipart/form-data" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo hochladen</label>
                <input type="file" name="letterheadLogo" accept="image/png,image/jpeg" className="w-full text-xs" />
                <p className="text-xs text-slate-400 mt-1">Leer lassen, um bestehendes Logo zu behalten.</p>
                {logoDataUrl && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-red-600">
                    <input type="checkbox" name="clearLogo" /> Logo entfernen
                  </label>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Primärfarbe (Hex)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="brandPrimary"
                    defaultValue={w.brandPrimary ?? ""}
                    placeholder="#fe6503"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  {w.brandPrimary && (
                    <span className="w-8 h-8 rounded border border-slate-300" style={{ background: w.brandPrimary }} />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Footer-Text (unten auf Rechnung)</label>
                <textarea
                  name="brandFooterText"
                  rows={3}
                  defaultValue={w.brandFooterText ?? ""}
                  placeholder={`${w.name}${w.taxId ? ` · USt-IdNr. ${w.taxId}` : ""}`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <button type="submit" className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
                Speichern
              </button>
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Vorschau</div>
              <div className="bg-white rounded p-4 border border-slate-200 aspect-[210/297] max-w-xs mx-auto flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  {logoDataUrl ? (
                    <img src={logoDataUrl} alt="Logo" className="h-8 object-contain" />
                  ) : (
                    <div className="text-xs text-slate-400 italic">Kein Logo</div>
                  )}
                  <div className="text-[8px] text-right text-slate-600 leading-tight">
                    <div className="font-semibold">{w.name}</div>
                    {w.street && <div>{w.street}</div>}
                    {(w.zip || w.city) && <div>{w.zip} {w.city}</div>}
                  </div>
                </div>
                <div className="text-[10px] font-bold mb-2" style={{ color: w.brandPrimary || "#fe6503" }}>
                  Rechnung
                </div>
                <div className="h-1 bg-slate-200 rounded mb-1" />
                <div className="h-1 bg-slate-200 rounded mb-1 w-3/4" />
                <div className="h-1 bg-slate-200 rounded mb-1 w-2/3" />
                <div className="flex-1" />
                <div className="text-[7px] text-slate-400 text-center border-t border-slate-100 pt-2">
                  {w.brandFooterText || `${w.name}${w.taxId ? ` · ${w.taxId}` : ""}`}
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Rechnungs-Nummerierung
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Format: <span className="font-mono">{`{Präfix}{JJ}-0001`}</span> — gapless pro Jahr (GoBD).
            Zurücksetzen kann nicht rückgängig gemacht werden.
          </p>
          <form action={updateInvoicePrefixAction} className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Präfix</label>
              <input
                name="invoicePrefix"
                defaultValue={w.invoicePrefix}
                maxLength={8}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-32 font-mono"
              />
            </div>
            <div className="text-sm text-slate-600">
              Nächste Nummer: <span className="font-mono font-semibold text-slate-900">
                {w.invoicePrefix}{String(new Date().getFullYear()).slice(-2)}-
                {String((w.invoiceNumberYear === new Date().getFullYear() ? w.invoiceNumberLast : 0) + 1).padStart(4, "0")}
              </span>
            </div>
            <button type="submit" className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
              Speichern
            </button>
          </form>
        </section>
      </div>
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
