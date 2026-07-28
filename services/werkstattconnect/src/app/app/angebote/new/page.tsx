import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../../shell";
import { DocComposer } from "@/components/doc-composer";
import { createQuoteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { customerId, vehicleId } = await searchParams;

  const [customers, services, workshop] = await Promise.all([
    prisma.customer.findMany({
      where: { workshopId: ctx.workshopId },
      select: {
        id: true, type: true, companyName: true, firstName: true, lastName: true, email: true,
        vehicles: { select: { id: true, brand: true, model: true, licensePlate: true, mileage: true } },
      },
      orderBy: [{ lastName: "asc" }, { companyName: "asc" }],
      take: 1000,
    }),
    prisma.serviceItem.findMany({
      where: { workshopId: ctx.workshopId, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.workshop.findUnique({
      where: { id: ctx.workshopId },
      select: { hourlyRateCent: true, partsMarkupPercent: true },
    }),
  ]);

  return (
    <WorkshopShell current="angebote">
      <div className="mb-6">
        <Link href="/app/angebote" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Neues Angebot</h1>
        <p className="text-sm text-slate-500 mt-1">Angebote sind unverbindliche Vorabschätzungen — später mit einem Klick in Rechnung umwandeln.</p>
      </div>
      <DocComposer
        kind="quote"
        action={createQuoteAction}
        customers={customers}
        services={services.map((s) => ({
          id: s.id,
          category: s.category,
          name: s.name,
          description: s.description,
          laborHours: s.laborHours,
          netPriceCent: s.netPriceCent,
          vatPercent: s.vatPercent,
          unit: s.unit,
          suggestedParts: Array.isArray(s.suggestedParts) ? (s.suggestedParts as string[]) : undefined,
        }))}
        hourlyRateCent={workshop?.hourlyRateCent ?? 9500}
        partsMarkupPercent={workshop?.partsMarkupPercent ?? 15}
        defaultCustomerId={customerId ?? ""}
        defaultVehicleId={vehicleId ?? ""}
      />
    </WorkshopShell>
  );
}
