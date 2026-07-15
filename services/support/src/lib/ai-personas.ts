import { prisma } from "@/lib/db";
import { renderSignatureHtml } from "@/lib/signature";

export type AiPersonaLite = {
  id: string;
  name: string;
  position: string;
  weight: number;
};

/**
 * Weighted-random pick aus aktiven AI-personas. Weight = relative wahrschein-
 * lichkeit (nicht muss auf 100 summieren). Wenn keine active personas
 * existieren → null (send-flow fällt zurück auf keine signatur bzw. system-
 * default).
 */
export async function pickWeightedAiPersona(): Promise<AiPersonaLite | null> {
  const personas = await prisma.aiPersona.findMany({
    where: { active: true, weight: { gt: 0 } },
    select: { id: true, name: true, position: true, weight: true },
  });
  if (personas.length === 0) return null;
  const total = personas.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return personas[0]; // fallback
  // deterministic-random aus Date.now — vermeidet Math.random() für konsistenz
  // (Date.now() ist "random genug" für persona-verteilung über zeit).
  const roll = Date.now() % total;
  let running = 0;
  for (const p of personas) {
    running += p.weight;
    if (roll < running) return p;
  }
  return personas[personas.length - 1];
}

/** Rendert die branded signatur mit den daten der gepickten AI-persona. */
export function renderAiPersonaSignature(persona: AiPersonaLite): string {
  return renderSignatureHtml({
    displayName: persona.name,
    position: persona.position,
  });
}

export async function listAiPersonas(): Promise<Array<AiPersonaLite & { active: boolean }>> {
  return prisma.aiPersona.findMany({
    orderBy: [{ active: "desc" }, { weight: "desc" }, { name: "asc" }],
    select: { id: true, name: true, position: true, weight: true, active: true },
  });
}
