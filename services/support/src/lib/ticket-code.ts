import { randomInt } from "crypto";
import { prisma } from "@/lib/db";

// Unambiguous charset: no 0/O, no 1/I/L. 32 chars total → 32^6 = 1.07 billion codes.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
// Matches: `#K3M7XZ`, `[#K3M7XZ]`, `#Ticket K3M7XZ`, `TICKET-REF:K3M7XZ` (HTML comment).
// Also allows md5-backfill hex chars (0-9 A-F) so old-format codes still match.
const CODE_REGEX = new RegExp(
  `(?:#(?:Ticket[- ]?)?|TICKET[- ]?REF[- :]?)([${CHARSET}A-F0-9]{${CODE_LEN}})\\b`,
  "i"
);

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CHARSET[randomInt(CHARSET.length)];
  }
  return out;
}

/**
 * Generates a unique ticket code, retrying on collision (extremely rare).
 * Throws after 10 retries which would only happen if the space is nearly full.
 */
export async function generateTicketCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await prisma.ticket.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique ticket code after 10 attempts");
}

/**
 * Extracts a ticket code from any string (subject, body, header).
 * Matches patterns like: `#K3M7XZ`, `[#K3M7XZ]`, `Ticket #K3M7XZ`, `#TICKET-K3M7XZ`.
 * Returns null if no match. Case-insensitive on the marker, normalizes code to uppercase.
 */
export function extractTicketCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.match(CODE_REGEX);
  if (!m) return null;
  return m[1].toUpperCase();
}

/**
 * Appends `[#CODE]` to a subject if not already present. Preserves customer's
 * subject prefix behavior (Re:, Aw:, etc.).
 */
export function ensureCodeInSubject(subject: string, code: string): string {
  if (extractTicketCode(subject) === code) return subject;
  return `${subject.trim()} [#${code}]`;
}
