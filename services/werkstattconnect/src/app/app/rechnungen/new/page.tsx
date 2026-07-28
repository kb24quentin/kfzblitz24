import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../../shell";
import { InvoiceComposer } from "./invoice-composer";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { customerId, vehicleId } = await searchParams;

  const [customers, services] = await Promise.all([
    prisma.customer.findMany({
      where: { workshopId: ctx.workshopId },
      include: {
        vehicles: { select: { id: true, brand: true, model: true, licensePlate: true } },
      },
      orderBy: [{ lastName: "asc" }, { companyName: "asc" }],
      take: 500,
    }),
    prisma.serviceItem.findMany({
      where: { workshopId: ctx.workshopId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <WorkshopShell current="rechnungen">
      <div className="mb-6">
        <Link href="/app/rechnungen" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Neue Rechnung</h1>
        <p className="text-sm text-slate-500 mt-1">
          Nach dem Speichern wird eine fortlaufende Rechnungsnummer vergeben (GoBD).
        </p>
      </div>
      <InvoiceComposer
        customers={customers.map((c) => ({
          id: c.id,
          type: c.type,
          companyName: c.companyName,
          firstName: c.firstName,
          lastName: c.lastName,
          vehicles: c.vehicles,
        }))}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          netPriceCent: s.netPriceCent,
          vatPercent: s.vatPercent,
          unit: s.unit,
        }))}
        defaultCustomerId={customerId ?? ""}
        defaultVehicleId={vehicleId ?? ""}
      />
    </WorkshopShell>
  );
}
