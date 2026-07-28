import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildWartungsheftPdf } from "@/lib/wartungsheft-pdf";
import type { InvoicePosition } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await auth();
  const u = session?.user as { workshopId?: string; audience?: string } | undefined;
  if (u?.audience !== "workshop" || !u?.workshopId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id, vid } = await params;
  const [vehicle, invoices] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: vid }, include: { customer: true, workshop: true } }),
    prisma.invoice.findMany({
      where: { vehicleId: vid, status: { not: "cancelled" } },
      orderBy: { issuedAt: "asc" },
    }),
  ]);
  if (!vehicle || vehicle.workshopId !== u.workshopId || vehicle.customerId !== id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const entries = invoices.map((inv) => ({
    date: inv.issuedAt,
    invoiceNumber: inv.invoiceNumber,
    mileage: inv.mileageAtIssue,
    positions: inv.positions as unknown as InvoicePosition[],
    totalGrossCent: inv.totalGrossCent,
  }));

  const pdf = await buildWartungsheftPdf({
    workshop: vehicle.workshop,
    customer: vehicle.customer,
    vehicle,
    entries,
  });

  const filename = `Wartungsheft_${(vehicle.licensePlate ?? "Fahrzeug").replace(/[^a-z0-9-]/gi, "_")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
