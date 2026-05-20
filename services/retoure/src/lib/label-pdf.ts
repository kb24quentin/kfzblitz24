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
  /**
   * Interne Palette (kfzBlitz24-Retoure-Sammler) → Routing-Hinweis wird
   * angepasst: "INTERN — KB24-LAGER" statt "→ <Lieferant>". Optional.
   */
  isInternal?: boolean;
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

  // Das Layout folgt der Logik eines echten Versand-Routing-Labels:
  //   ┌─────────────────────────────────────┐
  //   │ kfzblitz24 [klein]   ROUTING-LABEL │
  //   ╞═════════════════════════════════════╡
  //   │ PALETTE NR.                         │
  //   │                                     │
  //   │            042                      │ ← RIESIG
  //   │       [Code-128 Barcode]            │
  //   ╞═════════════════════════════════════╡
  //   │ ABSENDER        │ EMPFÄNGER         │
  //   │ kfzBlitz24 GmbH │ Interparts GmbH   │ ← Address-Block
  //   │ (Lager Retoure) │ → an Lieferant    │
  //   ╞═════════════════════════════════════╡
  //   │ SCHLIESSEN BIS    [03.06.2026]      │ ← orange
  //   ╞═════════════════════════════════════╡
  //   │ Geöffnet ...    · PAL-KB24 · 2026   │
  //   └─────────────────────────────────────┘

  // ── 1. Mini-Header (Brand + Doc-Tag) ─────────────────────────────
  const headerY = A6_H - MARGIN;
  const wordHeight = 11;
  let wx = MARGIN;
  const kfzWidth = helvBold.widthOfTextAtSize("kfz", wordHeight);
  const blitzWidth = helvBold.widthOfTextAtSize("blitz", wordHeight);
  page.drawText("kfz", { x: wx, y: headerY - wordHeight, size: wordHeight, font: helvBold, color: NAVY });
  wx += kfzWidth;
  page.drawText("blitz", { x: wx, y: headerY - wordHeight, size: wordHeight, font: helvBold, color: ORANGE });
  wx += blitzWidth;
  page.drawText("24", { x: wx, y: headerY - wordHeight, size: wordHeight, font: helvBold, color: NAVY });

  const docTag = "ROUTING-LABEL";
  const docTagSize = 9;
  const docTagWidth = helv.widthOfTextAtSize(docTag, docTagSize);
  page.drawText(docTag, {
    x: A6_W - MARGIN - docTagWidth,
    y: headerY - wordHeight + 1,
    size: docTagSize,
    font: helv,
    color: DARK_GREY,
  });

  page.drawRectangle({
    x: MARGIN,
    y: headerY - wordHeight - 3,
    width: A6_W - 2 * MARGIN,
    height: 2,
    color: ORANGE,
  });

  // ── 2. PALETTE NR. + RIESIGER Code ─────────────────────────────
  // User-Brief: "Im Container Code muss nicht der Supplier drinnen
  // sein, den schreiben wir zusätzlich als Empfänger auf die Palette".
  // Code = nackte Sequenz-Nummer ("042"). Wir geben ihm trotzdem die
  // gesamte Breite weil's der ID-Anker ist.
  let cursorY = headerY - wordHeight - 12;
  page.drawText("PALETTE NR.", {
    x: MARGIN,
    y: cursorY,
    size: 8,
    font: helvBold,
    color: DARK_GREY,
  });

  cursorY -= 8;
  const codeBoxHeight = 30 * MM;
  const codeBoxTop = cursorY;
  const codeBoxBottom = cursorY - codeBoxHeight;

  page.drawRectangle({
    x: MARGIN,
    y: codeBoxBottom,
    width: A6_W - 2 * MARGIN,
    height: codeBoxHeight,
    borderColor: NAVY,
    borderWidth: 2,
  });

  // Bei nur 3-stelligen Codes können wir extra groß werden — bis 120pt.
  const codeBoxInnerW = A6_W - 2 * MARGIN - 16;
  let codeSize = 100;
  let codeWidthAtSize = helvBold.widthOfTextAtSize(opts.palletCode, codeSize);
  while (codeWidthAtSize > codeBoxInnerW && codeSize > 24) {
    codeSize -= 2;
    codeWidthAtSize = helvBold.widthOfTextAtSize(opts.palletCode, codeSize);
  }
  const codeBaselineY = codeBoxBottom + (codeBoxHeight - codeSize * 0.7) / 2;
  page.drawText(opts.palletCode, {
    x: (A6_W - codeWidthAtSize) / 2,
    y: codeBaselineY,
    size: codeSize,
    font: helvBold,
    color: NAVY,
  });

  // ── 3. Code-128-Barcode ──────────────────────────────────────────
  let bcImg;
  try {
    const png = await generateBarcodePng(opts.palletCode);
    bcImg = await pdf.embedPng(png);
  } catch {
    bcImg = null;
  }
  cursorY = codeBoxBottom - 6;
  if (bcImg) {
    const targetW = A6_W - 2 * MARGIN;
    const aspect = bcImg.height / bcImg.width;
    const targetH = Math.min(40, targetW * aspect);
    cursorY -= targetH;
    page.drawImage(bcImg, {
      x: MARGIN,
      y: cursorY,
      width: targetW,
      height: targetH,
    });
    cursorY -= 8;
  } else {
    cursorY -= 8;
  }

  // ── 4. Absender + Empfänger nebeneinander ────────────────────────
  // Wie bei einem echten Routing-Label: zwei Spalten, links wer schickt,
  // rechts wo's hingeht. Empfänger ist die wichtigere Info → fettere
  // Schrift + Navy.
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - 0.5,
    width: A6_W - 2 * MARGIN,
    height: 0.5,
    color: LIGHT_GREY,
  });
  cursorY -= 4;

  const colW = (A6_W - 2 * MARGIN) / 2;
  const absenderX = MARGIN;
  const empfaengerX = MARGIN + colW + 6;

  page.drawText("ABSENDER", {
    x: absenderX,
    y: cursorY - 8,
    size: 7,
    font: helvBold,
    color: DARK_GREY,
  });
  page.drawText("kfzBlitz24 GmbH", {
    x: absenderX,
    y: cursorY - 22,
    size: 11,
    font: helvBold,
    color: NAVY,
  });
  page.drawText("Lager Retoure", {
    x: absenderX,
    y: cursorY - 34,
    size: 9,
    font: helv,
    color: DARK_GREY,
  });

  page.drawText("EMPFÄNGER", {
    x: empfaengerX,
    y: cursorY - 8,
    size: 7,
    font: helvBold,
    color: DARK_GREY,
  });
  if (opts.isInternal) {
    page.drawText("kfzBlitz24 LAGER", {
      x: empfaengerX,
      y: cursorY - 22,
      size: 11,
      font: helvBold,
      color: NAVY,
    });
    page.drawText("Sortierfach Retouren", {
      x: empfaengerX,
      y: cursorY - 34,
      size: 9,
      font: helv,
      color: DARK_GREY,
    });
    page.drawText("(intern, bleibt im Haus)", {
      x: empfaengerX,
      y: cursorY - 45,
      size: 8,
      font: helv,
      color: DARK_GREY,
    });
  } else {
    page.drawText(opts.partnerName, {
      x: empfaengerX,
      y: cursorY - 22,
      size: 11,
      font: helvBold,
      color: NAVY,
      maxWidth: colW - 4,
    });
    page.drawText("Lieferanten-Retoure", {
      x: empfaengerX,
      y: cursorY - 34,
      size: 9,
      font: helv,
      color: DARK_GREY,
    });
  }

  cursorY -= 55;

  // Separator
  page.drawRectangle({
    x: MARGIN,
    y: cursorY,
    width: A6_W - 2 * MARGIN,
    height: 0.5,
    color: LIGHT_GREY,
  });

  // ── 5. SCHLIESSEN BIS ─────────────────────────────────────────────
  // SLA-Deadline für den Lager-Mitarbeiter — orange Box damit's auffällt.
  cursorY -= 8;
  const deadlineBoxH = 20 * MM;
  const deadlineBoxTop = cursorY;
  const deadlineBoxBottom = cursorY - deadlineBoxH;
  page.drawRectangle({
    x: MARGIN,
    y: deadlineBoxBottom,
    width: A6_W - 2 * MARGIN,
    height: deadlineBoxH,
    color: ORANGE,
  });
  page.drawText("SCHLIESSEN BIS", {
    x: MARGIN + 10,
    y: deadlineBoxTop - 12,
    size: 9,
    font: helvBold,
    color: rgb(1, 1, 1),
  });
  const deadlineText = fmtDate(opts.maxOpenUntil);
  const deadlineSize = 22;
  const deadlineWidth = helvBold.widthOfTextAtSize(deadlineText, deadlineSize);
  page.drawText(deadlineText, {
    x: A6_W - MARGIN - 10 - deadlineWidth,
    y: deadlineBoxTop - 30,
    size: deadlineSize,
    font: helvBold,
    color: rgb(1, 1, 1),
  });

  // ── 6. Footer: Geöffnet-Datum + Doc-ID ───────────────────────────
  const openedText = `Geöffnet: ${fmtDateTime(opts.createdAt)}`;
  page.drawText(openedText, {
    x: MARGIN,
    y: MARGIN + 6,
    size: 7,
    font: helv,
    color: DARK_GREY,
  });
  const footer = `PAL-KB24 · ${fmtDate(opts.createdAt)}`;
  const footerSize = 7;
  const footerWidth = helvMono.widthOfTextAtSize(footer, footerSize);
  page.drawText(footer, {
    x: A6_W - MARGIN - footerWidth,
    y: MARGIN + 6,
    size: footerSize,
    font: helvMono,
    color: DARK_GREY,
  });

  const bytes = await pdf.save();
  return bytes;
}
