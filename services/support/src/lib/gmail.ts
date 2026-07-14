import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

const SETTING_KEY_REFRESH_TOKEN = "gmailRefreshToken";
const SETTING_KEY_USER_EMAIL = "gmailUserEmail";

let _client: gmail_v1.Gmail | null = null;
let _cachedRefreshToken: string | null = null;

function getClientId(): string | null {
  return process.env.GMAIL_CLIENT_ID?.trim() || null;
}

function getClientSecret(): string | null {
  return process.env.GMAIL_CLIENT_SECRET?.trim() || null;
}

export function getRedirectUri(): string {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/gmail/callback`;
}

async function loadRefreshToken(): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key: SETTING_KEY_REFRESH_TOKEN } });
  if (s?.value) return s.value;
  return process.env.GMAIL_REFRESH_TOKEN?.trim() || null;
}

export async function getGmailUserEmail(): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key: SETTING_KEY_USER_EMAIL } });
  if (s?.value) return s.value;
  return process.env.GMAIL_USER_EMAIL?.trim() || null;
}

async function buildOAuth(): Promise<OAuth2Client> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const refreshToken = await loadRefreshToken();
  if (!clientId || !clientSecret) throw new Error("GMAIL_CLIENT_ID/SECRET missing (env)");
  if (!refreshToken) throw new Error("Gmail refresh token missing — connect via /settings");

  const client = new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri: getRedirectUri(),
  });
  client.setCredentials({ refresh_token: refreshToken, scope: SCOPES.join(" ") });
  return client;
}

export async function isGmailConfigured(): Promise<boolean> {
  if (!getClientId() || !getClientSecret()) return false;
  const rt = await loadRefreshToken();
  return !!rt;
}

/** Sync check that only requires the OAuth app credentials to be present. */
export function hasOAuthApp(): boolean {
  return !!(getClientId() && getClientSecret());
}

/** Async wrapper: full Gmail readiness (app creds + refresh token). */
export async function gmail(): Promise<gmail_v1.Gmail> {
  if (_client) {
    const currentRt = await loadRefreshToken();
    if (currentRt === _cachedRefreshToken) return _client;
    _client = null;
  }
  const auth = await buildOAuth();
  _cachedRefreshToken = auth.credentials.refresh_token as string | null;
  _client = google.gmail({ version: "v1", auth });
  return _client;
}

export function buildAuthUrl(state: string): string {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID/SECRET not set in env — cannot start OAuth flow");
  }
  const client = new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri: getRedirectUri(),
  });
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures refresh_token comes back every time
    scope: SCOPES,
    state,
  });
}

/**
 * Exchange OAuth authorization code for tokens and store the refresh_token
 * in the Setting table. Also captures the authenticated user's email address
 * via the userinfo endpoint (via gmail.users.getProfile).
 */
export async function exchangeCodeAndStore(code: string): Promise<{
  email: string;
  hadRefreshToken: boolean;
}> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) throw new Error("GMAIL_CLIENT_ID/SECRET missing");

  const client = new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri: getRedirectUri(),
  });
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh_token. Revoke prior access at myaccount.google.com/permissions and try again."
    );
  }
  client.setCredentials(tokens);
  const g = google.gmail({ version: "v1", auth: client });
  const profile = await g.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress || "unknown";

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SETTING_KEY_REFRESH_TOKEN },
      create: { key: SETTING_KEY_REFRESH_TOKEN, value: tokens.refresh_token },
      update: { value: tokens.refresh_token },
    }),
    prisma.setting.upsert({
      where: { key: SETTING_KEY_USER_EMAIL },
      create: { key: SETTING_KEY_USER_EMAIL, value: email },
      update: { value: email },
    }),
  ]);

  // Force refresh on next gmail() call
  _client = null;
  _cachedRefreshToken = null;

  return { email, hadRefreshToken: !!tokens.refresh_token };
}

export async function disconnectGmail(): Promise<void> {
  await prisma.setting.deleteMany({
    where: { key: { in: [SETTING_KEY_REFRESH_TOKEN, SETTING_KEY_USER_EMAIL] } },
  });
  _client = null;
  _cachedRefreshToken = null;
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
  if (!(await isGmailConfigured())) return;
  const raw = buildRawRfc822({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    bodyHtml: opts.bodyHtml,
    bodyText: opts.bodyText,
    inReplyTo: opts.inReplyTo,
    references: opts.inReplyTo,
  });

  const g = await gmail();
  await g.users.messages.insert({
    userId: "me",
    internalDateSource: "receivedTime",
    requestBody: {
      raw,
      threadId: opts.threadId || undefined,
      labelIds: ["SENT"],
    },
  });
}
