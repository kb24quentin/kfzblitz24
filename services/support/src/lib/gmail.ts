import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

let _oauth: OAuth2Client | null = null;
let _client: gmail_v1.Gmail | null = null;

function getOAuth(): OAuth2Client {
  if (_oauth) return _oauth;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN not configured");
  }
  const client = new google.auth.OAuth2({ clientId, clientSecret });
  client.setCredentials({ refresh_token: refreshToken, scope: SCOPES.join(" ") });
  _oauth = client;
  return client;
}

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_USER_EMAIL
  );
}

export function gmail(): gmail_v1.Gmail {
  if (_client) return _client;
  _client = google.gmail({ version: "v1", auth: getOAuth() });
  return _client;
}

/**
 * Build a raw RFC822 message body suitable for gmail.users.messages.send or .insert.
 * Handles multipart alternative (HTML + plain text) plus threading headers.
 */
export function buildRawRfc822(opts: {
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  inReplyTo?: string;
  references?: string;
  messageId?: string;
}): string {
  const boundary = `----=_kb24_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  const headers: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeSubject(opts.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (opts.messageId) headers.push(`Message-ID: ${opts.messageId}`);
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.bodyText,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.bodyHtml,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const raw = headers.join("\r\n") + "\r\n\r\n" + body;
  return Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeSubject(subject: string): string {
  // Encode non-ASCII subject as MIME "encoded-word" per RFC 2047.
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7f]/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/**
 * Insert an outbound message we sent via Resend into the Gmail Sent folder so
 * the team can see the whole thread in Gmail. Best-effort, silent-fail-safe.
 */
export async function insertToGmailSent(opts: {
  threadId?: string | null;
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  inReplyTo?: string;
}) {
  if (!isGmailConfigured()) return;
  const raw = buildRawRfc822({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    bodyHtml: opts.bodyHtml,
    bodyText: opts.bodyText,
    inReplyTo: opts.inReplyTo,
    references: opts.inReplyTo,
  });

  await gmail().users.messages.insert({
    userId: "me",
    internalDateSource: "receivedTime",
    requestBody: {
      raw,
      threadId: opts.threadId || undefined,
      labelIds: ["SENT"],
    },
  });
}
