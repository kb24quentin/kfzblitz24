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

  // ── 1. Mini-Wortmark + orange Linie oben ─────────────────────────
  // Klein gehalten — das Label soll dominiert sein vom Paletten-Code,
  // nicht von unserem Brand. Header dient nur als Eigentums-Marker.
  const headerY = A6_H - MARGIN;
  const wordHeight = 12;
  let wx = MARGIN;
  const kfzWidth = helvBold.widthOfTextAtSize("kfz", wordHeight);
  const blitzWidth = helvBold.widthOfTextAtSize("blitz", wordHeight);
  page.drawText("kfz", { x: wx, y: headerY - wordHeight, size: wordHeight, font: helvBold, color: NAVY });
  wx += kfzWidth;
  page.drawText("blitz", { x: wx, y: headerY - wordHeight, size: wordHeight, font: helvBold, color: ORANGE });
  wx += blitzWidth;
  page.drawText("24", { x: wx, y: headerY - wordHeight, size: wordHeight, font: helvBold, color: NAVY });

  // Rechts oben: Doc-Marker (klein) — zeigt was das für ein Label ist
  const docTag = opts.isInternal ? "INTERNE PALETTE" : "PALETTE";
  const docTagSize = 9;
  const docTagWidth = helv.widthOfTextAtSize(docTag, docTagSize);
  page.drawText(docTag, {
    x: A6_W - MARGIN - docTagWidth,
    y: headerY - wordHeight + 1,
    size: docTagSize,
    font: helv,
    color: DARK_GREY,
  });

  // Orange Akzent-Linie unter dem Header
  page.drawRectangle({
    x: MARGIN,
    y: headerY - wordHeight - 3,
    width: A6_W - 2 * MARGIN,
    height: 2,
    color: ORANGE,
  });

  // ── 2. RIESIGER Paletten-Code in Box ─────────────────────────────
  // Aus User-Brief: "Rießiger Paletten Name". Wir geben dem Code die
  // meisten Pixel auf der Seite — von 5m Entfernung erkennbar.
  // Zentriert horizontal + dicker Navy-Rahmen.
  const codeBoxY = headerY - wordHeight - 12;
  const codeBoxH = 60 * MM / 25.4; // ~60mm hoch fühlt sich zu fett an
  // Eigentlich: ich nehme ~38mm, das passt sauber rein und lässt
  // genug Raum für Barcode + Routing + Deadline drunter.
  const codeBoxHeight = 38 * MM;
  const codeBoxTop = codeBoxY;
  const codeBoxBottom = codeBoxTop - codeBoxHeight;

  // Rahmen: 2pt Navy-Border
  page.drawRectangle({
    x: MARGIN,
    y: codeBoxBottom,
    width: A6_W - 2 * MARGIN,
    height: codeBoxHeight,
    borderColor: NAVY,
    borderWidth: 2,
  });

  // Code horizontal + vertikal mittig. Wir berechnen die Schriftgröße
  // dynamisch so dass der Code fast die volle Box-Breite ausnutzt.
  const codeBoxInnerW = A6_W - 2 * MARGIN - 16; // 8pt padding innen
  let codeSize = 64;
  let codeWidthAtSize = helvBold.widthOfTextAtSize(opts.palletCode, codeSize);
  while (codeWidthAtSize > codeBoxInnerW && codeSize > 24) {
    codeSize -= 2;
    codeWidthAtSize = helvBold.widthOfTextAtSize(opts.palletCode, codeSize);
  }
  // Approximate vertical centering — pdf-lib text baseline is at y.
  // Capital-letter height ≈ size * 0.7.
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
  let cursorY = codeBoxBottom - 8;
  if (bcImg) {
    const targetW = A6_W - 2 * MARGIN;
    const aspect = bcImg.height / bcImg.width;
    const targetH = Math.min(45, targetW * aspect);
    cursorY -= targetH;
    page.drawImage(bcImg, {
      x: MARGIN,
      y: cursorY,
      width: targetW,
      height: targetH,
    });
    cursorY -= 6;
  } else {
    cursorY -= 8;
  }

  // ── 4. Routing-Ziel ──────────────────────────────────────────────
  // Klein "WOHIN" + bold Routing-Text. Bei intern: anderer Routing-
  // Hinweis (eigenes Sortier-Fach im Lager statt externer Lieferant).
  cursorY -= 4;
  page.drawText("WOHIN", {
    x: MARGIN,
    y: cursorY,
    size: 7,
    font: helv,
    color: DARK_GREY,
  });
  cursorY -= 13;
  const routing = opts.isInternal
    ? "→ KB24-LAGER (Sortierfach Retouren)"
    : `→ ${opts.partnerName}`;
  page.drawText(routing, {
    x: MARGIN,
    y: cursorY,
    size: 11,
    font: helvBold,
    color: NAVY,
    maxWidth: A6_W - 2 * MARGIN,
  });

  // ── 5. Schliessen-Bis (prominenter orange Box) ──────────────────
  // Nach User-Brief: "Palette muss geschlossen werden am: XX.XX.XXXX".
  // Wir geben das einen orangen Box-Hintergrund damit's sofort ins
  // Auge fällt — das ist die SLA-Deadline für den Lager-Mitarbeiter.
  cursorY -= 14;
  const deadlineBoxH = 22 * MM;
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
    x: MARGIN + 8,
    y: deadlineBoxTop - 10,
    size: 8,
    font: helvBold,
    color: rgb(1, 1, 1),
  });
  const deadlineText = fmtDate(opts.maxOpenUntil);
  page.drawText(deadlineText, {
    x: MARGIN + 8,
    y: deadlineBoxTop - 28,
    size: 22,
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
