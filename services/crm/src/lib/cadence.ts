// Cadence primitives — trigger evaluation, send-windows, variant picks.
// Shared between /api/send (cron) and the campaign detail UI.

export type SendWindow = {
  days: number[];                // 0=Sun..6=Sat; empty = every weekday allowed
  mode: "exact" | "spread";      // exact = fire at `from`; spread = per-contact random in [from, to]
  from: string;                  // "HH:MM"
  to: string;                    // "HH:MM"  (== from when mode="exact")
};

type LegacySlot = { from: string; to: string };
type LegacyWindow = { days?: number[]; slots?: LegacySlot[] };

// Parses both the new shape and the legacy {days, slots[]} shape. Legacy is
// interpreted as: first slot from/to → spread if from!=to, exact if from==to.
export function parseSendWindow(raw: string | null | undefined): SendWindow | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;

  const w = parsed as Partial<SendWindow> & LegacyWindow;
  const days = Array.isArray(w.days) ? w.days.filter((d) => d >= 0 && d <= 6) : [];

  // New shape?
  if (w.mode === "exact" || w.mode === "spread") {
    return {
      days,
      mode: w.mode,
      from: typeof w.from === "string" ? w.from : "09:00",
      to:   typeof w.to   === "string" ? w.to   : (typeof w.from === "string" ? w.from : "09:00"),
    };
  }
  // Legacy shape → adopt first slot
  if (Array.isArray(w.slots) && w.slots.length > 0) {
    const s = w.slots[0];
    const from = typeof s.from === "string" ? s.from : "09:00";
    const to   = typeof s.to   === "string" ? s.to   : from;
    return {
      days,
      mode: from === to ? "exact" : "spread",
      from,
      to,
    };
  }
  // days only → treat as "any time on those days"
  if (days.length > 0) {
    return { days, mode: "spread", from: "00:00", to: "23:59" };
  }
  return null;
}

export function stringifySendWindow(w: SendWindow | null): string | null {
  if (!w) return null;
  // "empty" window (all defaults) → null
  if (
    w.days.length === 0 &&
    w.mode === "spread" &&
    w.from === "00:00" &&
    w.to === "23:59"
  ) return null;
  return JSON.stringify(w);
}

// ────────────────────────────────────────────────────────────────────────
// Per-contact deterministic minute offset — used by "spread" mode so the
// same contact always fires at the same minute-of-day, but different
// contacts spread across the window (handwritten-look).
// ────────────────────────────────────────────────────────────────────────
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Fire time (minutes-of-day) for a contact under this window on the given day.
// Deterministic per (contactId, from, to) so re-runs of the cron always
// resolve to the same target minute for the same contact.
function fireMinuteOfDay(window: SendWindow, contactId: string): number {
  const from = hhmmToMinutes(window.from);
  const to   = hhmmToMinutes(window.to);
  if (window.mode === "exact") return from;
  const range = Math.max(0, to - from);
  if (range === 0) return from;
  const h = hashSeed(`${contactId}|${window.from}|${window.to}`);
  return from + (h % (range + 1));
}

// Given the earliest moment this step could fire (`activation` — after all
// delay/absolute-schedule constraints have been met), figure out the ACTUAL
// per-contact fire time under this window. Returns activation itself when
// no window is set. Never returns a time earlier than activation.
export function contactFireTime(
  activation: Date,
  window: SendWindow | null,
  contactId: string,
): Date {
  if (!window) return activation;

  // Days constraint — walk forward up to 14 days to find the next allowed weekday.
  const allowedDays = window.days.length > 0 ? window.days : [0, 1, 2, 3, 4, 5, 6];

  for (let offset = 0; offset < 14; offset++) {
    const day = new Date(activation);
    day.setDate(day.getDate() + offset);
    if (!allowedDays.includes(day.getDay())) continue;

    const fireMin = fireMinuteOfDay(window, contactId);
    const fire = new Date(day);
    fire.setHours(Math.floor(fireMin / 60), fireMin % 60, 0, 0);

    // If we're on the activation day and the fire minute already passed → still fire
    // today (the cron ran late) as long as we're not past the day's `to`. Actually
    // simpler: if fire < activation, we've missed today's window — move to next
    // allowed day.
    if (fire < activation) continue;
    return fire;
  }
  // No allowed weekday within 14 days (means days is empty subset, unreachable)
  return activation;
}

// Simple boolean: is `now` at or past the contact's fire time?
export function readyForContact(
  now: Date,
  activation: Date,
  window: SendWindow | null,
  contactId: string,
): boolean {
  const fire = contactFireTime(activation, window, contactId);
  return now >= fire;
}

// Kept for backward-compat with older call sites — checks only day + window,
// without the per-contact spread offset. New code should prefer readyForContact.
export function isInSendWindow(now: Date, window: SendWindow | null): boolean {
  if (!window) return true;
  if (window.days.length > 0 && !window.days.includes(now.getDay())) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const fromMin = hhmmToMinutes(window.from);
  const toMin = hhmmToMinutes(window.to);
  return nowMin >= fromMin && nowMin <= toMin;
}

// Compute the target activation time for a given step + contact.
// For step 0: base = campaign.scheduledAt || campaign.createdAt
// For step N>0: base = campaignContact.lastStepAt (previous execution)
// Then apply delayDays (relative) or scheduledAt (absolute).
export function stepTargetTime(args: {
  triggerType: string;
  delayDays: number;
  scheduledAt: Date | null;
  baseTime: Date;
}): Date {
  if (args.triggerType === "absolute" && args.scheduledAt) {
    return args.scheduledAt;
  }
  const t = new Date(args.baseTime);
  t.setDate(t.getDate() + (args.delayDays ?? 0));
  return t;
}

// Deterministic-ish A/B pick based on contact id — same contact always
// gets same variant per step. Falls back to "A" if no B configured.
export function pickVariant(hasB: boolean, splitRatio: number | null | undefined, seed: string): "A" | "B" {
  if (!hasB) return "A";
  const ratio = splitRatio == null ? 50 : Math.max(0, Math.min(100, splitRatio));
  const h = hashSeed(seed);
  return h % 100 < ratio ? "A" : "B";
}

export function stepChannelLabel(channel: string): string {
  return channel === "email" ? "E-Mail" : channel === "letter" ? "Brief" : channel === "call" ? "Anruf" : channel;
}

// Human-readable summary of a window for UI badges.
export function describeSendWindow(window: SendWindow | null): string {
  if (!window) return "jederzeit";
  const dayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const days = window.days.length === 0
    ? "jeden Tag"
    : window.days.map((d) => dayLabels[d]).join("/");
  if (window.mode === "exact") return `${days} um ${window.from}`;
  return `${days} zwischen ${window.from}–${window.to} (verteilt)`;
}
