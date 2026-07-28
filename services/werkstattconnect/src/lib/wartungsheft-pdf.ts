import { PDFDocument, rgb } from "pdf-lib";
import { A4, BLACK, GRAY, LIGHT, BORDER, WHITE, s, fmt, drawRight, drawCenter, hexToRgb, embedLogo, loadFonts, wrap } from "./pdf/helpers";
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
  // HARDCODED WerkstattConnect-branding — nicht durch workshop anpassbar
  const brand = rgb(0.996, 0.396, 0.012); // #fe6503

  // Workshop-logo (klein, pro entry als "ausführende werkstatt")
  // Wartungsheft-eigener footer, IMMER Helvetica (nicht workshop-font)
  function drawWartungsheftFooter(pg: import("pdf-lib").PDFPage) {
    const w = input.workshop;
    const cols = [w.footerCol1, w.footerCol2, w.footerCol3];
    const hasCols = cols.some(Boolean);
    const topY = 68;
    pg.drawLine({ start: { x: 50, y: topY }, end: { x: A4.w - 50, y: topY }, thickness: 0.5, color: BORDER });
    if (!hasCols) {
      const legacy = w.brandFooterText || `${w.name}${w.taxId ? ` · USt-IdNr. ${w.taxId}` : ""}`;
      pg.drawText(s(legacy), { x: 50, y: topY - 12, size: 8, font: fonts.helv, color: LIGHT, maxWidth: A4.w - 100 });
      return;
    }
    const contentW = A4.w - 100;
    const colW = contentW / 3;
    for (let i = 0; i < 3; i++) {
      const txt = cols[i] ?? "";
      if (!txt) continue;
      const lines = txt.split("\n").filter((l) => l.trim().length > 0);
      const colX = 50 + i * colW + 5;
      const maxW = colW - 10;
      if (lines[0]) {
        const wrappedHead = wrap(s(lines[0]), maxW, fonts.helvBold, 8, 1);
        pg.drawText(wrappedHead[0], { x: colX, y: topY - 12, size: 8, font: fonts.helvBold, color: BLACK });
      }
      let ly = topY - 24;
      for (let li = 1; li < lines.length && li < 5; li++) {
        const wrapped = wrap(s(lines[li]), maxW, fonts.helv, 7.5, 1);
        pg.drawText(wrapped[0], { x: colX, y: ly, size: 7.5, font: fonts.helv, color: LIGHT });
        ly -= 10;
      }
      if (i < 2) {
        pg.drawLine({ start: { x: 50 + (i + 1) * colW, y: topY - 6 }, end: { x: 50 + (i + 1) * colW, y: topY - 60 }, thickness: 0.3, color: BORDER });
      }
    }
  }

  let workshopLogo = null as null | { img: any; w: number; h: number };
  if (input.workshop.letterheadLogo && input.workshop.letterheadLogo.length > 0) {
    workshopLogo = await embedLogo(pdf, new Uint8Array(input.workshop.letterheadLogo), input.workshop.letterheadLogoMime || "image/png", 60, 30);
  }
  const logo = workshopLogo; // für cover-page nutzen wir auch das workshop-logo

  // ======================= COVER PAGE =======================
  const cover = pdf.addPage([A4.w, A4.h]);
  // Header-band mit WerkstattConnect-branding
  cover.drawRectangle({ x: 0, y: A4.h - 130, width: A4.w, height: 130, color: brand });
  // WC-text-logo (statt SVG-import da pdf-lib kein SVG kann)
  cover.drawText("Werkstatt", { x: 50, y: A4.h - 60, size: 22, font: fonts.helvBold, color: WHITE });
  cover.drawText("Connect", { x: 50 + fonts.helvBold.widthOfTextAtSize("Werkstatt", 22), y: A4.h - 60, size: 22, font: fonts.helvBold, color: rgb(0.09, 0.17, 0.26) });
  cover.drawText("SERVICE- & WARTUNGSHEFT", { x: 50, y: A4.h - 90, size: 10, font: fonts.helvBold, color: WHITE });
  drawRight(cover, s(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`), A4.w - 50, A4.h - 60, fonts.helv, 9, WHITE);

  drawCenter(cover, s(vehicleDisplayName(input.vehicle)), A4.w / 2, A4.h - 200, fonts.helvBold, 22, BLACK);
  drawCenter(cover, s(`für ${customerDisplayName(input.customer)}`), A4.w / 2, A4.h - 220, fonts.helv, 12, GRAY);
  drawCenter(cover, "Chronologische Wartungshistorie", A4.w / 2, A4.h - 240, fonts.helvObl, 10, LIGHT);

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

  drawCenter(cover, s(`${input.entries.length} dokumentierte Wartungen`), A4.w / 2, 140, fonts.helvBold, 13, brand);

  // Ausführende werkstatt-info als kleine card unten
  const wsBoxY = 60;
  const wsBoxH = 50;
  cover.drawRectangle({ x: 60, y: wsBoxY, width: A4.w - 120, height: wsBoxH, borderColor: BORDER, borderWidth: 0.5, color: rgb(0.985, 0.985, 0.985) });
  cover.drawText("Betreut von:", { x: 75, y: wsBoxY + wsBoxH - 15, size: 8, font: fonts.helv, color: LIGHT });
  cover.drawText(s(input.workshop.name), { x: 75, y: wsBoxY + wsBoxH - 28, size: 11, font: fonts.helvBold, color: BLACK });
  const wsContact = [input.workshop.street, `${input.workshop.zip ?? ""} ${input.workshop.city ?? ""}`.trim(), input.workshop.contactPhone, input.workshop.contactEmail].filter(Boolean).join(" · ");
  cover.drawText(s(wsContact), { x: 75, y: wsBoxY + wsBoxH - 42, size: 8, font: fonts.helv, color: GRAY, maxWidth: A4.w - 220 });
  if (workshopLogo) {
    cover.drawImage(workshopLogo.img, { x: A4.w - 80 - workshopLogo.w, y: wsBoxY + (wsBoxH - workshopLogo.h) / 2, width: workshopLogo.w, height: workshopLogo.h });
  }
  drawCenter(cover, "Bitte bewahren Sie dieses Heft zusammen mit den Fahrzeugpapieren auf.", A4.w / 2, 30, fonts.helvObl, 8, LIGHT);

  // ======================= HISTORY-PAGES =======================
  if (input.entries.length === 0) {
    const empty = pdf.addPage([A4.w, A4.h]);
    drawCenter(empty, "Noch keine Werkstatt-Einträge vorhanden.", A4.w / 2, A4.h / 2, fonts.helv, 12, GRAY);
    drawWartungsheftFooter(empty);
    return Buffer.from(await pdf.save());
  }

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - 60;

  function drawPageHeader(pg: import("pdf-lib").PDFPage) {
    pg.drawRectangle({ x: 0, y: A4.h - 45, width: A4.w, height: 45, color: brand });
    pg.drawText(s(`Wartungshistorie · ${vehicleDisplayName(input.vehicle)}`), { x: 50, y: A4.h - 30, size: 11, font: fonts.helvBold, color: WHITE });
    drawRight(pg, s(input.workshop.name), A4.w - 50, A4.h - 30, fonts.helv, 9, WHITE);
    drawWartungsheftFooter(pg);
  }

  drawPageHeader(page);
  y = A4.h - 75;

  for (const entry of input.entries) {
    // header hat zwei zeilen: obere mit datum+nr+km+betrag, untere mit werkstatt-name
    const entryHeaderH = 42;
    const positionsH = Math.min(entry.positions.length, 8) * 14 + 20;
    const totalH = entryHeaderH + positionsH + 20;

    if (y - totalH < 110) {
      page = pdf.addPage([A4.w, A4.h]);
      drawPageHeader(page);
      y = A4.h - 75;
    }

    // Header-Box mit zwei zeilen
    page.drawRectangle({ x: 50, y: y - entryHeaderH, width: A4.w - 100, height: entryHeaderH, color: rgb(0.97, 0.97, 0.97) });

    // Obere zeile: Datum · Rechnung · km · Betrag (klar getrennte spalten)
    page.drawText(s(entry.date.toLocaleDateString("de-DE")), { x: 60, y: y - 16, size: 12, font: fonts.helvBold, color: brand });
    page.drawText(s(`Rechnung ${entry.invoiceNumber}`), { x: 160, y: y - 16, size: 10, font: fonts.helv, color: BLACK });
    if (entry.mileage != null) {
      page.drawText(s(`${entry.mileage.toLocaleString("de-DE")} km`), { x: 310, y: y - 16, size: 10, font: fonts.helv, color: GRAY });
    }
    drawRight(page, `${fmt(entry.totalGrossCent)} EUR`, A4.w - 60, y - 16, fonts.helvBold, 12, BLACK);

    // Untere zeile: Ausführende Werkstatt (in eigener zeile, damit nichts überlappt)
    page.drawText(s(`Ausführende Werkstatt: ${input.workshop.name}`), { x: 60, y: y - 32, size: 8, font: fonts.helv, color: GRAY });

    y -= entryHeaderH + 6;

    // Positionen
    for (const p of entry.positions.slice(0, 8)) {
      const kindTag = p.kind === "labor" ? "[Arbeit]" : "[Teil]";
      page.drawText(kindTag, { x: 65, y, size: 7, font: fonts.helv, color: LIGHT });
      const nameLines = wrap(s(p.name), 350, fonts.helv, 9, 1);
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
    y -= 14;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

