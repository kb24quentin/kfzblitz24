/**
 * Removes quoted history from customer reply mails so each thread message
 * shows ONLY the customer's new content — like a proper ticket-history view.
 *
 * Handles the common quote patterns produced by mail clients:
 * - Gmail:      <div class="gmail_quote">, <div class="gmail_attr">
 * - Outlook:    <div id="appendonsend">, <hr id="stopSpelling">, <div class="OutlookMessageHeader">, "From: ... Sent: ..."
 * - Apple Mail: <blockquote type="cite">
 * - Thunderbird: <div class="moz-cite-prefix">, <blockquote type="cite">
 * - Generic:    German "Am DD.MM.YYYY um HH:MM schrieb X:" and English "On DD/MM/YYYY, X wrote:"
 *
 * Falls back to leaving the body untouched if no known pattern matches
 * (better to over-include than accidentally strip legitimate content).
 */

const QUOTE_HEADER_PATTERNS: RegExp[] = [
  // Deutsche Zitat-Header
  /Am\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}(\s+um\s+\d{1,2}:\d{2})?\s+schrieb\s+.+?:/i,
  /Am\s+.+?,\s+.+?\s+schrieb\s+.+?:/i,
  /Von:\s.+?[\r\n]+.*Gesendet:\s.+?[\r\n]+.*An:\s/i,
  // English
  /On\s+.+?,\s+.+?\s+wrote:/i,
  /From:\s.+?[\r\n]+.*Sent:\s.+?[\r\n]+.*To:\s/i,
  // Support-System (unser eigenes X-KB24-Ticket-Marker + footer)
  /<!--\s*TICKET-REF:[\w]+\s*-->/i,
];

const QUOTE_CONTAINERS: RegExp[] = [
  // Gmail
  /<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*?<\/div>\s*(?=<\/(?:body|div|html)|$)/gi,
  /<div[^>]*class="[^"]*gmail_attr[^"]*"[^>]*>[\s\S]*/i,
  // Outlook
  /<div[^>]*id="appendonsend"[^>]*>[\s\S]*/i,
  /<hr[^>]*id="stopSpelling"[^>]*>[\s\S]*/i,
  /<div[^>]*class="[^"]*OutlookMessageHeader[^"]*"[^>]*>[\s\S]*/i,
  /<div[^>]*id="divRplyFwdMsg"[^>]*>[\s\S]*/i,
  // Thunderbird / Apple Mail
  /<blockquote[^>]*type=["']cite["'][^>]*>[\s\S]*?<\/blockquote>/gi,
  /<div[^>]*class="[^"]*moz-cite-prefix[^"]*"[^>]*>[\s\S]*/i,
  // Generic quoted block (usually the last blockquote in a reply)
  /<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi,
];

export function stripQuotedHistoryHtml(html: string): string {
  if (!html) return html;
  let cleaned = html;

  // Pass 1: kill known quote containers.
  for (const rx of QUOTE_CONTAINERS) {
    cleaned = cleaned.replace(rx, "");
  }

  // Pass 2: find quote-header patterns in visible text; cut everything AFTER.
  for (const rx of QUOTE_HEADER_PATTERNS) {
    const match = rx.exec(cleaned);
    if (match && match.index !== undefined) {
      // Try to cut at the nearest opening-tag boundary before the match so
      // we don't leave dangling tags. Fallback to raw substring.
      const cutoff = cleaned.lastIndexOf("<", match.index);
      if (cutoff > 0 && cutoff > match.index - 500) {
        cleaned = cleaned.slice(0, cutoff);
      } else {
        cleaned = cleaned.slice(0, match.index);
      }
      break;
    }
  }

  return cleaned.trim();
}

export function stripQuotedHistoryText(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  const cutIdx = lines.findIndex((line) => {
    return QUOTE_HEADER_PATTERNS.some((rx) => rx.test(line));
  });
  if (cutIdx > 0) {
    return lines.slice(0, cutIdx).join("\n").trim();
  }
  // Also cut on classic ">-prefix" quoted blocks (mailtext style)
  const firstQuoteLine = lines.findIndex((line) => /^>\s/.test(line));
  if (firstQuoteLine > 0) {
    // Skip empty lines right before the quote
    let end = firstQuoteLine;
    while (end > 0 && lines[end - 1].trim() === "") end--;
    return lines.slice(0, end).join("\n").trim();
  }
  return text.trim();
}
