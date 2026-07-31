/**
 * kfzBlitz24 Brief-PDF-Renderer.
 * DIN 5008 Typ B (OB24-Anforderung) für das Adressfeld:
 *   - Fenster: 42mm hoch × 72mm breit
 *   - Links: 20mm vom linken Rand
 *   - Oben: 49mm vom oberen Rand
 * Textbereich (Body/Betreff): 25mm links wie im kfzBlitz24-Brief-Designguide.
 *
 * Rest laut Design-Guide (Stil "dezent"): kein Brand-Bar, Logo oben
 * rechts als gesetzter Text (NAVY/ORANGE/NAVY), Betreff bold NAVY +
 * oranger Akzentbalken, Fließtext schwarz Flattersatz.
 */

import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image as PdfImage,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const NAVY = "#0b3756";
const ORANGE = "#ff6600";
const BODY = "#000000";
const MID_GREY = "#8a93a0";
const LIGHT_GREY = "#e6e8eb";

const PAGE_W = 595.27;
const mm = (n: number) => n * 2.83465;

// Textbereich für Body/Betreff — 25mm links (DIN 5008 § 2)
const LEFT = mm(25);
const RIGHT = mm(20);

// Adressfeld nach DIN 5008 Typ B (Position des Empfänger-Blocks)
const ADDR_LEFT = mm(20);   // 20mm vom Rand
const ADDR_TOP = mm(49);    // 49mm von oben
const ADDR_WIDTH = mm(72);  // 72mm breit
const ADDR_HEIGHT = mm(42); // 42mm hoch

// Absender-Kleinzeile darüber — muss ENDEN bevor Adressfeld beginnt
const SENDER_LINE_TOP = mm(40);  // 40mm — sicher oberhalb 49mm

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BODY,
    padding: 0,
  },
  senderTiny: {
    position: "absolute",
    top: SENDER_LINE_TOP,
    left: ADDR_LEFT,
    right: RIGHT,
    fontSize: 6.5,
    color: MID_GREY,
  },
  addressBlock: {
    position: "absolute",
    top: ADDR_TOP,
    left: ADDR_LEFT,
    width: ADDR_WIDTH,
    height: ADDR_HEIGHT,
  },
  addressLine: {
    fontSize: 10.5,
    color: BODY,
    lineHeight: 1.25,
  },
  dateLine: {
    position: "absolute",
    top: mm(97),                  // rechtsbündig oberhalb Betreff
    left: LEFT,
    right: RIGHT,
    fontSize: 10,
    color: BODY,
    textAlign: "right",
  },
  betreff: {
    position: "absolute",
    top: mm(108),
    left: LEFT,
    right: RIGHT,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  betreffAccent: {
    position: "absolute",
    top: mm(116),
    left: LEFT,
    width: 56,
    height: 3,
    backgroundColor: ORANGE,
  },
  contentArea: {
    position: "absolute",
    top: mm(125),
    left: LEFT,
    right: RIGHT,
    bottom: mm(35),
  },
  anrede: {
    fontSize: 10,
    lineHeight: 1.45,
    color: BODY,
  },
  para: {
    fontSize: 10,
    lineHeight: 1.45,
    color: BODY,
    marginTop: 10,
  },
  closing: {
    fontSize: 10,
    color: BODY,
    marginTop: 18,
  },
  // Ohne Bild: Abstand für handschriftliche Unterschrift
  signatureGap: {
    height: 62,
  },
  // Mit Bild: Bild wird direkt darunter angezeigt, kleiner Freiraum drum
  signatureImage: {
    marginTop: 8,
    width: 130,
    height: 45,
    objectFit: "contain",
  },
  signatureName: {
    fontSize: 10,
    color: BODY,
    marginTop: 4,
  },
  psWrap: {
    fontSize: 10,
    color: BODY,
    marginTop: 18,
    lineHeight: 1.45,
  },
  psLabel: {
    fontFamily: "Helvetica-Bold",
  },
  footerLine: {
    position: "absolute",
    left: LEFT,
    right: RIGHT,
    bottom: mm(20),
    borderTopWidth: 0.5,
    borderTopColor: LIGHT_GREY,
    height: 1,
  },
  footer: {
    position: "absolute",
    left: LEFT,
    right: RIGHT,
    bottom: mm(12),
    fontSize: 7,
    color: MID_GREY,
    textAlign: "center",
    lineHeight: 1.4,
  },
  versionCode: {
    position: "absolute",
    top: mm(120),
    right: 8,
    fontSize: 6.5,
    color: MID_GREY,
    transform: "rotate(-90deg)",
    transformOrigin: "right",
    width: 200,
  },
  logoWrap: {
    position: "absolute",
    top: mm(15),
    right: RIGHT,
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.5,
  },
  logoKfz: { color: NAVY },
  logoBlitz: { color: ORANGE },
  logo24: { color: NAVY },
});

export type LetterData = {
  senderName: string;
  senderLine1: string;
  senderLine2: string;
  recipient: {
    company?: string | null;
    salutation?: string | null;
    firstName: string;
    lastName: string;
    street?: string | null;
    houseNumber?: string | null;
    zipCode?: string | null;
    city?: string | null;
    country?: string | null;
  };
  anrede: string;
  subject: string;
  bodyParagraphs: string[];
  closing?: string;
  signatureImage?: string | null;   // data:image/png;base64,... (optional)
  signatureName?: string;
  ps?: string | null;
  footer?: string;
  versionCode?: string;
  date?: Date;
};

function formatGermanDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function buildAddressLines(r: LetterData["recipient"]): string[] {
  const lines: string[] = [];
  if (r.company) lines.push(r.company);
  const anrede = r.salutation === "Herr" ? "Herrn" : r.salutation ?? "";
  const nameLine = [anrede, r.firstName, r.lastName].filter(Boolean).join(" ");
  if (nameLine) lines.push(nameLine);
  const street = [r.street, r.houseNumber].filter(Boolean).join(" ");
  if (street) lines.push(street);
  const cityLine = [r.zipCode, r.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (r.country && r.country.toUpperCase() !== "DE") lines.push(r.country.toUpperCase());
  return lines;
}

export function LetterDoc({ data }: { data: LetterData }) {
  const addressLines = buildAddressLines(data.recipient);
  const date = data.date ?? new Date();
  const senderKleinzeile = `${data.senderName} · ${data.senderLine1} · ${data.senderLine2}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.logoWrap}>
          <Text style={styles.logoKfz}>kfz</Text>
          <Text style={styles.logoBlitz}>blitz</Text>
          <Text style={styles.logo24}>24</Text>
        </Text>

        {/* Absender-Kleinzeile — endet bei ~45mm, sicher über 49mm-Adressfeld */}
        <Text style={styles.senderTiny}>{senderKleinzeile}</Text>

        {/* Adressfeld nach DIN 5008 Typ B: 20mm links, 49mm oben, 72×42mm */}
        <View style={styles.addressBlock}>
          {addressLines.map((line, i) => (
            <Text key={i} style={styles.addressLine}>
              {line}
            </Text>
          ))}
        </View>

        {/* Ort, Datum (rechtsbündig, unter Adressfeld) */}
        <Text style={styles.dateLine}>
          {`Grünwald, ${formatGermanDate(date)}`}
        </Text>

        {/* Betreff + oranger Akzent */}
        <Text style={styles.betreff}>{data.subject}</Text>
        <View style={styles.betreffAccent} />

        {/* Body */}
        <View style={styles.contentArea}>
          <Text style={styles.anrede}>{data.anrede}</Text>

          {data.bodyParagraphs.map((p, i) => (
            <Text key={i} style={styles.para}>
              {p}
            </Text>
          ))}

          <Text style={styles.closing}>
            {data.closing ?? "Mit freundlichen Grüßen"}
          </Text>

          {data.signatureImage ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <PdfImage src={data.signatureImage} style={styles.signatureImage} />
              {data.signatureName && (
                <Text style={styles.signatureName}>{data.signatureName}</Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.signatureGap} />
              {data.signatureName && (
                <Text style={{ fontSize: 10, color: BODY }}>{data.signatureName}</Text>
              )}
            </>
          )}

          {data.ps && data.ps.trim() && (
            <Text style={styles.psWrap}>
              <Text style={styles.psLabel}>P.S. </Text>
              {data.ps.trim()}
            </Text>
          )}
        </View>

        <View style={styles.footerLine} />
        {data.footer && <Text style={styles.footer}>{data.footer}</Text>}
        {data.versionCode && (
          <Text style={styles.versionCode}>{data.versionCode}</Text>
        )}
      </Page>
    </Document>
  );
}

export function extractAnredeAndParagraphs(html: string): {
  anrede: string;
  paragraphs: string[];
} {
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
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim().replace(/\n+/g, " "))
    .filter(Boolean);
  const first = paras[0] ?? "";
  const isAnrede = /^(sehr geehrte[rn]?|hallo|liebe[rn]?)/i.test(first);
  if (isAnrede) return { anrede: first, paragraphs: paras.slice(1) };
  return { anrede: "Sehr geehrte Damen und Herren,", paragraphs: paras };
}

export async function renderLetterPdf(data: LetterData): Promise<Buffer> {
  return renderToBuffer(<LetterDoc data={data} />);
}
