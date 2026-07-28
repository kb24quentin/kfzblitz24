import PDFDocument from "pdfkit";
import { formatEur, type InvoicePosition } from "./money";
import { customerDisplayName, vehicleDisplayName } from "./customer-name";

type InvoiceForPdf = {
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date | null;
  positions: InvoicePosition[];
  subtotalNetCent: number;
  totalVatCent: number;
  totalGrossCent: number;
  notes: string | null;
  customer: {
    type: string;
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
  };
  vehicle: {
    brand: string | null;
    model: string | null;
    licensePlate: string | null;
    vin: string | null;
    mileage: number | null;
  } | null;
  workshop: {
    name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
    contactEmail: string;
    contactPhone: string | null;
    taxId: string | null;
    iban: string | null;
    bic: string | null;
    bankName: string | null;
    brandPrimary: string | null;
    brandFooterText: string | null;
    letterheadLogo: Uint8Array | null;
    letterheadLogoMime: string | null;
  };
};

const EURO = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

function fmt(cent: number) {
  return (cent / 100).toLocaleString("de-DE", EURO);
}

export function buildInvoicePdf(inv: InvoiceForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const brand = inv.workshop.brandPrimary || "#fe6503";

      // ------ HEADER: Logo (falls vorhanden) + Werkstatt-Adresse ---------------
      let headerY = 50;
      if (inv.workshop.letterheadLogo && inv.workshop.letterheadLogo.length > 0) {
        try {
          const logoBuf = Buffer.from(inv.workshop.letterheadLogo);
          doc.image(logoBuf, 50, 50, { fit: [140, 60] });
        } catch {
          // logo-format nicht unterstützt → ignoriere und mach text-header
        }
      }
      doc
        .fontSize(9)
        .fillColor("#333")
        .text(inv.workshop.name, 400, headerY, { align: "right", width: 145 })
        .fontSize(8)
        .fillColor("#666");
      if (inv.workshop.street) doc.text(inv.workshop.street, { align: "right", width: 145 });
      if (inv.workshop.zip || inv.workshop.city)
        doc.text(`${inv.workshop.zip ?? ""} ${inv.workshop.city ?? ""}`.trim(), {
          align: "right",
          width: 145,
        });
      if (inv.workshop.contactPhone) doc.text(inv.workshop.contactPhone, { align: "right", width: 145 });
      doc.text(inv.workshop.contactEmail, { align: "right", width: 145 });

      // ------ ADRESSFELD Kunde ---------------------------------------------------
      const addressY = 150;
      doc.fontSize(7).fillColor("#888").text(
        `${inv.workshop.name} · ${inv.workshop.street ?? ""} · ${inv.workshop.zip ?? ""} ${inv.workshop.city ?? ""}`,
        50,
        addressY,
        { width: 250 }
      );
      doc.fontSize(11).fillColor("#000");
      const cName = customerDisplayName(inv.customer);
      doc.text(cName, 50, addressY + 15, { width: 250 });
      if (inv.customer.type === "b2b" && inv.customer.firstName) {
        doc.text(`z. Hd. ${inv.customer.firstName} ${inv.customer.lastName ?? ""}`.trim(), {
          width: 250,
        });
      }
      if (inv.customer.street) doc.text(inv.customer.street, { width: 250 });
      if (inv.customer.zip || inv.customer.city)
        doc.text(`${inv.customer.zip ?? ""} ${inv.customer.city ?? ""}`.trim(), { width: 250 });

      // ------ META: Rechnungsdatum + Nummer -------------------------------------
      doc.fontSize(9).fillColor("#333");
      const metaY = addressY;
      const metaX = 380;
      doc.text("Rechnungs-Nr.", metaX, metaY);
      doc.font("Helvetica-Bold").text(inv.invoiceNumber, metaX + 100, metaY, { width: 90, align: "right" });
      doc.font("Helvetica").text("Datum", metaX, metaY + 15);
      doc.text(inv.issuedAt.toLocaleDateString("de-DE"), metaX + 100, metaY + 15, { width: 90, align: "right" });
      if (inv.dueAt) {
        doc.text("Fällig", metaX, metaY + 30);
        doc.text(inv.dueAt.toLocaleDateString("de-DE"), metaX + 100, metaY + 30, { width: 90, align: "right" });
      }

      // ------ TITEL --------------------------------------------------------------
      const titleY = 270;
      doc.fontSize(16).fillColor(brand).font("Helvetica-Bold").text(`Rechnung ${inv.invoiceNumber}`, 50, titleY);
      doc.font("Helvetica").fontSize(10).fillColor("#333");

      // ------ Fahrzeug-Info -----------------------------------------------------
      let bodyY = titleY + 30;
      if (inv.vehicle) {
        const vName = vehicleDisplayName(inv.vehicle);
        doc.fontSize(9).fillColor("#555").text(`Fahrzeug: ${vName}`, 50, bodyY);
        bodyY += 12;
        if (inv.vehicle.vin) {
          doc.text(`FIN: ${inv.vehicle.vin}`, 50, bodyY);
          bodyY += 12;
        }
        if (inv.vehicle.mileage != null) {
          doc.text(`km-Stand: ${inv.vehicle.mileage.toLocaleString("de-DE")}`, 50, bodyY);
          bodyY += 12;
        }
        bodyY += 6;
      }

      // ------ Positions-Tabelle --------------------------------------------------
      const tableTop = bodyY + 10;
      const colX = { desc: 50, qty: 300, unit: 340, price: 385, vat: 450, total: 490 };
      doc
        .fontSize(9)
        .fillColor("#fff")
        .rect(50, tableTop, 495, 20)
        .fill(brand);
      doc.fillColor("#fff").font("Helvetica-Bold");
      doc.text("Bezeichnung", colX.desc + 5, tableTop + 6);
      doc.text("Menge", colX.qty, tableTop + 6, { width: 35, align: "right" });
      doc.text("Einh.", colX.unit, tableTop + 6, { width: 40, align: "left" });
      doc.text("€ netto", colX.price, tableTop + 6, { width: 60, align: "right" });
      doc.text("MwSt", colX.vat, tableTop + 6, { width: 35, align: "right" });
      doc.text("Summe €", colX.total, tableTop + 6, { width: 55, align: "right" });

      doc.font("Helvetica").fillColor("#000");
      let rowY = tableTop + 24;
      for (const p of inv.positions) {
        const descHeight = doc.heightOfString(p.name, { width: 240 });
        const noteHeight = p.description
          ? doc.fontSize(8).heightOfString(p.description, { width: 240 }) + 2
          : 0;
        const rowH = Math.max(18, descHeight + noteHeight + 6);

        doc.fontSize(9).fillColor("#000").text(p.name, colX.desc + 5, rowY, { width: 240 });
        if (p.description) {
          doc.fontSize(8).fillColor("#666").text(p.description, colX.desc + 5, rowY + descHeight, { width: 240 });
        }
        doc.fontSize(9).fillColor("#000");
        doc.text(p.quantity.toLocaleString("de-DE"), colX.qty, rowY, { width: 35, align: "right" });
        doc.text(p.unit, colX.unit, rowY, { width: 40, align: "left" });
        doc.text(fmt(p.netPriceCent), colX.price, rowY, { width: 60, align: "right" });
        doc.text(`${p.vatPercent}%`, colX.vat, rowY, { width: 35, align: "right" });
        doc.text(fmt(p.netTotalCent), colX.total, rowY, { width: 55, align: "right" });

        rowY += rowH;
        doc
          .strokeColor("#eee")
          .lineWidth(0.5)
          .moveTo(50, rowY - 2)
          .lineTo(545, rowY - 2)
          .stroke();
      }

      // ------ Summen -------------------------------------------------------------
      rowY += 10;
      const sumX = 380;
      doc.fontSize(9).fillColor("#333");
      doc.text("Zwischensumme (netto)", sumX, rowY);
      doc.text(fmt(inv.subtotalNetCent) + " €", sumX + 100, rowY, { width: 60, align: "right" });
      rowY += 14;
      doc.text("MwSt.", sumX, rowY);
      doc.text(fmt(inv.totalVatCent) + " €", sumX + 100, rowY, { width: 60, align: "right" });
      rowY += 14;
      doc
        .fontSize(11)
        .fillColor(brand)
        .font("Helvetica-Bold")
        .text("Gesamtbetrag (brutto)", sumX, rowY);
      doc.text(fmt(inv.totalGrossCent) + " €", sumX + 100, rowY, { width: 60, align: "right" });
      doc.font("Helvetica").fillColor("#000");

      // ------ Zahlungshinweise + Notizen -----------------------------------------
      rowY += 40;
      doc.fontSize(9).fillColor("#333");
      if (inv.dueAt) {
        doc.text(
          `Bitte überweisen Sie den Betrag bis ${inv.dueAt.toLocaleDateString("de-DE")} auf folgendes Konto:`,
          50,
          rowY
        );
        rowY += 14;
      } else {
        doc.text("Bitte überweisen Sie den Betrag auf folgendes Konto:", 50, rowY);
        rowY += 14;
      }
      if (inv.workshop.iban) {
        doc.text(
          `${inv.workshop.bankName ?? "Bank"} · IBAN: ${inv.workshop.iban}${inv.workshop.bic ? ` · BIC: ${inv.workshop.bic}` : ""}`,
          50,
          rowY
        );
        rowY += 14;
      }
      doc.text(`Verwendungszweck: ${inv.invoiceNumber}`, 50, rowY);
      rowY += 20;

      if (inv.notes) {
        doc.fontSize(9).fillColor("#000").text("Notizen:", 50, rowY);
        rowY += 12;
        doc.fontSize(9).fillColor("#555").text(inv.notes, 50, rowY, { width: 495 });
      }

      // ------ Footer -------------------------------------------------------------
      const footerY = doc.page.height - 60;
      doc
        .fontSize(7)
        .fillColor("#888")
        .text(
          inv.workshop.brandFooterText ||
            `${inv.workshop.name}${inv.workshop.taxId ? ` · USt-IdNr. ${inv.workshop.taxId}` : ""}`,
          50,
          footerY,
          { align: "center", width: 495 }
        );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
