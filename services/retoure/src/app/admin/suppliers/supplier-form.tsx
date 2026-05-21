import Link from "next/link";
import type { Supplier } from "@prisma/client";

/**
 * Wiederverwendbares Form-Markup für Anlegen / Bearbeiten eines Lieferanten.
 *
 * Die `action`-Prop nimmt eine Server-Action entgegen; bei Edit wird zusätzlich
 * eine versteckte `id` mitgesendet. Auto-Fokus auf dem Name-Feld (gem. Brand-
 * Vorgaben).
 */
export function SupplierForm({
  action,
  cancelHref,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  initial?: Supplier | null;
  submitLabel: string;
}) {
  const v = initial ?? null;

  return (
    <form action={action} className="space-y-6 bg-white rounded-xl border border-[#e6e8eb] p-6">
      {v && <input type="hidden" name="id" value={v.id} />}

      <div className="grid grid-cols-[1fr_140px] gap-4">
        <Field label="Name" required>
          <input
            autoFocus
            name="name"
            defaultValue={v?.name ?? ""}
            required
            maxLength={200}
            className={input()}
            placeholder="z. B. Bosch Mobility Solutions GmbH"
          />
        </Field>
        <Field label="Container-Kürzel">
          <input
            name="shortCode"
            defaultValue={v?.shortCode ?? ""}
            maxLength={4}
            className={input("uppercase font-mono tracking-wider")}
            placeholder="z. B. KB"
          />
        </Field>
      </div>
      <p className="-mt-3 text-xs text-[#8a93a0]">
        2–4 Buchstaben — wird als Prefix für alle Container-Codes dieses
        Lieferanten verwendet (z. B. <code className="font-mono">KB-042</code>).
        Leer lassen → automatisch aus dem Namen abgeleitet.
      </p>

      <Field label="Routing-Code (Label-Aufdruck)">
        <input
          name="routeCode"
          defaultValue={v?.routeCode ?? ""}
          maxLength={40}
          className={input("font-mono uppercase")}
          placeholder="z. B. R01 · INTERPARTS-PL"
        />
      </Field>
      <p className="-mt-3 text-xs text-[#8a93a0]">
        Erscheint im ROUTE-Block auf dem Container-Label. Format frei,
        Konvention: <code className="font-mono">R## · ZIELORT-LL</code>.
        Leer lassen → wird aus dem Namen generiert.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Kontaktperson">
          <input
            name="contactPerson"
            defaultValue={v?.contactPerson ?? ""}
            maxLength={200}
            className={input()}
          />
        </Field>
        <Field label="Standard-Bearbeitungstage">
          <input
            name="defaultLeadDays"
            type="number"
            min={1}
            max={365}
            defaultValue={v?.defaultLeadDays ?? 30}
            className={input()}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="E-Mail">
          <input
            name="email"
            type="email"
            defaultValue={v?.email ?? ""}
            maxLength={200}
            className={input()}
          />
        </Field>
        <Field label="Telefon">
          <input
            name="phone"
            defaultValue={v?.phone ?? ""}
            maxLength={50}
            className={input()}
          />
        </Field>
      </div>

      <Field label="Straße">
        <input
          name="street"
          defaultValue={v?.street ?? ""}
          maxLength={200}
          className={input()}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="PLZ">
          <input
            name="postalCode"
            defaultValue={v?.postalCode ?? ""}
            maxLength={20}
            className={input()}
          />
        </Field>
        <Field label="Stadt">
          <input
            name="city"
            defaultValue={v?.city ?? ""}
            maxLength={100}
            className={input()}
          />
        </Field>
        <Field label="Land">
          <input
            name="country"
            defaultValue={v?.country ?? "DE"}
            maxLength={3}
            className={input()}
          />
        </Field>
      </div>

      <Field label="RMA-Policy (Freitext)">
        <textarea
          name="rmaPolicy"
          defaultValue={v?.rmaPolicy ?? ""}
          rows={4}
          className={input("resize-y")}
          placeholder="z. B. Bitte Originalverpackung verwenden, Retourenschein der Marke beilegen, ..."
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-[#3d4654]">
        <input
          type="checkbox"
          name="active"
          defaultChecked={v ? v.active : true}
          className="rounded border-[#8a93a0] text-[#ff6600] focus:ring-[#ff6600]/40"
        />
        Aktiv (für neue Lieferanten-Retouren auswählbar)
      </label>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e6e8eb]">
        <Link
          href={cancelHref}
          className="px-4 py-2 text-sm text-[#3d4654] hover:text-[#0b3756]"
        >
          Abbrechen
        </Link>
        <button
          type="submit"
          className="px-5 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#8a93a0]">
        {label}
        {required && <span className="text-[#ff6600] ml-1">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function input(extra: string = "") {
  return `w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm text-[#3d4654] focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40 ${extra}`;
}
