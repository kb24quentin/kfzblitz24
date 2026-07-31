"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { htmlToPlainText } from "@/lib/email";

export type CampaignChannel = "email" | "letter" | "call";

function parseChannels(raw: string | null | undefined): CampaignChannel[] {
  try {
    const arr = JSON.parse(raw || "[\"email\"]") as unknown;
    if (!Array.isArray(arr)) return ["email"];
    const filtered = arr.filter((c): c is CampaignChannel =>
      c === "email" || c === "letter" || c === "call"
    );
    return filtered.length > 0 ? filtered : ["email"];
  } catch {
    return ["email"];
  }
}

export async function createCampaign(formData: FormData) {
  const contactIds = JSON.parse(formData.get("contactIds") as string || "[]") as string[];
  const templateBId = formData.get("templateBId") as string;
  const senderId = (formData.get("senderId") as string) || null;
  const scheduledAtRaw = (formData.get("scheduledAt") as string) || "";
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  // channels comes as a JSON-encoded string from the form (multi-select chips)
  const channelsRaw = (formData.get("channels") as string) || "[\"email\"]";
  const channels = parseChannels(channelsRaw);

  const campaign = await prisma.campaign.create({
    data: {
      name: formData.get("name") as string,
      channels: JSON.stringify(channels),
      templateAId: formData.get("templateAId") as string,
      templateBId: templateBId || null,
      senderId,
      scheduledAt,
      abSplitRatio: parseInt(formData.get("abSplitRatio") as string || "50"),
      sendRatePerDay: parseInt(formData.get("sendRatePerDay") as string || "50"),
      followUpEnabled: formData.get("followUpEnabled") === "true",
      followUpDelayDays: parseInt(formData.get("followUpDelayDays") as string || "3"),
      followUpTemplateId: (formData.get("followUpTemplateId") as string) || null,
    },
  });

  // Assign contacts with A/B variant
  const abRatio = parseInt(formData.get("abSplitRatio") as string || "50");
  const shuffled = [...contactIds].sort(() => Math.random() - 0.5);
  const splitIndex = Math.floor(shuffled.length * (abRatio / 100));

  for (let i = 0; i < shuffled.length; i++) {
    await prisma.campaignContact.create({
      data: {
        campaignId: campaign.id,
        contactId: shuffled[i],
        variant: templateBId ? (i < splitIndex ? "A" : "B") : "A",
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
 * Renamed intent: this now queues everything the campaign's `channels`
 * config asks for — emails, letters, and/or call reminders. Kept the
 * "sendCampaignEmails" export name so existing UI buttons keep working.
 */
export async function sendCampaignEmails(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      templateA: { include: { signature: true } },
      templateB: { include: { signature: true } },
      sender: true,
      campaignContacts: { include: { contact: true } },
    },
  });

  if (!campaign) throw new Error("Campaign not found");

  const channels = parseChannels(campaign.channels);
  const doEmail = channels.includes("email");
  const doLetter = channels.includes("letter");
  const doCall = channels.includes("call");

  let queuedEmails = 0;
  let queuedLetters = 0;
  let queuedCalls = 0;
  let skippedNoAddress = 0;

  for (const cc of campaign.campaignContacts) {
    const contact = cc.contact;
    const template = cc.variant === "B" && campaign.templateB
      ? campaign.templateB
      : campaign.templateA;

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

    const subject = sub(template.subject);
    const bodyHtml = sub(template.bodyHtml);
    const signature = sub(template.signature?.html ?? "");
    const fullBodyHtml = signature.trim()
      ? `${bodyHtml}<div style="margin-top:24px">${signature}</div>`
      : bodyHtml;

    // ── EMAIL ─────────────────────────────────────────────────────────
    if (doEmail) {
      const already = await prisma.email.findFirst({
        where: { campaignId, contactId: cc.contactId },
      });
      if (!already) {
        await prisma.email.create({
          data: {
            campaignId,
            contactId: cc.contactId,
            templateId: template.id,
            variant: cc.variant,
            subject,
            body: fullBodyHtml,
            status: "queued",
          },
        });
        queuedEmails++;
      }
    }

    // ── LETTER ────────────────────────────────────────────────────────
    if (doLetter) {
      // Nur wenn Adresse vollständig ist — sonst nicht queuen (Fehler
      // beim Rendern des Adressblocks vermeiden).
      const addressOk = !!(contact.street && contact.zipCode && contact.city);
      if (!addressOk) {
        skippedNoAddress++;
      } else {
        const already = await prisma.letter.findFirst({
          where: { campaignId, contactId: cc.contactId },
        });
        if (!already) {
          // For letters we store the plain-text body (already substituted).
          // The signature is appended too — plain text version.
          const combined = signature.trim()
            ? `${bodyHtml}\n\n${signature}`
            : bodyHtml;
          await prisma.letter.create({
            data: {
              campaignId,
              contactId: cc.contactId,
              templateId: template.id,
              subject,
              body: htmlToPlainText(combined),
              status: "queued",
            },
          });
          queuedLetters++;
        }
      }
    }

    // ── CALL ──────────────────────────────────────────────────────────
    if (doCall) {
      // Simple approach: create a reminder for the campaign owner (or any
      // active admin) to call this contact. Assigned-to user preferred.
      const userId = contact.assignedToId
        ?? (await prisma.user.findFirst({ where: { active: true, role: "admin" } }))?.id
        ?? (await prisma.user.findFirst({ where: { active: true } }))?.id;
      if (userId) {
        const already = await prisma.reminder.findFirst({
          where: {
            contactId: cc.contactId,
            title: { contains: campaign.name },
          },
        });
        if (!already) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 1); // fällig morgen
          await prisma.reminder.create({
            data: {
              contactId: cc.contactId,
              userId,
              title: `Anruf: ${campaign.name}`,
              description: `Kampagnen-Anruf gemäß Channel "call" — Betreff: ${subject}`,
              dueDate,
            },
          });
          queuedCalls++;
        }
      }
    }
  }

  // Update campaign status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "active" },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  return {
    // legacy field for backward compat with the UI:
    queued: queuedEmails + queuedLetters + queuedCalls,
    queuedEmails,
    queuedLetters,
    queuedCalls,
    skippedNoAddress,
  };
}
