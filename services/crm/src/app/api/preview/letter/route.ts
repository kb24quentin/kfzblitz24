import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  renderLetterPdf,
  extractAnredeAndParagraphs,
} from "@/lib/letter-pdf";

// Sample-Empfänger mit dem der PDF-Preview gerendert wird. Adresse gehört
// uns selbst (kein echter Kunde), damit man auch das Adressfenster sieht.
const SAMPLE_RECIPIENT = {
  company: "Muster Autohaus GmbH",
  salutation: "Herr" as const,
  firstName: "Max",
  lastName: "Mustermann",
  street: "Musterstraße",
  houseNumber: "42",
  zipCode: "80331",
  city: "München",
  country: "DE",
};

const SAMPLE_VARS: Record<string, string> = {
  salutation: SAMPLE_RECIPIENT.salutation,
  first_name: SAMPLE_RECIPIENT.firstName,
  last_name: SAMPLE_RECIPIENT.lastName,
  email: "max.mustermann@musterbetrieb.de",
  company: SAMPLE_RECIPIENT.company,
  position: "Geschäftsführer",
  city: SAMPLE_RECIPIENT.city,
  phone: "+49 89 12345678",
  street: SAMPLE_RECIPIENT.street,
  zip_code: SAMPLE_RECIPIENT.zipCode,
};

function substitute(s: string): string {
  return Object.entries(SAMPLE_VARS).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v),
    s
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as {
    subject?: string;
    bodyHtml?: string;
    letterPs?: string;
    letterSignatureId?: string;
    signatureName?: string;
  };

  const subject = substitute(body.subject || "Betreff");
  const substitutedBody = substitute(body.bodyHtml || "");
  const { anrede, paragraphs, closing } = extractAnredeAndParagraphs(substitutedBody);
  const ps = body.letterPs ? substitute(body.letterPs) : null;

  let signatureImage: string | null = null;
  if (body.letterSignatureId) {
    const sig = await prisma.letterSignature.findUnique({
      where: { id: body.letterSignatureId },
    });
    signatureImage = sig?.imageData ?? null;
  }

  const pdf = await renderLetterPdf({
    senderName: process.env.LETTER_SENDER_NAME || "kfzBlitz24 GmbH",
    senderLine1: process.env.LETTER_SENDER_LINE1 || "Bomhardstraße 7",
    senderLine2:
      process.env.LETTER_SENDER_LINE2 || "82031 Grünwald bei München",
    recipient: SAMPLE_RECIPIENT,
    anrede,
    subject,
    bodyParagraphs: paragraphs,
    closing,
    signatureImage,
    signatureName: body.signatureName || "Corinna Wagner",
    ps,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=preview.pdf",
      "Cache-Control": "no-store",
    },
  });
}
