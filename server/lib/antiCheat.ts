/**
 * Phase 11: Anti-cheating foundations – device tracking, multi-account signals, suspicious behavior.
 * All data is real; no UI changes.
 */

import {
  recordUserDevice,
  getLinkedUserIdsByDevice,
  recordFraudSignal,
} from "../db";
import { logger } from "../_core/logger";

export type DeviceInput = {
  userId: number;
  deviceId?: string | null;
  fingerprintHash?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** Record or update device/fingerprint for the user. Call on login or critical actions. */
export async function recordDevice(input: DeviceInput): Promise<void> {
  try {
    await recordUserDevice(input);
  } catch (err) {
    logger.warn("Anti-cheat: recordUserDevice failed (non-fatal)", {
      userId: input.userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Get user IDs that share the same device or fingerprint. For multi-account detection. */
export async function getLinkedUserIds(deviceIdOrFingerprint: string): Promise<number[]> {
  if (!deviceIdOrFingerprint?.trim()) return [];
  return getLinkedUserIdsByDevice(deviceIdOrFingerprint.trim());
}

/** Record a suspicious behavior signal. Does not block the user; for review. */
export async function recordSuspiciousBehavior(data: {
  userId?: number | null;
  signalType: string;
  payload?: Record<string, unknown> | null;
  severity?: "low" | "medium" | "high";
}): Promise<void> {
  try {
    await recordFraudSignal(data);
  } catch (err) {
    logger.warn("Anti-cheat: recordFraudSignal failed (non-fatal)", {
      signalType: data.signalType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Flag abnormal score pattern (e.g. same IP multiple top scores). Stub: records a fraud signal for review. */
export async function flagAbnormalScorePattern(data: {
  userId: number;
  tournamentId: number;
  reason: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await recordSuspiciousBehavior({
    userId: data.userId,
    signalType: "abnormal_score_pattern",
    payload: { tournamentId: data.tournamentId, reason: data.reason, ...data.payload },
    severity: "medium",
  });
}

/** Phase 12: Suspicious pattern flags – unified entry for abuse signals (multiple accounts, velocity, etc.). */
export const SUSPICIOUS_PATTERN_TYPES = {
  MULTIPLE_ACCOUNTS_SAME_DEVICE: "multiple_accounts_same_device",
  SAME_DEVICE_MULTIPLE_ACCOUNTS: "same_device_multiple_accounts",
  HIGH_VELOCITY_SUBMISSIONS: "high_velocity_submissions",
  ABNORMAL_SCORE_PATTERN: "abnormal_score_pattern",
  REPEATED_FAILED_LOGIN: "repeated_failed_login",
} as const;

export async function flagSuspiciousPattern(data: {
  signalType: keyof typeof SUSPICIOUS_PATTERN_TYPES | string;
  userId?: number | null;
  payload?: Record<string, unknown> | null;
  severity?: "low" | "medium" | "high";
}): Promise<void> {
  await recordSuspiciousBehavior({
    userId: data.userId ?? null,
    signalType: data.signalType,
    payload: data.payload ?? null,
    severity: data.severity ?? "medium",
  });
}

/** Phase 12: Multiple device correlation placeholder – returns user IDs linked by device/fingerprint for review. */
export async function getLinkedAccountsByDevice(deviceIdOrFingerprint: string): Promise<number[]> {
  return getLinkedUserIds(deviceIdOrFingerprint);
}
