"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// A step as posted from the campaign form (client-side StepBuilder).
export type StepInput = {
  channel: "email" | "letter" | "call";
  triggerType: "relative" | "absolute";
  delayDays: number;
  scheduledAt: string | null;         // ISO string or null
  sendWindow: string | null;          // JSON blob or null
  maxPerDay: number | null;
  emailTemplateAId: string | null;
  emailTemplateBId: string | null;
  abSplitRatio: number | null;
  letterTemplateAId: string | null;
  letterTemplateBId: string | null;
  letterAbSplitRatio: number | null;
  letterColor: string | null;
  callNote: string | null;
};

function parseSteps(raw: string | null | undefined): StepInput[] {
  try {
    const arr = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(arr)) return [];
    return arr as StepInput[];
  } catch {
    return [];
  }
}

export async function createCampaign(formData: FormData) {
  const contactIds = JSON.parse(formData.get("contactIds") as string || "[]") as string[];
  const senderId = (formData.get("senderId") as string) || null;
  const scheduledAtRaw = (formData.get("scheduledAt") as string) || "";
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  const steps = parseSteps(formData.get("steps") as string);

  if (steps.length === 0) {
    throw new Error("Mindestens ein Schritt erforderlich");
  }

  // Derive legacy `channels` JSON from steps so old UIs / stats still work
  const channelSet = new Set(steps.map((s) => s.channel));
  const channelsJson = JSON.stringify(Array.from(channelSet));

  const campaign = await prisma.campaign.create({
    data: {
      name: formData.get("name") as string,
      channels: channelsJson,
      senderId,
      scheduledAt,
      sendRatePerDay: parseInt(formData.get("sendRatePerDay") as string || "50"),
      // legacy A/B fields kept as null — per-step config is authoritative now
      templateAId: null,
      templateBId: null,
      letterTemplateId: null,
      abSplitRatio: 50,
      followUpEnabled: false,
      followUpDelayDays: 3,
      followUpTemplateId: null,
    },
  });

  // Create the steps
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await prisma.campaignStep.create({
      data: {
        campaignId: campaign.id,
        order: i,
        channel: s.channel,
        triggerType: s.triggerType,
        delayDays: s.delayDays ?? 0,
        scheduledAt: s.scheduledAt ? new Date(s.scheduledAt) : null,
        sendWindow: s.sendWindow || null,
        maxPerDay: s.maxPerDay,
        emailTemplateAId: s.emailTemplateAId,
        emailTemplateBId: s.emailTemplateBId,
        abSplitRatio: s.abSplitRatio,
        letterTemplateAId: s.letterTemplateAId,
        letterTemplateBId: s.letterTemplateBId,
        letterAbSplitRatio: s.letterAbSplitRatio,
        letterColor: s.letterColor,
        callNote: s.callNote,
      },
    });
  }

  // Enrol contacts — every contact starts at step 0
  for (const contactId of contactIds) {
    await prisma.campaignContact.create({
      data: {
        campaignId: campaign.id,
        contactId,
        currentStepIndex: 0,
      },
    });
  }

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaignStatus(campaignId: string, status: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status },
  });
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

/**
 * "Start" a campaign — sets it active. From here the cron picks it up and
 * evaluates steps per contact. Kept the export name for backward compat
 * with existing UI buttons.
 */
export async function sendCampaignEmails(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { steps: true, campaignContacts: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.steps.length === 0) {
    throw new Error("Diese Kampagne hat keine Schritte — bitte in Bearbeitung ergänzen.");
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "active" },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  return {
    queued: 0, // legacy field kept for UI compat; real work happens in cron
    contacts: campaign.campaignContacts.length,
    steps: campaign.steps.length,
  };
}

/**
 * Manually stop a specific contact's cadence (e.g. "Kunde geantwortet
 * per Telefon, keine weiteren Schritte").
 */
export async function stopContactCadence(campaignId: string, contactId: string, reason: string = "manual") {
  await prisma.campaignContact.updateMany({
    where: { campaignId, contactId, stopped: false },
    data: { stopped: true, stoppedReason: reason, stoppedAt: new Date() },
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Stop ALL of a contact's active cadences at once — used by the webhook
 * when a reply comes in.
 */
export async function stopAllCadencesForContact(contactId: string, reason: string = "replied") {
  const res = await prisma.campaignContact.updateMany({
    where: { contactId, stopped: false },
    data: { stopped: true, stoppedReason: reason, stoppedAt: new Date() },
  });
  return res.count;
}
