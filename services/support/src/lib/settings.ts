import { prisma } from "@/lib/db";

const KEY_FIRST_RESPONSE = "slaFirstResponseHours";
const KEY_RESOLUTION = "slaResolutionHours";
const KEY_AUTO_SEND_CATEGORIES = "autoSendCategories";

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
