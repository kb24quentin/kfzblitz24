import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFromAddress, getListUnsubscribeHeaders, htmlToPlainText } from "@/lib/email";

// This API route processes the email send queue
// Call it via cron job or manually to send queued emails
export async function POST() {
  try {
    const now = new Date();
    // Get active campaigns whose scheduledAt has passed (or is null = send-now)
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        status: "active",
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      },
      include: { sender: true },
    });

    let totalSent = 0;

    for (const campaign of activeCampaigns) {
      // Per-campaign sender falls back to the env FROM_* pair
      const fromAddress = campaign.sender
        ? `"${campaign.sender.name.replace(/"/g, "")}" <${campaign.sender.email}>`
        : getFromAddress();

      // Get queued emails for this campaign, respecting rate limit
      const queuedEmails = await prisma.email.findMany({
        where: { campaignId: campaign.id, status: "queued" },
        take: campaign.sendRatePerDay,
        include: { contact: true },
      });

      for (const email of queuedEmails) {
        try {
          // Check if Resend API key is configured
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
            // Demo mode: mark as sent without actually sending
            await prisma.email.update({
              where: { id: email.id },
              data: {
                status: "sent",
                sentAt: new Date(),
              },
            });
          }

          // Update contact status + lastContactedAt
          await prisma.contact.update({
            where: { id: email.contactId },
            data: {
              lastContactedAt: new Date(),
              ...(email.contact.status === "new" ? { status: "contacted" } : {}),
            },
          });

          // Activity log entry — system action (no userId)
          await prisma.activity.create({
            data: {
              contactId: email.contactId,
              userId: null,
              type: "email_sent",
              content: `Kampagne: ${campaign.name} — ${email.subject}`,
            },
          });

          totalSent++;
        } catch (err) {
          console.error(`Failed to send email ${email.id}:`, err);
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "failed" },
          });
        }
      }
    }

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (error) {
    console.error("Send queue error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
