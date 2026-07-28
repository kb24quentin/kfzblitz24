import { PDFDocument, rgb, type PDFPage, type RGB } from "pdf-lib";
import type { PdfDoc } from "./types";
import {
  A4, BLACK, WHITE, GRAY, LIGHT, BORDER,
  s, fmt, drawRight, drawCenter, drawAddressBlock, drawVehicleInfo, drawPositionsTable,
  drawPaymentInfo, drawFooter, embedLogo, hexToRgb, lighter, darker, loadFonts, metaBlock, type Fonts,
} from "./helpers";

type Renderer = (page: PDFPage, doc: PdfDoc, fonts: Fonts, brand: RGB, accent: RGB, logoImg: { img: any; w: number; h: number } | null) => Promise<void> | void;

/**
 * Shared header-logo-render (top-left, max 140×60).
 */
function logoTopLeft(page: PDFPage, logo: { img: any; w: number; h: number } | null, x = 50, y = 800) {
  if (!logo) return;
  page.drawImage(logo.img, { x, y: y - logo.h, width: logo.w, height: logo.h });
}

// ============================================================================
// TEMPLATE 1 — modern-orange (default)
// ============================================================================
const modernOrange: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  logoTopLeft(page, logo);
  const rightX = 400;
  page.drawText(s(doc.workshop.name), { x: rightX, y: 795, size: 10, font: fonts.helvBold, color: BLACK });
  let ry = 780;
  if (doc.workshop.street) { page.drawText(s(doc.workshop.street), { x: rightX, y: ry, size: 9, font: fonts.helv, color: GRAY }); ry -= 12; }
  if (doc.workshop.zip || doc.workshop.city) { page.drawText(s(`${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim()), { x: rightX, y: ry, size: 9, font: fonts.helv, color: GRAY }); ry -= 12; }
  if (doc.workshop.contactPhone) { page.drawText(s(doc.workshop.contactPhone), { x: rightX, y: ry, size: 9, font: fonts.helv, color: GRAY }); ry -= 12; }
  page.drawText(s(doc.workshop.contactEmail), { x: rightX, y: ry, size: 9, font: fonts.helv, color: GRAY });

  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);

  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);

  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  if (doc.notes) {
    by -= 12;
    page.drawText("Notizen:", { x: 50, y: by, size: 9, font: fonts.helvBold, color: BLACK });
    by -= 12;
    page.drawText(s(doc.notes), { x: 50, y: by, size: 9, font: fonts.helv, color: GRAY, maxWidth: 495 });
  }
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 2 — modern-blue (nur farbvariante)
// ============================================================================
const modernBlue: Renderer = (page, doc, fonts, _brand, _accent, logo) => {
  return modernOrange(page, doc, fonts, hexToRgb("#1f6feb"), _accent, logo);
};

// TEMPLATE 3 — modern-black
const modernBlack: Renderer = (page, doc, fonts, _brand, _accent, logo) =>
  modernOrange(page, doc, fonts, rgb(0.1, 0.1, 0.1), _accent, logo);

// TEMPLATE 4 — modern-green
const modernGreen: Renderer = (page, doc, fonts, _brand, _accent, logo) =>
  modernOrange(page, doc, fonts, hexToRgb("#16a34a"), _accent, logo);

// ============================================================================
// TEMPLATE 5 — classic-serif (Times-Roman, traditionell)
// ============================================================================
const classicSerif: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  logoTopLeft(page, logo);
  const rightX = 400;
  page.drawText(s(doc.workshop.name), { x: rightX, y: 795, size: 11, font: fonts.timesBold, color: BLACK });
  let ry = 780;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: rightX, y: ry, size: 10, font: fonts.timesRoman, color: GRAY }); ry -= 13; }

  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);

  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 22, font: fonts.timesBold, color: BLACK });
  page.drawLine({ start: { x: 50, y: 562 }, end: { x: 545, y: 562 }, thickness: 1.2, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 6 — classic-lines
// ============================================================================
const classicLines: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  page.drawLine({ start: { x: 50, y: 815 }, end: { x: 545, y: 815 }, thickness: 2, color: brand });
  page.drawLine({ start: { x: 50, y: 810 }, end: { x: 545, y: 810 }, thickness: 0.5, color: brand });
  logoTopLeft(page, logo, 50, 780);
  drawCenter(page, s(doc.workshop.name), 297, 758, fonts.helvBold, 11, BLACK);
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  drawCenter(page, s(contact), 297, 744, fonts.helv, 9, GRAY);
  page.drawLine({ start: { x: 50, y: 730 }, end: { x: 545, y: 730 }, thickness: 0.4, color: BORDER });
  drawAddressBlock(page, doc, fonts, 50, 710);
  metaBlock(page, doc, fonts, 380, 690);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 18, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 7 — minimal-thin
// ============================================================================
const minimalThin: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  logoTopLeft(page, logo);
  drawRight(page, s(doc.workshop.name), 545, 795, fonts.helv, 10, BLACK);
  drawRight(page, s(doc.workshop.contactEmail), 545, 780, fonts.helv, 8, LIGHT);
  page.drawLine({ start: { x: 50, y: 750 }, end: { x: 545, y: 750 }, thickness: 0.3, color: BORDER });
  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(doc.title.toUpperCase()), { x: 50, y: 580, size: 22, font: fonts.helv, color: brand });
  page.drawText(s(doc.number), { x: 50, y: 560, size: 12, font: fonts.helv, color: LIGHT });
  let by = drawVehicleInfo(page, doc, fonts, 50, 540);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 8 — minimal-mono (Courier für "technisch"-feel)
// ============================================================================
const minimalMono: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 400, y: 795, size: 10, font: fonts.courierBold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactEmail].filter(Boolean);
  let ry = 780;
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 8, font: fonts.courier, color: GRAY }); ry -= 11; }
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title.toUpperCase()} // ${doc.number}`), { x: 50, y: 570, size: 14, font: fonts.courierBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 9 — bold-band (voll-breites farbband oben)
// ============================================================================
const boldBand: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  page.drawRectangle({ x: 0, y: 770, width: A4.w, height: 72, color: brand });
  page.drawText(s(doc.workshop.name), { x: 50, y: 810, size: 18, font: fonts.helvBold, color: WHITE });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 50, y: 790, size: 9, font: fonts.helv, color: WHITE });
  if (logo) page.drawImage(logo.img, { x: 545 - logo.w, y: 810 - logo.h / 2, width: logo.w, height: logo.h });

  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 10 — bold-sidebar (sidebar links)
// ============================================================================
const boldSidebar: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  page.drawRectangle({ x: 0, y: 0, width: 165, height: A4.h, color: brand });
  if (logo) {
    const s2 = Math.min(120 / logo.img.width, 60 / logo.img.height, 1);
    page.drawImage(logo.img, { x: 20, y: 780, width: logo.img.width * s2, height: logo.img.height * s2 });
  }
  page.drawText(s(doc.workshop.name), { x: 20, y: 750, size: 12, font: fonts.helvBold, color: WHITE });
  let ry = 730;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 20, y: ry, size: 8, font: fonts.helv, color: WHITE, maxWidth: 130 }); ry -= 11; }

  drawAddressBlock(page, doc, fonts, 190, 780);
  metaBlock(page, doc, fonts, 430, 780);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 190, y: 640, size: 18, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 190, 615);
  by = drawPositionsTable(page, doc, fonts, 190, by - 10, 355, brand);
  by = drawPaymentInfo(page, doc, 190, by - 24, fonts);
  // custom footer nur unter dem content-bereich (nicht unter sidebar)
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 11 — bold-centered
// ============================================================================
const boldCentered: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  if (logo) page.drawImage(logo.img, { x: (A4.w - logo.w) / 2, y: 800 - logo.h, width: logo.w, height: logo.h });
  drawCenter(page, s(doc.workshop.name), A4.w / 2, 750, fonts.helvBold, 14, BLACK);
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  drawCenter(page, s(contact), A4.w / 2, 735, fonts.helv, 9, GRAY);
  page.drawLine({ start: { x: 200, y: 715 }, end: { x: A4.w - 200, y: 715 }, thickness: 1.5, color: brand });

  drawAddressBlock(page, doc, fonts, 50, 685);
  metaBlock(page, doc, fonts, 380, 665);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 560, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 535);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 12 — farbig-corners
// ============================================================================
const farbigCorners: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  // ecken oben-links + unten-rechts
  page.drawRectangle({ x: 0, y: 780, width: 250, height: 62, color: brand });
  page.drawRectangle({ x: A4.w - 250, y: 0, width: 250, height: 20, color: brand });
  if (logo) page.drawImage(logo.img, { x: 20, y: 800 - logo.h, width: logo.w, height: logo.h });
  page.drawText(s(doc.workshop.name), { x: 280, y: 810, size: 12, font: fonts.helvBold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 280, y: 795, size: 9, font: fonts.helv, color: GRAY });

  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 13 — farbig-gradient (fake mit mehreren rectangles)
// ============================================================================
const farbigGradient: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const stops = 20;
  for (let i = 0; i < stops; i++) {
    const t = i / stops;
    const c = lighter(brand, t * 0.9);
    page.drawRectangle({ x: 0, y: 770 + i * 3.6, width: A4.w, height: 3.7, color: c });
  }
  if (logo) page.drawImage(logo.img, { x: 50, y: 810 - logo.h, width: logo.w, height: logo.h });
  page.drawText(s(doc.workshop.name), { x: 400, y: 810, size: 12, font: fonts.helvBold, color: WHITE });
  const contact = [doc.workshop.contactEmail, doc.workshop.contactPhone].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 400, y: 795, size: 9, font: fonts.helv, color: WHITE });

  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 14 — farbig-frame (rahmen um seite)
// ============================================================================
const farbigFrame: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  page.drawRectangle({ x: 20, y: 20, width: A4.w - 40, height: A4.h - 40, borderColor: brand, borderWidth: 2, color: undefined });
  logoTopLeft(page, logo, 50, 800);
  page.drawText(s(doc.workshop.name), { x: 400, y: 795, size: 10, font: fonts.helvBold, color: BLACK });
  let ry = 780;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 9, font: fonts.helv, color: GRAY }); ry -= 12; }
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 80);
};

// ============================================================================
// TEMPLATE 15 — farbig-split (obere hälfte primär-tint)
// ============================================================================
const farbigSplit: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  page.drawRectangle({ x: 0, y: 760, width: A4.w, height: 82, color: lighter(brand, 0.85) });
  logoTopLeft(page, logo, 50, 800);
  page.drawText(s(doc.workshop.name), { x: 400, y: 810, size: 12, font: fonts.helvBold, color: brand });
  const contact = [doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 400, y: 793, size: 9, font: fonts.helv, color: darker(brand, 0.1) });
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 16 — workshop-tools (mit werkzeug-akzent)
// ============================================================================
const workshopTools: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  // schraubenschlüssel-artiges dekor rechts oben
  page.drawRectangle({ x: A4.w - 100, y: 780, width: 6, height: 40, color: brand });
  page.drawCircle({ x: A4.w - 97, y: 775, size: 10, color: brand });
  page.drawText("WERKSTATT", { x: A4.w - 140, y: 730, size: 7, font: fonts.helvBold, color: brand });
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 200, y: 810, size: 14, font: fonts.helvBold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 200, y: 792, size: 9, font: fonts.helv, color: GRAY });

  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 17 — compact-dense (klein, viel platz für positionen)
// ============================================================================
const compactDense: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 400, y: 810, size: 9, font: fonts.helvBold, color: BLACK });
  page.drawText(s(`${doc.workshop.street ?? ""} · ${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""} · ${doc.workshop.contactEmail}`.trim()), { x: 400, y: 795, size: 7, font: fonts.helv, color: GRAY });
  drawAddressBlock(page, doc, fonts, 50, 750);
  metaBlock(page, doc, fonts, 380, 730);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 640, size: 14, font: fonts.helvBold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 620);
  by = drawPositionsTable(page, doc, fonts, 50, by - 6, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 20, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// TEMPLATE 18 — elegant-margins (weite ränder, ruhig)
// ============================================================================
const elegantMargins: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  logoTopLeft(page, logo, 80, 800);
  page.drawText(s(doc.workshop.name), { x: 400, y: 790, size: 10, font: fonts.timesBold, color: BLACK });
  let ry = 775;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 9, font: fonts.timesRoman, color: GRAY }); ry -= 12; }
  drawAddressBlock(page, doc, fonts, 80, 690);
  metaBlock(page, doc, fonts, 400, 670);
  page.drawText(s(doc.title.toUpperCase()), { x: 80, y: 550, size: 18, font: fonts.timesBold, color: brand });
  page.drawText(s(doc.number), { x: 80, y: 535, size: 11, font: fonts.timesRoman, color: LIGHT });
  let by = drawVehicleInfo(page, doc, fonts, 80, 510);
  by = drawPositionsTable(page, doc, fonts, 80, by - 15, 435, brand);
  by = drawPaymentInfo(page, doc, 80, by - 24, fonts);
  drawFooter(page, doc, fonts);
};

// ============================================================================
// Dispatch-map
// ============================================================================
export const RENDERERS: Record<string, Renderer> = {
  "modern-orange": modernOrange,
  "modern-blue": modernBlue,
  "modern-black": modernBlack,
  "modern-green": modernGreen,
  "classic-serif": classicSerif,
  "classic-lines": classicLines,
  "minimal-thin": minimalThin,
  "minimal-mono": minimalMono,
  "bold-band": boldBand,
  "bold-sidebar": boldSidebar,
  "bold-centered": boldCentered,
  "farbig-corners": farbigCorners,
  "farbig-gradient": farbigGradient,
  "farbig-frame": farbigFrame,
  "farbig-split": farbigSplit,
  "workshop-tools": workshopTools,
  "compact-dense": compactDense,
  "elegant-margins": elegantMargins,
};

// ============================================================================
// Public API — buildDocPdf
// ============================================================================
export async function buildDocPdf(doc: PdfDoc): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4.w, A4.h]);
  const fonts = await loadFonts(pdfDoc);
  const brand = hexToRgb(doc.workshop.brandPrimary);
  const accent = hexToRgb(doc.workshop.brandAccent, brand);
  let logo = null as null | { img: any; w: number; h: number };
  if (doc.workshop.letterheadLogo && doc.workshop.letterheadLogo.length > 0) {
    logo = await embedLogo(pdfDoc, new Uint8Array(doc.workshop.letterheadLogo), doc.workshop.letterheadLogoMime || "image/png", 140, 60);
  }
  const renderer = RENDERERS[doc.workshop.letterheadTemplate] || modernOrange;
  await renderer(page, doc, fonts, brand, accent, logo);
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
