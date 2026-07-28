"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { sumPositions, type InvoicePosition } from "@/lib/money";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { embedZugferdXml } from "@/lib/zugferd";
import { positionsFromFormData } from "@/lib/positions-parse";
import { Resend } from "resend";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

type PositionInput = {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  netPriceEur: string;
  vatPercent: number;
};

export async function createInvoiceAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const customerId = String(formData.get("customerId") || "");
  const vehicleId = str(formData.get("vehicleId"));
  const dueAtStr = str(formData.get("dueAt"));
  const notes = str(formData.get("notes"));
  const asDraft = String(formData.get("action") || "draft") === "draft";
  const paymentMethod = String(formData.get("paymentMethod") || "bank_transfer");
  const markPaid = String(formData.get("markPaid") || "") === "true";
  if (!customerId) throw new Error("Kunde fehlt");
  const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { workshopId: true } });
  if (!cust || cust.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const positions = positionsFromFormData(formData);
  if (positions.length === 0) throw new Error("Mindestens eine Position erforderlich");
  const totals = sumPositions(positions);

  const mileageRaw = str(formData.get("mileageAtIssue"));
  const mileageAtIssue = mileageRaw ? parseInt(mileageRaw, 10) : null;

  const invoiceNumber = await nextInvoiceNumber(ctx.workshopId);
  const created = await prisma.invoice.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceNumber,
      customerId,
      vehicleId,
      mileageAtIssue,
      issuedAt: new Date(),
      dueAt: dueAtStr ? new Date(dueAtStr) : null,
      positions: positions as unknown as object[],
      subtotalNetCent: totals.subtotalNetCent,
      totalVatCent: totals.totalVatCent,
      totalGrossCent: totals.totalGrossCent,
      status: markPaid ? "paid" : asDraft ? "draft" : "sent",
      paidAt: markPaid ? new Date() : null,
      paymentMethod: ["bank_transfer", "cash", "card", "sepa"].includes(paymentMethod) ? paymentMethod : "bank_transfer",
      notes,
      createdBy: ctx.userId,
    },
  });

  // km auf Vehicle spiegeln wenn höher als bisher
  if (vehicleId && mileageAtIssue) {
    const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { mileage: true } });
    if (v && (v.mileage == null || mileageAtIssue > v.mileage)) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { mileage: mileageAtIssue, mileageUpdatedAt: new Date() },
      });
    }
  }

  await prisma.invoiceJournalEntry.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceId: created.id,
      invoiceNumber,
      event: "created",
      actorId: ctx.userId,
      actorEmail: ctx.session.user?.email ?? null,
      actorName: ctx.session.user?.name ?? null,
      payload: {
        positions: positions as unknown as object[],
        totals,
        status: created.status,
      } as unknown as object,
    },
  });

  revalidatePath("/app/rechnungen");
  revalidatePath(`/app/kunden/${customerId}`);
  redirect(`/app/rechnungen/${created.id}`);
}

async function generateAndCachePdf(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { workshop: true, customer: true, vehicle: true, creator: { select: { name: true } } },
  });
  if (!inv) throw new Error("Rechnung nicht gefunden");
  const positions = inv.positions as unknown as InvoicePosition[];
  const rawPdf = await buildInvoicePdf({
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
    paymentMethod: inv.paymentMethod,
    paidAt: inv.paidAt,
    customer: inv.customer,
    vehicle: inv.vehicle,
    workshop: inv.workshop,
  });
  // ZUGFeRD-XML einbetten (Factur-X BASIC)
  const pdf = await embedZugferdXml(rawPdf, {
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
    paymentMethod: inv.paymentMethod,
    paidAt: inv.paidAt,
    customer: inv.customer,
    vehicle: inv.vehicle,
    workshop: inv.workshop,
  });
  const pdfCopy = new Uint8Array(new ArrayBuffer(pdf.byteLength));
  pdfCopy.set(new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength));
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { pdfBytes: pdfCopy },
  });
  return { pdf, inv };
}

export async function sendInvoiceAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: true, workshop: { select: { name: true, contactEmail: true } } },
  });
  if (!inv || inv.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (inv.status === "cancelled") throw new Error("Storniert — kein Versand möglich");
  if (!inv.customer.email) throw new Error("Kunde hat keine E-Mail-Adresse");

  const { pdf } = await generateAndCachePdf(id);

  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend nicht konfiguriert");
  const resend = new Resend(key);
  const FROM_EMAIL = process.env.FROM_EMAIL || "service@kfzblitz24.de";

  const html = `<!doctype html><html><body style="font-family:-apple-system,Arial;line-height:1.6;color:#0f172a;">
    <div style="max-width:560px;margin:24px auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
      <h2 style="margin-top:0;color:#fe6503;">Ihre Rechnung ${inv.invoiceNumber}</h2>
      <p>Guten Tag,</p>
      <p>anbei erhalten Sie unsere Rechnung <strong>${inv.invoiceNumber}</strong> vom ${inv.issuedAt.toLocaleDateString("de-DE")}.</p>
      ${inv.dueAt ? `<p>Bitte begleichen Sie den Betrag bis zum <strong>${inv.dueAt.toLocaleDateString("de-DE")}</strong>.</p>` : ""}
      <p>Bei Rückfragen antworten Sie einfach auf diese E-Mail.</p>
      <p>Mit freundlichen Grüßen<br/><strong>${inv.workshop.name}</strong></p>
    </div>
  </body></html>`;

  await resend.emails.send({
    from: `${inv.workshop.name} <${FROM_EMAIL}>`,
    replyTo: inv.workshop.contactEmail,
    to: [inv.customer.email],
    subject: `Rechnung ${inv.invoiceNumber}`,
    html,
    attachments: [
      {
        filename: `${inv.invoiceNumber}.pdf`,
        content: pdf,
      },
    ],
  });

  await prisma.invoice.update({
    where: { id },
    data: { status: inv.status === "draft" ? "sent" : inv.status },
  });
  await prisma.invoiceJournalEntry.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceId: id,
      invoiceNumber: inv.invoiceNumber,
      event: "sent",
      actorId: ctx.userId,
      actorEmail: ctx.session.user?.email ?? null,
      actorName: ctx.session.user?.name ?? null,
      payload: { to: inv.customer.email } as object,
    },
  });

  revalidatePath(`/app/rechnungen/${id}`);
  revalidatePath("/app/rechnungen");
}

export async function markPaidAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (inv.status === "cancelled") throw new Error("Storniert");
  await prisma.invoice.update({
    where: { id },
    data: { status: "paid", paidAt: new Date() },
  });
  await prisma.invoiceJournalEntry.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceId: id,
      invoiceNumber: inv.invoiceNumber,
      event: "paid",
      actorId: ctx.userId,
      actorEmail: ctx.session.user?.email ?? null,
      actorName: ctx.session.user?.name ?? null,
      payload: { paidAt: new Date().toISOString() } as object,
    },
  });
  revalidatePath(`/app/rechnungen/${id}`);
  revalidatePath("/app/rechnungen");
}

/**
 * GoBD-konformes Storno: legt eine NEUE storno-rechnung (negative summen) an,
 * verlinkt sie mit dem original. Original bleibt unverändert.
 */
export async function cancelInvoiceAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!id) throw new Error("ID fehlt");
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (inv.status === "cancelled") throw new Error("Bereits storniert");

  const positions = inv.positions as unknown as InvoicePosition[];
  const stornoPositions: InvoicePosition[] = positions.map((p) => ({
    ...p,
    netTotalCent: -p.netTotalCent,
    vatTotalCent: -p.vatTotalCent,
    grossTotalCent: -p.grossTotalCent,
  }));
  const stornoNumber = await nextInvoiceNumber(ctx.workshopId);
  const stornoTotals = sumPositions(stornoPositions);

  const storno = await prisma.invoice.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceNumber: stornoNumber,
      customerId: inv.customerId,
      vehicleId: inv.vehicleId,
      issuedAt: new Date(),
      positions: stornoPositions as unknown as object[],
      subtotalNetCent: stornoTotals.subtotalNetCent,
      totalVatCent: stornoTotals.totalVatCent,
      totalGrossCent: stornoTotals.totalGrossCent,
      status: "sent",
      notes: `Stornorechnung zu ${inv.invoiceNumber}${reason ? `. Grund: ${reason}` : ""}.`,
      createdBy: ctx.userId,
    },
  });

  await prisma.invoice.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date(), cancelledById: storno.id },
  });

  await prisma.invoiceJournalEntry.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceId: id,
      invoiceNumber: inv.invoiceNumber,
      event: "cancelled",
      actorId: ctx.userId,
      actorEmail: ctx.session.user?.email ?? null,
      actorName: ctx.session.user?.name ?? null,
      payload: { stornoInvoiceId: storno.id, stornoInvoiceNumber: stornoNumber, reason } as object,
    },
  });
  await prisma.invoiceJournalEntry.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceId: storno.id,
      invoiceNumber: stornoNumber,
      event: "created",
      actorId: ctx.userId,
      actorEmail: ctx.session.user?.email ?? null,
      actorName: ctx.session.user?.name ?? null,
      payload: { cancelledOriginalId: id, cancelledOriginalNumber: inv.invoiceNumber } as object,
    },
  });

  revalidatePath(`/app/rechnungen/${id}`);
  revalidatePath(`/app/rechnungen/${storno.id}`);
  revalidatePath("/app/rechnungen");
}

export async function regeneratePdfAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID fehlt");
  const inv = await prisma.invoice.findUnique({ where: { id }, select: { workshopId: true } });
  if (!inv || inv.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await generateAndCachePdf(id);
  revalidatePath(`/app/rechnungen/${id}`);
}
