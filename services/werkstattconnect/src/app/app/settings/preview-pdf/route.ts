import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildDocPdf } from "@/lib/pdf/templates";
import type { PdfDoc } from "@/lib/pdf/types";
import { calcPosition, sumPositions, type InvoicePosition } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Live-PDF-preview für settings-page. Nutzt aktuelle workshop-settings
 * (adresse, logo, farben, footer-cols, iban) und mockup-daten für positionen.
 * Query-params override: ?template=X&primary=Y — damit user beim klicken auf
 * ein template die preview sofort sieht ohne zu speichern.
 */
export async function GET(req: Request) {
  const session = await auth();
  const u = session?.user as { workshopId?: string; audience?: string; role?: string } | undefined;
  if (u?.audience !== "workshop" || !u?.workshopId) return new NextResponse("Unauthorized", { status: 401 });
  if (u.role !== "owner" && u.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const workshop = await prisma.workshop.findUnique({ where: { id: u.workshopId } });
  if (!workshop) return new NextResponse("Not found", { status: 404 });

  const url = new URL(req.url);
  const template = url.searchParams.get("template") || workshop.letterheadTemplate;
  const primary = url.searchParams.get("primary") || workshop.brandPrimary || "#fe6503";
  const accent = url.searchParams.get("accent") || workshop.brandAccent;
  const footerCol1 = url.searchParams.get("footerCol1") ?? workshop.footerCol1;
  const footerCol2 = url.searchParams.get("footerCol2") ?? workshop.footerCol2;
  const footerCol3 = url.searchParams.get("footerCol3") ?? workshop.footerCol3;

  const positions: InvoicePosition[] = [
    mkPos("labor", "Ölwechsel mit Filter", "Motoröl 5W-30 + Ölfilter", 0.5, "Std", 9500, 19),
    mkPos("labor", "HU (TÜV) Vorführung", "Anmeldung, Präsentation, Bericht", 0.7, "Std", 9500, 19),
    mkPos("labor", "Bremsscheiben + Beläge vorne", "beide Achsseiten", 1.2, "Std", 9500, 19),
    mkPos("part", "Motoröl 5W-30 (Longlife)", undefined, 5, "l", 1250, 19),
    mkPos("part", "Ölfilter Mahle OC 205", undefined, 1, "Stk", 1490, 19),
    mkPos("part", "Bremsscheiben-Satz vorne", "ATE 24.0128", 1, "Stk", 8950, 19),
    mkPos("part", "Bremsbelag-Satz vorne", "TRW GDB1550", 1, "Stk", 4790, 19),
  ];
  const totals = sumPositions(positions);

  const doc: PdfDoc = {
    kind: "invoice",
    number: `${workshop.invoicePrefix}${String(new Date().getFullYear()).slice(-2)}-0001`,
    title: "Rechnung",
    issuedAt: new Date(),
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    positions,
    subtotalNetCent: totals.subtotalNetCent,
    totalVatCent: totals.totalVatCent,
    totalGrossCent: totals.totalGrossCent,
    notes: "Vielen Dank für Ihren Auftrag. Bei Rückfragen sind wir gerne für Sie da.",
    mileageAtIssue: 84500,
    customer: {
      type: "b2c",
      companyName: null,
      firstName: "Max",
      lastName: "Mustermann",
      email: "max.mustermann@example.de",
      street: "Musterstraße 12",
      zip: "80331",
      city: "München",
    },
    vehicle: {
      brand: "BMW",
      model: "320d Touring",
      licensePlate: "M-AB 1234",
      vin: "WBAAA31090KX12345",
      mileage: 84500,
    },
    workshop: {
      name: workshop.name,
      street: workshop.street,
      zip: workshop.zip,
      city: workshop.city,
      contactEmail: workshop.contactEmail,
      contactPhone: workshop.contactPhone,
      taxId: workshop.taxId,
      iban: workshop.iban,
      bic: workshop.bic,
      bankName: workshop.bankName,
      brandPrimary: primary,
      brandAccent: accent,
      brandFooterText: workshop.brandFooterText,
      footerCol1,
      footerCol2,
      footerCol3,
      letterheadLogo: workshop.letterheadLogo,
      letterheadLogoMime: workshop.letterheadLogoMime,
      letterheadTemplate: template,
    },
  };

  const pdf = await buildDocPdf(doc);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="briefpapier-vorschau.pdf"`,
    },
  });
}

function mkPos(
  kind: "labor" | "part",
  name: string,
  description: string | undefined,
  quantity: number,
  unit: string,
  netPriceCent: number,
  vatPercent: number
): InvoicePosition {
  const { netTotalCent, vatTotalCent, grossTotalCent } = calcPosition(quantity, netPriceCent, vatPercent);
  return { kind, name, description, quantity, unit, netPriceCent, vatPercent, netTotalCent, vatTotalCent, grossTotalCent };
}
