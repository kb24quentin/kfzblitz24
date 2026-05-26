/**
 * Refund-Policy (D-007 final aus DECISIONS_REPLY.md).
 *
 * Auto-Refund-Trigger nur wenn ALLE Bedingungen erfüllt:
 *   1. Alle Items haben verdict = "green"
 *   2. amount_eur <= AUTO_REFUND_MAX_EUR
 *
 * Bei Verletzung → Admin-Queue (manueller Refund-Trigger im RMA-Dashboard).
 *
 * Wird genutzt vom Refund-Decision-Workflow im Admin-Dashboard
 * (wenn der gebaut wird) um zu entscheiden ob der Webhook automatisch
 * gefired wird oder ob's in die Manual-Review-Queue geht.
 */

/** Maximale Refund-Summe für Auto-Refund. Höher → Admin-Queue. */
export const AUTO_REFUND_MAX_EUR = 500;

export interface AutoRefundEligibilityResult {
  eligible: boolean;
  reason: null | "amount_exceeds_cap" | "non_green_items" | "case_already_terminal";
  blockedItemIds: string[];
  amountEur: number;
  capEur: number;
}

interface ItemForCheck {
  id: string;
  verdict: string | null;
}

export function checkAutoRefundEligibility(
  amountEur: number,
  items: ItemForCheck[],
): AutoRefundEligibilityResult {
  // Verdict-Check: alle green
  const nonGreen = items.filter((it) => it.verdict !== "green");
  if (nonGreen.length > 0) {
    return {
      eligible: false,
      reason: "non_green_items",
      blockedItemIds: nonGreen.map((it) => it.id),
      amountEur,
      capEur: AUTO_REFUND_MAX_EUR,
    };
  }

  // Cap-Check
  if (amountEur > AUTO_REFUND_MAX_EUR) {
    return {
      eligible: false,
      reason: "amount_exceeds_cap",
      blockedItemIds: [],
      amountEur,
      capEur: AUTO_REFUND_MAX_EUR,
    };
  }

  return {
    eligible: true,
    reason: null,
    blockedItemIds: [],
    amountEur,
    capEur: AUTO_REFUND_MAX_EUR,
  };
}
