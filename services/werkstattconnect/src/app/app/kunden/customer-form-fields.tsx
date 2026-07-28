"use client";

import { useState } from "react";

type Init = {
  type?: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  taxId?: string | null;
  notes?: string | null;
};

export function CustomerFormFields({ init }: { init?: Init }) {
  const [type, setType] = useState(init?.type || "b2c");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Kundentyp</label>
        <div className="flex gap-3">
          <label className={`flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer ${type === "b2c" ? "border-orange-500 bg-orange-50" : "border-slate-300"}`}>
            <input type="radio" name="type" value="b2c" checked={type === "b2c"} onChange={() => setType("b2c")} />
            <span className="text-sm font-medium">Privatkunde (B2C)</span>
          </label>
          <label className={`flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer ${type === "b2b" ? "border-orange-500 bg-orange-50" : "border-slate-300"}`}>
            <input type="radio" name="type" value="b2b" checked={type === "b2b"} onChange={() => setType("b2b")} />
            <span className="text-sm font-medium">Firmenkunde (B2B)</span>
          </label>
        </div>
      </div>

      {type === "b2b" && (
        <Field label="Firmenname *" name="companyName" required defaultValue={init?.companyName ?? ""} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={type === "b2b" ? "Ansprechpartner Vorname" : "Vorname"} name="firstName" defaultValue={init?.firstName ?? ""} />
        <Field label={type === "b2c" ? "Nachname *" : "Ansprechpartner Nachname"} name="lastName" required={type === "b2c"} defaultValue={init?.lastName ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" name="email" type="email" defaultValue={init?.email ?? ""} />
        <Field label="Telefon" name="phone" defaultValue={init?.phone ?? ""} />
      </div>
      <Field label="Straße" name="street" defaultValue={init?.street ?? ""} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="PLZ" name="zip" defaultValue={init?.zip ?? ""} />
        <div className="col-span-2">
          <Field label="Ort" name="city" defaultValue={init?.city ?? ""} />
        </div>
      </div>
      {type === "b2b" && <Field label="USt-IdNr." name="taxId" defaultValue={init?.taxId ?? ""} />}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notizen</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={init?.notes ?? ""}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      />
    </div>
  );
}
