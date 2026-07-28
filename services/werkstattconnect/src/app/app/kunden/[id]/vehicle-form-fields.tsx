type Init = {
  licensePlate?: string | null;
  vin?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | null;
  hsn?: string | null;
  tsn?: string | null;
  fuelType?: string | null;
  transmission?: string | null;
  power?: number | null;
  color?: string | null;
  firstRegistration?: Date | null;
  mileage?: number | null;
  nextTuev?: Date | null;
  nextInspection?: Date | null;
  notes?: string | null;
};

function toDateInput(d?: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function VehicleFormFields({ init }: { init?: Init }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Kennzeichen" name="licensePlate" defaultValue={init?.licensePlate ?? ""} placeholder="M-AB 1234" />
        <div className="col-span-2">
          <Field label="FIN (VIN)" name="vin" defaultValue={init?.vin ?? ""} placeholder="WBA...." />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Marke" name="brand" defaultValue={init?.brand ?? ""} placeholder="BMW" />
        <Field label="Modell" name="model" defaultValue={init?.model ?? ""} placeholder="320d" />
        <Field label="Variante" name="variant" defaultValue={init?.variant ?? ""} placeholder="Touring" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Baujahr" name="year" type="number" defaultValue={init?.year ?? ""} placeholder="2020" />
        <Field label="HSN" name="hsn" defaultValue={init?.hsn ?? ""} placeholder="0005" />
        <Field label="TSN" name="tsn" defaultValue={init?.tsn ?? ""} placeholder="AAA" />
        <Field label="Farbe" name="color" defaultValue={init?.color ?? ""} placeholder="schwarz" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kraftstoff</label>
          <select name="fuelType" defaultValue={init?.fuelType ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">–</option>
            <option value="benzin">Benzin</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="elektro">Elektro</option>
            <option value="gas">Gas</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Getriebe</label>
          <select name="transmission" defaultValue={init?.transmission ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">–</option>
            <option value="schaltung">Schaltung</option>
            <option value="automatik">Automatik</option>
          </select>
        </div>
        <Field label="Leistung (kW)" name="power" type="number" defaultValue={init?.power ?? ""} placeholder="140" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Erstzulassung" name="firstRegistration" type="date" defaultValue={toDateInput(init?.firstRegistration)} />
        <Field label="km-Stand" name="mileage" type="number" defaultValue={init?.mileage ?? ""} placeholder="42000" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nächste HU" name="nextTuev" type="date" defaultValue={toDateInput(init?.nextTuev)} />
        <Field label="Nächste Wartung" name="nextInspection" type="date" defaultValue={toDateInput(init?.nextInspection)} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notizen</label>
        <textarea name="notes" rows={2} defaultValue={init?.notes ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>
    </div>
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
  defaultValue?: string | number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue as string}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      />
    </div>
  );
}
