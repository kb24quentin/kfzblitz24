import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { InvoicePosition } from "./money";
import { customerDisplayName, vehicleDisplayName } from "./customer-name";

type InvoiceForPdf = {
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date | null;
  positions: InvoicePosition[];
  subtotalNetCent: number;
  totalVatCent: number;
  totalGrossCent: number;
  notes: string | null;
  customer: {
    type: string;
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
  };
  vehicle: {
    brand: string | null;
    model: string | null;
    licensePlate: string | null;
    vin: string | null;
    mileage: number | null;
  } | null;
  workshop: {
    name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
    contactEmail: string;
    contactPhone: string | null;
    taxId: string | null;
    iban: string | null;
    bic: string | null;
    bankName: string | null;
    brandPrimary: string | null;
    brandFooterText: string | null;
    letterheadLogo: Uint8Array | null;
    letterheadLogoMime: string | null;
  };
};

function fmt(cent: number) {
  return (cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hexToRgb(hex: string | null | undefined) {
  if (!hex) return rgb(0.996, 0.396, 0.012); // #fe6503 default
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0.996, 0.396, 0.012);
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Robust text sanitizer für WinAnsi (Standard-Font in pdf-lib). Ersetzt
 * problematische unicode-glyphen die WinAnsi nicht kann.
 */
function sanitize(s: string | null | undefined) {
  if (!s) return "";
  return s
    .replace(/€/g, "EUR")
    .replace(/„|"/g, `"`)
    .replace(/"|"/g, `"`)
    .replace(/'|'/g, "'")
    .replace(/–|—/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

export async function buildInvoicePdf(inv: InvoiceForPdf): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 in points
  const { width } = page.getSize();

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(inv.workshop.brandPrimary);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  const lightGray = rgb(0.6, 0.6, 0.6);
  const border = rgb(0.9, 0.9, 0.9);

  const marginL = 50;
  const marginR = 50;
  const contentW = width - marginL - marginR;

  // ============ HEADER: Logo (falls PNG/JPEG) + Werkstatt-Adresse rechts ==========
  let cursorY = 800;
  if (inv.workshop.letterheadLogo && inv.workshop.letterheadLogo.length > 0) {
    try {
      const bytes = new Uint8Array(inv.workshop.letterheadLogo);
      const mime = (inv.workshop.letterheadLogoMime || "").toLowerCase();
      const img = mime.includes("png")
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      const maxW = 140;
      const maxH = 60;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: marginL, y: cursorY - h, width: w, height: h });
    } catch {
      // ignore embed errors
    }
  }

  const rightX = 400;
  const rightW = 145;
  drawRight(page, sanitize(inv.workshop.name), rightX, cursorY - 10, helvBold, 10, black, rightW);
  let ry = cursorY - 24;
  if (inv.workshop.street) { drawRight(page, sanitize(inv.workshop.street), rightX, ry, helv, 9, gray, rightW); ry -= 12; }
  if (inv.workshop.zip || inv.workshop.city) {
    drawRight(page, sanitize(`${inv.workshop.zip ?? ""} ${inv.workshop.city ?? ""}`.trim()), rightX, ry, helv, 9, gray, rightW);
    ry -= 12;
  }
  if (inv.workshop.contactPhone) { drawRight(page, sanitize(inv.workshop.contactPhone), rightX, ry, helv, 9, gray, rightW); ry -= 12; }
  drawRight(page, sanitize(inv.workshop.contactEmail), rightX, ry, helv, 9, gray, rightW);

  // ============ ADRESSFELD Kunde =============================================
  const addrY = 700;
  const returnLine = `${inv.workshop.name} - ${inv.workshop.street ?? ""} - ${inv.workshop.zip ?? ""} ${inv.workshop.city ?? ""}`;
  page.drawText(sanitize(returnLine), { x: marginL, y: addrY, size: 7, font: helv, color: lightGray, maxWidth: 250 });
  page.drawLine({
    start: { x: marginL, y: addrY - 3 },
    end: { x: marginL + 250, y: addrY - 3 },
    thickness: 0.3,
    color: lightGray,
  });
  const cName = customerDisplayName(inv.customer);
  let ay = addrY - 20;
  page.drawText(sanitize(cName), { x: marginL, y: ay, size: 11, font: helvBold, color: black });
  ay -= 14;
  if (inv.customer.type === "b2b" && inv.customer.firstName) {
    page.drawText(sanitize(`z. Hd. ${inv.customer.firstName} ${inv.customer.lastName ?? ""}`.trim()), { x: marginL, y: ay, size: 10, font: helv, color: black });
    ay -= 13;
  }
  if (inv.customer.street) { page.drawText(sanitize(inv.customer.street), { x: marginL, y: ay, size: 10, font: helv, color: black }); ay -= 13; }
  if (inv.customer.zip || inv.customer.city) {
    page.drawText(sanitize(`${inv.customer.zip ?? ""} ${inv.customer.city ?? ""}`.trim()), { x: marginL, y: ay, size: 10, font: helv, color: black });
  }

  // ============ META rechts: Nummer/Datum/Fällig =============================
  const metaX = 380;
  let my = addrY - 20;
  const metaLabelCol = metaX;
  const metaValCol = metaX + 90;
  page.drawText("Rechnungs-Nr.", { x: metaLabelCol, y: my, size: 9, font: helv, color: gray });
  drawRight(page, sanitize(inv.invoiceNumber), metaValCol, my, helvBold, 9, black, 75);
  my -= 14;
  page.drawText("Datum", { x: metaLabelCol, y: my, size: 9, font: helv, color: gray });
  drawRight(page, inv.issuedAt.toLocaleDateString("de-DE"), metaValCol, my, helv, 9, black, 75);
  my -= 14;
  if (inv.dueAt) {
    page.drawText("Fällig", { x: metaLabelCol, y: my, size: 9, font: helv, color: gray });
    drawRight(page, inv.dueAt.toLocaleDateString("de-DE"), metaValCol, my, helv, 9, black, 75);
  }

  // ============ TITEL =========================================================
  const titleY = 570;
  page.drawText(sanitize(`Rechnung ${inv.invoiceNumber}`), { x: marginL, y: titleY, size: 16, font: helvBold, color: brand });

  // ============ Fahrzeug-Info =================================================
  let bodyY = titleY - 22;
  if (inv.vehicle) {
    page.drawText(sanitize(`Fahrzeug: ${vehicleDisplayName(inv.vehicle)}`), { x: marginL, y: bodyY, size: 9, font: helv, color: gray });
    bodyY -= 12;
    if (inv.vehicle.vin) { page.drawText(sanitize(`FIN: ${inv.vehicle.vin}`), { x: marginL, y: bodyY, size: 9, font: helv, color: gray }); bodyY -= 12; }
    if (inv.vehicle.mileage != null) {
      page.drawText(sanitize(`km-Stand: ${inv.vehicle.mileage.toLocaleString("de-DE")}`), { x: marginL, y: bodyY, size: 9, font: helv, color: gray });
      bodyY -= 12;
    }
    bodyY -= 6;
  }

  // ============ Positions-Tabelle =============================================
  const tableTop = bodyY - 10;
  const colX = { desc: marginL, qty: marginL + 245, unit: marginL + 290, price: marginL + 335, vat: marginL + 400, total: marginL + 440 };
  const rowH = 20;

  // Header row
  page.drawRectangle({
    x: marginL,
    y: tableTop - rowH,
    width: contentW,
    height: rowH,
    color: brand,
  });
  const th = tableTop - 14;
  page.drawText("Bezeichnung", { x: colX.desc + 4, y: th, size: 9, font: helvBold, color: rgb(1, 1, 1) });
  drawRight(page, "Menge", colX.qty - 5, th, helvBold, 9, rgb(1, 1, 1), 40);
  page.drawText("Einh.", { x: colX.unit, y: th, size: 9, font: helvBold, color: rgb(1, 1, 1) });
  drawRight(page, "EUR netto", colX.price + 55, th, helvBold, 9, rgb(1, 1, 1), 60);
  drawRight(page, "MwSt", colX.vat + 30, th, helvBold, 9, rgb(1, 1, 1), 35);
  drawRight(page, "Summe EUR", colX.total + 55, th, helvBold, 9, rgb(1, 1, 1), 60);

  let ry2 = tableTop - rowH - 4;
  for (const p of inv.positions) {
    const descLines = wrapText(sanitize(p.name), 240, helv, 9);
    const noteLines = p.description ? wrapText(sanitize(p.description), 240, helv, 8) : [];
    const height = Math.max(14, descLines.length * 11 + noteLines.length * 10 + 4);

    let dy = ry2 - 8;
    for (const line of descLines) {
      page.drawText(line, { x: colX.desc + 4, y: dy, size: 9, font: helv, color: black });
      dy -= 11;
    }
    for (const line of noteLines) {
      page.drawText(line, { x: colX.desc + 4, y: dy, size: 8, font: helv, color: lightGray });
      dy -= 10;
    }
    const rightBaseline = ry2 - 8;
    drawRight(page, p.quantity.toLocaleString("de-DE"), colX.qty - 5, rightBaseline, helv, 9, black, 40);
    page.drawText(sanitize(p.unit), { x: colX.unit, y: rightBaseline, size: 9, font: helv, color: black });
    drawRight(page, fmt(p.netPriceCent), colX.price + 55, rightBaseline, helv, 9, black, 60);
    drawRight(page, `${p.vatPercent} %`, colX.vat + 30, rightBaseline, helv, 9, black, 35);
    drawRight(page, fmt(p.netTotalCent), colX.total + 55, rightBaseline, helvBold, 9, black, 60);

    ry2 -= height;
    page.drawLine({
      start: { x: marginL, y: ry2 },
      end: { x: marginL + contentW, y: ry2 },
      thickness: 0.3,
      color: border,
    });
  }

  // ============ Summen ========================================================
  ry2 -= 15;
  const sumLabelX = marginL + 300;
  const sumValX = marginL + contentW;
  drawRight(page, "Zwischensumme (netto)", sumLabelX + 90, ry2, helv, 9, gray, 130);
  drawRight(page, fmt(inv.subtotalNetCent) + " EUR", sumValX, ry2, helv, 9, black, 90);
  ry2 -= 14;
  drawRight(page, "MwSt.", sumLabelX + 90, ry2, helv, 9, gray, 130);
  drawRight(page, fmt(inv.totalVatCent) + " EUR", sumValX, ry2, helv, 9, black, 90);
  ry2 -= 18;
  drawRight(page, "Gesamtbetrag (brutto)", sumLabelX + 90, ry2, helvBold, 11, brand, 130);
  drawRight(page, fmt(inv.totalGrossCent) + " EUR", sumValX, ry2, helvBold, 11, brand, 90);

  // ============ Zahlungshinweis ==============================================
  ry2 -= 40;
  if (inv.dueAt) {
    page.drawText(sanitize(`Bitte überweisen Sie den Betrag bis ${inv.dueAt.toLocaleDateString("de-DE")} auf folgendes Konto:`), { x: marginL, y: ry2, size: 9, font: helv, color: gray });
  } else {
    page.drawText("Bitte überweisen Sie den Betrag auf folgendes Konto:", { x: marginL, y: ry2, size: 9, font: helv, color: gray });
  }
  ry2 -= 12;
  if (inv.workshop.iban) {
    const bankLine = `${inv.workshop.bankName ?? "Bank"} - IBAN: ${inv.workshop.iban}${inv.workshop.bic ? ` - BIC: ${inv.workshop.bic}` : ""}`;
    page.drawText(sanitize(bankLine), { x: marginL, y: ry2, size: 9, font: helv, color: gray });
    ry2 -= 12;
  }
  page.drawText(sanitize(`Verwendungszweck: ${inv.invoiceNumber}`), { x: marginL, y: ry2, size: 9, font: helv, color: gray });
  ry2 -= 20;

  if (inv.notes) {
    page.drawText("Notizen:", { x: marginL, y: ry2, size: 9, font: helvBold, color: black });
    ry2 -= 12;
    const noteLines = wrapText(sanitize(inv.notes), contentW, helv, 9);
    for (const line of noteLines) {
      page.drawText(line, { x: marginL, y: ry2, size: 9, font: helv, color: gray });
      ry2 -= 11;
    }
  }

  // ============ Footer ========================================================
  const footerText =
    inv.workshop.brandFooterText ||
    `${inv.workshop.name}${inv.workshop.taxId ? ` - USt-IdNr. ${inv.workshop.taxId}` : ""}`;
  page.drawText(sanitize(footerText), {
    x: marginL,
    y: 30,
    size: 8,
    font: helv,
    color: lightGray,
    maxWidth: contentW,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function drawRight(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size: number, color = rgb(0, 0, 0), maxW?: number) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color, maxWidth: maxW });
}

function wrapText(text: string, maxW: number, font: PDFFont, size: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}
