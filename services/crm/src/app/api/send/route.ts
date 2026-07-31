import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFromAddress, getListUnsubscribeHeaders, htmlToPlainText } from "@/lib/email";
import { sendPrintjob, currentMode } from "@/lib/ob24";
import { renderLetterPdf, extractAnredeAndParagraphs } from "@/lib/letter-pdf";
import {
  parseSendWindow,
  readyForContact,
  stepTargetTime,
  pickVariant,
} from "@/lib/cadence";
import type { Prisma } from "@prisma/client";

// Cron: called every 10 min by systemd timer.
// Two phases:
//   1) STEP EVALUATION — for each active campaign, walk contacts, and
//      for each contact's currentStepIndex: check timing + windows +
//      per-step daily cap; if OK → queue Email/Letter/Reminder + advance.
//   2) SEND — dispatch any queued Emails (Resend) and Letters (OB24).

export async function POST() {
  try {
    const now = new Date();

    // ─── PHASE 1: Step evaluation ────────────────────────────────────
    const stepStats = await evaluateSteps(now);

    // ─── PHASE 2: Dispatch queued items ──────────────────────────────
    const emailStats = await dispatchEmails();
    const letterStats = await dispatchLetters();

    return NextResponse.json({
      success: true,
      steps: stepStats,
      sent: emailStats.sent,
      lettersSent: letterStats.sent,
    });
  } catch (error) {
    console.error("[send] fatal:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────
// PHASE 1
// ─────────────────────────────────────────────────────────────────────
async function evaluateSteps(now: Date) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "active",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    include: {
      steps: { orderBy: { order: "asc" } },
      campaignContacts: { include: { contact: true } },
    },
  });

  let queuedEmails = 0;
  let queuedLetters = 0;
  let queuedCalls = 0;
  let completed = 0;
  let waiting = 0;
  let skippedAddress = 0;

  for (const campaign of campaigns) {
    if (campaign.steps.length === 0) continue; // no cadence configured

    const campaignBase = campaign.scheduledAt ?? campaign.createdAt;

    // Preload step-level daily counts (max-per-day cap)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const perStepTodayCount = new Map<string, number>();
    for (const step of campaign.steps) {
      if (step.maxPerDay == null) continue;
      const count = await prisma.campaignContactStep.count({
        where: { stepId: step.id, executedAt: { gte: todayStart } },
      });
      perStepTodayCount.set(step.id, count);
    }

    for (const cc of campaign.campaignContacts) {
      if (cc.stopped) continue;

      const stepIndex = cc.currentStepIndex;
      if (stepIndex >= campaign.steps.length) {
        // Already through all steps → mark completed
        await prisma.campaignContact.update({
          where: { id: cc.id },
          data: { stopped: true, stoppedReason: "completed", stoppedAt: now },
        });
        completed++;
        continue;
      }

      const step = campaign.steps[stepIndex];

      // Timing
      const baseTime = stepIndex === 0 ? campaignBase : (cc.lastStepAt ?? campaignBase);
      const target = stepTargetTime({
        triggerType: step.triggerType,
        delayDays: step.delayDays,
        scheduledAt: step.scheduledAt,
        baseTime,
      });
      if (now < target) {
        waiting++;
        continue;
      }

      // Send-window (day-of-week + per-contact fire time within window)
      const window = parseSendWindow(step.sendWindow);
      if (!readyForContact(now, target, window, cc.contactId)) {
        waiting++;
        continue;
      }

      // Per-day cap
      if (step.maxPerDay != null) {
        const usedToday = perStepTodayCount.get(step.id) ?? 0;
        if (usedToday >= step.maxPerDay) {
          waiting++;
          continue;
        }
      }

      // Execute the step for this contact
      const outcome = await executeStep({
        step,
        campaign,
        cc,
        now,
      });

      if (outcome === "queued_email") queuedEmails++;
      else if (outcome === "queued_letter") queuedLetters++;
      else if (outcome === "queued_call") queuedCalls++;
      else if (outcome === "skipped_no_address") skippedAddress++;

      if (outcome !== "skipped_missing_template") {
        // Track the step execution
        await prisma.campaignContactStep.upsert({
          where: {
            campaignContactId_stepId: {
              campaignContactId: cc.id,
              stepId: step.id,
            },
          },
          create: {
            campaignContactId: cc.id,
            stepId: step.id,
            variant: outcome === "queued_email" || outcome === "queued_letter"
              ? computedVariantForStep(step, cc.contactId)
              : null,
            executedAt: now,
            status: outcome.startsWith("skipped") ? "skipped" : "executed",
            skippedReason: outcome.startsWith("skipped") ? outcome : null,
          },
          update: {},
        });

        // Advance
        await prisma.campaignContact.update({
          where: { id: cc.id },
          data: {
            currentStepIndex: stepIndex + 1,
            lastStepAt: now,
          },
        });

        // Bump per-day counter
        if (step.maxPerDay != null) {
          perStepTodayCount.set(step.id, (perStepTodayCount.get(step.id) ?? 0) + 1);
        }
      }
    }
  }

  return {
    queuedEmails,
    queuedLetters,
    queuedCalls,
    completedContacts: completed,
    waiting,
    skippedAddress,
  };
}

type StepOutcome =
  | "queued_email"
  | "queued_letter"
  | "queued_call"
  | "skipped_no_address"
  | "skipped_missing_template"
  | "skipped_missing_user";

function computedVariantForStep(
  step: { emailTemplateBId: string | null; letterTemplateBId: string | null; abSplitRatio: number | null; letterAbSplitRatio: number | null; channel: string },
  contactId: string
): "A" | "B" {
  if (step.channel === "email") {
    return pickVariant(!!step.emailTemplateBId, step.abSplitRatio, contactId + step.channel);
  }
  if (step.channel === "letter") {
    return pickVariant(!!step.letterTemplateBId, step.letterAbSplitRatio, contactId + step.channel);
  }
  return "A";
}

async function executeStep(args: {
  step: Prisma.CampaignStepGetPayload<Record<string, never>>;
  campaign: Prisma.CampaignGetPayload<{ include: { steps: true; campaignContacts: { include: { contact: true } } } }>;
  cc: Prisma.CampaignContactGetPayload<{ include: { contact: true } }>;
  now: Date;
}): Promise<StepOutcome> {
  const { step, campaign, cc, now } = args;
  const contact = cc.contact;

  const replacements: Record<string, string> = {
    salutation: contact.salutation || "",
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    company: contact.company || "",
    position: contact.position || "",
    city: contact.city || "",
    phone: contact.phone || "",
    street: contact.street || "",
    zip_code: contact.zipCode || "",
  };
  const sub = (s: string) =>
    Object.entries(replacements).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v),
      s
    );

  // ── EMAIL step ─────────────────────────────────────────────────────
  if (step.channel === "email") {
    const variant = pickVariant(!!step.emailTemplateBId, step.abSplitRatio, cc.contactId + "email");
    const templateId = variant === "B" && step.emailTemplateBId ? step.emailTemplateBId : step.emailTemplateAId;
    if (!templateId) return "skipped_missing_template";

    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { signature: true },
    });
    if (!template) return "skipped_missing_template";

    const subject = sub(template.subject);
    const bodyHtml = sub(template.bodyHtml);
    const signatureHtml = sub(template.signature?.html ?? "");
    const fullBodyHtml = signatureHtml.trim()
      ? `${bodyHtml}<div style="margin-top:24px">${signatureHtml}</div>`
      : bodyHtml;

    // Idempotency: don't double-queue the same step for the same contact
    const already = await prisma.email.findFirst({
      where: { campaignId: campaign.id, contactId: cc.contactId, stepId: step.id },
    });
    if (already) return "queued_email";

    await prisma.email.create({
      data: {
        campaignId: campaign.id,
        contactId: cc.contactId,
        templateId: template.id,
        stepId: step.id,
        variant,
        subject,
        body: fullBodyHtml,
        status: "queued",
      },
    });
    return "queued_email";
  }

  // ── LETTER step ────────────────────────────────────────────────────
  if (step.channel === "letter") {
    const variant = pickVariant(!!step.letterTemplateBId, step.letterAbSplitRatio, cc.contactId + "letter");
    const templateId = variant === "B" && step.letterTemplateBId ? step.letterTemplateBId : step.letterTemplateAId;
    if (!templateId) return "skipped_missing_template";

    const addressOk = !!(contact.street && contact.zipCode && contact.city);
    if (!addressOk) return "skipped_no_address";

    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) return "skipped_missing_template";

    const already = await prisma.letter.findFirst({
      where: { campaignId: campaign.id, contactId: cc.contactId, stepId: step.id },
    });
    if (already) return "queued_letter";

    const lSubject = sub(template.subject);
    const lBodyText = htmlToPlainText(sub(template.bodyHtml));
    const lPs = template.letterPs ? sub(template.letterPs) : null;
    const combined = lPs && lPs.trim()
      ? `${lBodyText}\n\n[P.S.]\n${lPs}`
      : lBodyText;

    await prisma.letter.create({
      data: {
        campaignId: campaign.id,
        contactId: cc.contactId,
        templateId: template.id,
        stepId: step.id,
        variant,
        color: step.letterColor,
        subject: lSubject,
        body: combined,
        status: "queued",
      },
    });
    return "queued_letter";
  }

  // ── CALL step ──────────────────────────────────────────────────────
  if (step.channel === "call") {
    const userId =
      contact.assignedToId ??
      (await prisma.user.findFirst({ where: { active: true, role: "admin" } }))?.id ??
      (await prisma.user.findFirst({ where: { active: true } }))?.id;
    if (!userId) return "skipped_missing_user";

    const already = await prisma.reminder.findFirst({
      where: { contactId: cc.contactId, stepId: step.id },
    });
    if (already) return "queued_call";

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 1);
    await prisma.reminder.create({
      data: {
        contactId: cc.contactId,
        userId,
        stepId: step.id,
        title: `Anruf: ${campaign.name}`,
        description: step.callNote || `Kampagnen-Schritt ${step.order + 1} — bitte anrufen.`,
        dueDate,
      },
    });
    return "queued_call";
  }

  return "skipped_missing_template";
}

// ─────────────────────────────────────────────────────────────────────
// PHASE 2 — dispatch
// ─────────────────────────────────────────────────────────────────────
async function dispatchEmails() {
  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "active" },
    include: { sender: true },
  });

  let sent = 0;
  for (const campaign of activeCampaigns) {
    const fromAddress = campaign.sender
      ? `"${campaign.sender.name.replace(/"/g, "")}" <${campaign.sender.email}>`
      : getFromAddress();

    const queued = await prisma.email.findMany({
      where: { campaignId: campaign.id, status: "queued" },
      take: campaign.sendRatePerDay,
      include: { contact: true },
    });

    for (const email of queued) {
      try {
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const result = await resend.emails.send({
            from: fromAddress,
            to: [email.contact.email],
            subject: email.subject,
            html: email.body,
            text: htmlToPlainText(email.body),
            headers: getListUnsubscribeHeaders(),
          });
          await prisma.email.update({
            where: { id: email.id },
            data: {
              status: "sent",
              sentAt: new Date(),
              resendEmailId: result.data?.id || null,
            },
          });
        } else {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "sent", sentAt: new Date() },
          });
        }

        await prisma.contact.update({
          where: { id: email.contactId },
          data: {
            lastContactedAt: new Date(),
            ...(email.contact.status === "new" ? { status: "contacted" } : {}),
          },
        });

        await prisma.activity.create({
          data: {
            contactId: email.contactId,
            userId: null,
            type: "email_sent",
            content: `Kampagne: ${campaign.name} — ${email.subject}`,
          },
        });

        sent++;
      } catch (err) {
        console.error(`[send] email ${email.id} failed:`, err);
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "failed" },
        });
      }
    }
  }
  return { sent };
}

async function dispatchLetters() {
  if (!process.env.OB24_API_KEY) return { sent: 0 };

  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "active" },
    include: { sender: true },
  });

  let sent = 0;
  for (const campaign of activeCampaigns) {
    const queued = await prisma.letter.findMany({
      where: { campaignId: campaign.id, status: "queued" },
      take: campaign.sendRatePerDay,
      include: { contact: true },
    });

    for (const letter of queued) {
      try {
        const c = letter.contact;
        const rawBody = letter.body;
        let mainBody = rawBody;
        let psText: string | null = null;
        const psSplit = rawBody.split(/\n{2,}\[P\.S\.\]\n/);
        if (psSplit.length === 2) {
          mainBody = psSplit[0];
          psText = psSplit[1].trim();
        }
        const { anrede, paragraphs } = extractAnredeAndParagraphs(mainBody);

        // Load signature image lazily per letter (may differ across templates)
        let signatureImage: string | null = null;
        if (letter.templateId) {
          const t = await prisma.template.findUnique({
            where: { id: letter.templateId },
            include: { letterSignature: true },
          });
          signatureImage = t?.letterSignature?.imageData ?? null;
        }

        const senderConf = campaign.sender ?? null;
        const pdf = await renderLetterPdf({
          senderName: process.env.LETTER_SENDER_NAME || "kfzBlitz24 GmbH",
          senderLine1: process.env.LETTER_SENDER_LINE1 || "Bomhardstraße 7",
          senderLine2: process.env.LETTER_SENDER_LINE2 || "82031 Grünwald bei München",
          recipient: {
            company: c.company,
            salutation: c.salutation,
            firstName: c.firstName,
            lastName: c.lastName,
            street: c.street,
            houseNumber: c.houseNumber,
            zipCode: c.zipCode,
            city: c.city,
            country: c.country,
          },
          anrede,
          subject: letter.subject,
          bodyParagraphs: paragraphs,
          closing: "Mit freundlichen Grüßen",
          signatureImage,
          signatureName: senderConf?.name?.split(" - ")[0] ?? "kfzBlitz24 Team",
          ps: psText,
          footer:
            "kfzBlitz24 GmbH · Bomhardstraße 7 · 82031 Grünwald bei München · " +
            "Geschäftsführer: Christian Engert · HRB 291765 Amtsgericht München · USt-IdNr.: DE367617344",
        });

        const colorArg = (letter.color === "1" || letter.color === "4" ||
          letter.color === "bw" || letter.color === "color")
          ? letter.color
          : undefined;
        const result = await sendPrintjob({ pdf, color: colorArg });
        const item = result.items?.[0];

        await prisma.letter.update({
          where: { id: letter.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            ob24JobId: result.id,
            ob24Mode: currentMode(),
            pages: item?.pages ?? null,
            amount: item ? item.amount + item.vat : null,
            trackingCode: item?.tracking_code ?? null,
          },
        });

        await prisma.contact.update({
          where: { id: letter.contactId },
          data: {
            lastContactedAt: new Date(),
            ...(c.status === "new" ? { status: "contacted" } : {}),
          },
        });

        await prisma.activity.create({
          data: {
            contactId: letter.contactId,
            userId: null,
            type: "email_sent",
            content:
              `Brief-Kampagne (${currentMode()}-Modus): ${campaign.name} — ` +
              `OB24-Job #${result.id}, ${item?.pages ?? "?"} Seiten`,
          },
        });

        sent++;
      } catch (err) {
        console.error(`[send] letter ${letter.id} failed:`, err);
        await prisma.letter.update({
          where: { id: letter.id },
          data: { status: "failed" },
        });
      }
    }
  }
  return { sent };
}
