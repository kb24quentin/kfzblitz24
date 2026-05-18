import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SupplierForm } from "../supplier-form";
import { createSupplierAction } from "../actions";

export default function NewSupplierPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/admin/suppliers"
          className="inline-flex items-center gap-1 text-sm text-[#8a93a0] hover:text-[#0b3756]"
        >
          <ChevronLeft className="w-4 h-4" /> Zurück zur Liste
        </Link>
        <h1 className="text-2xl font-bold text-[#0b3756] mt-2">
          Neuen Lieferanten anlegen
        </h1>
        <p className="text-sm text-[#8a93a0] mt-1">
          Pflichtfeld ist nur der Name. Adresse + RMA-Policy lassen sich auch
          später ergänzen.
        </p>
      </div>

      <SupplierForm
        action={createSupplierAction}
        cancelHref="/admin/suppliers"
        submitLabel="Anlegen"
      />
    </div>
  );
}
