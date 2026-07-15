import { prisma } from "@/lib/db";
import { sendMailAndPersist } from "@/lib/resend-send";
import { fullNameOf } from "@/lib/name-parse";

const REMINDER_AFTER_DAYS = 5;

/**
 * Nach 5 Tagen ohne Kunden-Antwort in status=pending: einmalig eine
 * Erinnerung schicken ("noch offen?"). Dedupliziert via TicketEvent
 * 'reminder_sent' — jeder pending-cycle bekommt max 1 reminder.
 * Der auto-close-check bei 7d greift dann als endpunkt.
 */
export async function sendReminderIfNeeded(): Promise<number> {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.ticket.findMany({
    where: {
      status: "pending",
      // letzte outbound war vor >=5d
      messages: {
        some: {
          direction: "outbound",
          createdAt: { lte: fiveDaysAgo },
        },
      },
    },
    select: {
      id: true,
      code: true,
      subject: true,
      contact: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, direction: true },
      },
      events: {
        where: { type: "reminder_sent" },
        select: { id: true },
        take: 1,
      },
    },
  });

  let sent = 0;
  for (const t of candidates) {
    // Skip wenn schon reminder für diesen pending-cycle geschickt
    if (t.events.length > 0) continue;

    const last = t.messages[0];
    if (!last || last.direction !== "outbound" || last.createdAt > fiveDaysAgo) continue;

    const firstName = t.contact.firstName || (fullNameOf(t.contact) || "").split(" ")[0] || "";
    const salutation = firstName ? `Guten Tag ${firstName},` : "Guten Tag,";
    const bodyHtml = [
      `<p>${salutation}</p>`,
      `<p>wir haben Ihre Anfrage zum Ticket <strong>#${t.code}</strong> vor einigen Tagen beantwortet und noch keine Rückmeldung von Ihnen erhalten.</p>`,
      `<p>Ist Ihre Frage damit erledigt oder benötigen Sie noch etwas von uns?</p>`,
      `<p>Falls wir nichts mehr hören, schließen wir das Ticket in 2 Tagen automatisch — Sie können sich aber jederzeit wieder bei uns melden.</p>`,
      ``,
      `<p>Mit freundlichen Grüßen</p>`,
    ].join("\n");

    try {
      await sendMailAndPersist({
        ticketId: t.id,
        subject: t.subject.startsWith("Re: ") ? t.subject : `Re: ${t.subject}`,
        bodyHtml,
        authorUserId: null,
        kind: "acknowledgement", // technisch nicht ganz — aber counts-not-as-first-response
        appendSignature: false, // absichtlich anonym, ist eine system-mail
        countsAsFirstResponse: false,
      });
      await prisma.ticketEvent.create({
        data: {
          ticketId: t.id,
          type: "reminder_sent",
          meta: JSON.stringify({ lastOutboundAt: last.createdAt.toISOString() }),
        },
      });
      sent++;
    } catch (err) {
      console.warn(`[reminder] send failed for ${t.code}:`, err instanceof Error ? err.message : err);
    }
  }
  return sent;
}
