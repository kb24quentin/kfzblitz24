import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import bwipjs from "bwip-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Address = {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  email?: string;
  telefon?: string;
};

type Item = {
  artikelnummer?: string;
  hersteller?: string;
  beschreibung?: string;
  menge: number;
  grund: string;
};

type Body = {
  bestellnummer?: string;
  belegnummer?: string;
  belegdatum?: string;
  rechnungsadresse?: Address;
  items: Item[];
  shippingMode: "standard" | "sicher" | "unknown";
  requestDHLLabel?: boolean;
};

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

  // ── Barcode ──
  let barcodePng: Uint8Array;
  try {
    barcodePng = await generateBarcodePng(body.bestellnummer);
  } catch (e) {
    return new NextResponse(
      `barcode error: ${e instanceof Error ? e.message : e}`,
      { status: 500 }
    );
  }

  // ── PDF ──
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const drawText = (
    text: string,
    x: number,
    y: number,
    opts: { size?: number; font?: PDFFont; color?: [number, number, number] } = {}
  ) => {
    page.drawText(text, {
      x,
      y,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: rgb(...(opts.color ?? [0, 0, 0])),
    });
  };

  const margin = 40;
  let y = height - margin;

  // Header: Title + Barcode
  drawText("Retourenschein", margin, y, { size: 20, font: fontBold });
  const barcodeImage = await pdf.embedPng(barcodePng);
  const barcodeDims = barcodeImage.scale(0.4);
  page.drawImage(barcodeImage, {
    x: width - margin - barcodeDims.width,
    y: y - 20,
    width: barcodeDims.width,
    height: barcodeDims.height,
  });
  y -= 40;
  drawText("kfzblitz24", margin, y, { size: 10, color: [0.4, 0.4, 0.4] });

  y -= 30;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });

  // Order info block
  y -= 25;
  drawText("Bestellung", margin, y, { size: 9, color: [0.4, 0.4, 0.4] });
  y -= 15;
  drawText(body.bestellnummer, margin, y, { size: 13, font: fontBold });
  if (body.belegdatum) {
    y -= 14;
    drawText(`Bestellt am ${body.belegdatum}`, margin, y, { size: 9, color: [0.4, 0.4, 0.4] });
  }

  // Customer address
  const addr = body.rechnungsadresse;
  if (addr) {
    const fullName = [addr.vorname, addr.name].filter(Boolean).join(" ");
    let cy = height - margin - 90;
    const cx = width / 2 + 20;
    drawText("Absender / Rechnungsadresse", cx, cy, { size: 9, color: [0.4, 0.4, 0.4] });
    cy -= 14;
    if (addr.anrede) {
      drawText(addr.anrede, cx, cy, { size: 10, color: [0.4, 0.4, 0.4] });
      cy -= 12;
    }
    if (fullName) {
      drawText(fullName, cx, cy, { size: 11, font: fontBold });
      cy -= 13;
    }
    if (addr.strasse) {
      drawText(addr.strasse, cx, cy, { size: 10 });
      cy -= 12;
    }
    if (addr.plz || addr.ort) {
      drawText([addr.plz, addr.ort].filter(Boolean).join(" "), cx, cy, { size: 10 });
      cy -= 12;
    }
    if (addr.email) {
      drawText(addr.email, cx, cy, { size: 9, color: [0.4, 0.4, 0.4] });
    }
  }

  // Items table
  y = height - margin - 180;
  drawText("Zurückzusendende Artikel", margin, y, { size: 12, font: fontBold });
  y -= 20;

  // Table header
  const col = {
    menge: margin,
    artikel: margin + 50,
    grund: margin + 310,
  };
  page.drawRectangle({
    x: margin - 5,
    y: y - 4,
    width: width - 2 * margin + 10,
    height: 18,
    color: rgb(0.95, 0.95, 0.95),
  });
  drawText("Menge", col.menge, y, { size: 9, font: fontBold, color: [0.3, 0.3, 0.3] });
  drawText("Artikel", col.artikel, y, { size: 9, font: fontBold, color: [0.3, 0.3, 0.3] });
  drawText("Grund", col.grund, y, { size: 9, font: fontBold, color: [0.3, 0.3, 0.3] });
  y -= 20;

  for (const it of body.items) {
    if (y < 120) {
      // Not enough space — simple: draw footer note and stop
      drawText("... (weitere Artikel abgeschnitten)", margin, y, { size: 9, color: [0.6, 0.2, 0.2] });
      break;
    }
    drawText(`${it.menge}×`, col.menge, y, { size: 10, font: fontBold });

    const descLine = it.beschreibung ?? "";
    const metaLine = [it.artikelnummer, it.hersteller].filter(Boolean).join(" · ");
    drawText(descLine.slice(0, 48), col.artikel, y, { size: 10 });
    if (metaLine) {
      drawText(metaLine.slice(0, 48), col.artikel, y - 11, { size: 8, color: [0.4, 0.4, 0.4] });
    }
    drawText(it.grund.slice(0, 28), col.grund, y, { size: 10 });

    page.drawLine({
      start: { x: margin - 5, y: y - 16 },
      end: { x: width - margin + 5, y: y - 16 },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 28;
  }

  // Instructions footer
  y = Math.min(y - 20, 170);
  if (body.shippingMode === "sicher") {
    page.drawRectangle({
      x: margin - 5,
      y: y - 90,
      width: width - 2 * margin + 10,
      height: 100,
      color: rgb(0.93, 0.98, 0.95),
      borderColor: rgb(0.6, 0.8, 0.7),
      borderWidth: 0.5,
    });
    drawText("Sichere Rückgabe", margin, y, { size: 11, font: fontBold, color: [0.06, 0.4, 0.2] });
    y -= 16;
    drawText(
      body.requestDHLLabel
        ? "Ein DHL-Retourenlabel wurde angefordert und wird dir separat per E-Mail zugestellt."
        : "Du hast kein DHL-Label angefordert. Du kannst eines jederzeit nachfordern.",
      margin,
      y,
      { size: 9, color: [0.2, 0.3, 0.25] }
    );
    y -= 14;
    drawText("1. Lege diesen Retourenschein der Sendung bei.", margin, y, { size: 9 });
    y -= 12;
    drawText("2. Verwende das DHL-Label zum Versand der Sendung.", margin, y, { size: 9 });
    y -= 12;
    drawText("3. Die Bearbeitung dauert bis zu 5 Werktagen nach Eingang.", margin, y, { size: 9 });
  } else {
    page.drawRectangle({
      x: margin - 5,
      y: y - 110,
      width: width - 2 * margin + 10,
      height: 120,
      color: rgb(1, 0.97, 0.9),
      borderColor: rgb(0.85, 0.7, 0.4),
      borderWidth: 0.5,
    });
    drawText("Rücksendeadresse", margin, y, { size: 11, font: fontBold, color: [0.5, 0.3, 0] });
    y -= 16;
    drawText("kfzblitz24 GmbH", margin, y, { size: 10 });
    y -= 12;
    drawText("Retourenabteilung", margin, y, { size: 10 });
    y -= 12;
    drawText("Musterstraße 1", margin, y, { size: 10 });
    y -= 12;
    drawText("82031 Grünwald", margin, y, { size: 10 });
    y -= 18;
    drawText("Bitte frankiere die Sendung ausreichend. Unfrei gesendete Pakete", margin, y, { size: 8, color: [0.4, 0.4, 0.4] });
    y -= 10;
    drawText("können leider nicht angenommen werden.", margin, y, { size: 8, color: [0.4, 0.4, 0.4] });
  }

  // Footer
  drawText(
    `Erstellt am ${new Date().toLocaleString("de-DE")} · kfzblitz24`,
    margin,
    30,
    { size: 8, color: [0.6, 0.6, 0.6] }
  );

  const bytes = await pdf.save();
  return new NextResponse(bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="retourenschein-${body.bestellnummer}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
