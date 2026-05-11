/**
 * Email-Heuristik: ist der Kontakt auf einer Firmen-Domain oder einem
 * Freemail-Anbieter? Plus simpler MX-Lookup würde hier später folgen.
 */

const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "gmx.ch",
  "gmx.com",
  "web.de",
  "t-online.de",
  "freenet.de",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.de",
  "live.de",
  "live.com",
  "yahoo.com",
  "yahoo.de",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "aol.de",
  "mail.de",
  "mail.com",
  "posteo.de",
  "posteo.net",
  "tutanota.com",
  "protonmail.com",
  "proton.me",
]);

export type EmailCheck = {
  ok: true;
  valid: boolean;
  domain?: string;
  isFreemail?: boolean;
  isDisposable?: boolean;
};

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "trashmail.com",
  "yopmail.com",
  "tempmail.com",
  "dispostable.com",
]);

export function checkEmail(email: string): EmailCheck {
  const trimmed = (email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { ok: true, valid: false };
  }
  const domain = trimmed.split("@")[1].toLowerCase();
  const isFreemail = FREEMAIL_DOMAINS.has(domain);
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);
  return {
    ok: true,
    valid: true,
    domain,
    isFreemail,
    isDisposable,
  };
}
