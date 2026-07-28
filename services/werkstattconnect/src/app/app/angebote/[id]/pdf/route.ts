import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildQuotePdf } from "@/lib/invoice-pdf";
import type { InvoicePosition } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const u = session?.user as { workshopId?: string; audience?: string } | undefined;
  if (u?.audience !== "workshop" || !u?.workshopId) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const q = await prisma.quote.findUnique({
    where: { id },
    include: { workshop: true, customer: true, vehicle: true },
  });
  if (!q || q.workshopId !== u.workshopId) return new NextResponse("Not found", { status: 404 });

  let bytes: Uint8Array | Buffer | null = q.pdfBytes;
  if (!bytes || bytes.length === 0) {
    const positions = q.positions as unknown as InvoicePosition[];
    const pdf = await buildQuotePdf({
      quoteNumber: q.quoteNumber,
      issuedAt: q.issuedAt,
      validUntil: q.validUntil,
      positions,
      subtotalNetCent: q.subtotalNetCent,
      totalVatCent: q.totalVatCent,
      totalGrossCent: q.totalGrossCent,
      notes: q.notes,
      mileageAtIssue: q.mileageAtIssue,
      customer: q.customer,
      vehicle: q.vehicle,
      workshop: q.workshop,
    });
    bytes = pdf;
    const pdfCopy = new Uint8Array(new ArrayBuffer(pdf.byteLength));
    pdfCopy.set(new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength));
    await prisma.quote.update({ where: { id }, data: { pdfBytes: pdfCopy } });
  }
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${q.quoteNumber}.pdf"`,
    },
  });
}
