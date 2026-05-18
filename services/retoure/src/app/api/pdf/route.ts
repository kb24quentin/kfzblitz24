import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
};

type Body = {
  bestellnummer?: string;
  belegnummer?: string;
  belegid?: number;
  belegdatum?: string;
  rechnungsadresse?: Address;
  items: Item[];
  shippingMode: "standard" | "sicher" | "unknown";
  /** Sichere Rückgabe: Label kostenfrei anfordern */
  requestDHLLabel?: boolean;
  /** Standard-Versand: Label gegen Gebühr (Abzug von Erstattung) */
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
// Bemerkung text (unchanged business logic)
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
// Brand Design Tokens (matched to Gewährleistungsantrag PDF)
// ─────────────────────────────────────────────────────────────────────────
const COLOR_ORANGE = rgb(232 / 255, 122 / 255, 47 / 255);
const COLOR_NAVY = rgb(26 / 255, 43 / 255, 79 / 255);
const COLOR_TEXT = rgb(0.15, 0.15, 0.15);
const COLOR_MUTED = rgb(0.42, 0.42, 0.42);
const STRIPE_W = 30;
const CONTENT_X = 60;
const PAGE_W = 595.28;
const PAGE_H = 841.89;

/**
 * Draws the kfzBlitz24 brand chrome on a page:
 * - Orange vertical stripe down the left edge
 * - "kfz" navy + "blitz" orange + "24" navy wordmark in the top-right
 */
function drawBrandChrome(
  page: PDFPage,
  fontBold: PDFFont,
  font: PDFFont
): void {
  page.drawRectangle({ x: 0, y: 0, width: STRIPE_W, height: PAGE_H, color: COLOR_ORANGE });
  const size = 22;
  const wKfz = fontBold.widthOfTextAtSize("kfz", size);
  const wBlitz = fontBold.widthOfTextAtSize("blitz", size);
  const w24 = fontBold.widthOfTextAtSize("24", size);
  const total = wKfz + wBlitz + w24;
  const x = PAGE_W - 40 - total;
  const y = PAGE_H - 55;
  page.drawText("kfz", { x, y, size, font: fontBold, color: COLOR_NAVY });
  page.drawText("blitz", { x: x + wKfz, y, size, font: fontBold, color: COLOR_ORANGE });
  page.drawText("24", { x: x + wKfz + wBlitz, y, size, font: fontBold, color: COLOR_NAVY });
  // (font param accepted but unused — kept for symmetry / future use)
  void font;
}

function drawFooter(page: PDFPage, font: PDFFont): void {
  page.drawLine({
    start: { x: CONTENT_X, y: 50 },
    end: { x: PAGE_W - 40, y: 50 },
    thickness: 0.3,
    color: rgb(0.85, 0.85, 0.85),
  });
  page.drawText(
    "kfzBlitz24 · Retourenabteilung · Bei Fragen erreichst du uns unter service@kfzblitz24.de",
    { x: CONTENT_X, y: 35, size: 8, font, color: COLOR_MUTED }
  );
  page.drawText(`Erstellt am ${new Date().toLocaleString("de-DE")}`, {
    x: CONTENT_X,
    y: 22,
    size: 7,
    font,
    color: rgb(0.65, 0.65, 0.65),
  });
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

  // ─── Barcode generieren ───
  let barcodePng: Uint8Array;
  try {
    barcodePng = await generateBarcodePng(body.bestellnummer);
  } catch (e) {
    return new NextResponse(
      `barcode error: ${e instanceof Error ? e.message : e}`,
      { status: 500 }
    );
  }

  // ─── PDF aufsetzen ───
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ─── Page 1: Retourenschein ─────────────────────────────────────────
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const margin = CONTENT_X;
  drawBrandChrome(page, fontBold, font);

  // Großer Titel + Orange-Underline
  let y = PAGE_H - 120;
  page.drawText("Retourenschein", {
    x: margin,
    y,
    size: 34,
    font: fontBold,
    color: COLOR_NAVY,
  });
  page.drawRectangle({ x: margin, y: y - 8, width: 80, height: 2, color: COLOR_ORANGE });

  // Barcode rechts (unterhalb der Wordmark)
  const barcodeImage = await pdf.embedPng(barcodePng);
  const barcodeDims = barcodeImage.scale(0.45);
  page.drawImage(barcodeImage, {
    x: PAGE_W - 40 - barcodeDims.width,
    y: PAGE_H - 130,
    width: barcodeDims.width,
    height: barcodeDims.height,
  });

  // Section-Heading Helper
  const sectionHeading = (text: string, atY: number, size = 13) => {
    page.drawText(text, { x: margin, y: atY, size, font: fontBold, color: COLOR_NAVY });
    const tw = fontBold.widthOfTextAtSize(text, size);
    page.drawRectangle({
      x: margin,
      y: atY - 4,
      width: Math.min(tw, 60),
      height: 1.5,
      color: COLOR_ORANGE,
    });
  };

  // ─── Bestellung + Rechnungsadresse (2 Spalten) ───
  y -= 60;
  const colSplit = PAGE_W / 2 + 10;
  let leftY = y;

  sectionHeading("Bestellung", leftY);
  leftY -= 22;
  page.drawText(body.bestellnummer, {
    x: margin,
    y: leftY,
    size: 16,
    font: fontBold,
    color: COLOR_TEXT,
  });
  if (body.belegdatum) {
    leftY -= 14;
    page.drawText(`Bestellt am ${body.belegdatum}`, {
      x: margin,
      y: leftY,
      size: 9,
      font,
      color: COLOR_MUTED,
    });
  }

  const addr = body.rechnungsadresse;
  if (addr) {
    const fullName = [addr.vorname, addr.name].filter(Boolean).join(" ");
    let cy = y;
    sectionHeading("Rechnungsadresse", cy);
    cy -= 22;
    if (addr.anrede) {
      page.drawText(addr.anrede, { x: colSplit, y: cy, size: 10, font, color: COLOR_MUTED });
      cy -= 12;
    }
    if (fullName) {
      page.drawText(fullName, {
        x: colSplit,
        y: cy,
        size: 11,
        font: fontBold,
        color: COLOR_TEXT,
      });
      cy -= 13;
    }
    if (addr.strasse) {
      page.drawText(addr.strasse, { x: colSplit, y: cy, size: 10, font, color: COLOR_TEXT });
      cy -= 12;
    }
    if (addr.plz || addr.ort) {
      page.drawText([addr.plz, addr.ort].filter(Boolean).join(" "), {
        x: colSplit,
        y: cy,
        size: 10,
        font,
        color: COLOR_TEXT,
      });
      cy -= 12;
    }
    if (addr.email) {
      page.drawText(addr.email, { x: colSplit, y: cy, size: 9, font, color: COLOR_MUTED });
    }
  }

  // ─── Artikel-Tabelle ───
  y -= 110;
  sectionHeading("Zurückzusendende Artikel", y);
  y -= 22;

  const col = {
    menge: margin,
    artikel: margin + 40,
    grund: margin + 260,
    summe: PAGE_W - 40 - 60,
  };

  // Tabellen-Header (Navy)
  page.drawRectangle({
    x: margin - 4,
    y: y - 4,
    width: PAGE_W - margin - 40 + 4,
    height: 18,
    color: COLOR_NAVY,
  });
  page.drawText("Menge", { x: col.menge, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Artikel", { x: col.artikel, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Grund", { x: col.grund, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Summe", { x: col.summe, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  y -= 22;

  const fmtEur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
  let erstattungTotal = 0;

  for (const it of body.items) {
    if (y < 200) {
      page.drawText("... (weitere Artikel abgeschnitten)", {
        x: margin,
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
      color: COLOR_TEXT,
    });
    const descLine = it.beschreibung ?? "";
    const metaLine = [it.artikelnummer, it.hersteller].filter(Boolean).join(" · ");
    page.drawText(descLine.slice(0, 38), {
      x: col.artikel,
      y,
      size: 10,
      font,
      color: COLOR_TEXT,
    });
    if (metaLine) {
      page.drawText(metaLine.slice(0, 44), {
        x: col.artikel,
        y: y - 11,
        size: 8,
        font,
        color: COLOR_MUTED,
      });
    }
    page.drawText(it.grund.slice(0, 28), {
      x: col.grund,
      y,
      size: 10,
      font,
      color: COLOR_TEXT,
    });
    if (it.gesamtpreis_brutto !== undefined) {
      page.drawText(fmtEur(it.gesamtpreis_brutto), {
        x: col.summe,
        y,
        size: 10,
        font: fontBold,
        color: COLOR_TEXT,
      });
      if (it.einzelpreis_brutto !== undefined && it.menge > 1) {
        page.drawText(`${fmtEur(it.einzelpreis_brutto)} / Stk`, {
          x: col.summe,
          y: y - 11,
          size: 8,
          font,
          color: COLOR_MUTED,
        });
      }
      erstattungTotal += it.gesamtpreis_brutto;
    }
    page.drawLine({
      start: { x: margin - 4, y: y - 16 },
      end: { x: PAGE_W - 40, y: y - 16 },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 28;
  }

  // ─── Erstattungs-Summe (Highlight-Zeile) ───
  if (erstattungTotal > 0) {
    y -= 2;
    page.drawRectangle({
      x: margin - 4,
      y: y - 6,
      width: PAGE_W - margin - 40 + 4,
      height: 24,
      color: rgb(0.97, 0.97, 0.97),
    });
    page.drawText("Voraussichtliche Erstattung", {
      x: col.grund,
      y: y + 4,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText(fmtEur(erstattungTotal), {
      x: col.summe,
      y: y + 4,
      size: 13,
      font: fontBold,
      color: COLOR_NAVY,
    });
    y -= 22;
  }

  // ─── Refund-Hinweis ───
  y -= 14;
  page.drawText(
    "Die Erstattung erfolgt auf das ursprüngliche Zahlungsmittel — in der Regel innerhalb von",
    { x: margin, y, size: 9, font, color: COLOR_MUTED }
  );
  y -= 11;
  page.drawText("5 Werktagen nach Eingang und Prüfung der Ware.", {
    x: margin,
    y,
    size: 9,
    font,
    color: COLOR_MUTED,
  });

  // ─── Versand-Block ───
  y -= 28;
  if (body.shippingMode === "sicher") {
    sectionHeading("Sichere Rückgabe", y);
    y -= 22;
    page.drawText(
      body.requestDHLLabel
        ? "Du hast die Sichere Rückgabe gewählt — das DHL-Retourenlabel liegt auf der nächsten Seite."
        : "Du hast die Sichere Rückgabe gewählt. Bei Bedarf kannst du ein DHL-Label nachfordern.",
      { x: margin, y, size: 10, font, color: COLOR_TEXT }
    );
    y -= 16;
    page.drawText("1. Lege diesen Retourenschein der Sendung bei.", {
      x: margin,
      y,
      size: 10,
      font,
      color: COLOR_TEXT,
    });
    y -= 13;
    page.drawText("2. Verwende das DHL-Label zum Versand (siehe nächste Seite).", {
      x: margin,
      y,
      size: 10,
      font,
      color: COLOR_TEXT,
    });
    y -= 13;
    page.drawText("3. Bearbeitung dauert bis zu 5 Werktage nach Eingang.", {
      x: margin,
      y,
      size: 10,
      font,
      color: COLOR_TEXT,
    });
  } else {
    sectionHeading("Rücksendeadresse", y);
    y -= 22;
    page.drawText("kfzBlitz24 GmbH", {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: COLOR_TEXT,
    });
    y -= 13;
    page.drawText("c/o RETOURE", { x: margin, y, size: 10, font, color: COLOR_TEXT });
    y -= 12;
    page.drawText("Musterstraße 1", { x: margin, y, size: 10, font, color: COLOR_TEXT });
    y -= 12;
    page.drawText("12345 Musterstadt", { x: margin, y, size: 10, font, color: COLOR_TEXT });
    y -= 20;
    page.drawText("Bitte frankiere die Sendung ausreichend.", {
      x: margin,
      y,
      size: 9,
      font,
      color: COLOR_MUTED,
    });
    y -= 11;
    page.drawText(
      "Unfrei gesendete Pakete können leider nicht angenommen werden.",
      { x: margin, y, size: 9, font, color: COLOR_MUTED }
    );
  }

  drawFooter(page, font);

  // ─── Page 2: DHL-Label-Wrapper (wenn Label angefordert) ─────────────
  let labelInfo: LabelInfo = { mode: "none" };
  if (shouldGenerateLabel(body)) {
    let labelResult: RetoureLabelResult;
    try {
      labelResult = await createRetoureLabel({
        customerReference: body.bestellnummer,
        description: `Retoure ${body.bestellnummer}`,
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
        const embeddedLabelPages = await pdf.embedPdf(labelPdf, labelPdf.getPageIndices());

        for (const lp of embeddedLabelPages) {
          const lpage = pdf.addPage([PAGE_W, PAGE_H]);
          drawBrandChrome(lpage, fontBold, font);

          // Titel + Orange-Underline
          let ly = PAGE_H - 120;
          lpage.drawText("DHL-Retourenlabel", {
            x: margin,
            y: ly,
            size: 28,
            font: fontBold,
            color: COLOR_NAVY,
          });
          lpage.drawRectangle({
            x: margin,
            y: ly - 8,
            width: 80,
            height: 2,
            color: COLOR_ORANGE,
          });

          // Anleitung
          ly -= 50;
          lpage.drawText("Anleitung", {
            x: margin,
            y: ly,
            size: 13,
            font: fontBold,
            color: COLOR_NAVY,
          });
          lpage.drawRectangle({
            x: margin,
            y: ly - 4,
            width: Math.min(fontBold.widthOfTextAtSize("Anleitung", 13), 60),
            height: 1.5,
            color: COLOR_ORANGE,
          });
          ly -= 22;
          const steps = [
            "1. Schneide das DHL-Label entlang der gestrichelten Linie aus.",
            "2. Klebe es gut sichtbar auf die Außenseite der Sendung.",
            "3. Lege den Retourenschein (Seite 1) ins Paket.",
            "4. Übergib das Paket bei einer DHL-Filiale oder Packstation.",
          ];
          for (const s of steps) {
            lpage.drawText(s, { x: margin, y: ly, size: 10, font, color: COLOR_TEXT });
            ly -= 14;
          }
          ly -= 6;
          lpage.drawText(
            "Bei Eingang prüfen wir die Ware und veranlassen die Erstattung",
            { x: margin, y: ly, size: 9, font, color: COLOR_MUTED }
          );
          ly -= 11;
          lpage.drawText("innerhalb von 5 Werktagen auf das ursprüngliche Zahlungsmittel.", {
            x: margin,
            y: ly,
            size: 9,
            font,
            color: COLOR_MUTED,
          });

          // Label zentriert
          const lw = lp.width;
          const lh = lp.height;
          const availTop = ly - 30;
          const availBottom = 80;
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
            borderColor: rgb(0.6, 0.6, 0.6),
            borderWidth: 0.5,
            borderDashArray: [4, 3],
          });
          lpage.drawText("Hier ausschneiden", {
            x: lx - pad,
            y: lyPos + lh + pad + 4,
            size: 8,
            font,
            color: COLOR_MUTED,
          });

          // Das eigentliche Label
          lpage.drawPage(lp, { x: lx, y: lyPos, width: lw, height: lh });

          // Tracking-Info im Footer-Bereich
          lpage.drawText(
            `Tracking: ${labelResult.trackingNumber ?? "—"}   ·   Bestellnr.: ${body.bestellnummer}`,
            { x: margin, y: 65, size: 9, font, color: COLOR_MUTED }
          );

          drawFooter(lpage, font);
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

  // ─── Bemerkung an Abisco zurückschreiben (best-effort) ───
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
