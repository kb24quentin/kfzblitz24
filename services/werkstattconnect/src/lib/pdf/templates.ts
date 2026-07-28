import { PDFDocument, rgb, type PDFPage, type RGB } from "pdf-lib";
import type { PdfDoc } from "./types";
import {
  A4, BLACK, WHITE, GRAY, LIGHT, BORDER, FOOTER_TOP_Y,
  s, drawRight, drawCenter, drawAddressBlock, drawVehicleInfo, drawPositionsTable,
  drawPaymentInfo, drawFooter, drawNotes, embedLogo, hexToRgb, lighter, darker, loadFonts, metaBlock, pickFonts, wrap,
  type Fonts,
} from "./helpers";

type LogoInfo = { img: any; w: number; h: number } | null;
type Renderer = (page: PDFPage, doc: PdfDoc, fonts: Fonts, brand: RGB, accent: RGB, logo: LogoInfo) => void | Promise<void>;

function logoTopLeft(page: PDFPage, logo: LogoInfo, x = 50, y = 800) {
  if (!logo) return;
  page.drawImage(logo.img, { x, y: y - logo.h, width: logo.w, height: logo.h });
}

/**
 * Standard-header rechts oben: workshop-name + adresse + kontakt.
 * Nutzt font aus workshop.brandFontFamily.
 */
function headerRight(page: PDFPage, doc: PdfDoc, fonts: Fonts, x = 400) {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawText(s(doc.workshop.name), { x, y: 795, size: 10, font: bold, color: BLACK });
  const contact = [
    doc.workshop.street,
    `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(),
    doc.workshop.contactPhone,
    doc.workshop.contactEmail,
  ].filter(Boolean);
  let ry = 780;
  for (const line of contact) {
    page.drawText(s(line as string), { x, y: ry, size: 9, font: body, color: GRAY });
    ry -= 12;
  }
}

// ============================================================================
// MODERN family (nur farbvarianten des gleichen layouts)
// ============================================================================
function modernBase(brand: RGB): Renderer {
  return (page, doc, fonts, _b, _a, logo) => {
    const { bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
    logoTopLeft(page, logo);
    headerRight(page, doc, fonts);
    drawAddressBlock(page, doc, fonts, 50, 700);
    metaBlock(page, doc, fonts, 380, 680);
    page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: bold, color: brand });
    let by = drawVehicleInfo(page, doc, fonts, 50, 545);
    by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
    by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
    drawNotes(page, doc, fonts, 50, by, 495);
    drawFooter(page, doc, fonts, LIGHT, 100);
  };
}

const modernOrange: Renderer = (p, d, f, _b, _a, l) => modernBase(hexToRgb(d.workshop.brandPrimary))(p, d, f, _b, _a, l);
const modernBlue: Renderer = (p, d, f, _b, _a, l) => modernBase(hexToRgb("#1f6feb"))(p, d, f, _b, _a, l);
const modernBlack: Renderer = (p, d, f, _b, _a, l) => modernBase(rgb(0.1, 0.1, 0.1))(p, d, f, _b, _a, l);
const modernGreen: Renderer = (p, d, f, _b, _a, l) => modernBase(hexToRgb("#16a34a"))(p, d, f, _b, _a, l);

// ============================================================================
// CLASSIC family
// ============================================================================
const classicSerif: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 400, y: 795, size: 11, font: bold, color: BLACK });
  let ry = 780;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 10, font: body, color: GRAY }); ry -= 13; }
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 22, font: bold, color: BLACK });
  page.drawLine({ start: { x: 50, y: 562 }, end: { x: 545, y: 562 }, thickness: 1.2, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

const classicLines: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawLine({ start: { x: 50, y: 815 }, end: { x: 545, y: 815 }, thickness: 2, color: brand });
  page.drawLine({ start: { x: 50, y: 810 }, end: { x: 545, y: 810 }, thickness: 0.5, color: brand });
  logoTopLeft(page, logo, 50, 780);
  drawCenter(page, s(doc.workshop.name), 297, 758, bold, 11, BLACK);
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  drawCenter(page, s(contact), 297, 744, body, 9, GRAY);
  page.drawLine({ start: { x: 50, y: 730 }, end: { x: 545, y: 730 }, thickness: 0.4, color: BORDER });
  drawAddressBlock(page, doc, fonts, 50, 710);
  metaBlock(page, doc, fonts, 380, 690);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 18, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: letterhead-classic — traditioneller zentrierter briefkopf
const letterheadClassic: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold, italic } = pickFonts(fonts, doc.workshop.brandFontFamily);
  if (logo) {
    const scale = Math.min(80 / logo.img.width, 40 / logo.img.height, 1);
    const w = logo.img.width * scale;
    const h = logo.img.height * scale;
    page.drawImage(logo.img, { x: (A4.w - w) / 2, y: 810 - h, width: w, height: h });
  }
  drawCenter(page, s(doc.workshop.name.toUpperCase()), A4.w / 2, 750, bold, 16, BLACK);
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim()].filter(Boolean).join(" · ");
  drawCenter(page, s(contact), A4.w / 2, 733, italic, 9, GRAY);
  const contact2 = [doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  drawCenter(page, s(contact2), A4.w / 2, 721, italic, 9, GRAY);
  page.drawLine({ start: { x: 200, y: 710 }, end: { x: A4.w - 200, y: 710 }, thickness: 0.4, color: brand });
  drawAddressBlock(page, doc, fonts, 50, 685);
  metaBlock(page, doc, fonts, 380, 665);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 555, size: 18, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 530);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: executive — elegant mit dünnen linien und weitem raster
const executive: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  // Elegant top-line
  page.drawLine({ start: { x: 50, y: 820 }, end: { x: 545, y: 820 }, thickness: 0.4, color: brand });
  logoTopLeft(page, logo, 50, 802);
  page.drawText(s(doc.workshop.name), { x: 400, y: 800, size: 12, font: bold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactEmail].filter(Boolean);
  let ry = 785;
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 8, font: body, color: LIGHT }); ry -= 11; }
  page.drawLine({ start: { x: 50, y: 745 }, end: { x: 545, y: 745 }, thickness: 0.2, color: LIGHT });
  drawAddressBlock(page, doc, fonts, 50, 710);
  metaBlock(page, doc, fonts, 380, 690);
  page.drawText(s(doc.title.toUpperCase()), { x: 50, y: 570, size: 24, font: bold, color: BLACK });
  page.drawText(s(doc.number), { x: 50, y: 552, size: 11, font: body, color: brand });
  page.drawLine({ start: { x: 50, y: 545 }, end: { x: 150, y: 545 }, thickness: 1, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 525);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// ============================================================================
// MINIMAL family
// ============================================================================
const minimalThin: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  logoTopLeft(page, logo);
  drawRight(page, s(doc.workshop.name), 545, 795, body, 10, BLACK);
  drawRight(page, s(doc.workshop.contactEmail), 545, 780, body, 8, LIGHT);
  page.drawLine({ start: { x: 50, y: 750 }, end: { x: 545, y: 750 }, thickness: 0.3, color: BORDER });
  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(doc.title.toUpperCase()), { x: 50, y: 580, size: 22, font: body, color: brand });
  page.drawText(s(doc.number), { x: 50, y: 560, size: 12, font: body, color: LIGHT });
  let by = drawVehicleInfo(page, doc, fonts, 50, 540);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

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
  drawFooter(page, doc, fonts, LIGHT, 100);
};

const compactDense: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 400, y: 810, size: 9, font: bold, color: BLACK });
  page.drawText(s(`${doc.workshop.street ?? ""} · ${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""} · ${doc.workshop.contactEmail}`.trim()), { x: 400, y: 795, size: 7, font: body, color: GRAY });
  drawAddressBlock(page, doc, fonts, 50, 750);
  metaBlock(page, doc, fonts, 380, 730);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 640, size: 14, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 620);
  by = drawPositionsTable(page, doc, fonts, 50, by - 6, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 20, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// ============================================================================
// BOLD family
// ============================================================================
const boldBand: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: 0, y: 770, width: A4.w, height: 72, color: brand });
  page.drawText(s(doc.workshop.name), { x: 50, y: 810, size: 18, font: bold, color: WHITE });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 50, y: 790, size: 9, font: body, color: WHITE });
  if (logo) page.drawImage(logo.img, { x: 545 - logo.w, y: 810 - logo.h / 2, width: logo.w, height: logo.h });
  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

const boldSidebar: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: 0, y: 0, width: 165, height: A4.h, color: brand });
  if (logo) {
    const s2 = Math.min(120 / logo.img.width, 60 / logo.img.height, 1);
    page.drawImage(logo.img, { x: 20, y: 780, width: logo.img.width * s2, height: logo.img.height * s2 });
  }
  page.drawText(s(doc.workshop.name), { x: 20, y: 750, size: 12, font: bold, color: WHITE });
  let ry = 730;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 20, y: ry, size: 8, font: body, color: WHITE, maxWidth: 130 }); ry -= 11; }
  drawAddressBlock(page, doc, fonts, 190, 780);
  metaBlock(page, doc, fonts, 350, 780);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 190, y: 640, size: 18, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 190, 615);
  by = drawPositionsTable(page, doc, fonts, 190, by - 10, 355, brand);
  by = drawPaymentInfo(page, doc, 190, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

const boldCentered: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  if (logo) page.drawImage(logo.img, { x: (A4.w - logo.w) / 2, y: 800 - logo.h, width: logo.w, height: logo.h });
  drawCenter(page, s(doc.workshop.name), A4.w / 2, 750, bold, 14, BLACK);
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  drawCenter(page, s(contact), A4.w / 2, 735, body, 9, GRAY);
  page.drawLine({ start: { x: 200, y: 715 }, end: { x: A4.w - 200, y: 715 }, thickness: 1.5, color: brand });
  drawAddressBlock(page, doc, fonts, 50, 685);
  metaBlock(page, doc, fonts, 380, 665);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 560, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 535);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: stripe-left — durchgehender balken links (voll höhe, 30pt breit)
const stripeLeft: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: 0, y: 0, width: 30, height: A4.h, color: brand });
  logoTopLeft(page, logo, 60, 800);
  headerRight(page, doc, fonts);
  drawAddressBlock(page, doc, fonts, 60, 700, 240);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 60, y: 570, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 60, 545);
  by = drawPositionsTable(page, doc, fonts, 60, by - 10, 485, brand);
  by = drawPaymentInfo(page, doc, 60, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: stripe-right — durchgehender balken rechts
const stripeRight: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: A4.w - 30, y: 0, width: 30, height: A4.h, color: brand });
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 350, y: 795, size: 10, font: bold, color: BLACK });
  let ry = 780;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 350, y: ry, size: 9, font: body, color: GRAY }); ry -= 12; }
  drawAddressBlock(page, doc, fonts, 50, 700, 240);
  metaBlock(page, doc, fonts, 350, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 485, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: double-stripe — zwei balken links (dick + dünn)
const doubleStripe: Renderer = (page, doc, fonts, brand, accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const secondColor = doc.workshop.brandAccent ? accent : lighter(brand, 0.5);
  page.drawRectangle({ x: 0, y: 0, width: 20, height: A4.h, color: brand });
  page.drawRectangle({ x: 24, y: 0, width: 4, height: A4.h, color: secondColor });
  logoTopLeft(page, logo, 55, 800);
  headerRight(page, doc, fonts);
  drawAddressBlock(page, doc, fonts, 55, 700, 240);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 55, y: 570, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 55, 545);
  by = drawPositionsTable(page, doc, fonts, 55, by - 10, 490, brand);
  by = drawPaymentInfo(page, doc, 55, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: industrial — grosse zahlen, bold, industrial-look
const industrial: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name.toUpperCase()), { x: 400, y: 800, size: 12, font: bold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim()].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 400, y: 786, size: 8, font: body, color: GRAY });
  page.drawText(s(doc.workshop.contactEmail), { x: 400, y: 774, size: 8, font: body, color: GRAY });
  page.drawRectangle({ x: 50, y: 748, width: 495, height: 4, color: brand });
  drawAddressBlock(page, doc, fonts, 50, 720);
  // Grosse nummer prominent
  page.drawText(s(doc.title.toUpperCase()), { x: 380, y: 700, size: 10, font: bold, color: brand });
  page.drawText(s(doc.number), { x: 380, y: 675, size: 22, font: bold, color: BLACK });
  page.drawText(s(`Datum: ${doc.issuedAt.toLocaleDateString("de-DE")}`), { x: 380, y: 660, size: 9, font: body, color: GRAY });
  if (doc.dueAt) page.drawText(s(`${doc.kind === "invoice" ? "Fällig" : "Gültig"}: ${doc.dueAt.toLocaleDateString("de-DE")}`), { x: 380, y: 648, size: 9, font: body, color: GRAY });
  let by = drawVehicleInfo(page, doc, fonts, 50, 620);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// ============================================================================
// FARBIG family
// ============================================================================
const farbigCorners: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: 0, y: 780, width: 250, height: 62, color: brand });
  page.drawRectangle({ x: A4.w - 250, y: 0, width: 250, height: 20, color: brand });
  if (logo) page.drawImage(logo.img, { x: 20, y: 800 - logo.h, width: logo.w, height: logo.h });
  page.drawText(s(doc.workshop.name), { x: 280, y: 810, size: 12, font: bold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 280, y: 795, size: 9, font: body, color: GRAY });
  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

const farbigGradient: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const stops = 20;
  for (let i = 0; i < stops; i++) {
    const t = i / stops;
    const c = lighter(brand, t * 0.9);
    page.drawRectangle({ x: 0, y: 770 + i * 3.6, width: A4.w, height: 3.7, color: c });
  }
  if (logo) page.drawImage(logo.img, { x: 50, y: 810 - logo.h, width: logo.w, height: logo.h });
  page.drawText(s(doc.workshop.name), { x: 400, y: 810, size: 12, font: bold, color: WHITE });
  const contact = [doc.workshop.contactEmail, doc.workshop.contactPhone].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 400, y: 795, size: 9, font: body, color: WHITE });
  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

const farbigFrame: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: 20, y: 20, width: A4.w - 40, height: A4.h - 40, borderColor: brand, borderWidth: 2, color: undefined });
  logoTopLeft(page, logo, 50, 800);
  page.drawText(s(doc.workshop.name), { x: 400, y: 795, size: 10, font: bold, color: BLACK });
  let ry = 780;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 9, font: body, color: GRAY }); ry -= 12; }
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 80);
};

const farbigSplit: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: 0, y: 760, width: A4.w, height: 82, color: lighter(brand, 0.85) });
  logoTopLeft(page, logo, 50, 800);
  page.drawText(s(doc.workshop.name), { x: 400, y: 810, size: 12, font: bold, color: brand });
  const contact = [doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 400, y: 793, size: 9, font: body, color: darker(brand, 0.1) });
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: corner-triangle — grosses dreieck oben-links
const cornerTriangle: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawSvgPath("M 0 842 L 0 662 L 180 842 Z", { color: brand, borderWidth: 0 });
  logoTopLeft(page, logo, 200, 800);
  page.drawText(s(doc.workshop.name), { x: 400, y: 800, size: 12, font: bold, color: BLACK });
  let ry = 785;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 9, font: body, color: GRAY }); ry -= 12; }
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: wave-header — geschwungene trennlinie via SVG-path
const waveHeader: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  // Wave via SVG path (Cubic bezier)
  const wavePath = "M 0 780 C 148 810, 297 750, 445 780 L 595 780 L 595 842 L 0 842 Z";
  page.drawSvgPath(wavePath, { color: brand, borderWidth: 0 });
  logoTopLeft(page, logo, 50, 828);
  drawRight(page, s(doc.workshop.name), 545, 820, bold, 12, WHITE);
  drawRight(page, s(doc.workshop.contactEmail), 545, 802, body, 8, WHITE);
  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: gradient-sidebar — verlauf-sidebar links (fake mit stripes)
const gradientSidebar: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const bands = 30;
  const w = 90;
  const h = A4.h / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    const c = i < bands / 2 ? brand : lighter(brand, (t - 0.5) * 1.6);
    page.drawRectangle({ x: 0, y: i * h, width: w, height: h + 1, color: c });
  }
  if (logo) {
    const s2 = Math.min(70 / logo.img.width, 40 / logo.img.height, 1);
    page.drawImage(logo.img, { x: 10, y: 800 - logo.img.height * s2, width: logo.img.width * s2, height: logo.img.height * s2 });
  }
  page.drawText(s(doc.workshop.name), { x: 10, y: 750, size: 10, font: bold, color: WHITE });
  let ry = 730;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 10, y: ry, size: 7, font: body, color: WHITE, maxWidth: 75 }); ry -= 10; }
  drawAddressBlock(page, doc, fonts, 110, 780);
  metaBlock(page, doc, fonts, 350, 780);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 110, y: 640, size: 18, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 110, 615);
  by = drawPositionsTable(page, doc, fonts, 110, by - 10, 435, brand);
  by = drawPaymentInfo(page, doc, 110, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// NEW: fresh-accents — mehrere farb-chips über die seite verteilt
const freshAccents: Renderer = (page, doc, fonts, brand, accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  const acc = doc.workshop.brandAccent ? accent : lighter(brand, 0.6);
  page.drawCircle({ x: 545, y: 820, size: 22, color: brand });
  page.drawCircle({ x: 520, y: 795, size: 8, color: acc });
  page.drawRectangle({ x: 0, y: 812, width: 380, height: 3, color: brand });
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 400, y: 770, size: 11, font: bold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 400, y: 755, size: 8, font: body, color: GRAY });
  drawAddressBlock(page, doc, fonts, 50, 700);
  metaBlock(page, doc, fonts, 380, 680);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 570, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 545);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

// ============================================================================
// Legacy templates
// ============================================================================
const workshopTools: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  page.drawRectangle({ x: A4.w - 100, y: 780, width: 6, height: 40, color: brand });
  page.drawCircle({ x: A4.w - 97, y: 775, size: 10, color: brand });
  page.drawText("WERKSTATT", { x: A4.w - 140, y: 730, size: 7, font: bold, color: brand });
  logoTopLeft(page, logo);
  page.drawText(s(doc.workshop.name), { x: 200, y: 810, size: 14, font: bold, color: BLACK });
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean).join(" · ");
  page.drawText(s(contact), { x: 200, y: 792, size: 9, font: body, color: GRAY });
  drawAddressBlock(page, doc, fonts, 50, 720);
  metaBlock(page, doc, fonts, 380, 700);
  page.drawText(s(`${doc.title} ${doc.number}`), { x: 50, y: 580, size: 20, font: bold, color: brand });
  let by = drawVehicleInfo(page, doc, fonts, 50, 555);
  by = drawPositionsTable(page, doc, fonts, 50, by - 10, 495, brand);
  by = drawPaymentInfo(page, doc, 50, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
};

const elegantMargins: Renderer = (page, doc, fonts, brand, _accent, logo) => {
  const { body, bold } = pickFonts(fonts, doc.workshop.brandFontFamily);
  logoTopLeft(page, logo, 80, 800);
  page.drawText(s(doc.workshop.name), { x: 400, y: 790, size: 10, font: bold, color: BLACK });
  let ry = 775;
  const contact = [doc.workshop.street, `${doc.workshop.zip ?? ""} ${doc.workshop.city ?? ""}`.trim(), doc.workshop.contactPhone, doc.workshop.contactEmail].filter(Boolean);
  for (const line of contact) { page.drawText(s(line as string), { x: 400, y: ry, size: 9, font: body, color: GRAY }); ry -= 12; }
  drawAddressBlock(page, doc, fonts, 80, 690);
  metaBlock(page, doc, fonts, 350, 670);
  page.drawText(s(doc.title.toUpperCase()), { x: 80, y: 550, size: 18, font: bold, color: brand });
  page.drawText(s(doc.number), { x: 80, y: 535, size: 11, font: body, color: LIGHT });
  let by = drawVehicleInfo(page, doc, fonts, 80, 510);
  by = drawPositionsTable(page, doc, fonts, 80, by - 15, 435, brand);
  by = drawPaymentInfo(page, doc, 80, by - 24, fonts);
  drawFooter(page, doc, fonts, LIGHT, 100);
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
  "letterhead-classic": letterheadClassic,
  "executive": executive,
  "minimal-thin": minimalThin,
  "minimal-mono": minimalMono,
  "compact-dense": compactDense,
  "bold-band": boldBand,
  "bold-sidebar": boldSidebar,
  "bold-centered": boldCentered,
  "stripe-left": stripeLeft,
  "stripe-right": stripeRight,
  "double-stripe": doubleStripe,
  "industrial": industrial,
  "farbig-corners": farbigCorners,
  "farbig-gradient": farbigGradient,
  "farbig-frame": farbigFrame,
  "farbig-split": farbigSplit,
  "corner-triangle": cornerTriangle,
  "wave-header": waveHeader,
  "gradient-sidebar": gradientSidebar,
  "fresh-accents": freshAccents,
  "workshop-tools": workshopTools,
  "elegant-margins": elegantMargins,
};

export async function buildDocPdf(doc: PdfDoc): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4.w, A4.h]);
  const fonts = await loadFonts(pdfDoc);
  const brand = hexToRgb(doc.workshop.brandPrimary);
  const accent = hexToRgb(doc.workshop.brandAccent, brand);
  let logo = null as LogoInfo;
  if (doc.workshop.letterheadLogo && doc.workshop.letterheadLogo.length > 0) {
    logo = await embedLogo(pdfDoc, new Uint8Array(doc.workshop.letterheadLogo), doc.workshop.letterheadLogoMime || "image/png", 140, 60);
  }
  const renderer = RENDERERS[doc.workshop.letterheadTemplate] || modernOrange;
  await renderer(page, doc, fonts, brand, accent, logo);
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
