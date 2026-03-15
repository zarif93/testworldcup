/**
 * Phase 11: Notification delivery queue – foundation only.
 * Returns notifications pending for email/sms/whatsapp. A cron or job can poll and send.
 * No actual sending implemented here.
 */

import { getPendingNotificationsForDelivery } from "../db";

export type PendingNotification = {
  id: number;
  recipientType: string;
  recipientId: number | null;
  channel: string;
  type: string;
  title: string | null;
  body: string | null;
  payloadJson: unknown;
};

/** Fetch notifications that are created and targeted at external channels (email, sms, whatsapp). */
export async function getPendingForDelivery(limit = 50): Promise<PendingNotification[]> {
  return getPendingNotificationsForDelivery(limit);
}
