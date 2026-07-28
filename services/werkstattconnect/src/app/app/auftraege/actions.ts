"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { nextInvoiceNumber, nextOrderNumber } from "@/lib/invoice-number";
import { sumPositions, type InvoicePosition } from "@/lib/money";
import { positionsFromFormData } from "@/lib/positions-parse";
import { Resend } from "resend";
import { sendSms } from "@/lib/sms-46elks";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

function newToken() {
  return randomBytes(24).toString("hex");
}

function publicSignUrl(token: string) {
  const base = process.env.AUTH_URL || "https://connect.kfzblitz24-group.com";
  return `${base}/sign/${token}`;
}

/* ------------------------------------------------------------------ */
/* Create Order                                                        */
/* ------------------------------------------------------------------ */

export async function createOrderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const customerId = String(formData.get("customerId") || "");
  const vehicleId = str(formData.get("vehicleId"));
  const notes = str(formData.get("notes"));
  if (!customerId) throw new Error("Kunde fehlt");
  const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { workshopId: true } });
  if (!cust || cust.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const positions = positionsFromFormData(formData);
  const totals = sumPositions(positions);
  const approvalFreetext = str(formData.get("approvalFreetext"));
  const approvedAmountStr = str(formData.get("approvedAmount"));
  const approvedAmountCent = approvedAmountStr
    ? Math.max(0, Math.round(parseFloat(approvedAmountStr.replace(",", ".")) * 100 || 0))
    : totals.totalGrossCent;

  const orderNumber = await nextOrderNumber(ctx.workshopId);
  const created = await prisma.order.create({
    data: {
      workshopId: ctx.workshopId,
      orderNumber,
      customerId,
      vehicleId,
      positions: positions as unknown as object[],
      subtotalNetCent: totals.subtotalNetCent,
      totalVatCent: totals.totalVatCent,
      totalGrossCent: totals.totalGrossCent,
      approvedAmountCent,
      approvalFreetext,
      status: "draft",
      notes,
      createdBy: ctx.userId,
    },
  });
  revalidatePath("/app/auftraege");
  redirect(`/app/auftraege/${created.id}`);
}

/**
 * Angebot → Auftrag (übernimmt positionen). Ersetzt convertQuoteToInvoice.
 */
export async function convertQuoteToOrderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const quoteId = String(formData.get("quoteId") || "");
  const q = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!q || q.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const positions = q.positions as unknown as InvoicePosition[];
  const orderNumber = await nextOrderNumber(ctx.workshopId);
  const order = await prisma.order.create({
    data: {
      workshopId: ctx.workshopId,
      orderNumber,
      customerId: q.customerId,
      vehicleId: q.vehicleId,
      basedOnQuoteId: q.id,
      positions: positions as unknown as object[],
      subtotalNetCent: q.subtotalNetCent,
      totalVatCent: q.totalVatCent,
      totalGrossCent: q.totalGrossCent,
      approvedAmountCent: q.totalGrossCent, // default: freigabe genau in höhe des angebots
      approvalFreetext: `Reparatur/Arbeiten wie in Angebot ${q.quoteNumber} angeboten. Bei Mehrkosten vorher Kontakt.`,
      status: "draft",
      notes: q.notes ? `${q.notes}\n\n(aus Angebot ${q.quoteNumber})` : `(aus Angebot ${q.quoteNumber})`,
      createdBy: ctx.userId,
    },
  });

  await prisma.quote.update({
    where: { id: q.id },
    data: { status: "accepted", acceptedAt: new Date() },
  });

  revalidatePath("/app/auftraege");
  revalidatePath("/app/angebote");
  redirect(`/app/auftraege/${order.id}`);
}

/* ------------------------------------------------------------------ */
/* Update Order (positions/approval/notes)                             */
/* ------------------------------------------------------------------ */

export async function updateOrderApprovalAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const approvedAmountStr = String(formData.get("approvedAmount") || "0");
  const approvedAmountCent = Math.max(0, Math.round(parseFloat(approvedAmountStr.replace(",", ".")) * 100 || 0));
  const approvalFreetext = str(formData.get("approvalFreetext"));

  await prisma.order.update({
    where: { id },
    data: { approvedAmountCent, approvalFreetext },
  });
  revalidatePath(`/app/auftraege/${id}`);
}

export async function updateOrderPositionsAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (o.status === "invoiced" || o.status === "cancelled") {
    throw new Error("Auftrag kann nicht mehr geändert werden");
  }

  const positions = positionsFromFormData(formData);
  const totals = sumPositions(positions);
  await prisma.order.update({
    where: { id },
    data: {
      positions: positions as unknown as object[],
      subtotalNetCent: totals.subtotalNetCent,
      totalVatCent: totals.totalVatCent,
      totalGrossCent: totals.totalGrossCent,
    },
  });
  revalidatePath(`/app/auftraege/${id}`);
}

/* ------------------------------------------------------------------ */
/* Signature-Request-Flow                                              */
/* ------------------------------------------------------------------ */

async function createSignatureRequest(
  orderId: string,
  ctxUserId: string,
  sentVia: "in_person" | "email" | "sms",
  sentTo: string | null
) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o) throw new Error("Auftrag nicht gefunden");
  const token = newToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 tage

  // Aktive pending-requests der werkstatt cancel'n
  await prisma.orderSignatureRequest.updateMany({
    where: { orderId, status: "pending" },
    data: { status: "cancelled" },
  });

  const req = await prisma.orderSignatureRequest.create({
    data: {
      orderId,
      requestedBy: ctxUserId,
      sentVia,
      sentTo,
      approvedAmountCent: o.approvedAmountCent,
      approvalFreetext: o.approvalFreetext,
      positionsSnapshot: o.positions as unknown as object,
      totalGrossCent: o.totalGrossCent,
      token,
      tokenExpiresAt: expiresAt,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: o.signedAt ? "awaiting_reapproval" : "sent_for_signature",
      currentSignatureTokenExpiresAt: expiresAt,
    },
  });

  return { req, token, url: publicSignUrl(token) };
}

export async function requestSignatureInPersonAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  const { token } = await createSignatureRequest(id, ctx.userId, "in_person", null);
  revalidatePath(`/app/auftraege/${id}`);
  // Weiterleitung zur tablet-signature-page (kein login-header, kunde signiert im werkstatt-tablet)
  redirect(`/sign/${token}`);
}

export async function requestSignatureEmailAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email ungültig");

  const o = await prisma.order.findUnique({
    where: { id },
    include: { workshop: { select: { name: true, contactEmail: true } }, customer: true },
  });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const { url } = await createSignatureRequest(id, ctx.userId, "email", email);

  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend nicht konfiguriert");
  const resend = new Resend(key);
  const FROM_EMAIL = process.env.FROM_EMAIL || "service@kfzblitz24.de";

  const cName = [o.customer.firstName, o.customer.lastName].filter(Boolean).join(" ") || o.customer.companyName || "";
  const html = `<!doctype html><html><body style="font-family:-apple-system,Arial;line-height:1.6;color:#0f172a;">
    <div style="max-width:560px;margin:24px auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
      <h2 style="margin-top:0;color:#fe6503;">Reparatur-Auftrag ${o.orderNumber}</h2>
      <p>Guten Tag${cName ? ` ${cName}` : ""},</p>
      <p><strong>${o.workshop.name}</strong> bittet Sie um digitale Freigabe für den Reparatur-Auftrag <strong>${o.orderNumber}</strong>.</p>
      ${o.approvalFreetext ? `<p style="background:#fff7ed;padding:12px;border-radius:8px;border-left:4px solid #fe6503;"><strong>Vereinbarung:</strong><br/>${o.approvalFreetext.replace(/</g, "&lt;")}</p>` : ""}
      <p>Bitte klicken Sie auf den folgenden Link, um den Auftrag einzusehen und digital zu signieren:</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td>
        <a href="${url}" style="display:inline-block;background:#fe6503;color:#fff;text-decoration:none;padding:14px 26px;border-radius:8px;font-size:15px;font-weight:600;">
          Auftrag ansehen &amp; freigeben
        </a>
      </td></tr></table>
      <p style="font-size:12px;color:#64748b;margin-top:24px;">Link ist 30 Tage gültig. Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
    </div>
  </body></html>`;

  await resend.emails.send({
    from: `${o.workshop.name} <${FROM_EMAIL}>`,
    replyTo: o.workshop.contactEmail,
    to: [email],
    subject: `Freigabe erbeten: Auftrag ${o.orderNumber}`,
    html,
    text: `Guten Tag,\n\n${o.workshop.name} bittet um Freigabe für Auftrag ${o.orderNumber}.\n\nSie können den Auftrag hier einsehen und signieren:\n${url}\n\nLink 30 Tage gültig.`,
  });

  revalidatePath(`/app/auftraege/${id}`);
}

export async function requestSignatureSmsAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const phone = String(formData.get("phone") || "").trim();
  if (!phone) throw new Error("Telefonnummer fehlt");

  const o = await prisma.order.findUnique({
    where: { id },
    include: { workshop: { select: { name: true } } },
  });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");

  const { url } = await createSignatureRequest(id, ctx.userId, "sms", phone);
  const msg = `${o.workshop.name}: Bitte Auftrag ${o.orderNumber} freigeben: ${url}`;
  await sendSms(phone, msg);
  revalidatePath(`/app/auftraege/${id}`);
}

/* ------------------------------------------------------------------ */
/* Customer signs (public token-endpoint, called from /sign/[token])   */
/* ------------------------------------------------------------------ */

export async function submitSignatureAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  const signatureSvg = String(formData.get("signatureSvg") || "").trim();
  const signedByName = String(formData.get("signedByName") || "").trim();
  if (!token || !signatureSvg || !signedByName) throw new Error("Fehlende Daten");

  const req = await prisma.orderSignatureRequest.findUnique({
    where: { token },
    include: { order: true },
  });
  if (!req) throw new Error("Signatur-Anfrage nicht gefunden");
  if (req.status !== "pending") throw new Error("Diese Anfrage ist nicht mehr aktiv");
  if (req.tokenExpiresAt < new Date()) {
    await prisma.orderSignatureRequest.update({ where: { id: req.id }, data: { status: "expired" } });
    throw new Error("Link abgelaufen");
  }

  await prisma.orderSignatureRequest.update({
    where: { id: req.id },
    data: {
      status: "signed",
      respondedAt: new Date(),
      signatureSvg,
      signedByName,
    },
  });
  await prisma.order.update({
    where: { id: req.orderId },
    data: {
      status: "signed",
      signedAt: new Date(),
      signatureSvg,
      signedByName,
      currentSignatureTokenExpiresAt: null,
    },
  });
  revalidatePath(`/app/auftraege/${req.orderId}`);
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

export async function startOrderWorkAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (o.status !== "signed" && o.status !== "in_progress") {
    throw new Error("Auftrag muss erst signiert werden");
  }
  await prisma.order.update({ where: { id }, data: { status: "in_progress" } });
  revalidatePath(`/app/auftraege/${id}`);
}

export async function completeOrderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.order.update({ where: { id }, data: { status: "completed" } });
  revalidatePath(`/app/auftraege/${id}`);
}

export async function convertOrderToInvoiceAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  if (o.status === "invoiced") throw new Error("Bereits in Rechnung überführt");

  const positions = o.positions as unknown as InvoicePosition[];
  const invoiceNumber = await nextInvoiceNumber(ctx.workshopId);
  const inv = await prisma.invoice.create({
    data: {
      workshopId: ctx.workshopId,
      invoiceNumber,
      customerId: o.customerId,
      vehicleId: o.vehicleId,
      issuedAt: new Date(),
      positions: positions as unknown as object[],
      subtotalNetCent: o.subtotalNetCent,
      totalVatCent: o.totalVatCent,
      totalGrossCent: o.totalGrossCent,
      status: "draft",
      notes: o.notes ? `${o.notes}\n\n(aus Auftrag ${o.orderNumber})` : `(aus Auftrag ${o.orderNumber})`,
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
      payload: { fromOrderId: o.id, fromOrderNumber: o.orderNumber } as object,
    },
  });
  await prisma.order.update({
    where: { id },
    data: { status: "invoiced", convertedToInvoiceId: inv.id },
  });
  revalidatePath(`/app/auftraege/${id}`);
  revalidatePath("/app/rechnungen");
  redirect(`/app/rechnungen/${inv.id}`);
}

export async function cancelOrderAction(formData: FormData) {
  const ctx = await requireWorkshopUser();
  const id = String(formData.get("id") || "");
  const reason = str(formData.get("reason"));
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o || o.workshopId !== ctx.workshopId) throw new Error("Nicht erlaubt");
  await prisma.order.update({
    where: { id },
    data: { status: "cancelled", notes: reason ? `${o.notes ?? ""}\n\nStorniert: ${reason}` : o.notes },
  });
  revalidatePath(`/app/auftraege/${id}`);
  revalidatePath("/app/auftraege");
}
