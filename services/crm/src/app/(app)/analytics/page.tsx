export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { BarChart3, TrendingUp, Mail, MessageSquare, MousePointerClick } from "lucide-react";

export default async function AnalyticsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: { templateA: true, templateB: true },
    orderBy: { createdAt: "desc" },
  });

  const campaignStats = await Promise.all(
    campaigns.map(async (c) => {
      const emails = await prisma.email.findMany({ where: { campaignId: c.id } });
      const sent = emails.filter((e) => e.status !== "queued").length;
      const opened = emails.filter((e) => e.openedAt).length;
      const clicked = emails.filter((e) => e.clickedAt).length;
      const replied = emails.filter((e) => e.repliedAt).length;
      const bounced = emails.filter((e) => e.status === "bounced").length;

      // A/B Stats
      const varA = emails.filter((e) => e.variant === "A");
      const varB = emails.filter((e) => e.variant === "B");

      return {
        campaign: c,
        sent,
        opened,
        clicked,
        replied,
        bounced,
        openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0",
        clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0",
        replyRate: sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0",
        ab: c.templateBId
          ? {
              a: {
                sent: varA.filter((e) => e.status !== "queued").length,
                opened: varA.filter((e) => e.openedAt).length,
                clicked: varA.filter((e) => e.clickedAt).length,
                replied: varA.filter((e) => e.repliedAt).length,
              },
              b: {
                sent: varB.filter((e) => e.status !== "queued").length,
                opened: varB.filter((e) => e.openedAt).length,
                clicked: varB.filter((e) => e.clickedAt).length,
                replied: varB.filter((e) => e.repliedAt).length,
              },
            }
          : null,
      };
    })
  );

  // Overall stats
  const totalSent = campaignStats.reduce((sum, s) => sum + s.sent, 0);
  const totalOpened = campaignStats.reduce((sum, s) => sum + s.opened, 0);
  const totalClicked = campaignStats.reduce((sum, s) => sum + s.clicked, 0);
  const totalReplied = campaignStats.reduce((sum, s) => sum + s.replied, 0);
  const totalBounced = campaignStats.reduce((sum, s) => sum + s.bounced, 0);

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Gesendet", value: totalSent, icon: Mail, color: "bg-accent" },
          { label: "Open Rate", value: totalSent > 0 ? `${((totalOpened / totalSent) * 100).toFixed(1)}%` : "0%", icon: TrendingUp, color: "bg-success" },
          { label: "Click Rate", value: totalSent > 0 ? `${((totalClicked / totalSent) * 100).toFixed(1)}%` : "0%", icon: MousePointerClick, color: "bg-info" },
          { label: "Reply Rate", value: totalSent > 0 ? `${((totalReplied / totalSent) * 100).toFixed(1)}%` : "0%", icon: MessageSquare, color: "bg-primary" },
          { label: "Bounce Rate", value: totalSent > 0 ? `${((totalBounced / totalSent) * 100).toFixed(1)}%` : "0%", icon: BarChart3, color: "bg-danger" },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card rounded-xl border border-border p-5">
            <div className={`${stat.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-text">{stat.value}</p>
            <p className="text-sm text-text-light">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Campaign Comparison */}
      <div className="bg-bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-text mb-4">Kampagnen-Vergleich</h2>
        {campaignStats.length === 0 ? (
          <p className="text-sm text-text-light text-center py-8">Noch keine Kampagnen-Daten vorhanden</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium text-text-light">Kampagne</th>
                <th className="text-right p-3 font-medium text-text-light">Gesendet</th>
                <th className="text-right p-3 font-medium text-text-light">Open Rate</th>
                <th className="text-right p-3 font-medium text-text-light">Click Rate</th>
                <th className="text-right p-3 font-medium text-text-light">Reply Rate</th>
                <th className="text-right p-3 font-medium text-text-light">Bounced</th>
              </tr>
            </thead>
            <tbody>
              {campaignStats.map((s) => (
                <tr key={s.campaign.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{s.campaign.name}</td>
                  <td className="p-3 text-right">{s.sent}</td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-12 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                        <span className="block h-full bg-success rounded-full" style={{ width: `${s.openRate}%` }} />
                      </span>
                      {s.openRate}%
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-12 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                        <span className="block h-full bg-info rounded-full" style={{ width: `${s.clickRate}%` }} />
                      </span>
                      {s.clickRate}%
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-12 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                        <span className="block h-full bg-primary rounded-full" style={{ width: `${s.replyRate}%` }} />
                      </span>
                      {s.replyRate}%
                    </span>
                  </td>
                  <td className="p-3 text-right text-danger">{s.bounced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* A/B Test Results */}
      {campaignStats.filter((s) => s.ab).length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-text mb-4">A/B Test Ergebnisse</h2>
          <div className="space-y-6">
            {campaignStats
              .filter((s) => s.ab)
              .map((s) => (
                <div key={s.campaign.id}>
                  <h3 className="font-medium text-text mb-3">{s.campaign.name}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: `A: ${s.campaign.templateA.name}`, data: s.ab!.a, color: "border-blue-300" },
                      { label: `B: ${s.campaign.templateB?.name}`, data: s.ab!.b, color: "border-purple-300" },
                    ].map((v) => {
                      const openRate = v.data.sent > 0 ? ((v.data.opened / v.data.sent) * 100).toFixed(1) : "0";
                      const clickRate = v.data.sent > 0 ? ((v.data.clicked / v.data.sent) * 100).toFixed(1) : "0";
                      const replyRate = v.data.sent > 0 ? ((v.data.replied / v.data.sent) * 100).toFixed(1) : "0";
                      return (
                        <div key={v.label} className={`p-4 rounded-lg bg-bg-secondary border-l-4 ${v.color}`}>
                          <p className="font-medium text-sm mb-2">{v.label}</p>
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <p className="text-text-light text-xs">Gesendet</p>
                              <p className="font-semibold">{v.data.sent}</p>
                            </div>
                            <div>
                              <p className="text-text-light text-xs">Open Rate</p>
                              <p className="font-semibold">{openRate}%</p>
                            </div>
                            <div>
                              <p className="text-text-light text-xs">Click Rate</p>
                              <p className="font-semibold">{clickRate}%</p>
                            </div>
                            <div>
                              <p className="text-text-light text-xs">Reply Rate</p>
                              <p className="font-semibold">{replyRate}%</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
