import { prisma } from "@/lib/db";

const KEY_FIRST_RESPONSE = "slaFirstResponseHours";
const KEY_RESOLUTION = "slaResolutionHours";
const KEY_AUTO_SEND_CATEGORIES = "autoSendCategories";
const KEY_AUTO_ACK_ENABLED = "autoAckEnabled";
const KEY_AUTO_ACK_SUBJECT = "autoAckSubject";
const KEY_AUTO_ACK_BODY = "autoAckBody";

const DEFAULT_ACK_SUBJECT = "Ihre Anfrage bei kfzBlitz24 (Ticket #{{ticket.number}})";
const DEFAULT_ACK_BODY = `<p>Guten Tag {{customer.first_name}},</p>
<p>vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und uns unter der Ticket-Nummer <strong>#{{ticket.number}}</strong> vorgemerkt.</p>
<p>Sie erhalten innerhalb von {{sla.first_response_hours}} Stunden eine Antwort von unserem Team.</p>
<p>Mit freundlichen Grüßen<br>Ihr kfzBlitz24 Support</p>`;

function parseHoursOrDefault(raw: string | undefined | null, def: number): number {
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export async function getSlaFirstResponseHours(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_FIRST_RESPONSE } });
  return parseHoursOrDefault(s?.value, parseHoursOrDefault(process.env.SLA_HOURS, 24));
}

export async function getSlaResolutionHours(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_RESOLUTION } });
  return parseHoursOrDefault(
    s?.value,
    parseHoursOrDefault(process.env.SLA_RESOLUTION_HOURS, 72)
  );
}

export async function saveSlaHours(input: {
  firstResponseHours: number;
  resolutionHours: number;
}): Promise<void> {
  const first = Math.max(1, Math.round(input.firstResponseHours));
  const res = Math.max(1, Math.round(input.resolutionHours));
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: KEY_FIRST_RESPONSE },
      create: { key: KEY_FIRST_RESPONSE, value: String(first) },
      update: { value: String(first) },
    }),
    prisma.setting.upsert({
      where: { key: KEY_RESOLUTION },
      create: { key: KEY_RESOLUTION, value: String(res) },
      update: { value: String(res) },
    }),
  ]);
}

export async function getAutoSendCategories(): Promise<Set<string>> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_AUTO_SEND_CATEGORIES } });
  if (!s?.value) return new Set();
  try {
    const arr = JSON.parse(s.value);
    return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export async function computeSlaDeadlines(createdAt: Date): Promise<{
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
}> {
  const [first, res] = await Promise.all([
    getSlaFirstResponseHours(),
    getSlaResolutionHours(),
  ]);
  return {
    firstResponseDueAt: new Date(createdAt.getTime() + first * 3600_000),
    resolutionDueAt: new Date(createdAt.getTime() + res * 3600_000),
  };
}

export async function getAutoAckEnabled(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_AUTO_ACK_ENABLED } });
  return s?.value === "true";
}

export async function getAutoAckSubject(): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_AUTO_ACK_SUBJECT } });
  return s?.value?.trim() || DEFAULT_ACK_SUBJECT;
}

export async function getAutoAckBody(): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_AUTO_ACK_BODY } });
  return s?.value?.trim() || DEFAULT_ACK_BODY;
}

export async function saveAutoAckSettings(input: {
  enabled: boolean;
  subject: string;
  body: string;
}): Promise<void> {
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: KEY_AUTO_ACK_ENABLED },
      create: { key: KEY_AUTO_ACK_ENABLED, value: input.enabled ? "true" : "false" },
      update: { value: input.enabled ? "true" : "false" },
    }),
    prisma.setting.upsert({
      where: { key: KEY_AUTO_ACK_SUBJECT },
      create: { key: KEY_AUTO_ACK_SUBJECT, value: input.subject },
      update: { value: input.subject },
    }),
    prisma.setting.upsert({
      where: { key: KEY_AUTO_ACK_BODY },
      create: { key: KEY_AUTO_ACK_BODY, value: input.body },
      update: { value: input.body },
    }),
  ]);
}

/** Substitutes template variables like {{customer.first_name}} against ticket+contact+sla data. */
export function substituteAckVariables(
  template: string,
  ctx: {
    ticketNumber: number;
    ticketSubject: string;
    contact: {
      firstName: string | null;
      lastName: string | null;
      name: string | null;
      email: string;
      phone: string | null;
    };
    slaFirstResponseHours: number;
  }
): string {
  const first = ctx.contact.firstName || ctx.contact.name?.split(" ")[0] || "";
  const last =
    ctx.contact.lastName || (ctx.contact.name ? ctx.contact.name.split(" ").slice(1).join(" ") : "") || "";
  const map: Record<string, string> = {
    "customer.first_name": first,
    "customer.last_name": last,
    "customer.name": [first, last].filter(Boolean).join(" ") || ctx.contact.name || "",
    "customer.email": ctx.contact.email,
    "customer.phone": ctx.contact.phone || "",
    "ticket.number": String(ctx.ticketNumber),
    "ticket.subject": ctx.ticketSubject,
    "sla.first_response_hours": String(ctx.slaFirstResponseHours),
  };
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => map[key] ?? `{{${key}}}`);
}
