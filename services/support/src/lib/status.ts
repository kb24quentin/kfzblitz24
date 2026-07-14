export const TICKET_STATUSES = [
  "open",
  "pending",
  "on_hold",
  "resolved",
  "closed",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  pending: "Warten auf Kunde",
  on_hold: "Pausiert",
  resolved: "Gelöst",
  closed: "Geschlossen",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};

export const PRIORITY_CLASSES: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-info/10 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-danger/15 text-danger",
};

/** Statuses considered "done" — hidden from the main ticket list, shown in archive */
export const TERMINAL_STATUSES: readonly TicketStatus[] = ["resolved", "closed"];

/**
 * Reopen-on-customer-reply: everything reopens EXCEPT `closed`.
 * - `resolved` → open (customer wants more help)
 * - `pending` (warten auf kunde) → open (customer answered!)
 * - `on_hold` → open (customer input unblocks)
 * - `open` → stays open (no-op)
 * - `closed` → stays closed (explicit final state, no auto-reopen)
 */
export function shouldReopenOnCustomerReply(status: string): boolean {
  return status !== "closed";
}
