import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../../shell";
import { createCustomerAction } from "../actions";
import { CustomerFormFields } from "../customer-form-fields";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireWorkshopUser();
  return (
    <WorkshopShell current="kunden">
      <div className="mb-6">
        <Link href="/app/kunden" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Neuer Kunde</h1>
      </div>
      <form action={createCustomerAction} className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl">
        <CustomerFormFields />
        <div className="flex justify-end gap-2 pt-6 mt-6 border-t border-slate-200">
          <Link href="/app/kunden" className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
            Abbrechen
          </Link>
          <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
            Kunde anlegen
          </button>
        </div>
      </form>
    </WorkshopShell>
  );
}
