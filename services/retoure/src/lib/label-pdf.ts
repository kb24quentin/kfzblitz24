/**
 * kfzBlitz24 — Returns Warehouse Routing Label.
 *
 * Verbindliche Spezifikation:
 *   /Users/quentinleopold/Desktop/GewährleistungsantragKB24/
 *       kfzBlitz24-Returns-Label-Designguide.md
 *
 * Kurzfassung:
 *   - 4×6 Zoll (288×432 pt) Portrait
 *   - Pure Schwarz/Weiß (keine Brand-Farben — Thermo-Optimierung)
 *   - Helvetica-Bold ausschließlich
 *   - Linker Brand-Bar 11 pt + rotiertes "RETURNS · ROUTING"-Ribbon
 *   - Top-Banner 46 pt schwarz mit weißer "RETURNS / WAREHOUSE"-Headline
 *   - Sektionen von oben nach unten:
 *       BIN (riesig in 2 pt-Box, 46 pt Text)
 *       ROUTE
 *       hr
 *       RECEIVER (Firma + Adresse)
 *       hr
 *       LATEST DEPARTURE + CONTAINER WAS OPENED ON + QR rechts
 *       hr + Footer
 *
 * Don'ts:
 *   - Niemals Markenfarben, niemals Regular-Schnitt, niemals <1pt Linien,
 *     niemals <7.5pt Text, niemals Brand-Bar weglassen, niemals BIN-Box
 *     verkleinern.
 */
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import bwipjs from "bwip-js";

export interface PalletPdfOptions {
  /** Palette-Code (= BIN). Beispiel: "042" oder "A12". */
  palletCode: string;
  /** Empfänger / Lieferant. Wird als "RECEIVER name" gerendert. */
  partnerName: string;
  /** Anlage-Zeitpunkt → "CONTAINER WAS OPENED ON". */
  createdAt: Date;
  /** Max-Offen-bis-Datum → "LATEST DEPARTURE". */
  maxOpenUntil: Date;
  /**
   * Interne Palette (kfzBlitz24-Sammler) → Receiver-Block wechselt auf
   * "kfzBlitz24 Lager Retoure" + Route auf "R00 · KB24-INTERNAL".
   */
  isInternal?: boolean;
  /** Optionale Adress-Zeilen des Empfängers. Mind. 2, max. 4. */
  receiverLines?: string[];
  /**
   * Optionale Routing-ID (`<R##> · <ZIEL>`). Wenn nicht gesetzt, wird
   * auto-derived aus dem Receiver-Namen.
   */
  route?: string;
  /** Optionale Retoure-Referenz für den QR-Code. */
  retoureReference?: string;
}

// ── Brand-Konstanten ────────────────────────────────────────────────
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

// ── Geometrie (4×6 Zoll in pt) ──────────────────────────────────────
const W = 288; // 4 inch
const H = 432; // 6 inch

const BRAND_BAR_W = 11;
const TEXT_X = BRAND_BAR_W + 22; // 33 pt
const RIGHT_MARGIN = 10;
const TEXT_RIGHT_X = W - RIGHT_MARGIN;
const TEXT_W = TEXT_RIGHT_X - TEXT_X;

const TOP_BANNER_H = 46;

const BIN_BOX_H = 62;
const QR_SIZE = 96;

// ── Helpers ─────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

async function generateBarcodePng(data: string): Promise<Uint8Array> {
  return bwipjs.toBuffer({
    bcid: "qrcode",
    text: data,
    scale: 4,
    eclevel: "M",
    backgroundcolor: "FFFFFF",
    paddingwidth: 0,
    paddingheight: 0,
  });
}

/**
 * Mappt unsere Supplier auf einen 4–8-stelligen Routing-Kurz-Code.
 * Format: `<R##> · <ZIEL>` (siehe Designguide §7.3).
 *
 * Fallback: aus dem Namen ableiten — bevorzugt ein bekanntes Hard-
 * Coding, sonst die ersten 8 Buchstaben in Großbuchstaben + Country.
 */
function deriveRoute(receiverName: string, isInternal: boolean): string {
  if (isInternal) return "R00 · KB24-INTERNAL";
  const known: Record<string, string> = {
    Interparts: "R01 · INTERPARTS-PL",
    Autopartner: "R02 · AUTOPARTN-DE",
  };
  if (known[receiverName]) return known[receiverName];
  const slug = receiverName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  return `R99 · ${slug || "RECEIVER"}`;
}

/**
 * Baut die finalen Receiver-Adresszeilen (mind. 2, max. 4). Letzte
 * Zeile = Land in Großbuchstaben (Designguide §7.4).
 */
function buildReceiverLines(
  opts: PalletPdfOptions,
): { name: string; lines: string[] } {
  if (opts.isInternal) {
    return {
      name: "kfzBlitz24 GmbH",
      lines: ["Lager Retoure", "Sortierfach intern", "GERMANY"],
    };
  }
  // Wenn User schon Zeilen mitgegeben hat — nehmen.
  if (opts.receiverLines && opts.receiverLines.length >= 2) {
    return {
      name: opts.partnerName,
      lines: opts.receiverLines.slice(0, 4),
    };
  }
  // Fallback wenn der Supplier in der DB keine Adresse hat: einfacher
  // Platzhalter mit "Adresse pflegen" Hinweis. Eigene Worker sehen das
  // sofort und können's im Admin-Dashboard nachpflegen.
  return {
    name: opts.partnerName,
    lines: ["Adresse im Admin pflegen", "—", "GERMANY"],
  };
}

/**
 * Baut das Routing-Label als PDF (4×6", Portrait, B/W).
 */
export async function buildPalletLabelPdf(
  opts: PalletPdfOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ── 1. Brand-Bar links (vollflächig schwarz) ─────────────────────
  page.drawRectangle({
    x: 0,
    y: 0,
    width: BRAND_BAR_W,
    height: H,
    color: BLACK,
  });

  // Rotiertes Ribbon-Text auf dem Brand-Bar (90° gedreht, weiß)
  // Wir zentrieren den Text mittig der Bar.
  const ribbonText = "RETURNS · ROUTING";
  const ribbonSize = 6.5;
  page.drawText(ribbonText, {
    x: BRAND_BAR_W / 2 + ribbonSize / 2,
    y: H / 2 - helvBold.widthOfTextAtSize(ribbonText, ribbonSize) / 2,
    size: ribbonSize,
    font: helvBold,
    color: WHITE,
    rotate: degrees(90),
  });

  // ── 2. Top-Banner (schwarze Fläche mit weißer Headline) ──────────
  const bannerY = H - TOP_BANNER_H;
  page.drawRectangle({
    x: BRAND_BAR_W,
    y: bannerY,
    width: W - BRAND_BAR_W,
    height: TOP_BANNER_H,
    color: BLACK,
  });
  page.drawText("RETURNS / WAREHOUSE", {
    x: TEXT_X,
    y: bannerY + TOP_BANNER_H - 19,
    size: 14,
    font: helvBold,
    color: WHITE,
  });
  page.drawText("kfzBlitz24 · Outbound to supplier", {
    x: TEXT_X,
    y: bannerY + TOP_BANNER_H - 33,
    size: 8,
    font: helvBold,
    color: WHITE,
  });

  // ── 3. BIN ───────────────────────────────────────────────────────
  // Caption + dicke schwarze Box mit 46pt-BIN-Code (dynamisch geshrinkt
  // wenn der Code zu lang wird, z. B. ab 4 Zeichen).
  const binCaptionY = bannerY - 16; // 4pt unter Banner + 12pt für Caption
  page.drawText("BIN", {
    x: TEXT_X,
    y: binCaptionY,
    size: 9,
    font: helvBold,
    color: BLACK,
  });

  const binBoxY = binCaptionY - 4 - BIN_BOX_H;
  const binBoxX = TEXT_X - 2;
  const binBoxW = TEXT_W + 4;
  page.drawRectangle({
    x: binBoxX,
    y: binBoxY,
    width: binBoxW,
    height: BIN_BOX_H,
    borderColor: BLACK,
    borderWidth: 2,
    color: WHITE,
  });

  // BIN-Code horizontal + vertikal mittig
  let binSize = 46;
  const binInnerW = binBoxW - 12;
  let binWidth = helvBold.widthOfTextAtSize(opts.palletCode, binSize);
  while (binWidth > binInnerW && binSize > 18) {
    binSize -= 2;
    binWidth = helvBold.widthOfTextAtSize(opts.palletCode, binSize);
  }
  const binBaselineY = binBoxY + (BIN_BOX_H - binSize * 0.7) / 2;
  page.drawText(opts.palletCode, {
    x: binBoxX + (binBoxW - binWidth) / 2,
    y: binBaselineY,
    size: binSize,
    font: helvBold,
    color: BLACK,
  });

  // ── 4. ROUTE ─────────────────────────────────────────────────────
  let cursorY = binBoxY - 14;
  page.drawText("ROUTE", {
    x: TEXT_X,
    y: cursorY,
    size: 8,
    font: helvBold,
    color: BLACK,
  });
  cursorY -= 18;
  const route = opts.route ?? deriveRoute(opts.partnerName, !!opts.isInternal);
  page.drawText(route, {
    x: TEXT_X,
    y: cursorY,
    size: 18,
    font: helvBold,
    color: BLACK,
    maxWidth: TEXT_W,
  });

  // hr — kürzer (60% der TEXT_W) damit die Linien optisch nicht über
  // andere Elemente wie den QR-Code hinwegfahren. User-Brief:
  // "Die striche überlagern den code, die müssen kürzer".
  const HR_W = Math.round(TEXT_W * 0.6);
  cursorY -= 10;
  page.drawRectangle({
    x: TEXT_X,
    y: cursorY,
    width: HR_W,
    height: 1,
    color: BLACK,
  });

  // ── 5. RECEIVER ──────────────────────────────────────────────────
  cursorY -= 14;
  page.drawText("RECEIVER", {
    x: TEXT_X,
    y: cursorY,
    size: 8,
    font: helvBold,
    color: BLACK,
  });
  cursorY -= 14;
  const receiver = buildReceiverLines(opts);
  page.drawText(receiver.name, {
    x: TEXT_X,
    y: cursorY,
    size: 11.5,
    font: helvBold,
    color: BLACK,
    maxWidth: TEXT_W,
  });
  cursorY -= 11.5;
  for (const line of receiver.lines.slice(0, 4)) {
    cursorY -= 11.5;
    page.drawText(line, {
      x: TEXT_X,
      y: cursorY,
      size: 10,
      font: helvBold,
      color: BLACK,
      maxWidth: TEXT_W,
    });
  }

  // hr — gleiche kurze Länge wie oben.
  cursorY -= 10;
  page.drawRectangle({
    x: TEXT_X,
    y: cursorY,
    width: HR_W,
    height: 1,
    color: BLACK,
  });

  // ── 6. LATEST DEPARTURE + CONTAINER WAS OPENED ON + QR ───────────
  // Zwei-Spalten-Layout links, QR rechts.
  const datesTopY = cursorY - 12;
  page.drawText("LATEST DEPARTURE", {
    x: TEXT_X,
    y: datesTopY,
    size: 8,
    font: helvBold,
    color: BLACK,
  });
  page.drawText(fmtDate(opts.maxOpenUntil), {
    x: TEXT_X,
    y: datesTopY - 16,
    size: 14,
    font: helvBold,
    color: BLACK,
  });

  const openedY = datesTopY - 38;
  page.drawText("CONTAINER WAS OPENED ON", {
    x: TEXT_X,
    y: openedY,
    size: 8,
    font: helvBold,
    color: BLACK,
  });
  page.drawText(fmtDate(opts.createdAt), {
    x: TEXT_X,
    y: openedY - 16,
    size: 14,
    font: helvBold,
    color: BLACK,
  });

  // QR rechts, vertikal mittig zu den beiden Datums-Blöcken
  let qrImg;
  try {
    const qrData =
      opts.retoureReference ?? `${opts.palletCode}·${route}`;
    const qrPng = await generateBarcodePng(qrData);
    qrImg = await pdf.embedPng(qrPng);
  } catch {
    qrImg = null;
  }
  if (qrImg) {
    const qrX = TEXT_RIGHT_X - QR_SIZE;
    const qrYCenter = (datesTopY + (openedY - 16)) / 2;
    const qrY = qrYCenter - QR_SIZE / 2;
    page.drawImage(qrImg, {
      x: qrX,
      y: qrY,
      width: QR_SIZE,
      height: QR_SIZE,
    });
  }

  cursorY = openedY - 28;

  // ── 7. Footer ────────────────────────────────────────────────────
  // User-Brief: Footer-Text "kfzBlitz24 Returns Warehouse · ops@…"
  // komplett raus von allen Lager-Labels. Die Labels sind ohnehin
  // intern — Kontakt-Footer braucht's nicht. HR-Linie auch weg.

  const bytes = await pdf.save();
  return bytes;
}
