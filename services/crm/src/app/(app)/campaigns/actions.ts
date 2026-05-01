"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCampaign(formData: FormData) {
  const contactIds = JSON.parse(formData.get("contactIds") as string || "[]") as string[];
  const templateBId = formData.get("templateBId") as string;

  const campaign = await prisma.campaign.create({
    data: {
      name: formData.get("name") as string,
      templateAId: formData.get("templateAId") as string,
      templateBId: templateBId || null,
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

export async function sendCampaignEmails(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      templateA: true,
      templateB: true,
      campaignContacts: { include: { contact: true } },
    },
  });

  if (!campaign) throw new Error("Campaign not found");

  let queued = 0;

  for (const cc of campaign.campaignContacts) {
    // Check if email already sent
    const existing = await prisma.email.findFirst({
      where: { campaignId, contactId: cc.contactId },
    });
    if (existing) continue;

    const template = cc.variant === "B" && campaign.templateB
      ? campaign.templateB
      : campaign.templateA;

    // Render template with contact data
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
    };

    let subject = template.subject;
    let body = template.bodyHtml;
    let signature = template.signature ?? "";
    for (const [key, value] of Object.entries(replacements)) {
      const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      subject = subject.replace(re, value);
      body = body.replace(re, value);
      signature = signature.replace(re, value);
    }

    // Append the rendered signature with a thin separator so the body
    // sent to Resend mirrors what the user previewed in the editor.
    const fullBody = signature.trim()
      ? `${body}<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />${signature}`
      : body;

    await prisma.email.create({
      data: {
        campaignId,
        contactId: cc.contactId,
        templateId: template.id,
        variant: cc.variant,
        subject,
        body: fullBody,
        status: "queued",
      },
    });
    queued++;
  }

  // Update campaign status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "active" },
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  return { queued };
}
