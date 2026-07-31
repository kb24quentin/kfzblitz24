/**
 * DIN 5008 (Form A) Brief-Renderer via @react-pdf/renderer.
 * Server-side only. Returns a PDF Buffer that we send to OB24.
 *
 * DIN-Positionen (in mm, gemessen von Papier-Kante):
 *   - Adressblock: Fenster liegt bei 20mm-105mm links, 45mm-90mm oben
 *   - Sender-Zeile darüber: 45mm oben, klein
 *   - Info-Block (rechts): ~50mm oben
 *   - Betreff: bei 97-98mm oben
 *   - Body: startet ~110mm
 */

import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";

// 1mm = 2.83465 pt in PDF units
const mm = (n: number) => n * 2.83465;

const styles = StyleSheet.create({
  page: {
    paddingTop: mm(15),
    paddingBottom: mm(20),
    paddingLeft: mm(25),
    paddingRight: mm(20),
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: "#1a202c",
  },
  // Sender address line above the recipient address block, small font
  senderLine: {
    fontSize: 7.5,
    color: "#4a5568",
    borderBottomWidth: 0.5,
    borderBottomColor: "#4a5568",
    paddingBottom: 1,
    marginBottom: mm(3),
    // absolute-position so the recipient block below sits at the exact
    // DIN 5008 window position (45mm from top → we subtract our page padding)
  },
  // Recipient block sits inside the envelope window
  addressBlock: {
    // wrapper occupies the recipient address area; contents left-aligned
    minHeight: mm(30),
  },
  addressLine: {
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  // Info block on the right (Datum, Zeichen)
  infoBlock: {
    position: "absolute",
    top: mm(50),
    right: mm(20),
    fontSize: 9,
    color: "#4a5568",
    textAlign: "right",
  },
  subject: {
    marginTop: mm(15),
    fontSize: 11,
    fontWeight: 700,
  },
  bodyPara: {
    marginTop: mm(4),
    lineHeight: 1.45,
    fontSize: 10.5,
  },
  signatureBlock: {
    marginTop: mm(10),
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  footer: {
    position: "absolute",
    bottom: mm(10),
    left: mm(25),
    right: mm(20),
    fontSize: 7.5,
    color: "#718096",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: mm(2),
  },
});

export type LetterData = {
  senderName: string;               // z.B. "kfzBlitz24 GmbH"
  senderLine1: string;              // "Bomhardstraße 7"
  senderLine2: string;              // "82031 Grünwald bei München"
  recipient: {
    company?: string | null;
    salutation?: string | null;     // "Herr" | "Frau"
    firstName: string;
    lastName: string;
    street?: string | null;
    houseNumber?: string | null;
    zipCode?: string | null;
    city?: string | null;
    country?: string | null;        // ISO alpha-2; "DE" wird ausgeblendet
  };
  subject: string;
  bodyParagraphs: string[];         // schon geplitteter Body (Absätze)
  closing?: string;                 // "Mit freundlichen Grüßen"
  signatureName?: string;           // "Corinna Wagner"
  signatureRole?: string;           // "Vertrieb B2B"
  footer?: string;                  // "kfzBlitz24 GmbH · Bomhardstraße 7 · …"
  date?: Date;
};

function formatGermanDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function LetterDoc({ data }: { data: LetterData }) {
  const r = data.recipient;
  const streetLine = [r.street, r.houseNumber].filter(Boolean).join(" ");
  const cityLine = [r.zipCode, r.city].filter(Boolean).join(" ");
  const countryLine =
    r.country && r.country.toUpperCase() !== "DE" ? r.country.toUpperCase() : null;

  // Name line: prefix salutation only if present (DIN empfiehlt Anrede in Adresszeile)
  const nameLine = [r.salutation, r.firstName, r.lastName].filter(Boolean).join(" ");
  const date = data.date ?? new Date();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Absender-Zeile (kleine Schrift überm Fenster) */}
        <Text style={styles.senderLine}>
          {`${data.senderName} · ${data.senderLine1} · ${data.senderLine2}`}
        </Text>

        {/* Empfänger-Adressblock (im Fenster sichtbar) */}
        <View style={styles.addressBlock}>
          {r.company && <Text style={styles.addressLine}>{r.company}</Text>}
          {nameLine && <Text style={styles.addressLine}>{nameLine}</Text>}
          {streetLine && <Text style={styles.addressLine}>{streetLine}</Text>}
          {cityLine && <Text style={styles.addressLine}>{cityLine}</Text>}
          {countryLine && <Text style={styles.addressLine}>{countryLine}</Text>}
        </View>

        {/* Info-Block rechts oben: Datum */}
        <View style={styles.infoBlock}>
          <Text>{`Grünwald, ${formatGermanDate(date)}`}</Text>
        </View>

        {/* Betreff */}
        <Text style={styles.subject}>{data.subject}</Text>

        {/* Body-Absätze */}
        {data.bodyParagraphs.map((p, i) => (
          <Text key={i} style={styles.bodyPara}>
            {p}
          </Text>
        ))}

        {/* Signatur */}
        <View style={styles.signatureBlock}>
          <Text>{data.closing ?? "Mit freundlichen Grüßen"}</Text>
          {data.signatureName && <Text style={{ marginTop: mm(12) }}>{data.signatureName}</Text>}
          {data.signatureRole && (
            <Text style={{ color: "#4a5568", fontSize: 9 }}>{data.signatureRole}</Text>
          )}
        </View>

        {/* Footer / Impressum */}
        {data.footer && <Text style={styles.footer}>{data.footer}</Text>}
      </Page>
    </Document>
  );
}

/**
 * Convert an HTML body (as stored in Template.bodyHtml, with variables
 * already substituted) into an array of paragraphs suitable for the PDF.
 */
export function htmlToParagraphs(html: string): string[] {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n");

  return text
    .split(/\n{2,}/)
    .map((p) => p.trim().replace(/\n+/g, " "))
    .filter(Boolean);
}

export async function renderLetterPdf(data: LetterData): Promise<Buffer> {
  return renderToBuffer(<LetterDoc data={data} />);
}
