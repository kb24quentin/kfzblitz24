/**
 * Branded transactional-mail HTML wrapper for kfzBlitz24.
 *
 * Ported 1:1 from the Shopware KB24VehicleSelector\Migration\MailLayoutHelper
 * (Navy gradient header + logo + white body + navy footer with impressum).
 * Layout is table-based on purpose — Outlook and older mail clients don't
 * respect flex/grid, and inline styles survive Gmail's CSS-stripping.
 *
 * Logo + shop links point to the production domain by default so real
 * customers see kfzblitz24.de regardless of which env sends the mail.
 * Overridable via `MAIL_SHOP_URL` + `MAIL_LOGO_URL` env vars.
 */

const SHOP_URL =
  process.env.MAIL_SHOP_URL?.trim() || "https://kfzblitz24.de";
const LOGO_URL =
  process.env.MAIL_LOGO_URL?.trim() ||
  "https://kfzblitz24.de/bundles/kb24vehicleselector/img/mail/logo.png";
const SUPPORT_EMAIL =
  process.env.FROM_EMAIL?.trim() || "service@kfzblitz24.de";

export function renderBrandedMail(innerContent: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>kfzBlitz24</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a202c;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:linear-gradient(135deg,#0b3756 0%,#0e2742 100%);background-color:#0b3756;padding:28px 32px;text-align:center;">
      <a href="${SHOP_URL}" style="display:inline-block;text-decoration:none;border:0;">
        <img src="${LOGO_URL}" alt="kfzBlitz24" width="200" style="display:inline-block;width:200px;max-width:200px;height:auto;border:0;outline:none;">
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:36px 32px;font-size:14px;line-height:1.7;color:#1a202c;">${innerContent}</td>
  </tr>
  <tr>
    <td style="background:#0b3756;padding:32px 32px 26px 32px;color:#cbd5e0;">
      <a href="${SHOP_URL}" style="display:inline-block;text-decoration:none;border:0;margin-bottom:14px;">
        <img src="${LOGO_URL}" alt="kfzBlitz24" width="140" style="display:block;width:140px;max-width:140px;height:auto;border:0;outline:none;">
      </a>
      <div style="font-size:12px;line-height:1.7;color:rgba(255,255,255,0.72);">
        Fragen? <a href="mailto:${SUPPORT_EMAIL}" style="color:#ff8533;text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
      </div>
      <div style="margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.10);font-size:10px;line-height:1.7;color:rgba(255,255,255,0.50);">
        <strong style="color:rgba(255,255,255,0.78);font-weight:600;">kfzBlitz24 GmbH</strong>
        &middot; Bomhardstra&szlig;e 7 &middot; 82031 Gr&uuml;nwald bei M&uuml;nchen<br>
        Gesch&auml;ftsf&uuml;hrer: Christian Engert &middot; HRB 291765, Amtsgericht M&uuml;nchen &middot; USt-ID: DE367617344<br>
        <a href="${SHOP_URL}/impressum" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Impressum</a>
        &middot; <a href="${SHOP_URL}/datenschutz" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Datenschutz</a>
        &middot; <a href="${SHOP_URL}/agb" style="color:rgba(255,255,255,0.62);text-decoration:underline;">AGB</a>
      </div>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>`;
}

/**
 * Detects if a string is already a fully-wrapped HTML document
 * (starts with a DOCTYPE or <html> tag). Used to skip double-wrapping
 * on resends of pre-refactor messages.
 */
export function isFullHtmlDocument(html: string): boolean {
  const head = html.trim().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}
