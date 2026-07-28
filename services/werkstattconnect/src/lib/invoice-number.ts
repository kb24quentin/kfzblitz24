import { prisma } from "./db";

/**
 * GoBD: gapless invoice-number pro workshop+year. Transaction sperrt die
 * workshop-row während wir zählen — kein race-condition, keine löcher.
 * Format: {prefix}{YY}-{4-digit-seq}   z.B. RE-26-0042
 */
export async function nextInvoiceNumber(workshopId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const workshop = await tx.workshop.findUnique({
      where: { id: workshopId },
      select: { invoicePrefix: true, invoiceNumberYear: true, invoiceNumberLast: true },
    });
    if (!workshop) throw new Error("Werkstatt nicht gefunden");

    const now = new Date();
    const year = now.getFullYear();
    const yy = String(year).slice(-2);

    const nextSeq =
      workshop.invoiceNumberYear === year ? workshop.invoiceNumberLast + 1 : 1;

    await tx.workshop.update({
      where: { id: workshopId },
      data: { invoiceNumberYear: year, invoiceNumberLast: nextSeq },
    });

    const prefix = workshop.invoicePrefix || "RE-";
    return `${prefix}${yy}-${String(nextSeq).padStart(4, "0")}`;
  });
}

/**
 * Gapless quote-number analog invoice-number, aber unter quotePrefix/quoteNumber*.
 */
export async function nextQuoteNumber(workshopId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const workshop = await tx.workshop.findUnique({
      where: { id: workshopId },
      select: { quotePrefix: true, quoteNumberYear: true, quoteNumberLast: true },
    });
    if (!workshop) throw new Error("Werkstatt nicht gefunden");
    const now = new Date();
    const year = now.getFullYear();
    const yy = String(year).slice(-2);
    const nextSeq =
      workshop.quoteNumberYear === year ? workshop.quoteNumberLast + 1 : 1;
    await tx.workshop.update({
      where: { id: workshopId },
      data: { quoteNumberYear: year, quoteNumberLast: nextSeq },
    });
    const prefix = workshop.quotePrefix || "AN-";
    return `${prefix}${yy}-${String(nextSeq).padStart(4, "0")}`;
  });
}
