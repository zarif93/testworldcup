/**
 * Phase 19: Safe notification creation. Never throws; never fails business logic.
 * For now only internal/in_app channel is used.
 */

import { logger } from "../_core/logger";
import { insertNotification } from "../db";
import type { NotificationType } from "./types";

export type CreateNotificationInput = {
  type: NotificationType | string;
  recipientType: "admin" | "user" | "agent" | "system";
  recipientId?: number | null;
  channel?: "in_app" | "email" | "whatsapp" | "sms" | "internal";
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Create a notification record. Safe: catches errors, logs, and never throws.
 * Call from business flows without affecting their outcome.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const channel = input.channel ?? "in_app";
    const id = await insertNotification({
      recipientType: input.recipientType,
      recipientId: input.recipientId ?? null,
      channel,
      type: input.type,
      title: input.title ?? null,
      body: input.body ?? null,
      payloadJson: input.payload ?? null,
      status: "created",
    });
    if (id != null) {
      logger.debug?.("Notification created", { id, type: input.type, recipientType: input.recipientType });
    }
  } catch (err) {
    logger.warn("Notification create failed (non-fatal)", {
      type: input.type,
      recipientType: input.recipientType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Fire-and-forget: schedule notification creation without awaiting.
 * Use from hot paths where we must not block or fail the main flow.
 */
export function notifyLater(input: CreateNotificationInput): void {
  createNotification(input).catch(() => {
    // already logged in createNotification
  });
}
