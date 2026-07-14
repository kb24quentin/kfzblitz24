export function getFromAddress(): string {
  const name = process.env.FROM_NAME?.trim();
  const email = process.env.FROM_EMAIL?.trim() || "service@kfzblitz24.de";
  if (!name) return email;
  const safeName = name.replace(/"/g, "");
  return `"${safeName}" <${email}>`;
}

export function getReplyToAddress(): string {
  return process.env.REPLY_TO_EMAIL?.trim() || process.env.FROM_EMAIL?.trim() || "service@kfzblitz24.de";
}

export function wrapEmailHtml(html: string): string {
  return `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;font-size:14px">${html}</div>`;
}

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
