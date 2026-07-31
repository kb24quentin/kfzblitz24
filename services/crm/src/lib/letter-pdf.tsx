/**
 * kfzBlitz24 Brief-PDF-Renderer.
 * Umsetzung des kfzBlitz24-Brief-Designguides (Stil "dezent", v1.0):
 *   - DIN 5008, A4, linker Rand 71pt (25mm), rechter Rand 57pt (20mm)
 *   - Keine Brand-Bar, kein Farbstreifen
 *   - Logo oben rechts als gesetzter Text: "kfz" NAVY + "blitz" ORANGE + "24" NAVY
 *   - Absender-Kleinzeile 6.5pt MID_GREY oberhalb Anschriftfeld
 *   - Anschriftfeld 10.5pt schwarz, KEINE Leerzeile zwischen Straße und PLZ/Ort
 *   - Ort/Datum rechtsbündig
 *   - Betreff 13pt Helvetica-Bold NAVY (ohne Wort "Betreff"), darunter oranger
 *     3pt hoher, 56pt breiter Akzentbalken
 *   - Fließtext 10pt / 14.5pt Leading, Flattersatz, schwarz
 *   - 62pt Freiraum für handschriftliche Unterschrift
 *   - P.S. mit fettem Label + Text (die einzige CTA)
 *   - Fußzeile 7pt MID_GREY mit §35a-Pflichtangaben, LIGHT_GREY-Trennlinie
 *   - Versionscode 6.5pt MID_GREY um 90° rotiert am rechten Rand
 */

import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ─── Design-Konstanten ─────────────────────────────────────────────────
const NAVY = "#0b3756";
const ORANGE = "#ff6600";
const BODY = "#000000";
const MID_GREY = "#8a93a0";
const LIGHT_GREY = "#e6e8eb";

const PAGE_W = 595.27;
const PAGE_H = 841.89;
const LEFT = 71;             // 25mm DIN 5008
const RIGHT = 57;            // 20mm
const TEXT_RIGHT = PAGE_W - RIGHT;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BODY,
    padding: 0,
  },
  senderTiny: {
    position: "absolute",
    top: 128,
    left: LEFT,
    right: RIGHT,
    fontSize: 6.5,
    color: MID_GREY,
  },
  addressBlock: {
    position: "absolute",
    top: 142,
    left: LEFT,
  },
  addressLine: {
    fontSize: 10.5,
    color: BODY,
    lineHeight: 1.25,
  },
  dateLine: {
    position: "absolute",
    top: 270,
    left: LEFT,
    right: RIGHT,
    fontSize: 10,
    color: BODY,
    textAlign: "right",
  },
  betreff: {
    position: "absolute",
    top: 300,
    left: LEFT,
    right: RIGHT,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  betreffAccent: {
    position: "absolute",
    top: 322,
    left: LEFT,
    width: 56,
    height: 3,
    backgroundColor: ORANGE,
  },
  contentArea: {
    position: "absolute",
    top: 348,
    left: LEFT,
    right: RIGHT,
    bottom: 100,
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
  signatureName: {
    fontSize: 10,
    color: BODY,
    marginTop: 62,   // Freiraum für handschriftliche Unterschrift
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
    bottom: 78,
    borderTopWidth: 0.5,
    borderTopColor: LIGHT_GREY,
    height: 1,
  },
  footer: {
    position: "absolute",
    left: LEFT,
    right: RIGHT,
    bottom: 55,
    fontSize: 7,
    color: MID_GREY,
    textAlign: "center",
    lineHeight: 1.4,
  },
  versionCode: {
    // 90° gedreht am rechten Rand
    position: "absolute",
    top: 400,
    right: 8,
    fontSize: 6.5,
    color: MID_GREY,
    transform: "rotate(-90deg)",
    transformOrigin: "right",
    width: 200,
  },
  // Logo — 3 Farbabschnitte als inline-Text
  logoWrap: {
    position: "absolute",
    top: 46,
    right: RIGHT,
    fontSize: 37.7, // 26pt × 1.45 lt. Guide
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
    salutation?: string | null;    // "Herr" | "Frau"
    firstName: string;
    lastName: string;
    street?: string | null;
    houseNumber?: string | null;
    zipCode?: string | null;
    city?: string | null;
    country?: string | null;       // ISO alpha-2
  };
  anrede: string;                  // "Sehr geehrter Herr Flügel," etc.
  subject: string;                 // Betreff (ohne Wort "Betreff:")
  bodyParagraphs: string[];        // idealerweise 3 Absätze
  closing?: string;                // "Mit freundlichen Grüßen"
  signatureName?: string;          // "Christian Engert"
  ps?: string | null;              // P.S. Text (ohne "P.S." Prefix)
  footer?: string;                 // §35a Pflichtangaben
  versionCode?: string;            // z.B. "AKQ-KB24 · Rev. 07/2026 · v1.0"
  date?: Date;
};

function formatGermanDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Anschriftfeld nach DIN 5008: Firma / Anrede+Name / Straße / PLZ+Ort / (Land) */
function buildAddressLines(r: LetterData["recipient"]): string[] {
  const lines: string[] = [];
  if (r.company) lines.push(r.company);
  // Anrede im Dativ ("Herrn ..."), Frau bleibt
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
        {/* Logo oben rechts (gesetzter Text, 3 Farbabschnitte) */}
        <Text style={styles.logoWrap}>
          <Text style={styles.logoKfz}>kfz</Text>
          <Text style={styles.logoBlitz}>blitz</Text>
          <Text style={styles.logo24}>24</Text>
        </Text>

        {/* Absender-Kleinzeile */}
        <Text style={styles.senderTiny}>{senderKleinzeile}</Text>

        {/* Anschriftfeld */}
        <View style={styles.addressBlock}>
          {addressLines.map((line, i) => (
            <Text key={i} style={styles.addressLine}>
              {line}
            </Text>
          ))}
        </View>

        {/* Ort, Datum (rechtsbündig) */}
        <Text style={styles.dateLine}>
          {`Grünwald, ${formatGermanDate(date)}`}
        </Text>

        {/* Betreff + Akzentbalken */}
        <Text style={styles.betreff}>{data.subject}</Text>
        <View style={styles.betreffAccent} />

        {/* Content-Bereich: Anrede, Absätze, Grußformel, Name, P.S. */}
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

          {data.signatureName && (
            <Text style={styles.signatureName}>{data.signatureName}</Text>
          )}

          {data.ps && data.ps.trim() && (
            <Text style={styles.psWrap}>
              <Text style={styles.psLabel}>P.S. </Text>
              {data.ps.trim()}
            </Text>
          )}
        </View>

        {/* Fußzeilen-Trennlinie */}
        <View style={styles.footerLine} />

        {/* Fußzeile mit §35a-Pflichtangaben */}
        {data.footer && <Text style={styles.footer}>{data.footer}</Text>}

        {/* Versionscode am rechten Rand, 90° gedreht */}
        {data.versionCode && (
          <Text style={styles.versionCode}>{data.versionCode}</Text>
        )}
      </Page>
    </Document>
  );
}

/**
 * Strippt HTML aus Template.bodyHtml und teilt in Absätze.
 * Anrede wird herausgezogen wenn erste Zeile mit "Sehr geehrt..." / "Hallo" beginnt.
 */
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
  if (isAnrede) {
    return { anrede: first, paragraphs: paras.slice(1) };
  }
  return { anrede: "Sehr geehrte Damen und Herren,", paragraphs: paras };
}

export async function renderLetterPdf(data: LetterData): Promise<Buffer> {
  return renderToBuffer(<LetterDoc data={data} />);
}
