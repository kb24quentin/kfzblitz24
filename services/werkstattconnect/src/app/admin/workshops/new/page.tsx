import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireKbAdmin } from "@/lib/admin-guard";
import { AdminShell } from "../../shell";
import { createWorkshopAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewWorkshopPage() {
  await requireKbAdmin();

  return (
    <AdminShell current="workshops">
      <div className="mb-6">
        <Link
          href="/admin/workshops"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Neue Werkstatt anlegen</h1>
        <p className="text-sm text-slate-500 mt-1">
          Der Owner bekommt automatisch eine Setup-Mail und legt sein Passwort selbst fest.
        </p>
      </div>

      <form action={createWorkshopAction} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 max-w-2xl">
        <Section title="Werkstatt">
          <Field label="Name der Werkstatt *" name="name" required placeholder="Auto Meier GmbH" />
          <Field label="Straße" name="street" placeholder="Hauptstraße 12" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="PLZ" name="zip" placeholder="80331" />
            <div className="col-span-2">
              <Field label="Ort" name="city" placeholder="München" />
            </div>
          </div>
          <Field label="Telefon" name="contactPhone" placeholder="+49 89 123456" />
          <Field label="USt-IdNr." name="taxId" placeholder="DE123456789" />
        </Section>

        <Section title="Owner (initialer Admin)">
          <Field label="Name *" name="ownerName" required placeholder="Max Meier" />
          <Field
            label="Email *"
            name="ownerEmail"
            type="email"
            required
            placeholder="max@auto-meier.de"
          />
          <p className="text-xs text-slate-500">
            An diese Adresse wird die Setup-Mail geschickt. Der Owner legt selbst ein Passwort fest
            (Link gültig 7 Tage).
          </p>
        </Section>

        <Section title="Plan">
          <div className="flex gap-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="plan" value="free" defaultChecked className="mt-1" />
              <div>
                <div className="text-sm font-medium text-slate-900">Free</div>
                <div className="text-xs text-slate-500">Kunden, Fahrzeuge, Kalender, Rechnungen</div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="plan" value="pro" className="mt-1" />
              <div>
                <div className="text-sm font-medium text-slate-900">Pro</div>
                <div className="text-xs text-slate-500">+ Erinnerungen, Kunden-Benachrichtigungen</div>
              </div>
            </label>
          </div>
        </Section>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
          <Link
            href="/admin/workshops"
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
          >
            Werkstatt anlegen + Setup-Mail senden
          </button>
        </div>
      </form>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
      />
    </div>
  );
}
