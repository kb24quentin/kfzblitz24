"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { nextInvoiceNumber, nextQuoteNumber } from "@/lib/invoice-number";
import { sumPositions, type InvoicePosition } from "@/lib/money";
import { positionsFromFormData } from "@/lib/positions-parse";
import { buildQuotePdf } from "@/lib/invoice-pdf";
import { Resend } from "resend";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createQuoteAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const customerId = String(formData.get("customerId") || "");
  const vehicleId = str(formData.get("vehicleId"));
  const validUntilStr = str(formData.get("validUntil"));
  const notes = str(formData.get("notes"));
  const asDraft = String(formData.get("action") || "draft") === "draft";
  if (!customerId) throw new Error("Kunde fehlt");
  const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { workshopId: true } });
  if (!cust || cust.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const positions = positionsFromFormData(formData);
  if (positions.length === 0) throw new Error("Mindestens eine Position erforderlich");
  const totals = sumPositions(positions);

  const mileageRaw = str(formData.get("mileageAtIssue"));
  const mileageAtIssue = mileageRaw ? parseInt(mileageRaw, 10) : null;

  const quoteNumber = await nextQuoteNumber(ctx.workshopId);
  const created = await prisma.quote.create({
    data: {
      workshopId: ctx.workshopId,
      quoteNumber,
      customerId,
      vehicleId,
      mileageAtIssue,
      validUntil: validUntilStr ? new Date(validUntilStr) : null,
      positions: positions as unknown as object[],
      subtotalNetCent: totals.subtotalNetCent,
      totalVatCent: totals.totalVatCent,
      totalGrossCent: totals.totalGrossCent,
      status: asDraft ? "draft" : "sent",
      notes,
      createdBy: ctx.userId,
    },
  });

  if (vehicleId && mileageAtIssue) {
    const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { mileage: true } });
    if (v && (v.mileage == null || mileageAtIssue > v.mileage)) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { mileage: mileageAtIssue, mileageUpdatedAt: new Date() },
      });
    }
  }

  revalidatePath("/app/angebote");
  revalidatePath(`/app/kunden/${customerId}`);
  redirect(`/app/angebote/${created.id}`);
}

async function generateAndCacheQuotePdf(quoteId: string) {
  const q = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { workshop: true, customer: true, vehicle: true, creator: { select: { name: true } } },
  });
  if (!q) throw new Error("Angebot nicht gefunden");
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
    creatorName: q.creator?.name ?? null,
    customer: q.customer,
    vehicle: q.vehicle,
    workshop: q.workshop,
  });
  const pdfCopy = new Uint8Array(new ArrayBuffer(pdf.byteLength));
  pdfCopy.set(new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength));
  await prisma.quote.update({ where: { id: quoteId }, data: { pdfBytes: pdfCopy } });
  return { pdf, q };
}

export async function sendQuoteAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const q = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, workshop: { select: { name: true, contactEmail: true } } },
  });
  if (!q || q.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (!q.customer.email) throw new Error("Kunde hat keine E-Mail-Adresse");

  const { pdf } = await generateAndCacheQuotePdf(id);

  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend nicht konfiguriert");
  const resend = new Resend(key);
  const FROM_EMAIL = process.env.FROM_EMAIL || "service@kfzblitz24.de";

  const html = `<!doctype html><html><body style="font-family:-apple-system,Arial;line-height:1.6;color:#0f172a;">
    <div style="max-width:560px;margin:24px auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
      <h2 style="margin-top:0;color:#fe6503;">Ihr Angebot ${q.quoteNumber}</h2>
      <p>Guten Tag,</p>
      <p>anbei erhalten Sie unser Angebot <strong>${q.quoteNumber}</strong> vom ${q.issuedAt.toLocaleDateString("de-DE")}.</p>
      ${q.validUntil ? `<p>Das Angebot ist gültig bis <strong>${q.validUntil.toLocaleDateString("de-DE")}</strong>.</p>` : ""}
      <p>Bei Rückfragen antworten Sie einfach auf diese E-Mail.</p>
      <p>Mit freundlichen Grüßen<br/><strong>${q.workshop.name}</strong></p>
    </div>
  </body></html>`;

  await resend.emails.send({
    from: `${q.workshop.name} <${FROM_EMAIL}>`,
    replyTo: q.workshop.contactEmail,
    to: [q.customer.email],
    subject: `Angebot ${q.quoteNumber}`,
    html,
    attachments: [{ filename: `${q.quoteNumber}.pdf`, content: pdf }],
  });

  await prisma.quote.update({
    where: { id },
    data: { status: q.status === "draft" ? "sent" : q.status },
  });
  revalidatePath(`/app/angebote/${id}`);
  revalidatePath("/app/angebote");
}

export async function updateQuoteStatusAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!["draft", "sent", "accepted", "rejected", "expired"].includes(status)) {
    throw new Error("Ungültiger Status");
  }
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q || q.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (q.status === "converted") throw new Error("Angebot wurde bereits in Rechnung überführt");
  await prisma.quote.update({
    where: { id },
    data: {
      status,
      acceptedAt: status === "accepted" ? new Date() : q.acceptedAt,
      rejectedAt: status === "rejected" ? new Date() : q.rejectedAt,
    },
  });
  revalidatePath(`/app/angebote/${id}`);
  revalidatePath("/app/angebote");
}

/**
 * Überführt ein Angebot 1:1 in eine Rechnung. Positionen werden übernommen.
 * Angebot wird status='converted', bekommt convertedToInvoiceId.
 */
export async function convertQuoteToInvoiceAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q || q.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (q.status === "converted") throw new Error("Bereits konvertiert");

  const positions = q.positions as unknown as InvoicePosition[];
  const invoiceNumber = await nextInvoiceNumber(ctx.workshopId);
  const inv = await prisma.invoice.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceNumber,
      customerId: q.customerId,
      vehicleId: q.vehicleId,
      mileageAtIssue: q.mileageAtIssue,
      issuedAt: new Date(),
      positions: positions as unknown as object[],
      subtotalNetCent: q.subtotalNetCent,
      totalVatCent: q.totalVatCent,
      totalGrossCent: q.totalGrossCent,
      status: "draft",
      notes: q.notes ? `${q.notes}\n\n(aus Angebot ${q.quoteNumber})` : `(aus Angebot ${q.quoteNumber})`,
      createdBy: ctx.userId,
    },
  });

  await prisma.invoiceJournalEntry.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceId: inv.id,
      invoiceNumber,
      event: "created",
      actorId: ctx.userId,
      actorEmail: ctx.session.user?.email ?? null,
      actorName: ctx.session.user?.name ?? null,
      payload: { fromQuoteId: q.id, fromQuoteNumber: q.quoteNumber } as object,
    },
  });

  await prisma.quote.update({
    where: { id },
    data: { status: "converted", convertedAt: new Date(), convertedToInvoiceId: inv.id },
  });

  revalidatePath(`/app/angebote/${id}`);
  revalidatePath("/app/angebote");
  revalidatePath("/app/rechnungen");
  redirect(`/app/rechnungen/${inv.id}`);
}

export async function deleteQuoteAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q || q.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (q.status === "converted") throw new Error("Konvertiertes Angebot kann nicht gelöscht werden");
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/app/angebote");
  redirect("/app/angebote");
}
