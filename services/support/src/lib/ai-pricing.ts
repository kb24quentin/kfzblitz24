/**
 * OpenAI-Preise pro 1M Tokens in USD (Stand 2026).
 * Cached-input-Rabatt: nur input-tokens die aus dem Prompt-Cache kommen.
 * Fällt ein unbekanntes Modell rein, nehmen wir gpt-4o als Fallback und loggen.
 */

export type ModelPricing = {
  input: number; // USD per 1M input tokens
  cachedInput: number; // USD per 1M cached input tokens
  output: number; // USD per 1M output tokens
};

const PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { input: 2.5, output: 10.0, cachedInput: 1.25 },
  "gpt-4o-2024-11-20": { input: 2.5, output: 10.0, cachedInput: 1.25 },
  "gpt-4o-2024-08-06": { input: 2.5, output: 10.0, cachedInput: 1.25 },
  "gpt-4o-2024-05-13": { input: 5.0, output: 15.0, cachedInput: 2.5 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cachedInput: 0.075 },
  "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.6, cachedInput: 0.075 },
  "gpt-4-turbo": { input: 10.0, output: 30.0, cachedInput: 5.0 },
  "gpt-4-turbo-2024-04-09": { input: 10.0, output: 30.0, cachedInput: 5.0 },
  "gpt-4": { input: 30.0, output: 60.0, cachedInput: 15.0 },
  "o1": { input: 15.0, output: 60.0, cachedInput: 7.5 },
  "o1-mini": { input: 3.0, output: 12.0, cachedInput: 1.5 },
};

const FALLBACK: ModelPricing = { input: 2.5, output: 10.0, cachedInput: 1.25 };

export function getPricing(model: string): ModelPricing {
  if (PRICING[model]) return PRICING[model];
  const stripped = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (PRICING[stripped]) return PRICING[stripped];
  return FALLBACK;
}

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens = 0,
): { inputCostUsd: number; outputCostUsd: number; totalCostUsd: number } {
  const p = getPricing(model);
  const uncachedInput = Math.max(0, promptTokens - cachedTokens);
  const inputCostUsd =
    (uncachedInput / 1_000_000) * p.input + (cachedTokens / 1_000_000) * p.cachedInput;
  const outputCostUsd = (completionTokens / 1_000_000) * p.output;
  const totalCostUsd = inputCostUsd + outputCostUsd;
  return { inputCostUsd, outputCostUsd, totalCostUsd };
}

export function knownModels(): string[] {
  return Object.keys(PRICING);
}
