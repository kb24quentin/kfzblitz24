/**
 * Kunden-Mail zum Verdict-Outcome einer Retoure.
 *
 * Trigger: `POST /api/pda/cases/:id/finalize` — sobald alle (registered+extra,
 * nicht "missing") Items des Cases ein verdict gesetzt haben.
 *
 * Outcome-Logik:
 *   - alle green                → "Retoure freigegeben — Erstattung wird bearbeitet"
 *   - mindestens 1 red          → "Manche Artikel können wir nicht zurücknehmen"
 *                                  (mit Pro-Artikel-Liste warum)
 *   - sonst (mix mit yellow)    → "Wir prüfen noch — Lieferant entscheidet"
 *
 * Brand-Farben sind inline-CSS (NAVY / ORANGE laut CLAUDE.md §8). Das
 * Wortmark `kfz` (NAVY) · `blitz` (ORANGE) · `24` (NAVY) wird als HTML-
 * Text gerendert — kein SVG/Bitmap.
 *
 * Wenn `RESEND_API_KEY` fehlt, skippen wir die Mail (ok:true, skipped).
 * Fehlt die Kunden-Email, skippen wir ebenfalls — der Case läuft trotzdem
 * weiter und der Admin sieht das im Dashboard.
 */
import { prisma } from "./db";
import { addEvent } from "./retoure-cases";

const NAVY = "#0b3756";
const ORANGE = "#ff6600";
const LIGHT_GREY = "#e6e8eb";
const MID_GREY = "#8a93a0";
const DARK_GREY = "#3d4654";

export type SendVerdictMailResult =
  | { ok: true; sent: true; outcome: VerdictOutcome }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export type VerdictOutcome = "all_green" | "any_red" | "mixed";

interface ItemForMail {
  id: string;
  artikelnummer: string | null;
  beschreibung: string | null;
  verdict: string | null;
  verdictReason: string | null;
}

/**
 * Hauptfunktion — entscheidet Outcome, baut Mail, schickt sie via Resend.
 *
 * Vorbedingung (vom Aufrufer geprüft): alle relevanten Items haben ein
 * verdict; missing-Items werden ignoriert (waren ja nie da).
 */
export async function sendVerdictMail(
  caseId: string
): Promise<SendVerdictMailResult> {
  const c = await prisma.retoureCase.findUnique({
    where: { id: caseId },
    include: { items: true },
  });
  if (!c) return { ok: false, error: "Case not found" };

  const relevant = c.items.filter((it) => it.status !== "missing");
  if (relevant.length === 0) {
    return { ok: true, skipped: true, reason: "Keine relevanten Items" };
  }
  if (relevant.some((it) => !it.verdict)) {
    return {
      ok: true,
      skipped: true,
      reason: "Nicht alle Items haben verdict — Mail wird zurückgehalten",
    };
  }

  const outcome = decideOutcome(relevant.map((it) => it.verdict!));
  const recipient = c.customerEmail?.trim();
  if (!recipient) {
    return { ok: true, skipped: true, reason: "Keine Kunden-Email hinterlegt" };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return { ok: true, skipped: true, reason: "RESEND_API_KEY nicht gesetzt" };
  }

  const from =
    process.env.CUSTOMER_MAIL_FROM?.trim() ||
    "kfzblitz24 Retoure <noreply@kfzblitz24-group.com>";

  const { subject, html, text } = buildMail({
    outcome,
    bestellnummer: c.bestellnummer,
    customerVorname: c.customerVorname,
    customerName: c.customerName,
    items: relevant.map((it) => ({
      id: it.id,
      artikelnummer: it.artikelnummer,
      beschreibung: it.beschreibung,
      verdict: it.verdict,
      verdictReason: it.verdictReason,
    })),
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Resend HTTP ${res.status}: ${t.slice(0, 200)}`,
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: `Resend-Request fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  await addEvent(
    caseId,
    "customer_mail_sent",
    `Verdict-Mail an ${recipient} (${outcome})`,
    { outcome, recipient },
    "system"
  );

  return { ok: true, sent: true, outcome };
}

function decideOutcome(verdicts: string[]): VerdictOutcome {
  if (verdicts.every((v) => v === "green")) return "all_green";
  if (verdicts.some((v) => v === "red")) return "any_red";
  return "mixed";
}

interface BuildMailInput {
  outcome: VerdictOutcome;
  bestellnummer: string;
  customerVorname: string | null;
  customerName: string | null;
  items: ItemForMail[];
}

function buildMail(input: BuildMailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const anrede = buildAnrede(input.customerVorname, input.customerName);

  if (input.outcome === "all_green") {
    const subject = `Retoure ${input.bestellnummer} freigegeben — Erstattung wird bearbeitet`;
    const intro =
      "wir haben Ihre Rücksendung geprüft und können sie vollständig zurücknehmen. " +
      "Die Erstattung wird in den nächsten Werktagen über den ursprünglichen Zahlungsweg veranlasst.";
    return {
      subject,
      html: renderHtml({
        title: "Retoure freigegeben",
        accent: "green",
        anrede,
        intro,
        items: input.items,
        bestellnummer: input.bestellnummer,
        showReasons: false,
      }),
      text: renderText({
        title: "Retoure freigegeben",
        anrede,
        intro,
        items: input.items,
        bestellnummer: input.bestellnummer,
        showReasons: false,
      }),
    };
  }

  if (input.outcome === "any_red") {
    const subject = `Retoure ${input.bestellnummer} — manche Artikel können wir nicht zurücknehmen`;
    const intro =
      "wir haben Ihre Rücksendung geprüft. Leider können wir nicht alle Artikel zurücknehmen. " +
      "Eine Übersicht pro Artikel finden Sie unten. Bei Rückfragen melden Sie sich bitte gerne — die nicht zurücknehmbaren Artikel halten wir 14 Tage für Sie bereit.";
    return {
      subject,
      html: renderHtml({
        title: "Manche Artikel können wir nicht zurücknehmen",
        accent: "red",
        anrede,
        intro,
        items: input.items,
        bestellnummer: input.bestellnummer,
        showReasons: true,
      }),
      text: renderText({
        title: "Manche Artikel können wir nicht zurücknehmen",
        anrede,
        intro,
        items: input.items,
        bestellnummer: input.bestellnummer,
        showReasons: true,
      }),
    };
  }

  // mixed (yellow ± green, kein red)
  const subject = `Retoure ${input.bestellnummer} — wir prüfen noch`;
  const intro =
    "wir haben Ihre Rücksendung erhalten. Einige Artikel müssen wir noch durch den Lieferanten prüfen lassen, " +
    "bevor wir die finale Entscheidung treffen. Sie hören in Kürze wieder von uns — typischerweise innerhalb von 7–14 Werktagen.";
  return {
    subject,
    html: renderHtml({
      title: "Wir prüfen noch — Lieferant entscheidet",
      accent: "yellow",
      anrede,
      intro,
      items: input.items,
      bestellnummer: input.bestellnummer,
      showReasons: true,
    }),
    text: renderText({
      title: "Wir prüfen noch — Lieferant entscheidet",
      anrede,
      intro,
      items: input.items,
      bestellnummer: input.bestellnummer,
      showReasons: true,
    }),
  };
}

function buildAnrede(vorname: string | null, name: string | null): string {
  const parts = [vorname, name].filter(Boolean).join(" ").trim();
  if (parts) return `Guten Tag ${parts},`;
  return "Guten Tag,";
}

interface RenderInput {
  title: string;
  anrede: string;
  intro: string;
  items: ItemForMail[];
  bestellnummer: string;
  showReasons: boolean;
  accent?: "green" | "red" | "yellow";
}

function renderHtml(input: RenderInput): string {
  const accentColor =
    input.accent === "red"
      ? "#b3261e"
      : input.accent === "yellow"
        ? "#a8740a"
        : input.accent === "green"
          ? "#1b7f3a"
          : NAVY;

  const itemsHtml = input.items
    .map((it) => itemRowHtml(it, input.showReasons))
    .join("");

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${LIGHT_GREY};font-family:Helvetica,Arial,sans-serif;color:${DARK_GREY};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${LIGHT_GREY};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background:#ffffff;border-radius:6px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:${NAVY};padding:20px 28px;">
              <span style="font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;letter-spacing:0.5px;">
                <span style="color:#ffffff;">kfz</span><span style="color:${ORANGE};">blitz</span><span style="color:#ffffff;">24</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px 0;font-size:20px;color:${accentColor};font-weight:600;">${escapeHtml(input.title)}</h1>
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:${DARK_GREY};">${escapeHtml(input.anrede)}</p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:${DARK_GREY};">${escapeHtml(input.intro)}</p>
              <p style="margin:0 0 12px 0;font-size:14px;color:${MID_GREY};">Bestellnummer: <strong style="color:${DARK_GREY};">${escapeHtml(input.bestellnummer)}</strong></p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${LIGHT_GREY};margin-top:8px;">
                ${itemsHtml}
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;color:${MID_GREY};">Bei Rückfragen antworten Sie einfach auf diese Mail.</p>
            </td>
          </tr>
          <tr>
            <td style="background:${LIGHT_GREY};padding:14px 28px;font-size:12px;color:${MID_GREY};">
              kfzblitz24 · Retoure-Service · kfzblitz24-group.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function itemRowHtml(it: ItemForMail, showReason: boolean): string {
  const label = it.beschreibung || it.artikelnummer || "Artikel";
  const verdict = it.verdict ?? "";
  const pill =
    verdict === "green"
      ? verdictPill("Erstattung", "#1b7f3a")
      : verdict === "yellow"
        ? verdictPill("In Prüfung", "#a8740a")
        : verdict === "red"
          ? verdictPill("Nicht zurücknehmbar", "#b3261e")
          : "";
  const reasonBlock =
    showReason && it.verdictReason
      ? `<div style="margin-top:4px;font-size:13px;color:${MID_GREY};">${escapeHtml(it.verdictReason)}</div>`
      : "";
  const artNr = it.artikelnummer
    ? `<div style="font-size:12px;color:${MID_GREY};margin-top:2px;">Art-Nr.: ${escapeHtml(it.artikelnummer)}</div>`
    : "";
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid ${LIGHT_GREY};">
      <div style="font-size:14px;color:${DARK_GREY};font-weight:600;">${escapeHtml(label)}</div>
      ${artNr}
      ${pill}
      ${reasonBlock}
    </td>
  </tr>`;
}

function verdictPill(label: string, color: string): string {
  return `<div style="margin-top:6px;display:inline-block;padding:3px 8px;border-radius:10px;background:${color};color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.3px;">${escapeHtml(label)}</div>`;
}

function renderText(input: RenderInput): string {
  const lines: string[] = [];
  lines.push(input.title);
  lines.push("");
  lines.push(input.anrede);
  lines.push("");
  lines.push(input.intro);
  lines.push("");
  lines.push(`Bestellnummer: ${input.bestellnummer}`);
  lines.push("");
  lines.push("Artikel:");
  for (const it of input.items) {
    const label = it.beschreibung || it.artikelnummer || "Artikel";
    const v =
      it.verdict === "green"
        ? "Erstattung"
        : it.verdict === "yellow"
          ? "In Prüfung"
          : it.verdict === "red"
            ? "Nicht zurücknehmbar"
            : "—";
    lines.push(`- ${label}${it.artikelnummer ? ` (${it.artikelnummer})` : ""} → ${v}`);
    if (input.showReasons && it.verdictReason) {
      lines.push(`  Grund: ${it.verdictReason}`);
    }
  }
  lines.push("");
  lines.push("Bei Rückfragen antworten Sie einfach auf diese Mail.");
  lines.push("");
  lines.push("kfzblitz24 · Retoure-Service");
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
