// Cadence primitives — trigger evaluation, send-windows, variant picks.
// Shared between /api/send (cron) and the campaign detail UI.

export type SendSlot = { from: string; to: string }; // "HH:MM"
export type SendWindow = {
  days: number[];     // 0=Sun..6=Sat; empty = every day
  slots: SendSlot[];  // empty = anytime
};

export function parseSendWindow(raw: string | null | undefined): SendWindow | null {
  if (!raw) return null;
  try {
    const w = JSON.parse(raw) as Partial<SendWindow>;
    return {
      days: Array.isArray(w.days) ? w.days.filter((d) => d >= 0 && d <= 6) : [],
      slots: Array.isArray(w.slots)
        ? w.slots.filter((s): s is SendSlot => !!s && typeof s.from === "string" && typeof s.to === "string")
        : [],
    };
  } catch {
    return null;
  }
}

// Is `now` inside the given send-window? Null window = always OK.
export function isInSendWindow(now: Date, window: SendWindow | null): boolean {
  if (!window) return true;
  if (window.days.length > 0 && !window.days.includes(now.getDay())) return false;
  if (window.slots.length === 0) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  return window.slots.some((s) => {
    const [fh, fm] = s.from.split(":").map(Number);
    const [th, tm] = s.to.split(":").map(Number);
    return mins >= fh * 60 + fm && mins <= th * 60 + tm;
  });
}

// When is the next moment >= now that falls inside the window?
// Returns null if window has empty days (unreachable).
export function nextWindowStart(now: Date, window: SendWindow | null): Date | null {
  if (!window) return now;
  if (window.days.length === 0 && window.slots.length === 0) return now;
  const slots = window.slots.length > 0 ? window.slots : [{ from: "00:00", to: "23:59" }];
  const days = window.days.length > 0 ? window.days : [0, 1, 2, 3, 4, 5, 6];

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    if (!days.includes(d.getDay())) continue;
    for (const s of slots) {
      const [fh, fm] = s.from.split(":").map(Number);
      const start = new Date(d);
      start.setHours(fh, fm, 0, 0);
      if (offset === 0 && start < now) {
        // Slot already started; if still within it, return now
        const [th, tm] = s.to.split(":").map(Number);
        const end = new Date(d);
        end.setHours(th, tm, 0, 0);
        if (now <= end) return now;
        continue;
      }
      return start;
    }
  }
  return null;
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
  // Simple hash → 0..99
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 100 < ratio ? "A" : "B";
}

export function stepChannelLabel(channel: string): string {
  return channel === "email" ? "E-Mail" : channel === "letter" ? "Brief" : channel === "call" ? "Anruf" : channel;
}
