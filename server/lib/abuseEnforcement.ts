/**
 * Phase 15: Abuse enforcement foundation – soft warning, temporary block hook, escalation placeholder.
 * Based on existing fraud_signals; no UI change.
 */

import { getFraudSignalsForUser, getUsersWithFraudSignalsSince, recordFraudSignal } from "../db";
import { logger } from "../_core/logger";

const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SOFT_WARN_MIN_SIGNALS = 1;
const TEMP_BLOCK_MIN_SIGNALS = 5;
const TEMP_BLOCK_HIGH_SEVERITY_COUNT = 2;
const ESCALATION_SIGNAL_TYPE = "escalation_requested";

/** User IDs that have at least one fraud signal in the review window (for admin review queue). */
export async function getReviewFlaggedUserIds(sinceMs = REVIEW_WINDOW_MS): Promise<number[]> {
  return getUsersWithFraudSignalsSince(sinceMs);
}

/** Whether to show a soft warning (e.g. "account under review") – has any signal in window. */
export async function shouldSoftWarn(userId: number, sinceMs = REVIEW_WINDOW_MS): Promise<boolean> {
  const signals = await getFraudSignalsForUser(userId, { sinceMs, limit: 1 });
  return signals.length >= SOFT_WARN_MIN_SIGNALS;
}

/** Hook: whether to apply temporary block (e.g. deny submissions). Threshold: many signals or multiple high-severity. */
export async function shouldTempBlock(userId: number, sinceMs = REVIEW_WINDOW_MS): Promise<boolean> {
  const signals = await getFraudSignalsForUser(userId, { sinceMs, limit: 100 });
  if (signals.length >= TEMP_BLOCK_MIN_SIGNALS) return true;
  const highCount = signals.filter((s) => s.severity === "high").length;
  return highCount >= TEMP_BLOCK_HIGH_SEVERITY_COUNT;
}

/** Escalation path placeholder – records a signal for manual review; call when admin escalates. */
export async function escalateForReview(userId: number, reason: string, payload?: Record<string, unknown>): Promise<void> {
  try {
    await recordFraudSignal({
      userId,
      signalType: ESCALATION_SIGNAL_TYPE,
      payload: { reason, ...payload },
      severity: "high",
    });
    logger.info("Abuse escalation recorded", { userId, reason });
  } catch (err) {
    logger.warn("Abuse escalation record failed", { userId, error: err instanceof Error ? err.message : String(err) });
  }
}
