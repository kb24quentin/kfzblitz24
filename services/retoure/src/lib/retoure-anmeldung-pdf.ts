/**
 * Retoure-Anmeldungs-PDF — pure builder function.
 *
 * Generiert das KOMPLETTE Customer-PDF (Seite 1: Retourenschein, Seite 2:
 * DHL-Label embedded). Identisches Layout wie /api/pdf (Customer-Portal-
 * Submit) — wird von Shop-Native-Flow + zukünftigem RMA-Reprint-Button
 * benutzt.
 *
 * Pure function: keine DB-Writes, keine Side-Effects ausser PDF-Bytes
 * zurückgeben. Caller ist responsible fürs Laden der Case-Daten, optional
 * dodajpaczke-Label-Fetch + danach Caching/Response.
 *
 * Layout-Spec: /Users/quentinleopold/Desktop/GewährleistungsantragKB24/
 *              kfzBlitz24-Formular-Designguide.md
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import bwipjs from "bwip-js";

// ─────────────────────────────────────────────────────────────────────────
// Public Input/Output Types
// ─────────────────────────────────────────────────────────────────────────

export interface RetoureAnmeldungPdfInput {
  bestellnummer: string;
  belegnummer?: string | null;
  belegdatum?: string | null;
  rechnungsadresse?: {
    anrede?: string | null;
    vorname?: string | null;
    name?: string | null;
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
    email?: string | null;
    telefon?: string | null;
  };
  items: Array<{
    artikelnummer?: string | null;
    hersteller?: string | null;
    beschreibung?: string | null;
    menge: number;
    grund: string;
    einzelpreis_brutto?: number | null;
    gesamtpreis_brutto?: number | null;
  }>;
  /**
   * Service-Mode für Versand-Block-Text.
   * - "sicher"   → Sichere Rückgabe / Rückgabe+
   * - "standard" → Customer trägt selbst oder zahlt Label-Fee
   */
  shippingMode: "sicher" | "standard";
  /**
   * Pre-Generierte DHL-Label-PDF-Bytes (von dodajpaczke). Wenn `null`/
   * `undefined`, wird KEINE zweite Seite generiert (Customer versendet selbst).
   */
  labelPdfBytes?: Uint8Array | null;
  /** Tracking-Nummer für die Label-Seite (nur bei labelPdfBytes ≠ null). */
  labelTrackingNumber?: string | null;
  /** Label-Fee brutto (für Refund-Berechnung im Total-Block). Default 0. */
  labelFeeBrutto?: number | null;
  /** Label-Fee netto (für Anzeige im Total-Block). Default 0. */
  labelFeeNet?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Brand tokens — aus kfzBlitz24-Formular-Designguide.md
// ─────────────────────────────────────────────────────────────────────────
const NAVY = rgb(0x0b / 255, 0x37 / 255, 0x56 / 255);
const ORANGE = rgb(0xff / 255, 0x66 / 255, 0x00 / 255);
const LIGHT_GREY = rgb(0xe6 / 255, 0xe8 / 255, 0xeb / 255);
const MID_GREY = rgb(0x8a / 255, 0x93 / 255, 0xa0 / 255);
const DARK_GREY = rgb(0x3d / 255, 0x46 / 255, 0x54 / 255);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.27;
const PAGE_H = 841.89;
const PAGE_LEFT = 56;
const PAGE_RIGHT = PAGE_W - 40;
const LEFT_BAR_W = 14;
const LEFT_BAR_ORANGE_TOP = 170;

const FORM_ID = "RET-KB24";
const FORM_REV = "05/2026";
const FORM_VER = "v1.0";

// ─────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────

function drawBrandBar(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: LEFT_BAR_W, height: PAGE_H, color: NAVY });
  page.drawRectangle({
    x: 0,
    y: PAGE_H - LEFT_BAR_ORANGE_TOP,
    width: LEFT_BAR_W,
    height: LEFT_BAR_ORANGE_TOP,
    color: ORANGE,
  });
}

function drawLogo(page: PDFPage, fontBold: PDFFont, scale = 1.45) {
  const baseSize = 26;
  const size = baseSize * scale;
  const x = PAGE_W - 220;
  const y = PAGE_H - 70;
  const wKfz = fontBold.widthOfTextAtSize("kfz", size);
  const wBlitz = fontBold.widthOfTextAtSize("blitz", size);
  page.drawText("kfz", { x, y, size, font: fontBold, color: NAVY });
  page.drawText("blitz", { x: x + wKfz, y, size, font: fontBold, color: ORANGE });
  page.drawText("24", { x: x + wKfz + wBlitz, y, size, font: fontBold, color: NAVY });
}

function drawVersionCode(page: PDFPage, font: PDFFont) {
  page.drawText(`${FORM_ID} · Rev. ${FORM_REV} · ${FORM_VER}`, {
    x: PAGE_W - 18,
    y: 60,
    size: 6.5,
    font,
    color: MID_GREY,
    rotate: degrees(90),
  });
}

function drawFooter(page: PDFPage, font: PDFFont) {
  page.drawText(
    "kfzBlitz24 · Retourenabteilung · Bei Fragen erreichst du uns unter service@kfzblitz24.de",
    { x: PAGE_LEFT, y: 36, size: 7.5, font, color: MID_GREY },
  );
  page.drawText(`Erstellt am ${new Date().toLocaleString("de-DE")}`, {
    x: PAGE_LEFT,
    y: 24,
    size: 7,
    font,
    color: MID_GREY,
  });
}

function drawPageChrome(page: PDFPage, font: PDFFont, fontBold: PDFFont) {
  drawBrandBar(page);
  drawLogo(page, fontBold);
  drawVersionCode(page, font);
  drawFooter(page, font);
}

function drawTitle(page: PDFPage, fontBold: PDFFont, title: string, y: number) {
  page.drawText(title, { x: PAGE_LEFT, y, size: 30, font: fontBold, color: NAVY });
  page.drawRectangle({ x: PAGE_LEFT, y: y - 11, width: 56, height: 3, color: ORANGE });
}

function drawSectionHeading(
  page: PDFPage,
  fontBold: PDFFont,
  text: string,
  y: number,
  size = 11.5,
  x: number = PAGE_LEFT,
) {
  page.drawText(text, { x, y, size, font: fontBold, color: NAVY });
}

function drawBullet(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  text: string,
  y: number,
  size = 9.2,
) {
  page.drawText("›", { x: PAGE_LEFT, y, size, font: fontBold, color: ORANGE });
  page.drawText(text, { x: PAGE_LEFT + 12, y, size, font, color: DARK_GREY });
}

async function generateBarcodePng(data: string): Promise<Uint8Array> {
  return await bwipjs.toBuffer({
    bcid: "code128",
    text: data,
    scale: 3,
    height: 14,
    includetext: true,
    textxalign: "center",
    textsize: 10,
    backgroundcolor: "FFFFFF",
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export async function buildRetoureAnmeldungPdf(
  input: RetoureAnmeldungPdfInput,
): Promise<Uint8Array> {
  const barcodePng = await generateBarcodePng(input.bestellnummer);

  const pdf = await PDFDocument.create();
  pdf.setTitle("Retourenschein – kfzBlitz24");
  pdf.setAuthor("kfzBlitz24");
  pdf.setSubject("Retoure / Rücksendung");
  pdf.setCreator("kfzBlitz24");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ── Seite 1: Retourenschein ─────────────────────────────────────────
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  drawPageChrome(page, font, fontBold);
  drawTitle(page, fontBold, "Retourenschein", PAGE_H - 95);

  // Barcode rechts oben
  const barcodeImage = await pdf.embedPng(barcodePng);
  const barcodeDims = barcodeImage.scale(0.4);
  page.drawImage(barcodeImage, {
    x: PAGE_RIGHT - barcodeDims.width,
    y: PAGE_H - 140,
    width: barcodeDims.width,
    height: barcodeDims.height,
  });

  // Bestellung + Rechnungsadresse (2 Spalten)
  let y = PAGE_H - 180;
  const colSplit = PAGE_W / 2 + 10;

  drawSectionHeading(page, fontBold, "Bestellung", y);
  let leftY = y - 18;
  page.drawText(input.bestellnummer, {
    x: PAGE_LEFT,
    y: leftY,
    size: 16,
    font: fontBold,
    color: NAVY,
  });
  if (input.belegdatum) {
    leftY -= 14;
    page.drawText(`Bestellt am ${input.belegdatum}`, {
      x: PAGE_LEFT,
      y: leftY,
      size: 8,
      font,
      color: MID_GREY,
    });
  }

  const addr = input.rechnungsadresse;
  if (addr) {
    const fullName = [addr.vorname, addr.name].filter(Boolean).join(" ");
    drawSectionHeading(page, fontBold, "Rechnungsadresse", y, 11.5, colSplit);
    let cy = y - 18;
    if (addr.anrede) {
      page.drawText(addr.anrede, { x: colSplit, y: cy, size: 9.2, font, color: MID_GREY });
      cy -= 12;
    }
    if (fullName) {
      page.drawText(fullName, { x: colSplit, y: cy, size: 10, font: fontBold, color: NAVY });
      cy -= 13;
    }
    if (addr.strasse) {
      page.drawText(addr.strasse, { x: colSplit, y: cy, size: 9.2, font, color: DARK_GREY });
      cy -= 12;
    }
    if (addr.plz || addr.ort) {
      page.drawText([addr.plz, addr.ort].filter(Boolean).join(" "), {
        x: colSplit, y: cy, size: 9.2, font, color: DARK_GREY,
      });
      cy -= 12;
    }
    if (addr.email) {
      page.drawText(addr.email, { x: colSplit, y: cy, size: 8, font, color: MID_GREY });
    }
  }

  // Artikel-Tabelle
  y -= 100;
  drawSectionHeading(page, fontBold, "Zurückzusendende Artikel", y);
  y -= 22;
  const col = {
    menge: PAGE_LEFT,
    artikel: PAGE_LEFT + 40,
    grund: PAGE_LEFT + 260,
    summe: PAGE_RIGHT - 60,
  };

  page.drawRectangle({
    x: PAGE_LEFT - 4, y: y - 4, width: PAGE_RIGHT - PAGE_LEFT + 4, height: 18, color: NAVY,
  });
  page.drawText("Menge", { x: col.menge, y, size: 8.5, font: fontBold, color: WHITE });
  page.drawText("Artikel", { x: col.artikel, y, size: 8.5, font: fontBold, color: WHITE });
  page.drawText("Grund", { x: col.grund, y, size: 8.5, font: fontBold, color: WHITE });
  page.drawText("Summe", { x: col.summe, y, size: 8.5, font: fontBold, color: WHITE });
  y -= 22;

  const fmtEur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
  let erstattungTotal = 0;

  for (const it of input.items) {
    if (y < 210) {
      page.drawText("... (weitere Artikel abgeschnitten)", {
        x: PAGE_LEFT, y, size: 9, font, color: rgb(0.6, 0.2, 0.2),
      });
      break;
    }
    page.drawText(`${it.menge}x`, { x: col.menge, y, size: 10, font: fontBold, color: NAVY });
    const descLine = it.beschreibung ?? "";
    const metaLine = [it.artikelnummer, it.hersteller].filter(Boolean).join(" · ");
    page.drawText(descLine.slice(0, 38), { x: col.artikel, y, size: 9.2, font, color: DARK_GREY });
    if (metaLine) {
      page.drawText(metaLine.slice(0, 44), {
        x: col.artikel, y: y - 11, size: 7.5, font, color: MID_GREY,
      });
    }
    page.drawText((it.grund ?? "").slice(0, 28), {
      x: col.grund, y, size: 9.2, font, color: DARK_GREY,
    });
    if (it.gesamtpreis_brutto != null) {
      page.drawText(fmtEur(it.gesamtpreis_brutto), {
        x: col.summe, y, size: 10, font: fontBold, color: NAVY,
      });
      if (it.einzelpreis_brutto != null && it.menge > 1) {
        page.drawText(`${fmtEur(it.einzelpreis_brutto)} / Stk`, {
          x: col.summe, y: y - 11, size: 7.5, font, color: MID_GREY,
        });
      }
      erstattungTotal += it.gesamtpreis_brutto;
    }
    page.drawLine({
      start: { x: PAGE_LEFT - 4, y: y - 16 },
      end: { x: PAGE_RIGHT, y: y - 16 },
      thickness: 0.4, color: LIGHT_GREY,
    });
    y -= 28;
  }

  // Erstattungs-Block
  const labelFeeBrutto = input.labelFeeBrutto ?? 0;
  const labelFeeNet = input.labelFeeNet ?? 0;
  const willChargeLabel = labelFeeBrutto > 0;
  const erstattungFinal = Math.max(0, erstattungTotal - labelFeeBrutto);

  if (erstattungTotal > 0) {
    y -= 12;
    page.drawText("Warenwert", { x: col.grund, y, size: 9.5, font, color: DARK_GREY });
    page.drawText(fmtEur(erstattungTotal), { x: col.summe, y, size: 10, font, color: DARK_GREY });
    y -= 16;

    if (willChargeLabel) {
      page.drawText(
        `DHL-Label-Kosten (${labelFeeNet.toFixed(2).replace(".", ",")} € netto)`,
        { x: col.grund, y, size: 9.5, font, color: DARK_GREY },
      );
      page.drawText(`– ${fmtEur(labelFeeBrutto)}`, {
        x: col.summe, y, size: 10, font, color: rgb(0.55, 0.15, 0.15),
      });
      y -= 16;
    }

    y -= 6;
    page.drawRectangle({
      x: PAGE_LEFT - 4, y: y - 8, width: PAGE_RIGHT - PAGE_LEFT + 4, height: 26, color: LIGHT_GREY,
    });
    page.drawText("Voraussichtliche Erstattung", {
      x: col.grund, y: y + 1, size: 11, font: fontBold, color: NAVY,
    });
    page.drawText(fmtEur(erstattungFinal), {
      x: col.summe, y: y + 1, size: 12, font: fontBold, color: NAVY,
    });
    y -= 28;
  }

  // Refund-Hinweis
  y -= 16;
  drawBullet(
    page, font, fontBold,
    "Die Erstattung erfolgt auf das ursprüngliche Zahlungsmittel — in der Regel",
    y,
  );
  y -= 12;
  page.drawText("innerhalb von 5 Werktagen nach Eingang und Prüfung der Ware.", {
    x: PAGE_LEFT + 12, y, size: 9.2, font, color: DARK_GREY,
  });

  // Versand-Block
  y -= 30;
  if (input.shippingMode === "sicher") {
    drawSectionHeading(page, fontBold, "Sichere Rückgabe", y);
    y -= 18;
    page.drawText(
      input.labelPdfBytes
        ? "Sichere Rückgabe — DHL-Retourenlabel auf der nächsten Seite."
        : "Sichere Rückgabe. Bei Bedarf kannst du ein DHL-Label nachfordern.",
      { x: PAGE_LEFT, y, size: 9.2, font, color: DARK_GREY },
    );
    y -= 18;
    const steps = [
      "Lege diesen Retourenschein der Sendung bei.",
      "Verwende das DHL-Label zum Versand (siehe nächste Seite).",
      "Bearbeitung dauert bis zu 5 Werktage nach Eingang.",
    ];
    for (const s of steps) {
      drawBullet(page, font, fontBold, s, y);
      y -= 12;
    }
  } else {
    drawSectionHeading(page, fontBold, "Rücksendeadresse", y);
    y -= 18;
    page.drawText("kfzBlitz24 GmbH", { x: PAGE_LEFT, y, size: 10.5, font: fontBold, color: NAVY });
    y -= 13;
    page.drawText("c/o RETOURE", { x: PAGE_LEFT, y, size: 9.2, font, color: DARK_GREY });
    y -= 12;
    page.drawText("Musterstraße 1", { x: PAGE_LEFT, y, size: 9.2, font, color: DARK_GREY });
    y -= 12;
    page.drawText("12345 Musterstadt", { x: PAGE_LEFT, y, size: 9.2, font, color: DARK_GREY });
    y -= 22;
    drawBullet(page, font, fontBold, "Bitte frankiere die Sendung ausreichend.", y);
    y -= 12;
    drawBullet(
      page, font, fontBold,
      "Unfrei gesendete Pakete können leider nicht angenommen werden.", y,
    );
  }

  // ── Seite 2: DHL-Label-Wrapper (wenn Label-PDF mitgegeben) ──────────
  if (input.labelPdfBytes && input.labelPdfBytes.length > 0) {
    try {
      const labelPdf = await PDFDocument.load(input.labelPdfBytes);
      const embeddedLabelPages = await pdf.embedPdf(labelPdf, labelPdf.getPageIndices());

      for (const lp of embeddedLabelPages) {
        const lpage = pdf.addPage([PAGE_W, PAGE_H]);
        drawPageChrome(lpage, font, fontBold);
        drawTitle(lpage, fontBold, "DHL-Retourenlabel", PAGE_H - 95);

        let ly = PAGE_H - 180;
        drawSectionHeading(lpage, fontBold, "Anleitung", ly);
        ly -= 18;
        const steps = [
          "Schneide das DHL-Label entlang der gestrichelten Linie aus.",
          "Klebe es gut sichtbar auf die Außenseite der Sendung.",
          "Lege den Retourenschein (Seite 1) ins Paket.",
          "Übergib das Paket bei einer DHL-Filiale oder Packstation.",
        ];
        for (const s of steps) {
          drawBullet(lpage, font, fontBold, s, ly);
          ly -= 12.2;
        }
        ly -= 8;
        lpage.drawText(
          "Bei Eingang prüfen wir die Ware und veranlassen die Erstattung innerhalb von",
          { x: PAGE_LEFT, y: ly, size: 9.2, font, color: MID_GREY },
        );
        ly -= 11;
        lpage.drawText("5 Werktagen auf das ursprüngliche Zahlungsmittel.", {
          x: PAGE_LEFT, y: ly, size: 9.2, font, color: MID_GREY,
        });

        const lw = lp.width;
        const lh = lp.height;
        const availTop = ly - 30;
        const availBottom = 90;
        const avail = availTop - availBottom;
        const lx = (PAGE_W - lw) / 2;
        const lyPos = availBottom + (avail - lh) / 2;

        const pad = 8;
        lpage.drawRectangle({
          x: lx - pad, y: lyPos - pad, width: lw + 2 * pad, height: lh + 2 * pad,
          borderColor: MID_GREY, borderWidth: 0.5, borderDashArray: [4, 3],
        });
        lpage.drawText("Hier ausschneiden", {
          x: lx - pad, y: lyPos + lh + pad + 4, size: 7.5, font, color: MID_GREY,
        });

        lpage.drawPage(lp, { x: lx, y: lyPos, width: lw, height: lh });

        lpage.drawText(
          `Tracking: ${input.labelTrackingNumber ?? "—"}   ·   Bestellnr.: ${input.bestellnummer}`,
          { x: PAGE_LEFT, y: 70, size: 8, font, color: MID_GREY },
        );
      }
    } catch (e) {
      // Label-Merge ist optional — wenn's failed, geht nur Seite 1 raus.
      console.warn(
        `[retoure-anmeldung-pdf] label merge failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return await pdf.save();
}
