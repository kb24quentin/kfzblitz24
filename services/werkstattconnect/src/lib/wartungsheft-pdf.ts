import { PDFDocument, rgb } from "pdf-lib";
import { A4, BLACK, GRAY, LIGHT, BORDER, WHITE, s, fmt, drawRight, drawCenter, hexToRgb, embedLogo, loadFonts, drawFooter, wrap } from "./pdf/helpers";
import type { InvoicePosition } from "./money";
import { customerDisplayName, vehicleDisplayName } from "./customer-name";
import type { PdfDoc } from "./pdf/types";

type Entry = {
  date: Date;
  invoiceNumber: string;
  mileage: number | null;
  positions: InvoicePosition[];
  totalGrossCent: number;
};

type WartungsheftInput = {
  workshop: PdfDoc["workshop"];
  customer: PdfDoc["customer"];
  vehicle: {
    brand: string | null;
    model: string | null;
    variant: string | null;
    licensePlate: string | null;
    vin: string | null;
    year: number | null;
    firstRegistration: Date | null;
    hsn: string | null;
    tsn: string | null;
    fuelType: string | null;
    power: number | null;
    color: string | null;
    mileage: number | null;
    nextTuev: Date | null;
    nextInspection: Date | null;
  };
  entries: Entry[]; // chronologisch aufsteigend
};

/**
 * Virtuelles Wartungsheft — druckbares PDF für Kunden.
 * WerkstattConnect-branded (mit workshop-logo), chronologisch alle rechnungen,
 * fahrzeug-stammdaten, aktuelle km/HU/Wartung.
 */
export async function buildWartungsheftPdf(input: WartungsheftInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const brand = hexToRgb(input.workshop.brandPrimary);

  let logo = null as null | { img: any; w: number; h: number };
  if (input.workshop.letterheadLogo && input.workshop.letterheadLogo.length > 0) {
    logo = await embedLogo(pdf, new Uint8Array(input.workshop.letterheadLogo), input.workshop.letterheadLogoMime || "image/png", 120, 55);
  }

  // ======================= COVER PAGE =======================
  const cover = pdf.addPage([A4.w, A4.h]);
  // Header-band
  cover.drawRectangle({ x: 0, y: A4.h - 130, width: A4.w, height: 130, color: brand });
  if (logo) cover.drawImage(logo.img, { x: 50, y: A4.h - 90, width: logo.w, height: logo.h });
  drawRight(cover, s(input.workshop.name), A4.w - 50, A4.h - 55, fonts.helvBold, 14, WHITE);
  drawRight(cover, s(input.workshop.contactEmail), A4.w - 50, A4.h - 75, fonts.helv, 10, WHITE);

  drawCenter(cover, "SERVICE- & WARTUNGSHEFT", A4.w / 2, A4.h - 200, fonts.helvBold, 22, brand);
  drawCenter(cover, s(vehicleDisplayName(input.vehicle)), A4.w / 2, A4.h - 230, fonts.helvBold, 16, BLACK);
  drawCenter(cover, s(`für ${customerDisplayName(input.customer)}`), A4.w / 2, A4.h - 250, fonts.helv, 12, GRAY);

  // Fahrzeug-details in einer schönen box
  const boxY = A4.h - 300;
  const boxH = 220;
  cover.drawRectangle({ x: 60, y: boxY - boxH, width: A4.w - 120, height: boxH, borderColor: BORDER, borderWidth: 1, color: undefined });

  const kv: [string, string | null][] = [
    ["Kennzeichen", input.vehicle.licensePlate],
    ["Marke / Modell", [input.vehicle.brand, input.vehicle.model, input.vehicle.variant].filter(Boolean).join(" ")],
    ["Baujahr", input.vehicle.year ? String(input.vehicle.year) : null],
    ["Erstzulassung", input.vehicle.firstRegistration ? input.vehicle.firstRegistration.toLocaleDateString("de-DE") : null],
    ["FIN", input.vehicle.vin],
    ["HSN / TSN", input.vehicle.hsn && input.vehicle.tsn ? `${input.vehicle.hsn} / ${input.vehicle.tsn}` : null],
    ["Kraftstoff", input.vehicle.fuelType],
    ["Leistung", input.vehicle.power ? `${input.vehicle.power} kW` : null],
    ["Farbe", input.vehicle.color],
    ["Aktueller km-Stand", input.vehicle.mileage != null ? `${input.vehicle.mileage.toLocaleString("de-DE")} km` : null],
    ["Nächste HU", input.vehicle.nextTuev ? input.vehicle.nextTuev.toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" }) : null],
    ["Nächste Wartung", input.vehicle.nextInspection ? input.vehicle.nextInspection.toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" }) : null],
  ];
  let ky = boxY - 25;
  const kx = 80;
  const vx = 260;
  for (const [label, value] of kv) {
    if (!value) continue;
    cover.drawText(s(label), { x: kx, y: ky, size: 10, font: fonts.helv, color: GRAY });
    cover.drawText(s(value), { x: vx, y: ky, size: 10, font: fonts.helvBold, color: BLACK });
    ky -= 16;
  }

  drawCenter(cover, s(`${input.entries.length} dokumentierte Wartungen`), A4.w / 2, 100, fonts.helvBold, 13, brand);
  drawCenter(cover, `Erstellt am ${new Date().toLocaleDateString("de-DE")} · ${input.workshop.name}`, A4.w / 2, 80, fonts.helv, 9, GRAY);
  drawCenter(cover, "Bitte bewahren Sie dieses Heft zusammen mit den Fahrzeugpapieren auf.", A4.w / 2, 62, fonts.helvObl, 9, LIGHT);

  drawFooter(cover, mkPdfDoc(input), fonts);

  // ======================= HISTORY-PAGES =======================
  if (input.entries.length === 0) {
    const empty = pdf.addPage([A4.w, A4.h]);
    drawCenter(empty, "Noch keine Werkstatt-Einträge vorhanden.", A4.w / 2, A4.h / 2, fonts.helv, 12, GRAY);
    drawFooter(empty, mkPdfDoc(input), fonts);
    return Buffer.from(await pdf.save());
  }

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - 60;

  function drawPageHeader(pg: import("pdf-lib").PDFPage) {
    pg.drawRectangle({ x: 0, y: A4.h - 45, width: A4.w, height: 45, color: brand });
    pg.drawText(s(`Wartungshistorie · ${vehicleDisplayName(input.vehicle)}`), { x: 50, y: A4.h - 30, size: 11, font: fonts.helvBold, color: WHITE });
    drawRight(pg, s(input.workshop.name), A4.w - 50, A4.h - 30, fonts.helv, 9, WHITE);
    drawFooter(pg, mkPdfDoc(input), fonts);
  }

  drawPageHeader(page);
  y = A4.h - 75;

  for (const entry of input.entries) {
    const entryHeaderH = 26;
    const positionsH = Math.min(entry.positions.length, 8) * 14 + 20;
    const totalH = entryHeaderH + positionsH + 20;

    if (y - totalH < 90) {
      page = pdf.addPage([A4.w, A4.h]);
      drawPageHeader(page);
      y = A4.h - 75;
    }

    // Datum-badge + Rechnung
    page.drawRectangle({ x: 50, y: y - entryHeaderH, width: A4.w - 100, height: entryHeaderH, color: rgb(0.97, 0.97, 0.97) });
    page.drawText(s(entry.date.toLocaleDateString("de-DE")), { x: 60, y: y - 18, size: 12, font: fonts.helvBold, color: brand });
    page.drawText(s(`Rechnung ${entry.invoiceNumber}`), { x: 160, y: y - 18, size: 10, font: fonts.helv, color: BLACK });
    if (entry.mileage != null) {
      page.drawText(s(`${entry.mileage.toLocaleString("de-DE")} km`), { x: 340, y: y - 18, size: 10, font: fonts.helv, color: GRAY });
    }
    drawRight(page, `${fmt(entry.totalGrossCent)} EUR`, A4.w - 60, y - 18, fonts.helvBold, 10, BLACK);
    y -= entryHeaderH + 4;

    // Positionen
    for (const p of entry.positions.slice(0, 8)) {
      const kindTag = p.kind === "labor" ? "[Arbeit]" : "[Teil]";
      page.drawText(kindTag, { x: 65, y, size: 7, font: fonts.helv, color: LIGHT });
      const nameLines = wrap(s(p.name), 380, fonts.helv, 9, 1);
      page.drawText(nameLines[0] || "", { x: 105, y, size: 9, font: fonts.helv, color: BLACK });
      drawRight(page, `${p.quantity.toLocaleString("de-DE")} ${p.unit}`, A4.w - 130, y, fonts.helv, 9, GRAY);
      drawRight(page, fmt(p.netTotalCent), A4.w - 60, y, fonts.helv, 9, BLACK);
      y -= 12;
    }
    if (entry.positions.length > 8) {
      page.drawText(s(`… und ${entry.positions.length - 8} weitere Positionen`), { x: 65, y, size: 8, font: fonts.helvObl, color: LIGHT });
      y -= 12;
    }
    y -= 12;
    page.drawLine({ start: { x: 50, y }, end: { x: A4.w - 50, y }, thickness: 0.4, color: BORDER });
    y -= 10;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** wrap workshop for drawFooter helper */
function mkPdfDoc(input: WartungsheftInput): PdfDoc {
  return {
    kind: "invoice",
    number: "-",
    title: "Wartungsheft",
    issuedAt: new Date(),
    dueAt: null,
    positions: [],
    subtotalNetCent: 0, totalVatCent: 0, totalGrossCent: 0,
    notes: null,
    mileageAtIssue: null,
    customer: input.customer,
    vehicle: null,
    workshop: input.workshop,
  };
}
