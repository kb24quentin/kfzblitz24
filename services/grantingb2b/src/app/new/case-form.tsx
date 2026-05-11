"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCaseAction, type CreateCaseState } from "./actions";
import {
  Wrench,
  Store,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  Save,
  Loader2,
} from "lucide-react";

const INITIAL: CreateCaseState = { ok: true };

const SUBTYPES_WERKSTATT = [
  { id: "kfz_werkstatt", label: "Kfz-Werkstatt" },
  { id: "reifenservice", label: "Reifenservice" },
  { id: "karosseriebau", label: "Karosseriebau" },
];
const SUBTYPES_WIEDERVERKAEUFER = [
  { id: "onlineshop", label: "Online-Shop" },
  { id: "grosshandel", label: "Großhandel" },
  { id: "einzelhandel", label: "Einzelhandel" },
];

export function CaseForm() {
  const [state, formAction] = useActionState(createCaseAction, INITIAL);
  const [customerType, setCustomerType] = useState<"werkstatt" | "wiederverkaeufer">(
    "werkstatt"
  );
  const [shippingSame, setShippingSame] = useState(true);

  const subtypes = customerType === "werkstatt" ? SUBTYPES_WERKSTATT : SUBTYPES_WIEDERVERKAEUFER;
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {/* ─── Kundentyp ─────────────────────────────────────────────── */}
      <section className="bg-bg-card rounded-xl border border-border p-5 space-y-4">
        <SectionTitle>Was bist du?</SectionTitle>
        <input type="hidden" name="customerType" value={customerType} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TypeChoice
            active={customerType === "werkstatt"}
            onClick={() => setCustomerType("werkstatt")}
            icon={<Wrench className="w-5 h-5" />}
            title="Werkstatt"
            desc="Kfz-Werkstatt, Reifenservice, Karosseriebau"
          />
          <TypeChoice
            active={customerType === "wiederverkaeufer"}
            onClick={() => setCustomerType("wiederverkaeufer")}
            icon={<Store className="w-5 h-5" />}
            title="Wiederverkäufer"
            desc="Online-Shop, Großhandel, Einzelhandel"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {subtypes.map((s) => (
            <label
              key={s.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-bg-card text-sm cursor-pointer hover:bg-bg-secondary has-[:checked]:bg-accent/10 has-[:checked]:border-accent has-[:checked]:text-accent"
            >
              <input type="radio" name="businessSubtype" value={s.id} className="sr-only" />
              {s.label}
            </label>
          ))}
        </div>
      </section>

      {/* ─── Firma & Ansprechpartner ───────────────────────────────── */}
      <section className="bg-bg-card rounded-xl border border-border p-5 space-y-4">
        <SectionTitle>Firma & Ansprechpartner</SectionTitle>

        <Field
          label="Firmenname"
          icon={<Building2 className="w-4 h-4" />}
          required
          error={err.companyName}
        >
          <input
            name="companyName"
            required
            placeholder="Mustermann Autohaus GmbH"
            className="input"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Vorname Ansprechpartner"
            icon={<User className="w-4 h-4" />}
            required
            error={err.contactFirstName}
          >
            <input name="contactFirstName" required className="input" />
          </Field>
          <Field label="Nachname Ansprechpartner" required>
            <input name="contactLastName" required className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="E-Mail"
            icon={<Mail className="w-4 h-4" />}
            required
            error={err.email}
          >
            <input
              name="email"
              type="email"
              required
              className="input"
              placeholder="kontakt@firma.de"
            />
          </Field>
          <Field
            label="Telefonnummer"
            icon={<Phone className="w-4 h-4" />}
            help="+49 …"
          >
            <input name="phone" type="tel" className="input" placeholder="+49 ..." />
          </Field>
        </div>
      </section>

      {/* ─── Firmenanschrift ───────────────────────────────────────── */}
      <section className="bg-bg-card rounded-xl border border-border p-5 space-y-4">
        <SectionTitle>
          <MapPin className="w-4 h-4 inline mr-1" /> Firmenanschrift
        </SectionTitle>
        <Field label="Straße & Hausnummer" required error={err.street}>
          <input name="street" required className="input" placeholder="Musterstraße 1" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="PLZ" required error={err.postalCode}>
            <input name="postalCode" required className="input font-mono" placeholder="12345" />
          </Field>
          <Field label="Stadt" required error={err.city}>
            <input name="city" required className="input" placeholder="Berlin" />
          </Field>
          <Field label="Land" required>
            <select name="country" defaultValue="Deutschland" className="input">
              <option>Deutschland</option>
              <option>Österreich</option>
              <option>Schweiz</option>
              <option>Niederlande</option>
              <option>Belgien</option>
              <option>Luxemburg</option>
              <option>Frankreich</option>
              <option>Italien</option>
              <option>Polen</option>
              <option>Tschechien</option>
            </select>
          </Field>
        </div>
      </section>

      {/* ─── Lieferanschrift ───────────────────────────────────────── */}
      <section className="bg-bg-card rounded-xl border border-border p-5 space-y-4">
        <SectionTitle>Lieferanschrift</SectionTitle>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="shippingSameAsBilling"
            defaultChecked={shippingSame}
            onChange={(e) => setShippingSame(e.target.checked)}
            className="rounded"
          />
          Lieferanschrift entspricht Firmenanschrift
        </label>

        {!shippingSame && (
          <div className="space-y-3">
            <Field label="Straße & Hausnummer" required error={err.shippingStreet}>
              <input name="shippingStreet" className="input" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="PLZ" required error={err.shippingPostalCode}>
                <input name="shippingPostalCode" className="input font-mono" />
              </Field>
              <Field label="Stadt" required error={err.shippingCity}>
                <input name="shippingCity" className="input" />
              </Field>
              <Field label="Land" required>
                <select name="shippingCountry" defaultValue="Deutschland" className="input">
                  <option>Deutschland</option>
                  <option>Österreich</option>
                  <option>Schweiz</option>
                </select>
              </Field>
            </div>
          </div>
        )}
      </section>

      {/* ─── Steuer & Gewerbe ──────────────────────────────────────── */}
      <section className="bg-bg-card rounded-xl border border-border p-5 space-y-4">
        <SectionTitle>Steuer- & Gewerbe-Daten</SectionTitle>
        <Field
          label="USt-ID"
          help="Wird automatisch gegen VIES (EU-Schnittstelle) geprüft. Format: DE123456789"
        >
          <input
            name="ustId"
            className="input font-mono uppercase"
            placeholder="DE123456789"
          />
        </Field>

        <Field
          label="Gewerbeschein (PDF, JPG, PNG)"
          icon={<FileText className="w-4 h-4" />}
          required
          error={err.gewerbeschein}
        >
          <input
            name="gewerbeschein"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            required
            className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-border file:bg-bg-secondary file:text-text hover:file:bg-border/30 file:cursor-pointer"
          />
        </Field>
      </section>

      {/* ─── Errors + Submit ───────────────────────────────────────── */}
      {state.message && !state.ok && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      <SubmitRow />
    </form>
  );
}

function SubmitRow() {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Prüfe & speichere...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" /> Case anlegen & prüfen
          </>
        )}
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-semibold text-text mb-1">{children}</h2>;
}

function TypeChoice({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        active
          ? "border-accent bg-accent/5 ring-2 ring-accent/20"
          : "border-border bg-bg-card hover:bg-bg-secondary"
      }`}
    >
      <div className="flex items-center gap-2 text-text font-semibold">
        {icon} {title}
      </div>
      <p className="text-xs text-text-light mt-1">{desc}</p>
    </button>
  );
}

function Field({
  label,
  icon,
  required,
  help,
  error,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1">
        {icon ? <span className="inline-flex items-center gap-1">{icon} {label}</span> : label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      {children}
      {help && !error && <p className="text-xs text-text-light mt-1">{help}</p>}
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
