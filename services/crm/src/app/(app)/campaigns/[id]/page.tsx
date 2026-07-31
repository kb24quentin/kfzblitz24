export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CampaignDetail } from "./campaign-detail";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: {
          emailTemplateA: { select: { name: true } },
          emailTemplateB: { select: { name: true } },
          letterTemplateA: { select: { name: true } },
          letterTemplateB: { select: { name: true } },
        },
      },
      campaignContacts: {
        include: { contact: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) notFound();

  const emails = await prisma.email.findMany({
    where: { campaignId: id },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const letters = await prisma.letter.findMany({
    where: { campaignId: id },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Contact progress rows
  const contactRows = campaign.campaignContacts.map((cc) => ({
    ccId: cc.id,
    contact: {
      id: cc.contact.id,
      firstName: cc.contact.firstName,
      lastName: cc.contact.lastName,
      email: cc.contact.email,
    },
    currentStepIndex: cc.currentStepIndex,
    lastStepAt: cc.lastStepAt,
    stopped: cc.stopped,
    stoppedReason: cc.stoppedReason,
    stoppedAt: cc.stoppedAt,
  }));

  const stats = {
    total: contactRows.length,
    active: contactRows.filter((c) => !c.stopped && c.currentStepIndex < campaign.steps.length).length,
    completed: contactRows.filter(
      (c) => (c.stopped && c.stoppedReason === "completed") ||
             (!c.stopped && c.currentStepIndex >= campaign.steps.length)
    ).length,
    stopped: contactRows.filter((c) => c.stopped && c.stoppedReason !== "completed" && c.stoppedReason !== "replied").length,
    replied: contactRows.filter((c) => c.stopped && c.stoppedReason === "replied").length,
    perStep: await Promise.all(
      campaign.steps.map(async (s) => ({
        stepId: s.id,
        executed: await prisma.campaignContactStep.count({
          where: { stepId: s.id, status: "executed" },
        }),
      }))
    ),
  };

  return (
    <CampaignDetail
      campaign={{
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sendRatePerDay: campaign.sendRatePerDay,
        scheduledAt: campaign.scheduledAt,
        steps: campaign.steps,
      }}
      contacts={contactRows}
      stats={stats}
      emails={emails}
      letters={letters}
    />
  );
}
