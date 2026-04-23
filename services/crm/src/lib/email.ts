/**
 * Builds an RFC-5322 sender address from FROM_NAME + FROM_EMAIL.
 * Quotes the name so display strings containing -, , or other tokens are safe.
 *
 *   FROM_NAME="Corinna Wagner - kfzBlitz24"
 *   FROM_EMAIL=corinna.wagner@kfzblitz24-group.com
 *   → '"Corinna Wagner - kfzBlitz24" <corinna.wagner@kfzblitz24-group.com>'
 */
export function getFromAddress(): string {
  const name = process.env.FROM_NAME?.trim();
  const email = process.env.FROM_EMAIL?.trim() || "noreply@kfzblitz24-group.com";
  if (!name) return email;
  const safeName = name.replace(/"/g, "");
  return `"${safeName}" <${email}>`;
}

/**
 * Wraps a TipTap-produced HTML body with our standard mail container styling.
 * The editor already emits sanitized HTML (no <script>, etc) so we don't
 * re-escape here.
 */
export function wrapEmailHtml(html: string): string {
  return `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;font-size:14px">${html}</div>`;
}

/**
 * Best-effort plain-text fallback for the multipart text/plain part of an
 * email. Strips HTML tags and collapses runs of whitespace; preserves
 * paragraph breaks by mapping <br> and </p> to newlines first.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
