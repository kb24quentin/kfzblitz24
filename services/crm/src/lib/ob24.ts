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

async function call<T = unknown>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth: getAuth(), ...body }),
  });
  const json = (await res.json()) as {
    status: number;
    message: string;
    data?: T;
    errors?: unknown;
  };
  if (!res.ok || json.status >= 400) {
    const err = json.message || JSON.stringify(json.errors ?? json);
    throw new Error(`OB24 API ${res.status}: ${err}`);
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
    specification: {
      color: opts.color,
      mode: opts.mode,
      shipping: opts.shipping,
    },
    pages: opts.pages,
  });
}

// ─── Send a printjob ────────────────────────────────────────────────────
export type SendOptions = {
  pdf: Buffer;                       // full PDF binary (recipient address inside!)
  color?: "1" | "4";
  mode?: "simplex" | "duplex";
  shipping?: "national" | "international" | "auto";
};

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
    base64_file,
    base64_file_checksum,
    specification: {
      color: opts.color ?? "1",
      mode: opts.mode ?? "simplex",
      shipping: opts.shipping ?? "auto",
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
