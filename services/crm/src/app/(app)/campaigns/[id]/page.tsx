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
      templateA: true,
      templateB: true,
      followUpTemplate: true,
      campaignContacts: { include: { contact: true } },
    },
  });

  if (!campaign) notFound();

  const emails = await prisma.email.findMany({
    where: { campaignId: id },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
  });

  // Stats
  const sent = emails.filter((e) => e.status !== "queued").length;
  const opened = emails.filter((e) => e.openedAt).length;
  const clicked = emails.filter((e) => e.clickedAt).length;
  const replied = emails.filter((e) => e.repliedAt).length;
  const bounced = emails.filter((e) => e.status === "bounced").length;
  const queued = emails.filter((e) => e.status === "queued").length;

  // A/B Stats
  const variantA = emails.filter((e) => e.variant === "A");
  const variantB = emails.filter((e) => e.variant === "B");
  const abStats = campaign.templateBId
    ? {
        a: {
          sent: variantA.filter((e) => e.status !== "queued").length,
          opened: variantA.filter((e) => e.openedAt).length,
          clicked: variantA.filter((e) => e.clickedAt).length,
          replied: variantA.filter((e) => e.repliedAt).length,
        },
        b: {
          sent: variantB.filter((e) => e.status !== "queued").length,
          opened: variantB.filter((e) => e.openedAt).length,
          clicked: variantB.filter((e) => e.clickedAt).length,
          replied: variantB.filter((e) => e.repliedAt).length,
        },
      }
    : null;

  return (
    <CampaignDetail
      campaign={campaign}
      emails={emails}
      stats={{ sent, opened, clicked, replied, bounced, queued, total: emails.length }}
      abStats={abStats}
    />
  );
}
