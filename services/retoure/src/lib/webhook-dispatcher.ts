/**
 * Webhook-Dispatcher — feuert Events an Shop-Plugin.
 *
 * **Architektur:**
 * - `enqueueWebhook()` ist die einzige Public-API zum Fire-Event.
 *   Sie sucht den aktiven Endpoint für `source`, legt eine `WebhookDelivery`-
 *   Row an und triggert sofort einen ersten Delivery-Versuch (best-effort,
 *   non-blocking).
 * - `processDelivery()` macht den eigentlichen HTTP-POST mit HMAC-Signatur.
 * - `runDeliveryQueue()` ist der Cron-Job-Entry der pending+overdue Rows
 *   regelmäßig abarbeitet (siehe /api/cron/webhook-queue).
 *
 * **HMAC:** SHA-256 über `<timestamp>.<rawBody>`, Header
 * `X-KB24-Signature: sha256=<hex>`. Anti-Replay via Timestamp, Idempotency
 * via Delivery-UUID.
 *
 * **Retry-Schedule:** 1m, 5m, 30m, 3h, 24h. Nach 5 Failures → hard_failed.
 */
import { createHmac, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import type { WebhookEndpoint, WebhookDelivery } from "@prisma/client";

// Backoff in Sekunden ab `lastAttemptAt`
const RETRY_DELAYS_SEC = [60, 300, 1800, 10800, 86400];
const MAX_RETRIES = RETRY_DELAYS_SEC.length;
const DELIVERY_TIMEOUT_MS = 30_000;

export type WebhookEvent =
  | "status_changed"
  | "refund_decided"
  | "case_canceled";

export interface EnqueueOptions {
  source: string;
  event: WebhookEvent;
  caseId: string | null;
  /** Wird als Payload-JSON gespeichert + bei Retries 1:1 wieder geschickt. */
  payload: Record<string, unknown>;
}

/**
 * Legt eine neue WebhookDelivery-Row an + triggert einen sofortigen
 * Delivery-Versuch im Hintergrund (fire-and-forget).
 *
 * Wenn kein aktiver Endpoint für die Source konfiguriert ist (z. B.
 * Marketplace-Sources), ist das ein no-op.
 */
export async function enqueueWebhook(opts: EnqueueOptions): Promise<WebhookDelivery | null> {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { source: opts.source, active: true },
  });
  if (!endpoint) return null;

  // Event-Filter prüfen
  const enabledEvents = endpoint.events.split(",").map((s) => s.trim());
  if (!enabledEvents.includes(opts.event)) return null;

  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      deliveryUuid: randomUUID(),
      caseId: opts.caseId,
      event: opts.event,
      payload: JSON.stringify(opts.payload),
      status: "pending",
      scheduledAt: new Date(),
    },
  });

  // Fire-and-forget — wenn der Versuch failed, holt der Cron-Job ihn ein.
  // void: wir warten nicht.
  void processDelivery(delivery.id).catch((err) => {
    console.error("[webhook-dispatcher] processDelivery failed:", err);
  });

  return delivery;
}

/**
 * Macht den eigentlichen HTTP-POST + HMAC-Sign. Updated die DB-Row.
 * Wird sowohl direkt nach `enqueueWebhook` als auch vom Cron-Worker
 * aufgerufen.
 *
 * Idempotent gegen mehrfache Aufrufe für die gleiche Row (aber: kein
 * Cluster-safe Lock — Cron sollte Single-Instance laufen).
 */
export async function processDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery) return;
  if (delivery.status === "ok" || delivery.status === "hard_failed" || delivery.status === "canceled") {
    return; // schon terminal
  }

  const timestamp = Date.now().toString();
  const body = delivery.payload;
  const signature = signPayload(delivery.endpoint.secret, timestamp, body);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "kfzBlitz24-Retoure-Webhook/1.0",
    "X-KB24-Event": delivery.event,
    "X-KB24-Signature": signature,
    "X-KB24-Timestamp": timestamp,
    "X-KB24-Delivery": delivery.deliveryUuid,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;

  try {
    const resp = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    responseCode = resp.status;
    responseBody = await resp.text();
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeoutId);
  }

  const success = responseCode !== null && responseCode >= 200 && responseCode < 300;

  if (success) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "ok",
        lastAttemptAt: new Date(),
        lastResponseCode: responseCode,
        lastResponseBody: responseBody?.slice(0, 2000) ?? null,
        ackBody: responseBody?.slice(0, 2000) ?? null,
        nextRetryAt: null,
      },
    });
    return;
  }

  // Failure-Handling
  const newRetryCount = delivery.retryCount + 1;
  const hardFailed = newRetryCount >= MAX_RETRIES;
  const nextRetryAt = hardFailed
    ? null
    : new Date(Date.now() + RETRY_DELAYS_SEC[newRetryCount - 1] * 1000);

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: hardFailed ? "hard_failed" : "failed",
      retryCount: newRetryCount,
      lastAttemptAt: new Date(),
      lastResponseCode: responseCode,
      lastResponseBody: (responseBody ?? errorMessage)?.slice(0, 2000) ?? null,
      nextRetryAt,
    },
  });

  if (hardFailed) {
    console.warn(
      `[webhook-dispatcher] HARD FAIL delivery=${delivery.id} event=${delivery.event} ` +
        `case=${delivery.caseId} after ${MAX_RETRIES} attempts`,
    );
    // TODO: Admin-Mail-Alert
  }
}

/**
 * Cron-Worker-Entry: holt alle pending+overdue Rows und schickt sie nochmal.
 */
export async function runDeliveryQueue(opts: { limit?: number } = {}): Promise<{
  processed: number;
  ok: number;
  failed: number;
  hardFailed: number;
}> {
  const now = new Date();
  const dueRows = await prisma.webhookDelivery.findMany({
    where: {
      OR: [
        { status: "pending" },
        { status: "failed", nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    take: opts.limit ?? 50,
  });

  let ok = 0;
  let failed = 0;
  let hardFailed = 0;

  for (const row of dueRows) {
    await processDelivery(row.id);
    const reloaded = await prisma.webhookDelivery.findUnique({
      where: { id: row.id },
      select: { status: true },
    });
    if (reloaded?.status === "ok") ok++;
    else if (reloaded?.status === "hard_failed") hardFailed++;
    else failed++;
  }

  return { processed: dueRows.length, ok, failed, hardFailed };
}

/**
 * HMAC-SHA256 Signatur über `<timestamp>.<rawBody>`.
 * Format: `sha256=<hex>`.
 */
export function signPayload(secret: string, timestamp: string, body: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${body}`);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Manueller Replay aus dem Admin-Dashboard.
 * Setzt eine hard_failed-Row zurück auf pending damit der Cron sie
 * nochmal probiert.
 */
export async function replayDelivery(deliveryId: string): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      lastAttemptAt: null,
    },
  });
  void processDelivery(deliveryId).catch((err) => {
    console.error("[webhook-dispatcher] replayDelivery failed:", err);
  });
}
