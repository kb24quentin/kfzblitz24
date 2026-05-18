/**
 * Verdict-Berechnung für die Wareneingangs-Prüfung.
 *
 * Inputs:
 *   - employee:        0..100 — Mitarbeiter-Einschätzung (immer da, wenn /assess gelaufen ist)
 *   - aiScores[]:      0..100 — pro Foto ein Score (kann leer sein, wenn keine
 *                                Fotos da oder OpenAI ausgefallen)
 *   - aiConfidences[]: 0..1   — pro Foto die zugehörige Confidence
 *
 * Combined:
 *   - Wenn AI-Scores da: combined = 0.6 * employee + 0.4 * avgAi
 *   - Sonst:             combined = employee
 *
 * Verdict-Schwellen (default): ≥85 green · ≥50 yellow · <50 red.
 * Wenn avg(confidence) < 0.6, sind wir vorsichtiger und schieben die
 * green-Schwelle auf 90 hoch (yellow-Bias bei unsicherem Model-Output).
 */

export type Verdict = "green" | "yellow" | "red";

export interface VerdictResult {
  combined: number;
  verdict: Verdict;
}

export function computeVerdict(
  employee: number,
  aiScores: number[],
  aiConfidences: number[]
): VerdictResult {
  const emp = clampScore(employee);

  const aiVals = aiScores.filter((n) => Number.isFinite(n));
  const confVals = aiConfidences.filter((n) => Number.isFinite(n));

  let combined: number;
  let avgConf = 0;
  if (aiVals.length > 0) {
    const avgAi = avg(aiVals);
    combined = Math.round(0.6 * emp + 0.4 * avgAi);
    avgConf = confVals.length > 0 ? avg(confVals) : 0;
  } else {
    combined = Math.round(emp);
  }
  combined = clampScore(combined);

  // Yellow-Bias bei niedriger AI-Confidence
  const lowConfidence = aiVals.length > 0 && avgConf < 0.6;
  const greenThreshold = lowConfidence ? 90 : 85;

  let verdict: Verdict;
  if (combined >= greenThreshold) verdict = "green";
  else if (combined >= 50) verdict = "yellow";
  else verdict = "red";

  return { combined, verdict };
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const n of arr) s += n;
  return s / arr.length;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
