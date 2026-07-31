/**
 * OnlineBrief24 API client.
 * Docs: https://www.onlinebrief24.de/briefe-uebertragen/api
 *
 * Auth model: every request carries {apiKey, apiSecret, mode} in the "auth"
 * object of the JSON body. `mode` is "test" (goes into the OB24 cart, no
 * postage) or "live" (actually printed & mailed).
 */

import crypto from "node:crypto";

const BASE_URL = "https://api.onlinebrief24.de/v1";

type Auth = {
  apiKey: string;
  apiSecret: string;
  mode: "test" | "live";
};

function getAuth(): Auth {
  const apiKey = process.env.OB24_API_KEY?.trim();
  const apiSecret = process.env.OB24_API_SECRET?.trim();
  const mode = (process.env.OB24_MODE?.trim() as "test" | "live") || "test";
  if (!apiKey || !apiSecret) {
    throw new Error("OB24_API_KEY / OB24_API_SECRET are not set on the server");
  }
  return { apiKey, apiSecret, mode };
}

function formatObErrors(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        parts.push(`${k}: ${v.map(String).join("; ")}`);
      } else if (typeof v === "object" && v !== null) {
        parts.push(`${k}: ${formatObErrors(v)}`);
      } else {
        parts.push(`${k}: ${String(v)}`);
      }
    }
    return parts.join(" | ");
  }
  return String(raw);
}

async function call<T = unknown>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth: getAuth(), ...body }),
  });
  const raw = await res.text();
  let json: {
    status?: number;
    message?: unknown;   // kann string ODER object (Field-Errors) sein
    data?: T;
    errors?: unknown;
  } = {};
  try {
    json = JSON.parse(raw);
  } catch {
    // Response ist kein JSON
  }
  if (!res.ok || (json.status && json.status >= 400)) {
    const msg = formatObErrors(json.message);
    const errs = formatObErrors(json.errors);
    const combined = [msg, errs].filter(Boolean).join(" | ") || raw.slice(0, 300);
    console.error(`[ob24] ${path} → HTTP ${res.status}:`, raw.slice(0, 500));
    throw new Error(`OB24 API ${res.status}: ${combined}`);
  }
  return json.data as T;
}

// ─── Balance ────────────────────────────────────────────────────────────
export async function getBalance() {
  return call<{ balance: number; currency: string }>("/balance", {});
}

// ─── Price estimate ─────────────────────────────────────────────────────
export type PriceOptions = {
  color: "1" | "4";           // 1 = B&W, 4 = colour
  mode: "simplex" | "duplex"; // one-sided vs. two-sided print
  shipping: "national" | "international" | "auto";
  pages: number;
};

export async function getPrice(opts: PriceOptions) {
  return call<{ amount: number; vat: number; currency: string }>("/price", {
    letter: {
      specification: {
        color: opts.color,
        mode: opts.mode,
        shipping: opts.shipping,
      },
      pages: opts.pages,
    },
  });
}

// ─── Send a printjob ────────────────────────────────────────────────────
export type SendOptions = {
  pdf: Buffer;                                    // full PDF binary (recipient address inside!)
  color?: "1" | "4" | "bw" | "color";             // bw/color = friendly aliases; fallback env LETTER_COLOR_DEFAULT
  mode?: "simplex" | "duplex";
  shipping?: "national" | "international" | "auto";
};

function resolveColor(c?: SendOptions["color"]): "1" | "4" {
  if (c === "1" || c === "4") return c;
  if (c === "bw") return "1";
  if (c === "color") return "4";
  const env = (process.env.LETTER_COLOR_DEFAULT || "bw").toLowerCase();
  return env === "color" ? "4" : "1";
}

export type SendResult = {
  id: number;                        // OB24 printjob id
  status: string;                    // "queue" | "hold" | "done" | ...
  items?: Array<{
    address?: string;
    pages: number;
    amount: number;
    vat: number;
    tracking_code?: string;
  }>;
};

export async function sendPrintjob(opts: SendOptions): Promise<SendResult> {
  const base64_file = opts.pdf.toString("base64");
  const base64_file_checksum = crypto.createHash("md5").update(base64_file).digest("hex");

  return call<SendResult>("/printjobs", {
    letter: {
      base64_file,
      base64_file_checksum,
      specification: {
        color: resolveColor(opts.color),
        mode: opts.mode ?? "simplex",
        // "national" statt "auto" — auto liest die Adresse aus dem PDF und kann
        // fehlschlagen wenn OB24 sie nicht sauber parsen kann. national ist der
        // Regelfall bei uns (Deutschland → Deutschland).
        shipping: opts.shipping ?? "national",
      },
    },
  });
}

// ─── Job status polling ─────────────────────────────────────────────────
export async function getJobStatus(jobId: number) {
  return call<SendResult>(`/printjobs/${jobId}`, {});
}

export function currentMode(): "test" | "live" {
  return getAuth().mode;
}
