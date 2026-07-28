import { prisma } from "./db";

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "werkstatt";
}

export async function uniqueWorkshopSlug(base: string) {
  let candidate = slugify(base);
  const original = candidate;
  let n = 2;
  while (await prisma.workshop.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${original}-${n++}`;
  }
  return candidate;
}
