export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, Send, Pause, Play, BarChart3 } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Send }> = {
  draft: { label: "Entwurf", color: "bg-gray-100 text-gray-700", icon: Send },
  active: { label: "Aktiv", color: "bg-green-100 text-green-700", icon: Play },
  paused: { label: "Pausiert", color: "bg-yellow-100 text-yellow-700", icon: Pause },
  completed: { label: "Abgeschlossen", color: "bg-blue-100 text-blue-700", icon: BarChart3 },
};

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      templateA: true,
      templateB: true,
      _count: { select: { emails: true, campaignContacts: true } },
    },
  });

  // Get email stats per campaign
  const campaignStats = await Promise.all(
    campaigns.map(async (c) => {
      const [sent, opened, replied, bounced] = await Promise.all([
        prisma.email.count({ where: { campaignId: c.id, status: { not: "queued" } } }),
        prisma.email.count({ where: { campaignId: c.id, openedAt: { not: null } } }),
        prisma.email.count({ where: { campaignId: c.id, repliedAt: { not: null } } }),
        prisma.email.count({ where: { campaignId: c.id, status: "bounced" } }),
      ]);
      return { id: c.id, sent, opened, replied, bounced };
    })
  );

  const statsMap = Object.fromEntries(campaignStats.map((s) => [s.id, s]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-light">{campaigns.length} Kampagne{campaigns.length !== 1 ? "n" : ""}</p>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neue Kampagne
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <Send className="w-12 h-12 text-text-light/40 mx-auto mb-3" />
          <p className="font-medium text-text">Noch keine Kampagnen</p>
          <p className="text-sm text-text-light mt-1">Erstelle deine erste Outreach-Kampagne</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const config = statusConfig[campaign.status] || statusConfig.draft;
            const stats = statsMap[campaign.id] || { sent: 0, opened: 0, replied: 0, bounced: 0 };
            const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : "0";
            const replyRate = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : "0";

            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="block bg-bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-text">{campaign.name}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    {campaign.templateBId && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        A/B Test ({campaign.abSplitRatio}/{100 - campaign.abSplitRatio})
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-text-light">
                    {campaign._count.campaignContacts} Kontakte
                  </span>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-text-light">Gesendet:</span>{" "}
                    <span className="font-medium">{stats.sent}</span>
                  </div>
                  <div>
                    <span className="text-text-light">Geöffnet:</span>{" "}
                    <span className="font-medium">{openRate}%</span>
                  </div>
                  <div>
                    <span className="text-text-light">Antworten:</span>{" "}
                    <span className="font-medium">{replyRate}%</span>
                  </div>
                  <div>
                    <span className="text-text-light">Bounced:</span>{" "}
                    <span className="font-medium">{stats.bounced}</span>
                  </div>
                  <div className="ml-auto text-xs text-text-light">
                    Template: {campaign.templateA.name}
                    {campaign.templateB && ` / ${campaign.templateB.name}`}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
