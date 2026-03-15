/**
 * Phase 12: Notification delivery worker – polling queue, retry logic, failure handling.
 * No actual email/sms sending; structure only. A cron or long-running process can call runDeliveryCycle().
 */

import { getPendingForDelivery } from "./queue";
import { updateNotificationDeliveryStatus } from "../db";
import { logger } from "../_core/logger";
import { incrementNotificationSuccess, incrementNotificationFailure } from "../_core/metrics";

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5000;

export type DeliveryResult = "delivered" | "failed" | "skipped";

/** Stub: deliver one notification. Replace with real email/sms provider. Returns delivered | failed. */
async function deliverOne(_notification: {
  id: number;
  channel: string;
  type: string;
  title: string | null;
  body: string | null;
  recipientType: string;
  recipientId: number | null;
}): Promise<DeliveryResult> {
  await Promise.resolve();
  logger.debug?.("Notification worker: deliver stub (no provider)", { id: _notification.id, channel: _notification.channel });
  return "delivered";
}

/** Run one delivery cycle: fetch pending, attempt delivery with retries, mark delivered or failed. */
export async function runDeliveryCycle(limit = 50): Promise<{ processed: number; delivered: number; failed: number }> {
  const pending = await getPendingForDelivery(limit);
  let delivered = 0;
  let failed = 0;

  for (const n of pending) {
    let lastError: string | null = null;
    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
      try {
        const result = await deliverOne(n);
        if (result === "delivered") {
          await updateNotificationDeliveryStatus(n.id, "delivered", { sentAt: new Date() });
          delivered++;
          success = true;
          incrementNotificationSuccess();
        } else {
          lastError = "delivery_stub_failed";
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn("Notification delivery attempt failed", { notificationId: n.id, attempt, error: lastError });
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        }
      }
    }
    if (!success) {
      await updateNotificationDeliveryStatus(n.id, "failed", { lastError: lastError ?? "unknown" });
      failed++;
      incrementNotificationFailure();
    }
  }

  return { processed: pending.length, delivered, failed };
}

/** Run delivery in a loop with interval (for background worker). Stops when stopSignal is set. */
export function startDeliveryWorker(options: { intervalMs?: number; limitPerCycle?: number; stopSignal?: { stop: boolean } }): () => void {
  const intervalMs = options.intervalMs ?? 30_000;
  const limitPerCycle = options.limitPerCycle ?? 50;
  const stopSignal = options.stopSignal ?? { stop: false };
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const run = async () => {
    if (stopSignal.stop) return;
    try {
      await runDeliveryCycle(limitPerCycle);
    } catch (e) {
      logger.error("Delivery worker cycle error", { error: e instanceof Error ? e.message : String(e) });
    }
    if (!stopSignal.stop) timeoutId = setTimeout(run, intervalMs);
  };

  run();
  return () => {
    stopSignal.stop = true;
    if (timeoutId != null) clearTimeout(timeoutId);
  };
}
