/**
 * Phase 19: Notification type constants.
 * Internal/admin notifications first; user/agent and external channels later.
 */

export const NOTIFICATION_TYPES = {
  COMPETITION_CREATED: "competition_created",
  COMPETITION_CLOSING_SOON: "competition_closing_soon",
  COMPETITION_CLOSED: "competition_closed",
  TOURNAMENT_SETTLED: "tournament_settled",
  AUTOMATION_FAILED: "automation_failed",
  AUTOMATION_SKIPPED: "automation_skipped",
  SUBMISSION_APPROVED: "submission_approved",
  SUBMISSION_REJECTED: "submission_rejected",
  /** Phase 22: User/agent lifecycle */
  AGENT_NEW_PLAYER: "agent_new_player",
  PLAYER_JOINED_COMPETITION: "player_joined_competition",
  /** Phase 29: Payment/accounting */
  PAYMENT_MARKED_PAID: "payment_marked_paid",
  PAYMENT_REFUNDED: "payment_refunded",
  /** Phase 11: User-facing alerts (foundation for delivery) */
  RANKING_CHANGE: "ranking_change",
  TOURNAMENT_CLOSING_ALERT: "tournament_closing_alert",
  RESULT_AVAILABLE: "result_available",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const RECIPIENT_TYPES = ["admin", "user", "agent", "system"] as const;
export const CHANNELS = ["in_app", "email", "whatsapp", "sms", "internal"] as const;
