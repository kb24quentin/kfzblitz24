import { NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import bwipjs from "bwip-js";
import { addBelegBemerkung, getWebiscoConfig } from "@/lib/webisco";
import { createRetoureLabel, type RetoureLabelResult } from "@/lib/dodajpaczke";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────
type Address = {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  email?: string;
  telefon?: string;
  handy?: string;
};

type Item = {
  artikelnummer?: string;
  hersteller?: string;
  beschreibung?: string;
  menge: number;
  grund: string;
  einzelpreis_brutto?: number;
  gesamtpreis_brutto?: number;
  /** Stückgewicht in Gramm, kommt aus Webisco-Position. */
  einzelgewicht_g?: number;
};

type Body = {
  bestellnummer?: string;
  belegnummer?: string;
  belegid?: number;
  belegdatum?: string;
  rechnungsadresse?: Address;
  items: Item[];
  shippingMode: "standard" | "sicher" | "unknown";
  requestDHLLabel?: boolean;
  requestPaidLabel?: boolean;
  labelFeeNet?: number;
  labelFeeBrutto?: number;
};

function shouldGenerateLabel(body: Body): boolean {
  if (body.shippingMode === "sicher" && body.requestDHLLabel) return true;
  if (body.shippingMode !== "sicher" && body.requestPaidLabel) return true;
  return false;
}

type LabelInfo =
  | { mode: "none" }
  | { mode: "free"; trackingNumber?: string; shipmentId?: number }
  | {
      mode: "paid";
      trackingNumber?: string;
      shipmentId?: number;
      feeNet: number;
      feeBrutto: number;
    }
  | { mode: "failed"; reason: string };

// ─────────────────────────────────────────────────────────────────────────
// Bemerkung text — unchanged business logic
// ─────────────────────────────────────────────────────────────────────────
function buildBemerkungText(body: Body, label: LabelInfo): string {
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${pad(ts.getDate())}.${pad(ts.getMonth() + 1)}.${ts.getFullYear()} ${pad(ts.getHours())}:${pad(ts.getMinutes())}`;
  const addr = body.rechnungsadresse;
  const fullName = addr ? [addr.vorname, addr.name].filter(Boolean).join(" ") : "";
  const lines: string[] = [];
  lines.push(`RETOURE ANGEMELDET AM: ${stamp}`);
  lines.push(`Bestellnummer: ${body.bestellnummer ?? "-"}`);
  if (body.belegdatum) lines.push(`Bestelldatum: ${body.belegdatum}`);
  lines.push("");
  if (fullName || addr?.email) {
    lines.push("KUNDE:");
    if (fullName) lines.push(`  ${fullName}`);
    if (addr?.strasse) lines.push(`  ${addr.strasse}`);
    if (addr?.plz || addr?.ort) lines.push(`  ${[addr?.plz, addr?.ort].filter(Boolean).join(" ")}`);
    if (addr?.email) lines.push(`  ${addr.email}`);
    if (addr?.telefon) lines.push(`  Tel: ${addr.telefon}`);
    lines.push("");
  }
  lines.push("ANGEMELDETE ARTIKEL:");
  let total = 0;
  for (const it of body.items) {
    const parts = [
      `  ${it.menge}x  ${it.artikelnummer ?? "-"}`,
      it.beschreibung ? `     ${it.beschreibung}` : null,
      it.hersteller ? `     Hersteller: ${it.hersteller}` : null,
      `     Grund: ${it.grund}`,
      it.gesamtpreis_brutto !== undefined
        ? `     Erstattung: ${it.gesamtpreis_brutto.toFixed(2).replace(".", ",")} EUR`
        : null,
    ].filter(Boolean) as string[];
    lines.push(...parts);
    if (it.gesamtpreis_brutto) total += it.gesamtpreis_brutto;
  }
  if (total > 0) {
    const deduction = label.mode === "paid" ? label.feeBrutto : 0;
    const erstattung = Math.max(0, total - deduction);
    lines.push("");
    lines.push(`WARENWERT: ${total.toFixed(2).replace(".", ",")} EUR`);
    if (deduction > 0) {
      lines.push(`ABZUG DHL-LABEL: -${deduction.toFixed(2).replace(".", ",")} EUR`);
    }
    lines.push(`VORAUSSICHTLICHE ERSTATTUNG: ${erstattung.toFixed(2).replace(".", ",")} EUR`);
  }
  lines.push("");
  if (body.shippingMode === "sicher") {
    lines.push("VERSAND: Sichere Rückgabe");
    if (label.mode === "free") {
      lines.push(
        `  DHL-Retourenlabel über uns erzeugt (kostenfrei).${label.trackingNumber ? ` Tracking: ${label.trackingNumber}` : ""}`
      );
    } else if (body.requestDHLLabel) {
      lines.push("  DHL-Label vom Kunden angefordert.");
    }
  } else {
    lines.push("VERSAND: Standard");
    if (label.mode === "paid") {
      lines.push(
        `  DHL-Retourenlabel über uns erzeugt (kostenpflichtig: ${label.feeNet.toFixed(2).replace(".", ",")} EUR netto / ${label.feeBrutto.toFixed(2).replace(".", ",")} EUR brutto).${label.trackingNumber ? ` Tracking: ${label.trackingNumber}` : ""}`
      );
    } else {
      lines.push("  Kunde trägt Rücksendekosten selbst.");
    }
  }
  if (label.mode === "failed") {
    lines.push(`  ⚠ Label-Erzeugung fehlgeschlagen: ${label.reason}`);
  }
  lines.push("");
  lines.push("Eingegangen über: retoure.kfzblitz24-group.com");
  return lines.join("\n");
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
// Brand tokens — direct from kfzBlitz24-Formular-Designguide.md
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
const LEFT_BAR_ORANGE_TOP = 170; // height of orange overlay on the brand bar

const FORM_ID = "RET-KB24";
const FORM_REV = "05/2026";
const FORM_VER = "v1.0";

// ─────────────────────────────────────────────────────────────────────────
// Brand chrome helpers
// ─────────────────────────────────────────────────────────────────────────
function drawBrandBar(page: PDFPage) {
  // Navy full-height
  page.drawRectangle({ x: 0, y: 0, width: LEFT_BAR_W, height: PAGE_H, color: NAVY });
  // Orange overlay on top 170pt
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
    { x: PAGE_LEFT, y: 36, size: 7.5, font, color: MID_GREY }
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
  // 56 × 3 pt orange accent under the title
  page.drawRectangle({
    x: PAGE_LEFT,
    y: y - 11,
    width: 56,
    height: 3,
    color: ORANGE,
  });
}

function drawSectionHeading(
  page: PDFPage,
  fontBold: PDFFont,
  text: string,
  y: number,
  size = 11.5,
  x: number = PAGE_LEFT
) {
  page.drawText(text, { x, y, size, font: fontBold, color: NAVY });
}

function drawBullet(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  text: string,
  y: number,
  size = 9.2
) {
  // › marker in orange
  page.drawText("›", { x: PAGE_LEFT, y, size, font: fontBold, color: ORANGE });
  page.drawText(text, { x: PAGE_LEFT + 12, y, size, font, color: DARK_GREY });
}

// ─────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  if (!body.bestellnummer) {
    return new NextResponse("bestellnummer missing", { status: 400 });
  }
  if (!body.items || body.items.length === 0) {
    return new NextResponse("no items", { status: 400 });
  }

  // ─── Barcode ───
  let barcodePng: Uint8Array;
  try {
    barcodePng = await generateBarcodePng(body.bestellnummer);
  } catch (e) {
    return new NextResponse(
      `barcode error: ${e instanceof Error ? e.message : e}`,
      { status: 500 }
    );
  }

  // ─── PDF setup ───
  const pdf = await PDFDocument.create();
  pdf.setTitle("Retourenschein – kfzBlitz24");
  pdf.setAuthor("kfzBlitz24");
  pdf.setSubject("Retoure / Rücksendung");
  pdf.setCreator("kfzBlitz24");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ─── Page 1: Retourenschein ─────────────────────────────────────────
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  drawPageChrome(page, font, fontBold);
  drawTitle(page, fontBold, "Retourenschein", PAGE_H - 95);

  // Barcode — direkt unter dem Logo rechts, mit ein wenig Abstand zum Titel
  const barcodeImage = await pdf.embedPng(barcodePng);
  const barcodeDims = barcodeImage.scale(0.4);
  page.drawImage(barcodeImage, {
    x: PAGE_RIGHT - barcodeDims.width,
    y: PAGE_H - 140,
    width: barcodeDims.width,
    height: barcodeDims.height,
  });

  // ─── Bestellung + Rechnungsadresse (2 Spalten) ───
  let y = PAGE_H - 180;
  const colSplit = PAGE_W / 2 + 10;

  drawSectionHeading(page, fontBold, "Bestellung", y);
  let leftY = y - 18;
  page.drawText(body.bestellnummer, {
    x: PAGE_LEFT,
    y: leftY,
    size: 16,
    font: fontBold,
    color: NAVY,
  });
  if (body.belegdatum) {
    leftY -= 14;
    page.drawText(`Bestellt am ${body.belegdatum}`, {
      x: PAGE_LEFT,
      y: leftY,
      size: 8,
      font,
      color: MID_GREY,
    });
  }

  const addr = body.rechnungsadresse;
  if (addr) {
    const fullName = [addr.vorname, addr.name].filter(Boolean).join(" ");
    drawSectionHeading(page, fontBold, "Rechnungsadresse", y, 11.5, colSplit);
    let cy = y - 18;
    if (addr.anrede) {
      page.drawText(addr.anrede, {
        x: colSplit,
        y: cy,
        size: 9.2,
        font,
        color: MID_GREY,
      });
      cy -= 12;
    }
    if (fullName) {
      page.drawText(fullName, {
        x: colSplit,
        y: cy,
        size: 10,
        font: fontBold,
        color: NAVY,
      });
      cy -= 13;
    }
    if (addr.strasse) {
      page.drawText(addr.strasse, {
        x: colSplit,
        y: cy,
        size: 9.2,
        font,
        color: DARK_GREY,
      });
      cy -= 12;
    }
    if (addr.plz || addr.ort) {
      page.drawText([addr.plz, addr.ort].filter(Boolean).join(" "), {
        x: colSplit,
        y: cy,
        size: 9.2,
        font,
        color: DARK_GREY,
      });
      cy -= 12;
    }
    if (addr.email) {
      page.drawText(addr.email, {
        x: colSplit,
        y: cy,
        size: 8,
        font,
        color: MID_GREY,
      });
    }
  }

  // ─── Artikel-Tabelle ───
  y -= 100;
  drawSectionHeading(page, fontBold, "Zurückzusendende Artikel", y);
  y -= 22;

  const col = {
    menge: PAGE_LEFT,
    artikel: PAGE_LEFT + 40,
    grund: PAGE_LEFT + 260,
    summe: PAGE_RIGHT - 60,
  };

  // Tabellen-Header (Navy mit weißem Text)
  page.drawRectangle({
    x: PAGE_LEFT - 4,
    y: y - 4,
    width: PAGE_RIGHT - PAGE_LEFT + 4,
    height: 18,
    color: NAVY,
  });
  page.drawText("Menge", {
    x: col.menge,
    y,
    size: 8.5,
    font: fontBold,
    color: WHITE,
  });
  page.drawText("Artikel", {
    x: col.artikel,
    y,
    size: 8.5,
    font: fontBold,
    color: WHITE,
  });
  page.drawText("Grund", {
    x: col.grund,
    y,
    size: 8.5,
    font: fontBold,
    color: WHITE,
  });
  page.drawText("Summe", {
    x: col.summe,
    y,
    size: 8.5,
    font: fontBold,
    color: WHITE,
  });
  y -= 22;

  const fmtEur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
  let erstattungTotal = 0;

  for (const it of body.items) {
    if (y < 210) {
      page.drawText("... (weitere Artikel abgeschnitten)", {
        x: PAGE_LEFT,
        y,
        size: 9,
        font,
        color: rgb(0.6, 0.2, 0.2),
      });
      break;
    }
    page.drawText(`${it.menge}x`, {
      x: col.menge,
      y,
      size: 10,
      font: fontBold,
      color: NAVY,
    });
    const descLine = it.beschreibung ?? "";
    const metaLine = [it.artikelnummer, it.hersteller].filter(Boolean).join(" · ");
    page.drawText(descLine.slice(0, 38), {
      x: col.artikel,
      y,
      size: 9.2,
      font,
      color: DARK_GREY,
    });
    if (metaLine) {
      page.drawText(metaLine.slice(0, 44), {
        x: col.artikel,
        y: y - 11,
        size: 7.5,
        font,
        color: MID_GREY,
      });
    }
    page.drawText(it.grund.slice(0, 28), {
      x: col.grund,
      y,
      size: 9.2,
      font,
      color: DARK_GREY,
    });
    if (it.gesamtpreis_brutto !== undefined) {
      page.drawText(fmtEur(it.gesamtpreis_brutto), {
        x: col.summe,
        y,
        size: 10,
        font: fontBold,
        color: NAVY,
      });
      if (it.einzelpreis_brutto !== undefined && it.menge > 1) {
        page.drawText(`${fmtEur(it.einzelpreis_brutto)} / Stk`, {
          x: col.summe,
          y: y - 11,
          size: 7.5,
          font,
          color: MID_GREY,
        });
      }
      erstattungTotal += it.gesamtpreis_brutto;
    }
    page.drawLine({
      start: { x: PAGE_LEFT - 4, y: y - 16 },
      end: { x: PAGE_RIGHT, y: y - 16 },
      thickness: 0.4,
      color: LIGHT_GREY,
    });
    y -= 28;
  }

  // Erstattungs-Block: Warenwert → (optional) Abzug Label → Erstattung
  const willChargeLabel =
    body.shippingMode !== "sicher" && body.requestPaidLabel === true;
  // Brutto explizit aus Netto * 1,19 rechnen damit kein Rundungs-Edge-Case
  // entsteht (4.50 * 1.19 = 5.355 — IEEE → 5.354... — toFixed(2) gibt "5.35"
  // statt "5.36"). Plus 0.005 schiebt es eindeutig in die richtige Richtung.
  const labelNetExact = willChargeLabel ? body.labelFeeNet ?? 4.5 : 0;
  const labelDeductionBrutto = willChargeLabel
    ? body.labelFeeBrutto ?? Math.round(labelNetExact * 1.19 * 100 + 1e-6) / 100
    : 0;
  const labelDeductionNet = labelNetExact;
  const erstattungFinal = Math.max(0, erstattungTotal - labelDeductionBrutto);

  if (erstattungTotal > 0) {
    // mehr Abstand zur Tabelle für sauberere Optik
    y -= 12;

    // Warenwert
    page.drawText("Warenwert", {
      x: col.grund,
      y,
      size: 9.5,
      font,
      color: DARK_GREY,
    });
    page.drawText(fmtEur(erstattungTotal), {
      x: col.summe,
      y,
      size: 10,
      font,
      color: DARK_GREY,
    });
    y -= 16;

    // Abzug Label (nur wenn anwendbar)
    if (labelDeductionBrutto > 0) {
      page.drawText(
        `DHL-Label-Kosten (${labelDeductionNet.toFixed(2).replace(".", ",")} € netto)`,
        { x: col.grund, y, size: 9.5, font, color: DARK_GREY }
      );
      page.drawText(`– ${fmtEur(labelDeductionBrutto)}`, {
        x: col.summe,
        y,
        size: 10,
        font,
        color: rgb(0.55, 0.15, 0.15),
      });
      y -= 16;
    }

    // Highlight-Zeile: Voraussichtliche Erstattung — klar getrennt
    y -= 6;
    page.drawRectangle({
      x: PAGE_LEFT - 4,
      y: y - 8,
      width: PAGE_RIGHT - PAGE_LEFT + 4,
      height: 26,
      color: LIGHT_GREY,
    });
    page.drawText("Voraussichtliche Erstattung", {
      x: col.grund,
      y: y + 1,
      size: 11,
      font: fontBold,
      color: NAVY,
    });
    page.drawText(fmtEur(erstattungFinal), {
      x: col.summe,
      y: y + 1,
      size: 12,
      font: fontBold,
      color: NAVY,
    });
    y -= 28;
  }

  // Refund-Hinweis als Aufzählungszeile
  y -= 16;
  drawBullet(
    page,
    font,
    fontBold,
    "Die Erstattung erfolgt auf das ursprüngliche Zahlungsmittel — in der Regel",
    y
  );
  y -= 12;
  page.drawText("innerhalb von 5 Werktagen nach Eingang und Prüfung der Ware.", {
    x: PAGE_LEFT + 12,
    y,
    size: 9.2,
    font,
    color: DARK_GREY,
  });

  // ─── Versand-Block ───
  y -= 30;
  if (body.shippingMode === "sicher") {
    drawSectionHeading(page, fontBold, "Sichere Rückgabe", y);
    y -= 18;
    page.drawText(
      body.requestDHLLabel
        ? "Du hast die Sichere Rückgabe gewählt — das DHL-Retourenlabel liegt auf der nächsten Seite."
        : "Du hast die Sichere Rückgabe gewählt. Bei Bedarf kannst du ein DHL-Label nachfordern.",
      { x: PAGE_LEFT, y, size: 9.2, font, color: DARK_GREY }
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
    page.drawText("kfzBlitz24 GmbH", {
      x: PAGE_LEFT,
      y,
      size: 10.5,
      font: fontBold,
      color: NAVY,
    });
    y -= 13;
    page.drawText("c/o RETOURE", {
      x: PAGE_LEFT,
      y,
      size: 9.2,
      font,
      color: DARK_GREY,
    });
    y -= 12;
    page.drawText("Musterstraße 1", {
      x: PAGE_LEFT,
      y,
      size: 9.2,
      font,
      color: DARK_GREY,
    });
    y -= 12;
    page.drawText("12345 Musterstadt", {
      x: PAGE_LEFT,
      y,
      size: 9.2,
      font,
      color: DARK_GREY,
    });
    y -= 22;
    drawBullet(page, font, fontBold, "Bitte frankiere die Sendung ausreichend.", y);
    y -= 12;
    drawBullet(
      page,
      font,
      fontBold,
      "Unfrei gesendete Pakete können leider nicht angenommen werden.",
      y
    );
  }

  // ─── Page 2: DHL-Label-Wrapper (wenn Label angefordert) ─────────────
  let labelInfo: LabelInfo = { mode: "none" };
  if (shouldGenerateLabel(body)) {
    let labelResult: RetoureLabelResult;
    // Gesamtgewicht aus Webisco-Positionen (einzelgewicht in Gramm)
    // × angemeldete Menge, summiert über alle ausgewählten Artikel.
    const rawWeightKg = body.items.reduce((sum, it) => {
      const g = (it.einzelgewicht_g ?? 0) * it.menge;
      return sum + g / 1000;
    }, 0);
    // Wenn Webisco kein Gewicht hatte (z.B. Streckengeschäft ohne hinterlegtes
    // Gewicht): konservativ 30 kg annehmen — lieber zu viel als DHL-Nachporto.
    // Sonst: gemessenes Gewicht + 20% Verpackungs-Puffer, Hardcap 30 kg,
    // Mindestens 0,5 kg (DHL-Minimum).
    const weightInKg =
      rawWeightKg > 0
        ? Math.max(0.5, Math.min(30, rawWeightKg * 1.2))
        : 30;
    try {
      labelResult = await createRetoureLabel({
        customerReference: body.bestellnummer,
        description: `Retoure ${body.bestellnummer}`,
        weightInKg,
        customer: addr
          ? {
              salutation: addr.anrede,
              firstname: addr.vorname,
              lastname: addr.name,
              streetName: addr.strasse,
              zipNumber: addr.plz,
              city: addr.ort,
              email: addr.email,
              phone: addr.telefon,
              mobile: addr.handy,
              countryISOCode: "DE",
            }
          : undefined,
      });
    } catch (e) {
      labelResult = {
        ok: false,
        error: `dodajpaczke threw: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    if (labelResult.ok) {
      try {
        const labelPdf = await PDFDocument.load(new Uint8Array(labelResult.pdfBuffer));
        const embeddedLabelPages = await pdf.embedPdf(
          labelPdf,
          labelPdf.getPageIndices()
        );

        for (const lp of embeddedLabelPages) {
          const lpage = pdf.addPage([PAGE_W, PAGE_H]);
          drawPageChrome(lpage, font, fontBold);
          drawTitle(lpage, fontBold, "DHL-Retourenlabel", PAGE_H - 95);

          // Anleitung
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
            { x: PAGE_LEFT, y: ly, size: 9.2, font, color: MID_GREY }
          );
          ly -= 11;
          lpage.drawText("5 Werktagen auf das ursprüngliche Zahlungsmittel.", {
            x: PAGE_LEFT,
            y: ly,
            size: 9.2,
            font,
            color: MID_GREY,
          });

          // Label zentriert
          const lw = lp.width;
          const lh = lp.height;
          const availTop = ly - 30;
          const availBottom = 90;
          const avail = availTop - availBottom;
          const lx = (PAGE_W - lw) / 2;
          const lyPos = availBottom + (avail - lh) / 2;

          // Gestrichelter Schneide-Rahmen
          const pad = 8;
          lpage.drawRectangle({
            x: lx - pad,
            y: lyPos - pad,
            width: lw + 2 * pad,
            height: lh + 2 * pad,
            borderColor: MID_GREY,
            borderWidth: 0.5,
            borderDashArray: [4, 3],
          });
          lpage.drawText("Hier ausschneiden", {
            x: lx - pad,
            y: lyPos + lh + pad + 4,
            size: 7.5,
            font,
            color: MID_GREY,
          });

          // Das eigentliche Label
          lpage.drawPage(lp, { x: lx, y: lyPos, width: lw, height: lh });

          // Tracking-Info
          lpage.drawText(
            `Tracking: ${labelResult.trackingNumber ?? "—"}   ·   Bestellnr.: ${body.bestellnummer}`,
            { x: PAGE_LEFT, y: 70, size: 8, font, color: MID_GREY }
          );
        }

        labelInfo =
          body.shippingMode === "sicher"
            ? {
                mode: "free",
                trackingNumber: labelResult.trackingNumber,
                shipmentId: labelResult.shipmentId,
              }
            : {
                mode: "paid",
                trackingNumber: labelResult.trackingNumber,
                shipmentId: labelResult.shipmentId,
                feeNet: body.labelFeeNet ?? 4.5,
                feeBrutto: body.labelFeeBrutto ?? 5.36,
              };
        console.log(
          `[retoure] DHL label merged (shipment=${labelResult.shipmentId}, tracking=${labelResult.trackingNumber ?? "—"})`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : "";
        labelInfo = {
          mode: "failed",
          reason: `Label-PDF konnte nicht gemerged werden: ${msg}`,
        };
        console.warn(`[retoure] label merge failed: ${msg}`);
        if (stack) console.warn(stack.split("\n").slice(0, 5).join("\n"));
      }
    } else if ("skipped" in labelResult && labelResult.skipped) {
      labelInfo = { mode: "failed", reason: `dodajpaczke skipped: ${labelResult.reason}` };
      console.warn(`[retoure] label generation skipped: ${labelResult.reason}`);
    } else {
      labelInfo = { mode: "failed", reason: labelResult.error };
      console.warn(`[retoure] label generation error: ${labelResult.error}`);
    }
  }

  const bytes = await pdf.save();

  // ─── Bemerkung an Abisco (best-effort) ───
  const cfg = getWebiscoConfig();
  const belegId = body.belegid ?? body.belegnummer;
  if (cfg && belegId) {
    const text = buildBemerkungText(body, labelInfo);
    const res = await addBelegBemerkung(cfg, { typ: "auftrag", id: belegId, text });
    if (res.ok) {
      console.log(`[retoure] Bemerkung written to Abisco beleg ${belegId}`);
    } else {
      console.warn(`[retoure] Bemerkung failed for beleg ${belegId}: ${res.error}`);
    }
  }

  return new NextResponse(bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="retourenschein-${body.bestellnummer}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
