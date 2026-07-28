import { rgb, StandardFonts, type PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { PdfDoc } from "./types";
import { customerDisplayName, vehicleDisplayName } from "../customer-name";

export const A4 = { w: 595.28, h: 841.89 };
export const WHITE = rgb(1, 1, 1);
export const BLACK = rgb(0, 0, 0);
export const GRAY = rgb(0.35, 0.35, 0.35);
export const LIGHT = rgb(0.55, 0.55, 0.55);
export const BORDER = rgb(0.88, 0.88, 0.88);

export function hexToRgb(hex: string | null | undefined, fallback = rgb(0.996, 0.396, 0.012)): RGB {
  if (!hex) return fallback;
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  return rgb(
    parseInt(m[1].slice(0, 2), 16) / 255,
    parseInt(m[1].slice(2, 4), 16) / 255,
    parseInt(m[1].slice(4, 6), 16) / 255
  );
}

export function darker(color: RGB, by = 0.15): RGB {
  return rgb(Math.max(0, color.red - by), Math.max(0, color.green - by), Math.max(0, color.blue - by));
}
export function lighter(color: RGB, by = 0.7): RGB {
  return rgb(color.red + (1 - color.red) * by, color.green + (1 - color.green) * by, color.blue + (1 - color.blue) * by);
}

/** Ersetzt problematische unicode-glyphen die Helvetica-WinAnsi nicht kann. */
export function s(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/€/g, "EUR")
    .replace(/„|"/g, `"`)
    .replace(/"|"/g, `"`)
    .replace(/'|'/g, "'")
    .replace(/–|—/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

export function fmt(cent: number) {
  return (cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function drawRight(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size: number, color: RGB = BLACK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color });
}
export function drawCenter(page: PDFPage, text: string, xCenter: number, y: number, font: PDFFont, size: number, color: RGB = BLACK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xCenter - w / 2, y, size, font, color });
}

export function wrap(text: string, maxW: number, font: PDFFont, size: number, maxLines = 8): string[] {
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
  return lines.slice(0, maxLines);
}

/** Embed logo, returns dimensions after fitting into maxW x maxH */
export async function embedLogo(doc: PDFDocument, bytes: Uint8Array, mime: string, maxW: number, maxH: number) {
  const m = (mime || "").toLowerCase();
  // pdf-lib versteht nur PNG + JPEG. SVG/WebP etc. gehen nicht.
  try {
    if (m.includes("png")) {
      const img = await doc.embedPng(bytes);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      return { img, w: img.width * scale, h: img.height * scale };
    }
    if (m.includes("jpeg") || m.includes("jpg")) {
      const img = await doc.embedJpg(bytes);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      return { img, w: img.width * scale, h: img.height * scale };
    }
    // Fallback: erst als PNG, dann JPEG versuchen (magic-bytes-basiert)
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      const img = await doc.embedPng(bytes);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      return { img, w: img.width * scale, h: img.height * scale };
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      const img = await doc.embedJpg(bytes);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      return { img, w: img.width * scale, h: img.height * scale };
    }
    console.warn("[embedLogo] unsupported logo format:", mime, "first bytes:", bytes[0], bytes[1]);
    return null;
  } catch (e) {
    console.error("[embedLogo] embed failed:", (e as Error).message, "mime:", mime);
    return null;
  }
}

export async function loadFonts(doc: PDFDocument) {
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvObl = await doc.embedFont(StandardFonts.HelveticaOblique);
  const timesRoman = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const courier = await doc.embedFont(StandardFonts.Courier);
  const courierBold = await doc.embedFont(StandardFonts.CourierBold);
  return { helv, helvBold, helvObl, timesRoman, timesBold, timesItalic, courier, courierBold };
}

export type Fonts = Awaited<ReturnType<typeof loadFonts>>;

/**
 * Wählt das font-set das dem gewünschten family entspricht.
 * Templates rufen `pickFonts(fonts, doc.workshop.brandFontFamily)` und benutzen
 * die returned {body, bold, italic}-fonts überall.
 */
export function pickFonts(fonts: Fonts, family: string) {
  switch (family) {
    case "times":
      return { body: fonts.timesRoman, bold: fonts.timesBold, italic: fonts.timesItalic };
    case "courier":
      return { body: fonts.courier, bold: fonts.courierBold, italic: fonts.courier };
    default:
      return { body: fonts.helv, bold: fonts.helvBold, italic: fonts.helvObl };
  }
}

/** Dichte → row-multiplier für positions-tabelle */
export function densityMult(density: string) {
  switch (density) {
    case "compact":
      return 0.85;
    case "spacious":
      return 1.25;
    default:
      return 1.0;
  }
}

/**
 * Standard-payment-block (Zahlungshinweise + IBAN + verwendungszweck).
 * Alle templates rufen das gleiche.
 */
export function drawPaymentInfo(
  page: PDFPage,
  doc: PdfDoc,
  x: number,
  y: number,
  fonts: Fonts,
  color: RGB = GRAY
): number {
  const { body } = pickFonts(fonts, doc.workshop.brandFontFamily);
  let ry = y;
  if (doc.kind === "invoice") {
    if (doc.dueAt) {
      page.drawText(s(`Bitte begleichen Sie den Betrag bis ${doc.dueAt.toLocaleDateString("de-DE")}:`), { x, y: ry, size: 9, font: body, color });
    } else {
      page.drawText("Bitte überweisen Sie den Betrag auf folgendes Konto:", { x, y: ry, size: 9, font: body, color });
    }
    ry -= 12;
    if (doc.workshop.iban) {
      page.drawText(
        s(`${doc.workshop.bankName ?? "Bank"} - IBAN: ${doc.workshop.iban}${doc.workshop.bic ? ` - BIC: ${doc.workshop.bic}` : ""}`),
        { x, y: ry, size: 9, font: body, color }
      );
      ry -= 12;
    }
    page.drawText(s(`Verwendungszweck: ${doc.number}`), { x, y: ry, size: 9, font: body, color });
    ry -= 12;
  } else {
    if (doc.dueAt) {
      page.drawText(s(`Dieses Angebot ist gültig bis ${doc.dueAt.toLocaleDateString("de-DE")}.`), { x, y: ry, size: 9, font: body, color });
    } else {
      page.drawText("Dieses Angebot ist gültig für 14 Tage ab Ausstellungsdatum.", { x, y: ry, size: 9, font: body, color });
    }
    ry -= 12;
    page.drawText("Alle Preise verstehen sich in EUR zzgl. gesetzlicher MwSt.", { x, y: ry, size: 9, font: body, color });
    ry -= 12;
  }
  return ry;
}

/**
 * Standard-footer (drei-spalten) — 3 spalten oder legacy-fallback auf brandFooterText.
 * Wird von allen templates am seitenende gerufen.
 */
/**
 * Footer als 3-spalten-block: saubere spalten mit vertikalen trennern,
 * erste zeile jeder spalte als überschrift (fett), rest als body.
 * Fallback auf legacy-freitext wenn alle spalten leer sind.
 */
export function drawFooter(page: PDFPage, doc: PdfDoc, fonts: Fonts, color: RGB = LIGHT, topY = 68) {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const w = doc.workshop;
  const cols = [w.footerCol1, w.footerCol2, w.footerCol3];
  const hasCols = cols.some(Boolean);

  if (!hasCols) {
    const legacy = w.brandFooterText || `${w.name}${w.taxId ? ` - USt-IdNr. ${w.taxId}` : ""}`;
    page.drawLine({ start: { x: 50, y: topY }, end: { x: A4.w - 50, y: topY }, thickness: 0.4, color: BORDER });
    page.drawText(s(legacy), { x: 50, y: topY - 12, size: 8, font: body, color, maxWidth: A4.w - 100 });
    return;
  }

  const contentW = A4.w - 100;
  const colW = contentW / 3;
  const startX = 50;

  // Top-Linie
  page.drawLine({ start: { x: 50, y: topY }, end: { x: A4.w - 50, y: topY }, thickness: 0.5, color: BORDER });

  for (let i = 0; i < 3; i++) {
    const txt = cols[i] ?? "";
    if (!txt) continue;
    const lines = txt.split("\n").filter((l) => l.trim().length > 0);
    const colX = startX + i * colW + 5;
    const maxW = colW - 10;

    // Erste Zeile = Überschrift (bold, etwas grösser)
    if (lines[0]) {
      const wrappedHead = wrap(s(lines[0]), maxW, bold, 8, 1);
      page.drawText(wrappedHead[0], {
        x: colX,
        y: topY - 12,
        size: 8,
        font: bold,
        color: BLACK,
      });
    }
    // Restliche Zeilen als body
    let ly = topY - 24;
    for (let li = 1; li < lines.length && li < 6; li++) {
      const wrapped = wrap(s(lines[li]), maxW, body, 7.5, 1);
      page.drawText(wrapped[0], { x: colX, y: ly, size: 7.5, font: body, color });
      ly -= 10;
    }

    // Vertikale Trennlinie zwischen Spalten (nicht nach letzter)
    if (i < 2) {
      page.drawLine({
        start: { x: startX + (i + 1) * colW, y: topY - 6 },
        end: { x: startX + (i + 1) * colW, y: topY - 66 },
        thickness: 0.3,
        color: BORDER,
      });
    }
  }
}

/**
 * Positions-tabelle, getrennt in "Arbeitsleistungen" und "Ersatzteile".
 * Respektiert workshop.brandTableStyle + brandDensity + brandFontFamily.
 * Returned die neue y-position unterhalb der tabelle+summen.
 */
export function drawPositionsTable(
  page: PDFPage,
  doc: PdfDoc,
  fonts: Fonts,
  x: number,
  y: number,
  width: number,
  brand: RGB
): number {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const style = doc.workshop.brandTableStyle;
  const dm = densityMult(doc.workshop.brandDensity);

  const labor = doc.positions.filter((p) => p.kind === "labor");
  const parts = doc.positions.filter((p) => p.kind === "part");
  let ry = y;

  const cols = {
    desc: x,
    qty: x + width - 245,
    unit: x + width - 200,
    price: x + width - 155,
    vat: x + width - 90,
    total: x + width - 50,
  };
  const headers = ["Bezeichnung", "Menge", "Einh.", "EUR/E", "MwSt", "Summe"];

  function drawHeader() {
    if (style === "colored") {
      page.drawRectangle({ x, y: ry - 16, width, height: 16, color: brand });
      const th = ry - 12;
      page.drawText(headers[0], { x: cols.desc + 4, y: th, size: 8, font: bold, color: WHITE });
      drawRight(page, headers[1], cols.qty + 35, th, bold, 8, WHITE);
      page.drawText(headers[2], { x: cols.unit, y: th, size: 8, font: bold, color: WHITE });
      drawRight(page, headers[3], cols.price + 55, th, bold, 8, WHITE);
      drawRight(page, headers[4], cols.vat + 30, th, bold, 8, WHITE);
      drawRight(page, headers[5], cols.total + 55, th, bold, 8, WHITE);
    } else if (style === "bordered") {
      page.drawRectangle({ x, y: ry - 16, width, height: 16, borderColor: brand, borderWidth: 0.8, color: undefined });
      const th = ry - 12;
      page.drawText(headers[0], { x: cols.desc + 4, y: th, size: 8, font: bold, color: brand });
      drawRight(page, headers[1], cols.qty + 35, th, bold, 8, brand);
      page.drawText(headers[2], { x: cols.unit, y: th, size: 8, font: bold, color: brand });
      drawRight(page, headers[3], cols.price + 55, th, bold, 8, brand);
      drawRight(page, headers[4], cols.vat + 30, th, bold, 8, brand);
      drawRight(page, headers[5], cols.total + 55, th, bold, 8, brand);
    } else {
      // minimal / zebra header: nur unterstrich + text
      const th = ry - 12;
      page.drawText(headers[0], { x: cols.desc + 2, y: th, size: 8, font: bold, color: GRAY });
      drawRight(page, headers[1], cols.qty + 35, th, bold, 8, GRAY);
      page.drawText(headers[2], { x: cols.unit, y: th, size: 8, font: bold, color: GRAY });
      drawRight(page, headers[3], cols.price + 55, th, bold, 8, GRAY);
      drawRight(page, headers[4], cols.vat + 30, th, bold, 8, GRAY);
      drawRight(page, headers[5], cols.total + 55, th, bold, 8, GRAY);
      page.drawLine({ start: { x, y: ry - 17 }, end: { x: x + width, y: ry - 17 }, thickness: 1.2, color: brand });
    }
    ry -= 20;
  }

  function drawSection(title: string, positions: typeof doc.positions) {
    if (positions.length === 0) return;
    page.drawText(s(title), { x: cols.desc, y: ry, size: 10, font: bold, color: brand });
    ry -= 14;
    drawHeader();

    let rowIdx = 0;
    for (const p of positions) {
      const nameLines = wrap(s(p.name), 220, body, 9);
      const noteLines = p.description ? wrap(s(p.description), 220, body, 8, 3) : [];
      const rowH = Math.max(14, nameLines.length * 11 + noteLines.length * 10 + 4) * dm;

      // Zebra: jede zweite zeile leicht getönt
      if (style === "zebra" && rowIdx % 2 === 0) {
        page.drawRectangle({ x, y: ry - rowH, width, height: rowH, color: rgb(0.97, 0.97, 0.97) });
      }
      // Bordered: linke+rechte begrenzung
      if (style === "bordered") {
        page.drawLine({ start: { x, y: ry }, end: { x, y: ry - rowH }, thickness: 0.4, color: BORDER });
        page.drawLine({ start: { x: x + width, y: ry }, end: { x: x + width, y: ry - rowH }, thickness: 0.4, color: BORDER });
      }

      let dy = ry - 8;
      for (const line of nameLines) {
        page.drawText(line, { x: cols.desc + 4, y: dy, size: 9, font: body, color: BLACK });
        dy -= 11;
      }
      for (const line of noteLines) {
        page.drawText(line, { x: cols.desc + 4, y: dy, size: 8, font: body, color: LIGHT });
        dy -= 10;
      }
      const baseline = ry - 8;
      drawRight(page, p.quantity.toLocaleString("de-DE"), cols.qty + 35, baseline, body, 9, BLACK);
      page.drawText(s(p.unit), { x: cols.unit, y: baseline, size: 9, font: body, color: BLACK });
      drawRight(page, fmt(p.netPriceCent), cols.price + 55, baseline, body, 9, BLACK);
      drawRight(page, `${p.vatPercent}%`, cols.vat + 30, baseline, body, 9, BLACK);
      drawRight(page, fmt(p.netTotalCent), cols.total + 55, baseline, bold, 9, BLACK);
      ry -= rowH;

      // Zwischenlinie: colored/bordered/minimal → dünne linie zwischen zeilen
      if (style !== "zebra") {
        page.drawLine({ start: { x, y: ry }, end: { x: x + width, y: ry }, thickness: 0.3, color: BORDER });
      }
      rowIdx++;
    }
    // Bordered: bottom line
    if (style === "bordered") {
      page.drawLine({ start: { x, y: ry }, end: { x: x + width, y: ry }, thickness: 0.6, color: brand });
    }
    ry -= 8;
  }

  drawSection("Arbeitsleistung", labor);
  drawSection("Ersatzteile / Material", parts);

  // ------- Summen -------
  ry -= 8;
  const sumLabelX = x + width - 220;
  const sumValX = x + width;
  drawRight(page, "Zwischensumme (netto)", sumLabelX + 100, ry, body, 9, GRAY);
  drawRight(page, `${fmt(doc.subtotalNetCent)} EUR`, sumValX, ry, body, 9, BLACK);
  ry -= 12;
  // Aufsplittung je MwSt-satz (z.B. "zzgl. 19% MwSt" oder mehrere zeilen wenn gemischt)
  const vatByRate = new Map<number, { net: number; vat: number }>();
  for (const p of doc.positions) {
    const g = vatByRate.get(p.vatPercent) ?? { net: 0, vat: 0 };
    g.net += p.netTotalCent;
    g.vat += p.vatTotalCent;
    vatByRate.set(p.vatPercent, g);
  }
  const sortedRates = Array.from(vatByRate.entries()).sort(([a], [b]) => b - a);
  for (const [rate, g] of sortedRates) {
    drawRight(page, `zzgl. ${rate}% MwSt aus ${fmt(g.net)} EUR`, sumLabelX + 100, ry, body, 9, GRAY);
    drawRight(page, `${fmt(g.vat)} EUR`, sumValX, ry, body, 9, BLACK);
    ry -= 12;
  }
  ry -= 4;
  drawRight(page, "Gesamtbetrag (brutto)", sumLabelX + 100, ry, bold, 11, brand);
  drawRight(page, `${fmt(doc.totalGrossCent)} EUR`, sumValX, ry, bold, 11, brand);
  return ry - 12;
}

/**
 * Adressblock: absender-return-line + kunde-block.
 * Position wird per param angegeben, defaults für DIN-lang-brief-fenster.
 */
export function drawAddressBlock(page: PDFPage, doc: PdfDoc, fonts: Fonts, x: number, y: number, w: number = 250) {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const returnLine = `${doc.workshop.name} - ${doc.workshop.street ?? ""} - ${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`;
  page.drawText(s(returnLine), { x, y, size: 7, font: body, color: LIGHT, maxWidth: w });
  page.drawLine({ start: { x, y: y - 3 }, end: { x: x + w, y: y - 3 }, thickness: 0.3, color: LIGHT });
  let ay = y - 20;
  page.drawText(s(customerDisplayName(doc.customer)), { x, y: ay, size: 11, font: bold, color: BLACK });
  ay -= 14;
  if (doc.customer.type === "b2b" && doc.customer.firstName) {
    page.drawText(s(`z. Hd. ${doc.customer.firstName} ${doc.customer.lastName ?? ""}`.trim()), { x, y: ay, size: 10, font: body, color: BLACK });
    ay -= 13;
  }
  if (doc.customer.street) { page.drawText(s(doc.customer.street), { x, y: ay, size: 10, font: body, color: BLACK }); ay -= 13; }
  if (doc.customer.zip || doc.customer.city) {
    page.drawText(s(`${doc.customer.zip ?? ""} ${doc.customer.city ?? ""}`.trim()), { x, y: ay, size: 10, font: body, color: BLACK });
  }
}

/**
 * Standard vehicle-info block unterhalb des titels.
 */
export function drawVehicleInfo(page: PDFPage, doc: PdfDoc, fonts: Fonts, x: number, y: number): number {
  if (!doc.vehicle) return y;
  const { body } = pickFonts(fonts, doc.workshop.brandFontFamily);
  let ry = y;
  page.drawText(s(`Fahrzeug: ${vehicleDisplayName(doc.vehicle)}`), { x, y: ry, size: 9, font: body, color: GRAY });
  ry -= 12;
  if (doc.vehicle.vin) { page.drawText(s(`FIN: ${doc.vehicle.vin}`), { x, y: ry, size: 9, font: body, color: GRAY }); ry -= 12; }
  const km = doc.mileageAtIssue ?? doc.vehicle.mileage;
  if (km != null) {
    page.drawText(s(`km-Stand: ${km.toLocaleString("de-DE")}`), { x, y: ry, size: 9, font: body, color: GRAY });
    ry -= 12;
  }
  return ry - 6;
}

export function metaBlock(page: PDFPage, doc: PdfDoc, fonts: Fonts, x: number, y: number, color: RGB = GRAY) {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const labels = doc.kind === "invoice"
    ? [["Rechnungs-Nr.", doc.number], ["Datum", doc.issuedAt.toLocaleDateString("de-DE")]]
    : [["Angebots-Nr.", doc.number], ["Datum", doc.issuedAt.toLocaleDateString("de-DE")]];
  if (doc.dueAt) labels.push([doc.kind === "invoice" ? "Fällig" : "Gültig bis", doc.dueAt.toLocaleDateString("de-DE")]);
  let ry = y;
  for (const [label, val] of labels) {
    page.drawText(s(label), { x, y: ry, size: 9, font: body, color });
    drawRight(page, s(val), x + 130, ry, bold, 9, BLACK);
    ry -= 14;
  }
  return ry;
}
