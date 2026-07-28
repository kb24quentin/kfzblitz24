import { buildDocPdf } from "./pdf/templates";
import type { PdfDoc } from "./pdf/types";
import type { InvoicePosition } from "./money";

type InvoiceForPdf = {
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date | null;
  positions: InvoicePosition[];
  subtotalNetCent: number;
  totalVatCent: number;
  totalGrossCent: number;
  notes: string | null;
  mileageAtIssue?: number | null;
  creatorName?: string | null;
  customer: PdfDoc["customer"];
  vehicle: PdfDoc["vehicle"];
  workshop: PdfDoc["workshop"];
};

export async function buildInvoicePdf(inv: InvoiceForPdf): Promise<Buffer> {
  return buildDocPdf({
    kind: "invoice",
    number: inv.invoiceNumber,
    title: "Rechnung",
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    positions: inv.positions,
    subtotalNetCent: inv.subtotalNetCent,
    totalVatCent: inv.totalVatCent,
    totalGrossCent: inv.totalGrossCent,
    notes: inv.notes,
    mileageAtIssue: inv.mileageAtIssue ?? null,
    creatorName: inv.creatorName ?? null,
    customer: inv.customer,
    vehicle: inv.vehicle,
    workshop: inv.workshop,
  });
}

export async function buildQuotePdf(q: {
  quoteNumber: string;
  issuedAt: Date;
  validUntil: Date | null;
  positions: InvoicePosition[];
  subtotalNetCent: number;
  totalVatCent: number;
  totalGrossCent: number;
  notes: string | null;
  mileageAtIssue?: number | null;
  creatorName?: string | null;
  customer: PdfDoc["customer"];
  vehicle: PdfDoc["vehicle"];
  workshop: PdfDoc["workshop"];
}): Promise<Buffer> {
  return buildDocPdf({
    kind: "quote",
    number: q.quoteNumber,
    title: "Angebot",
    issuedAt: q.issuedAt,
    dueAt: q.validUntil,
    positions: q.positions,
    subtotalNetCent: q.subtotalNetCent,
    totalVatCent: q.totalVatCent,
    totalGrossCent: q.totalGrossCent,
    notes: q.notes,
    mileageAtIssue: q.mileageAtIssue ?? null,
    creatorName: q.creatorName ?? null,
    customer: q.customer,
    vehicle: q.vehicle,
    workshop: q.workshop,
  });
}
