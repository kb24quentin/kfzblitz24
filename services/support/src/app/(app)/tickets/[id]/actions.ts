"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendMailAndPersist } from "@/lib/resend-send";
import { computeSlaDeadlines } from "@/lib/settings";
import { TICKET_STATUSES } from "@/lib/status";
import { generateTicketCode } from "@/lib/ticket-code";
import { generateDraftForTicket } from "@/lib/ticket-ai";
import { submitRetoure, type RetoureSubmitItem } from "@/lib/retoure-submit";
import {
  belegDeliveryDate,
  hasSichereRueckgabe,
  type Beleg,
} from "@/lib/webisco-lookup";

async function requireUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Nicht angemeldet");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User nicht gefunden");
  return user;
}

/**
 * Send a reply, optionally changing status in the same action.
 * `statusAfter` values: 'keep' | 'open' | 'pending' | 'on_hold' | 'resolved' | 'closed'
 * Default is 'pending' (Warten auf Kunde).
 */
export async function sendReplyAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  const draftId = String(formData.get("draftId") || "") || null;
  const statusAfter = String(formData.get("statusAfter") || "pending");
  const attachRetoureRaw = String(formData.get("attachRetoureOrderIds") || "").trim();
  const attachRetoureOrderIds = attachRetoureRaw
    ? attachRetoureRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (!ticketId || !bodyHtml) throw new Error("Ticket-ID + Body erforderlich");

  await sendMailAndPersist({
    ticketId,
    subject,
    bodyHtml,
    authorUserId: user.id,
    aiGenerated: !!draftId,
    approvedDraftId: draftId,
    attachRetoureOrderIds,
  });

  if (
    statusAfter &&
    statusAfter !== "keep" &&
    (TICKET_STATUSES as readonly string[]).includes(statusAfter)
  ) {
    await setStatusAction(ticketId, statusAfter);
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function addNoteAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!ticketId || !body) return;

  await prisma.$transaction([
    prisma.ticketNote.create({
      data: { ticketId, userId: user.id, body },
    }),
    prisma.ticketEvent.create({
      data: { ticketId, userId: user.id, type: "note_added" },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
}

export async function setStatusAction(ticketId: string, status: string) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");
  if (!(TICKET_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Ungültiger Status: " + status);
  }

  const resolvedAt =
    status === "resolved" || status === "closed"
      ? existing.resolvedAt ?? new Date()
      : null;

  // Clear snooze when leaving on_hold
  const clearSnooze = status !== "on_hold" && existing.snoozedUntil !== null;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        resolvedAt,
        ...(clearSnooze ? { snoozedUntil: null, snoozedReason: null } : {}),
      },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "status_changed",
        meta: JSON.stringify({ from: existing.status, to: status }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function setPriorityAction(ticketId: string, priority: string) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { priority } }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "priority_changed",
        meta: JSON.stringify({ from: existing.priority, to: priority }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function setAssigneeAction(
  ticketId: string,
  assigneeId: string | null
) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId } }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "assigned",
        meta: JSON.stringify({
          from: existing.assigneeId,
          to: assigneeId,
        }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function snoozeTicketAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const until = String(formData.get("until") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;

  if (!ticketId || !until) throw new Error("Ticket + Zeitpunkt erforderlich");
  const dt = new Date(until);
  if (isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
    throw new Error("Zeitpunkt muss in der Zukunft liegen");
  }

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "on_hold",
        snoozedUntil: dt,
        snoozedReason: reason,
      },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "snoozed",
        meta: JSON.stringify({ until: dt.toISOString(), reason }),
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/");
}

export async function wakeTicketAction(ticketId: string) {
  const user = await requireUser();
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new Error("Ticket nicht gefunden");

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: existing.status === "on_hold" ? "open" : existing.status,
        snoozedUntil: null,
        snoozedReason: null,
      },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId,
        userId: user.id,
        type: "woken",
        meta: null,
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/");
}

export async function addOrderAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const ref = String(formData.get("ref") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  if (!ticketId || !ref) return;

  await prisma.ticketOrder.upsert({
    where: { ticketId_ref: { ticketId, ref } },
    create: { ticketId, ref, note, source: "manual" },
    update: { note },
  });
  await prisma.ticketEvent.create({
    data: {
      ticketId,
      userId: user.id,
      type: "order_added",
      meta: JSON.stringify({ ref, source: "manual" }),
    },
  });

  // Auto-enrich: agent added it manually, so we trust them — fetch from Webisco
  // even if the email doesn't match (agent may know the customer used another
  // address). emailMatched still reflects reality so the AI treats it correctly.
  try {
    const { lookupOrder, belegEmailMatches } = await import("@/lib/webisco-lookup");
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { contact: { select: { email: true } } },
    });
    const result = await lookupOrder(ref);
    if (result.ok && ticket) {
      const matched = belegEmailMatches(result.beleg, ticket.contact.email);
      await prisma.ticketOrder.update({
        where: { ticketId_ref: { ticketId, ref } },
        data: {
          emailMatched: matched,
          status: result.beleg.status ?? null,
          totalBrutto: result.beleg.endpreis_brutto ?? null,
          webiscoData: JSON.stringify(result.beleg),
          fetchedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn("[addOrder] webisco enrich failed:", err instanceof Error ? err.message : err);
  }

  revalidatePath(`/tickets/${ticketId}`);
}

export type CreateRetoureInput = {
  orderId: string;
  items: Array<{
    artikelnummer: string;
    menge: number;
    grund_code: string;
    grund_freitext?: string;
    hersteller: string;
    beschreibung: string;
    einzelpreis_brutto: number;
  }>;
  labelRequested: boolean;
  freeLabel: boolean; // admin-only override
  kategorie: "widerruf" | "gewaehrleistung";
};

export type CreateRetoureResult =
  | {
      ok: true;
      caseId: string;
      anmeldungPdfUrl: string;
      labelPdfUrl: string | null;
      trackingNumber: string | null;
      composerText: string;
    }
  | { ok: false; error: string };

// Age-Gate (Support-Seite mirror OrderCard) — muss auf dem Server unabhängig
// von der UI enforced werden, sonst umgeht ein manipuliertes Frontend die Frist.
const AGENT_STANDARD_DAYS = 14;
const AGENT_RUECKGABE_PLUS_DAYS = 30;
const ADMIN_MAX_DAYS = 730;

export async function createRetoureFromTicketAction(
  input: CreateRetoureInput,
): Promise<CreateRetoureResult> {
  const user = await requireUser();
  const order = await prisma.ticketOrder.findUnique({
    where: { id: input.orderId },
    include: {
      ticket: {
        include: { contact: true },
      },
    },
  });
  if (!order) return { ok: false, error: "order_not_found" };
  if (!order.webiscoData) return { ok: false, error: "order_not_loaded" };
  if (order.retoureCaseId) return { ok: false, error: "already_has_retoure" };

  // Free-label + gewährleistung + age-bypass are admin-only privileges.
  const isAdmin = user.role === "admin";
  if (input.freeLabel && !isAdmin) return { ok: false, error: "free_label_admin_only" };
  if (input.kategorie === "gewaehrleistung" && !isAdmin) {
    return { ok: false, error: "gewaehrleistung_admin_only" };
  }

  const beleg = JSON.parse(order.webiscoData) as Beleg;

  const referenceDate = belegDeliveryDate(beleg);
  const ageDays = referenceDate
    ? Math.floor((Date.now() - referenceDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const rueckgabePlus = hasSichereRueckgabe(beleg);
  const maxDaysAgent = rueckgabePlus ? AGENT_RUECKGABE_PLUS_DAYS : AGENT_STANDARD_DAYS;
  const maxDays = isAdmin ? ADMIN_MAX_DAYS : maxDaysAgent;
  if (ageDays !== null && ageDays > maxDays) {
    return {
      ok: false,
      error: isAdmin
        ? `too_old (${ageDays}d > ${ADMIN_MAX_DAYS}d Gewährleistungsfrist)`
        : `too_old_for_agent (${ageDays}d, max ${maxDaysAgent}d${rueckgabePlus ? " mit Rückgabe+" : ""})`,
    };
  }

  if (input.items.length === 0) return { ok: false, error: "no_items_selected" };

  const addr = beleg.lieferadresse ?? beleg.rechnungsadresse ?? {};
  const contact = order.ticket.contact;
  const customerEmail = addr.email || contact.email;
  if (!customerEmail || !customerEmail.includes("@")) {
    return { ok: false, error: "customer_email_missing" };
  }

  const items: RetoureSubmitItem[] = input.items.map((it) => ({
    artikelnummer: it.artikelnummer,
    menge: it.menge,
    grund_code: it.grund_code,
    grund_freitext: it.grund_freitext,
    hersteller: it.hersteller,
    beschreibung: it.beschreibung,
    einzelpreis_brutto: it.einzelpreis_brutto,
  }));

  const result = await submitRetoure({
    bestellnummer: order.ref,
    source: "direct",
    kategorie: input.kategorie,
    customer: {
      anrede: addr.anrede,
      vorname: addr.vorname || contact.firstName || undefined,
      name: addr.name || contact.lastName || undefined,
      strasse: addr.strasse,
      plz: addr.plz,
      ort: addr.ort,
      land: addr.land,
      email: customerEmail,
      telefon: addr.telefon,
    },
    items,
    label_requested: input.labelRequested,
    premium_return: input.labelRequested && input.freeLabel
      ? { active: true, frist_tage: 30, free_label: true }
      : undefined,
  });

  if (!result.ok) {
    await prisma.ticketEvent.create({
      data: {
        ticketId: order.ticketId,
        userId: user.id,
        type: "retoure_create_failed",
        meta: JSON.stringify({ ref: order.ref, error: result.error }),
      },
    });
    return { ok: false, error: result.error };
  }

  await prisma.ticketOrder.update({
    where: { id: order.id },
    data: {
      retoureCaseId: result.caseId,
      retoureAnmeldungUrl: result.retoureAnmeldungPdfUrl,
      retoureLabelUrl: result.shippingLabel?.labelPdfUrl ?? null,
      retoureCreatedAt: new Date(),
      retoureFreeLabel: input.freeLabel,
    },
  });

  await prisma.ticketEvent.create({
    data: {
      ticketId: order.ticketId,
      userId: user.id,
      type: "retoure_created",
      meta: JSON.stringify({
        ref: order.ref,
        caseId: result.caseId,
        items: input.items.length,
        labelRequested: input.labelRequested,
        freeLabel: input.freeLabel,
        kategorie: input.kategorie,
      }),
    },
  });

  const composerText = buildRetoureReplyBody({
    firstName: contact.firstName || contact.name?.split(" ")[0] || null,
    ref: order.ref,
    kategorie: input.kategorie,
    labelRequested: input.labelRequested,
    freeLabel: input.freeLabel,
    anmeldungUrl: result.retoureAnmeldungPdfUrl,
    trackingNumber: result.shippingLabel?.trackingNumber ?? null,
  });

  revalidatePath(`/tickets/${order.ticketId}`);

  return {
    ok: true,
    caseId: result.caseId,
    anmeldungPdfUrl: result.retoureAnmeldungPdfUrl,
    labelPdfUrl: result.shippingLabel?.labelPdfUrl ?? null,
    trackingNumber: result.shippingLabel?.trackingNumber ?? null,
    composerText,
  };
}

function buildRetoureReplyBody(opts: {
  firstName: string | null;
  ref: string;
  kategorie: "widerruf" | "gewaehrleistung";
  labelRequested: boolean;
  freeLabel: boolean;
  anmeldungUrl: string;
  trackingNumber: string | null;
}): string {
  const salutation = opts.firstName ? `Guten Tag ${opts.firstName},` : "Guten Tag,";
  const kategorieText =
    opts.kategorie === "gewaehrleistung"
      ? "Gewährleistungs-Retoure"
      : "Retoure";
  const labelLine = opts.labelRequested
    ? opts.freeLabel
      ? "<p>Der Retourenschein enthält bereits das <strong>vorfrankierte DHL-Versandlabel</strong> — der Versand ist für Sie kostenfrei.</p>"
      : "<p>Der Retourenschein enthält das vorfrankierte DHL-Versandlabel. Die Versandkosten von 5,50 € werden bei der Rückerstattung vom Warenwert abgezogen.</p>"
    : "<p>Bitte senden Sie das Paket auf einem Versandweg Ihrer Wahl an unser Retourenzentrum. Die Adresse finden Sie auf dem Retourenschein.</p>";

  return [
    `<p>${salutation}</p>`,
    `<p>wir haben Ihre ${kategorieText} zu Bestellung <strong>${opts.ref}</strong> angelegt. Anbei finden Sie den Retourenschein mit allen weiteren Informationen.</p>`,
    labelLine,
    `<p><strong>Retourenschein herunterladen:</strong> <a href="${opts.anmeldungUrl}">Retoure-Anmeldung.pdf</a></p>`,
    opts.trackingNumber
      ? `<p>Sendungsverfolgung (nach Einlieferung): <strong>${opts.trackingNumber}</strong></p>`
      : "",
    `<p>Bitte packen Sie die Artikel möglichst originalverpackt und gepolstert ins Paket. Sobald die Ware bei uns eingegangen ist, prüfen wir den Zustand und erstatten Ihnen den entsprechenden Betrag.</p>`,
    `<p>Bei Fragen antworten Sie einfach auf diese E-Mail — wir helfen gerne weiter.</p>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function refreshOrderAction(orderId: string) {
  const user = await requireUser();
  const existing = await prisma.ticketOrder.findUnique({
    where: { id: orderId },
    include: { ticket: { select: { contact: { select: { email: true } } } } },
  });
  if (!existing) return;

  const { lookupOrder, belegEmailMatches } = await import("@/lib/webisco-lookup");
  const result = await lookupOrder(existing.ref);
  if (!result.ok) {
    await prisma.ticketEvent.create({
      data: {
        ticketId: existing.ticketId,
        userId: user.id,
        type: "order_refresh_failed",
        meta: JSON.stringify({ ref: existing.ref, error: result.error }),
      },
    });
    revalidatePath(`/tickets/${existing.ticketId}`);
    return;
  }

  const matched = belegEmailMatches(result.beleg, existing.ticket.contact.email);
  await prisma.ticketOrder.update({
    where: { id: orderId },
    data: {
      emailMatched: matched,
      status: result.beleg.status ?? null,
      totalBrutto: result.beleg.endpreis_brutto ?? null,
      webiscoData: JSON.stringify(result.beleg),
      fetchedAt: new Date(),
    },
  });
  await prisma.ticketEvent.create({
    data: {
      ticketId: existing.ticketId,
      userId: user.id,
      type: "order_refreshed",
      meta: JSON.stringify({ ref: existing.ref, emailMatched: matched }),
    },
  });

  revalidatePath(`/tickets/${existing.ticketId}`);
}

export async function removeOrderAction(orderId: string) {
  const user = await requireUser();
  const existing = await prisma.ticketOrder.findUnique({ where: { id: orderId } });
  if (!existing) return;
  await prisma.ticketOrder.delete({ where: { id: orderId } });
  await prisma.ticketEvent.create({
    data: {
      ticketId: existing.ticketId,
      userId: user.id,
      type: "order_removed",
      meta: JSON.stringify({ ref: existing.ref }),
    },
  });
  revalidatePath(`/tickets/${existing.ticketId}`);
}

export async function resendMessageAction(messageId: string) {
  const user = await requireUser();
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error("Nachricht nicht gefunden");
  if (msg.direction !== "outbound") throw new Error("Nur ausgehende Nachrichten können erneut gesendet werden");

  await sendMailAndPersist({
    ticketId: msg.ticketId,
    subject: msg.subject || undefined,
    bodyHtml: msg.bodyHtml,
    authorUserId: user.id,
    appendSignature: false, // original already has signature
    kind: "resend",
    resentFromId: msg.id,
    countsAsFirstResponse: false, // resend of an existing message is not a NEW first response
  });

  revalidatePath(`/tickets/${msg.ticketId}`);
}

export async function updateContactAction(formData: FormData) {
  await requireUser();
  const contactId = String(formData.get("contactId") || "");
  const firstName = String(formData.get("firstName") || "").trim() || null;
  const lastName = String(formData.get("lastName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const orderRef = String(formData.get("orderRef") || "").trim() || null;
  const ticketId = String(formData.get("ticketId") || "");

  if (!contactId) throw new Error("Kontakt-ID erforderlich");

  const composedName = [firstName, lastName].filter(Boolean).join(" ") || null;

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName,
      lastName,
      name: composedName,
      phone,
      orderRef,
    },
  });

  if (ticketId) revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/contacts");
}

export async function regenerateDraftAction(ticketId: string) {
  await requireUser();
  await generateDraftForTicket(ticketId, { force: true });
  revalidatePath(`/tickets/${ticketId}`);
}

export async function rejectDraftAction(draftId: string, reason?: string) {
  const user = await requireUser();
  await prisma.aiDraft.update({
    where: { id: draftId },
    data: {
      status: "rejected",
      reviewedById: user.id,
      reviewedAt: new Date(),
      rejectedReason: reason?.trim() || null,
    },
  });
  const draft = await prisma.aiDraft.findUnique({ where: { id: draftId } });
  if (draft) revalidatePath(`/tickets/${draft.ticketId}`);
}

export async function createTicketAction(formData: FormData) {
  const user = await requireUser();
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "")
    .trim()
    .toLowerCase();
  const firstName = String(formData.get("firstName") || "").trim() || null;
  const lastName = String(formData.get("lastName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const priority = String(formData.get("priority") || "normal");
  const orderRefsRaw = String(formData.get("orderRefs") || "").trim();
  const orderRefs = orderRefsRaw
    ? orderRefsRaw
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!subject || !contactEmail) throw new Error("Betreff + Kunden-Email erforderlich");

  const composedName = [firstName, lastName].filter(Boolean).join(" ") || null;

  const contact = await prisma.contact.upsert({
    where: { email: contactEmail },
    create: {
      email: contactEmail,
      firstName,
      lastName,
      name: composedName,
      phone,
    },
    update: {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(composedName ? { name: composedName } : {}),
      ...(phone ? { phone } : {}),
    },
  });

  const now = new Date();
  const { firstResponseDueAt, resolutionDueAt } = await computeSlaDeadlines(now);
  const code = await generateTicketCode();

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      code,
      priority,
      contactId: contact.id,
      firstResponseDueAt,
      resolutionDueAt,
      orders: orderRefs.length
        ? { create: orderRefs.map((ref) => ({ ref })) }
        : undefined,
    },
  });

  await prisma.$transaction([
    ...(bodyHtml
      ? [
          prisma.message.create({
            data: {
              ticketId: ticket.id,
              authorUserId: user.id,
              direction: "outbound",
              fromEmail: user.email,
              toEmail: contact.email,
              subject,
              bodyHtml,
              createdAt: now,
            },
          }),
        ]
      : []),
    prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        userId: user.id,
        type: "created",
        meta: JSON.stringify({ source: "manual", orderRefs }),
      },
    }),
  ]);

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}
