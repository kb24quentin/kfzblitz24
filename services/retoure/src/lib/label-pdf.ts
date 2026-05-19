/**
 * Pallet-Label als PDF — Fallback solange noch kein ZPL-Netzwerk-
 * Drucker im Lager hängt. Layout spiegelt das ZPL-Label aus
 * `label-print/templates.ts` möglichst genau (kfzblitz24-Wortmark,
 * "PALETTE"-Titel, Lieferant fett, Code-128-Barcode, Datums-Block).
 *
 * Größe: A6 (105×148 mm). Lässt sich auf einem normalen Bluetooth-
 * Drucker auf A6-Label-Papier drucken oder vom Browser/iOS-Share-Menü
 * an einen beliebigen Mobile-Drucker schicken.
 *
 * Gibt einen `Uint8Array` zurück (kompatibel mit Next-`Response`),
 * KEINE Filesystem-Seiteneffekte.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js";

export interface PalletPdfOptions {
  /** Pallet identifier, encoded als Code-128. */
  palletCode: string;
  /** Lieferanten-/Partner-Name groß. */
  partnerName: string;
  /** Anlage-Zeitpunkt. */
  createdAt: Date;
  /** Max-Offen-bis-Datum. */
  maxOpenUntil: Date;
}

// Brand-Farben (aus CLAUDE.md §8)
const NAVY = rgb(0x0b / 255, 0x37 / 255, 0x56 / 255);
const ORANGE = rgb(0xff / 255, 0x66 / 255, 0);
const LIGHT_GREY = rgb(0xe6 / 255, 0xe8 / 255, 0xeb / 255);
const DARK_GREY = rgb(0x3d / 255, 0x46 / 255, 0x54 / 255);

// A6 in PDF-Points (1 mm ≈ 2.83465 pt)
const MM = 2.83464567;
const A6_W = 105 * MM;
const A6_H = 148 * MM;
const MARGIN = 8 * MM;

function fmtDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

async function generateBarcodePng(data: string): Promise<Uint8Array> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: data,
    scale: 3,
    height: 18,
    includetext: false, // Text setzen wir selbst drunter (bessere Typo)
    backgroundcolor: "FFFFFF",
    paddingwidth: 0,
    paddingheight: 0,
  });
}

/**
 * Baut das Paletten-Label als PDF (A6). Reihenfolge top→bottom:
 *   1. kfzblitz24-Wortmark + orange Akzent-Linie
 *   2. "PALETTE"-Überschrift
 *   3. Lieferant (fett, groß)
 *   4. Code-128-Barcode des Codes
 *   5. Code in Monospace darunter
 *   6. Datums-Block (Geöffnet / Max. offen bis)
 *   7. Footer "PAL-KB24 · YYYY-MM-DD"
 */
export async function buildPalletLabelPdf(
  opts: PalletPdfOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A6_W, A6_H]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvMono = await pdf.embedFont(StandardFonts.Courier);
  const helvMonoBold = await pdf.embedFont(StandardFonts.CourierBold);

  let y = A6_H - MARGIN;

  // ── 1. Wortmark "kfzblitz24" ───────────────────────────────────────
  // "kfz" Navy, "blitz" Orange, "24" Navy, alles in einer Zeile
  const wordHeight = 18;
  const kfzWidth = helvBold.widthOfTextAtSize("kfz", wordHeight);
  const blitzWidth = helvBold.widthOfTextAtSize("blitz", wordHeight);
  // const _twentyfourWidth = helvBold.widthOfTextAtSize("24", wordHeight);

  let wx = MARGIN;
  y -= wordHeight;
  page.drawText("kfz", { x: wx, y, size: wordHeight, font: helvBold, color: NAVY });
  wx += kfzWidth;
  page.drawText("blitz", { x: wx, y, size: wordHeight, font: helvBold, color: ORANGE });
  wx += blitzWidth;
  page.drawText("24", { x: wx, y, size: wordHeight, font: helvBold, color: NAVY });

  // Orange Akzent-Linie unter dem Wortmark
  y -= 4;
  page.drawRectangle({
    x: MARGIN,
    y: y - 3,
    width: A6_W - 2 * MARGIN,
    height: 3,
    color: ORANGE,
  });
  y -= 6;

  // ── 2. PALETTE-Title ──────────────────────────────────────────────
  y -= 32;
  page.drawText("PALETTE", {
    x: MARGIN,
    y,
    size: 28,
    font: helvBold,
    color: NAVY,
  });

  // ── 3. Lieferant ──────────────────────────────────────────────────
  y -= 8;
  page.drawText("Lieferant", {
    x: MARGIN,
    y: y - 10,
    size: 8,
    font: helv,
    color: DARK_GREY,
  });
  y -= 28;
  page.drawText(opts.partnerName, {
    x: MARGIN,
    y,
    size: 18,
    font: helvBold,
    color: NAVY,
    maxWidth: A6_W - 2 * MARGIN,
  });

  // ── 4. Barcode ────────────────────────────────────────────────────
  y -= 24;
  let bcImg;
  try {
    const png = await generateBarcodePng(opts.palletCode);
    bcImg = await pdf.embedPng(png);
  } catch {
    bcImg = null;
  }

  if (bcImg) {
    const targetW = A6_W - 2 * MARGIN;
    const aspect = bcImg.height / bcImg.width;
    const targetH = Math.min(60, targetW * aspect);
    y -= targetH;
    page.drawImage(bcImg, {
      x: MARGIN,
      y,
      width: targetW,
      height: targetH,
    });
  } else {
    // Fallback: keinen Barcode, nur den Code prominent
    y -= 24;
  }

  // ── 5. Code als monospace ─────────────────────────────────────────
  y -= 20;
  const codeWidth = helvMonoBold.widthOfTextAtSize(opts.palletCode, 14);
  page.drawText(opts.palletCode, {
    x: (A6_W - codeWidth) / 2,
    y,
    size: 14,
    font: helvMonoBold,
    color: NAVY,
  });

  // ── 6. Datums-Block ───────────────────────────────────────────────
  y -= 14;
  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: A6_W - 2 * MARGIN,
    height: 1,
    color: LIGHT_GREY,
  });
  y -= 12;

  const labelSize = 8;
  const valSize = 11;
  const labelW = 80;
  page.drawText("Geöffnet:", {
    x: MARGIN,
    y,
    size: labelSize,
    font: helv,
    color: DARK_GREY,
  });
  page.drawText(fmtDateTime(opts.createdAt), {
    x: MARGIN + labelW,
    y: y - 1,
    size: valSize,
    font: helv,
    color: NAVY,
  });
  y -= 16;
  page.drawText("Max. offen bis:", {
    x: MARGIN,
    y,
    size: labelSize,
    font: helv,
    color: DARK_GREY,
  });
  page.drawText(fmtDateTime(opts.maxOpenUntil), {
    x: MARGIN + labelW,
    y: y - 1,
    size: valSize,
    font: helvBold,
    color: NAVY,
  });

  // ── 7. Footer Doc-ID ──────────────────────────────────────────────
  const footer = `PAL-KB24 · ${fmtDate(opts.createdAt)}`;
  const footerSize = 7;
  const footerWidth = helvMono.widthOfTextAtSize(footer, footerSize);
  page.drawText(footer, {
    x: A6_W - MARGIN - footerWidth,
    y: MARGIN,
    size: footerSize,
    font: helvMono,
    color: DARK_GREY,
  });

  const bytes = await pdf.save();
  return bytes;
}
