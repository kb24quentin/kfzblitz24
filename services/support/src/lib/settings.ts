import { prisma } from "@/lib/db";

const KEY_FIRST_RESPONSE = "slaFirstResponseHours";
const KEY_RESOLUTION = "slaResolutionHours";
const KEY_AUTO_SEND_CATEGORIES = "autoSendCategories";
const KEY_AUTO_SEND_MIN_CONFIDENCE = "autoSendMinConfidence";
const KEY_AUTO_ACK_ENABLED = "autoAckEnabled";
const KEY_AUTO_ACK_SUBJECT = "autoAckSubject";
const KEY_AUTO_ACK_BODY = "autoAckBody";
const KEY_TICKET_CATEGORIES = "ticketCategories";
const KEY_BUSINESS_HOURS = "businessHours";

export const DEFAULT_CATEGORIES = [
  { key: "shipping", label: "Versand" },
  { key: "returns", label: "Retoure" },
  { key: "invoice", label: "Rechnung" },
  { key: "general", label: "Allgemein" },
  { key: "other", label: "Sonstiges" },
];

export type BusinessDay = {
  active: boolean;
  from: string; // "08:00"
  to: string;   // "18:00"
};
export type BusinessHours = {
  mon: BusinessDay;
  tue: BusinessDay;
  wed: BusinessDay;
  thu: BusinessDay;
  fri: BusinessDay;
  sat: BusinessDay;
  sun: BusinessDay;
  timezone: string;
};

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: { active: true, from: "08:00", to: "18:00" },
  tue: { active: true, from: "08:00", to: "18:00" },
  wed: { active: true, from: "08:00", to: "18:00" },
  thu: { active: true, from: "08:00", to: "18:00" },
  fri: { active: true, from: "08:00", to: "17:00" },
  sat: { active: false, from: "10:00", to: "14:00" },
  sun: { active: false, from: "10:00", to: "14:00" },
  timezone: "Europe/Berlin",
};

const DEFAULT_ACK_SUBJECT = "Ihre Anfrage bei kfzBlitz24 [#{{ticket.code}}]";
const DEFAULT_ACK_BODY = `<p>Guten Tag {{customer.first_name}},</p>
<p>vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und unter der Referenz <strong>#{{ticket.code}}</strong> vorgemerkt.</p>
<p>Sie erhalten innerhalb von {{sla.first_response_hours}} Stunden eine Antwort von unserem Team.</p>
<p style="font-size:12px;color:#8a93a0;margin-top:24px">Wichtig: Bei Antworten bitte den Betreff unverändert lassen — die Referenz <strong>#{{ticket.code}}</strong> hilft uns bei der Zuordnung.</p>
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

export async function saveAutoSendCategories(cats: string[]): Promise<void> {
  await prisma.setting.upsert({
    where: { key: KEY_AUTO_SEND_CATEGORIES },
    create: { key: KEY_AUTO_SEND_CATEGORIES, value: JSON.stringify(cats) },
    update: { value: JSON.stringify(cats) },
  });
}

export async function getAutoSendMinConfidence(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_AUTO_SEND_MIN_CONFIDENCE } });
  if (!s?.value) return 0.9;
  const n = Number(s.value);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.9;
}

export async function saveAutoSendMinConfidence(v: number): Promise<void> {
  const clamped = Math.max(0.5, Math.min(1, v));
  await prisma.setting.upsert({
    where: { key: KEY_AUTO_SEND_MIN_CONFIDENCE },
    create: { key: KEY_AUTO_SEND_MIN_CONFIDENCE, value: String(clamped) },
    update: { value: String(clamped) },
  });
}

export async function getTicketCategories(): Promise<{ key: string; label: string }[]> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_TICKET_CATEGORIES } });
  if (!s?.value) return DEFAULT_CATEGORIES;
  try {
    const arr = JSON.parse(s.value);
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch {}
  return DEFAULT_CATEGORIES;
}

export async function saveTicketCategories(
  cats: { key: string; label: string }[]
): Promise<void> {
  const clean = cats
    .map((c) => ({ key: c.key.trim().toLowerCase(), label: c.label.trim() }))
    .filter((c) => c.key && c.label);
  await prisma.setting.upsert({
    where: { key: KEY_TICKET_CATEGORIES },
    create: { key: KEY_TICKET_CATEGORIES, value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
}

export async function getBusinessHours(): Promise<BusinessHours> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_BUSINESS_HOURS } });
  if (!s?.value) return DEFAULT_BUSINESS_HOURS;
  try {
    const parsed = JSON.parse(s.value);
    return { ...DEFAULT_BUSINESS_HOURS, ...parsed };
  } catch {
    return DEFAULT_BUSINESS_HOURS;
  }
}

export async function saveBusinessHours(bh: BusinessHours): Promise<void> {
  await prisma.setting.upsert({
    where: { key: KEY_BUSINESS_HOURS },
    create: { key: KEY_BUSINESS_HOURS, value: JSON.stringify(bh) },
    update: { value: JSON.stringify(bh) },
  });
}

/**
 * Checks if the given date is within configured business hours.
 * Returns true always if all days are inactive (degenerate config).
 */
export function isWithinBusinessHours(when: Date, bh: BusinessHours): boolean {
  const days: (keyof BusinessHours)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = days[when.getDay()];
  const day = bh[dayKey] as BusinessDay | undefined;
  if (!day || !day.active) return false;
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  const now = `${hh}:${mm}`;
  return now >= day.from && now <= day.to;
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
    ticketCode: string;
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
    "ticket.code": ctx.ticketCode,
    // Legacy alias: old templates referenced {{ticket.number}} back when we
    // used sequential integers. Redirect to the code so customer-facing text
    // stays consistent no matter which variable a template ended up using.
    "ticket.number": ctx.ticketCode,
    "ticket.subject": ctx.ticketSubject,
    "sla.first_response_hours": String(ctx.slaFirstResponseHours),
  };
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => map[key] ?? `{{${key}}}`);
}
