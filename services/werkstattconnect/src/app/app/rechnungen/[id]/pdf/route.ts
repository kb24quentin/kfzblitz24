import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { embedZugferdXml } from "@/lib/zugferd";
import type { InvoicePosition } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const u = session?.user as { workshopId?: string; audience?: string } | undefined;
  if (u?.audience !== "workshop" || !u?.workshopId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { workshop: true, customer: true, vehicle: true, creator: { select: { name: true } } },
  });
  if (!inv || inv.workshopId !== u.workshopId) return new NextResponse("Not found", { status: 404 });

  let bytes: Uint8Array | Buffer | null = inv.pdfBytes;
  if (!bytes || bytes.length === 0) {
    const positions = inv.positions as unknown as InvoicePosition[];
    const raw = await buildInvoicePdf({
      invoiceNumber: inv.invoiceNumber,
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      positions,
      subtotalNetCent: inv.subtotalNetCent,
      totalVatCent: inv.totalVatCent,
      totalGrossCent: inv.totalGrossCent,
      notes: inv.notes,
      mileageAtIssue: inv.mileageAtIssue,
      creatorName: inv.creator?.name ?? null,
      customer: inv.customer,
      vehicle: inv.vehicle,
      workshop: inv.workshop,
    });
    const pdf = await embedZugferdXml(raw, {
      kind: "invoice",
      number: inv.invoiceNumber,
      title: "Rechnung",
      issuedAt: inv.issuedAt,
      dueAt: inv.dueAt,
      positions,
      subtotalNetCent: inv.subtotalNetCent,
      totalVatCent: inv.totalVatCent,
      totalGrossCent: inv.totalGrossCent,
      notes: inv.notes,
      mileageAtIssue: inv.mileageAtIssue,
      creatorName: inv.creator?.name ?? null,
      customer: inv.customer,
      vehicle: inv.vehicle,
      workshop: inv.workshop,
    });
    bytes = pdf;
    const pdfCopy = new Uint8Array(new ArrayBuffer(pdf.byteLength));
    pdfCopy.set(new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength));
    await prisma.invoice.update({ where: { id }, data: { pdfBytes: pdfCopy } });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${inv.invoiceNumber}.pdf"`,
    },
  });
}
