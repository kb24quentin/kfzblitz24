import { prisma } from "@/lib/db";
import {
  belegEmailMatches,
  extractOrderNumbers,
  isLookupConfigured,
  lookupOrder,
} from "@/lib/webisco-lookup";

/**
 * Scans a message body for KB24-* order numbers, looks each up in Webisco,
 * cross-checks the ticket contact email, and upserts TicketOrder rows.
 * Non-blocking — meant to be called fire-and-forget. Logs errors but never
 * throws so gmail-sync doesn't fail because Webisco is down.
 */
export async function linkOrdersFromMessage(
  ticketId: string,
  bodyText: string,
): Promise<void> {
  if (!isLookupConfigured()) return;

  const refs = extractOrderNumbers(bodyText);
  if (refs.length === 0) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, contact: { select: { email: true } } },
  });
  if (!ticket) return;
  const contactEmail = ticket.contact.email;

  for (const ref of refs) {
    try {
      const result = await lookupOrder(ref);
      if (!result.ok) {
        // Persist the failure too so the sidebar can show a specific reason
        // (e.g. Streckengeschäft not indexed) instead of "noch nicht geladen".
        await prisma.ticketOrder.upsert({
          where: { ticketId_ref: { ticketId, ref } },
          create: {
            ticketId,
            ref,
            source: "ai_detected",
            lastLookupError: result.error,
            lastLookupAt: new Date(),
          },
          update: {
            lastLookupError: result.error,
            lastLookupAt: new Date(),
          },
        });
        console.log(`[order-detect] ${ref} lookup failed: ${result.error}`);
        continue;
      }

      const matched = belegEmailMatches(result.beleg, contactEmail);

      await prisma.ticketOrder.upsert({
        where: { ticketId_ref: { ticketId, ref } },
        create: {
          ticketId,
          ref,
          source: "ai_detected",
          emailMatched: matched,
          status: result.beleg.status ?? null,
          totalBrutto: result.beleg.endpreis_brutto ?? null,
          webiscoData: JSON.stringify(result.beleg),
          fetchedAt: new Date(),
          lastLookupError: null,
          lastLookupAt: new Date(),
        },
        update: {
          emailMatched: matched,
          status: result.beleg.status ?? null,
          totalBrutto: result.beleg.endpreis_brutto ?? null,
          webiscoData: JSON.stringify(result.beleg),
          fetchedAt: new Date(),
          lastLookupError: null,
          lastLookupAt: new Date(),
        },
      });

      await prisma.ticketEvent.create({
        data: {
          ticketId,
          type: "order_linked",
          meta: JSON.stringify({ ref, emailMatched: matched, source: "ai_detected" }),
        },
      });
    } catch (err) {
      console.warn(
        `[order-detect] ${ref} upsert failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
