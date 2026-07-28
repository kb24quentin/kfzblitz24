import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

const FROM_EMAIL = process.env.FROM_EMAIL || "service@kfzblitz24.de";
const FROM_NAME = process.env.FROM_NAME || "WerkstattConnect";
const APP_URL = process.env.AUTH_URL || "https://connect.kfzblitz24-group.com";

type PasswordSetupInput = {
  to: string;
  recipientName: string;
  workshopName: string;
  token: string;
  variant: "welcome" | "team-invite";
};

export async function sendPasswordSetupMail({
  to,
  recipientName,
  workshopName,
  token,
  variant,
}: PasswordSetupInput) {
  const setupUrl = `${APP_URL}/setup/${token}`;
  const subject =
    variant === "welcome"
      ? `Willkommen bei WerkstattConnect — Ihr Zugang für ${workshopName}`
      : `Zugang für ${workshopName} — WerkstattConnect`;

  const html = renderMail({
    heading:
      variant === "welcome"
        ? `Willkommen bei WerkstattConnect, ${escape(recipientName)}!`
        : `Ihr Zugang zu ${escape(workshopName)}`,
    intro:
      variant === "welcome"
        ? `Ihre Werkstatt <strong>${escape(workshopName)}</strong> wurde in WerkstattConnect angelegt. Legen Sie jetzt Ihr Passwort fest, um loszulegen.`
        : `Sie wurden von <strong>${escape(workshopName)}</strong> zu WerkstattConnect eingeladen. Legen Sie Ihr Passwort fest, um sich einzuloggen.`,
    ctaLabel: "Passwort festlegen",
    ctaUrl: setupUrl,
    footer:
      "Der Link ist 7 Tage gültig. Danach bitte einen neuen Zugangs-Link bei Ihrem Werkstatt-Admin anfordern.",
  });

  const text = [
    variant === "welcome"
      ? `Willkommen bei WerkstattConnect!`
      : `Sie wurden zu WerkstattConnect für ${workshopName} eingeladen.`,
    ``,
    `Legen Sie Ihr Passwort fest:`,
    setupUrl,
    ``,
    `Der Link ist 7 Tage gültig.`,
  ].join("\n");

  return resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html,
    text,
  });
}

function renderMail(opts: {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}) {
  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">
            <span style="color:#092c43;">Werkstatt</span><span style="color:#fe6503;">Connect</span>
          </span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">${opts.heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">${opts.intro}</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td>
            <a href="${opts.ctaUrl}" style="display:inline-block;background:#fe6503;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">${opts.ctaLabel}</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:#64748b;">${opts.footer}</p>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
            Falls der Button nicht funktioniert: <a href="${opts.ctaUrl}" style="color:#fe6503;">${opts.ctaUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:11px;color:#94a3b8;">
          WerkstattConnect · ein Produkt der kfzBlitz24 GmbH · Rauschwalder Str. 48B, 02826 Görlitz
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
