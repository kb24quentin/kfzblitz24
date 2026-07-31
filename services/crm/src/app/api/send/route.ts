import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFromAddress, getListUnsubscribeHeaders, htmlToPlainText } from "@/lib/email";
import { sendPrintjob, currentMode } from "@/lib/ob24";
import { renderLetterPdf, extractAnredeAndParagraphs } from "@/lib/letter-pdf";

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

    // ── Letters ────────────────────────────────────────────────────────
    let totalLettersSent = 0;
    if (process.env.OB24_API_KEY) {
      for (const campaign of activeCampaigns) {
        const queuedLetters = await prisma.letter.findMany({
          where: { campaignId: campaign.id, status: "queued" },
          take: campaign.sendRatePerDay,
          include: { contact: true },
        });

        for (const letter of queuedLetters) {
          try {
            const c = letter.contact;
            // Body vs. P.S. splitten (Marker "[P.S.]" — von sendCampaignEmails gesetzt)
            const rawBody = letter.body;
            let mainBody = rawBody;
            let psText: string | null = null;
            const psSplit = rawBody.split(/\n{2,}\[P\.S\.\]\n/);
            if (psSplit.length === 2) {
              mainBody = psSplit[0];
              psText = psSplit[1].trim();
            }
            // Anrede erkennt automatisch "Sehr geehrter ..." — sonst Fallback
            const { anrede, paragraphs } = extractAnredeAndParagraphs(mainBody);

            const senderConf = campaign.sender ?? null;
            const pdf = await renderLetterPdf({
              senderName:
                process.env.LETTER_SENDER_NAME || "kfzBlitz24 GmbH",
              senderLine1:
                process.env.LETTER_SENDER_LINE1 || "Bomhardstraße 7",
              senderLine2:
                process.env.LETTER_SENDER_LINE2 ||
                "82031 Grünwald bei München",
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
              signatureName: senderConf?.name?.split(" - ")[0] ?? "kfzBlitz24 Team",
              ps: psText,
              footer:
                "kfzBlitz24 GmbH · Bomhardstraße 7 · 82031 Grünwald bei München · " +
                "Geschäftsführer: Christian Engert · HRB 291765 Amtsgericht München · USt-IdNr.: DE367617344",
              versionCode: "AKQ-KB24 · Rev. 07/2026 · v1.0",
            });

            const result = await sendPrintjob({ pdf });

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
                type: "email_sent", // reuse type; content differentiates
                content:
                  `Brief-Kampagne (${currentMode()}-Modus): ${campaign.name} — ` +
                  `OB24-Job #${result.id}, ${item?.pages ?? "?"} Seiten`,
              },
            });

            totalLettersSent++;
          } catch (err) {
            console.error(`Failed to send letter ${letter.id}:`, err);
            await prisma.letter.update({
              where: { id: letter.id },
              data: { status: "failed" },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: totalSent,
      lettersSent: totalLettersSent,
    });
  } catch (error) {
    console.error("Send queue error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
