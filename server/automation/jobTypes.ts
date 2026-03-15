/**
 * Phase 18: Automation job type constants.
 * Only execute when conditions are safe; idempotent; no crash on missing data.
 */

export const AUTOMATION_JOB_TYPES = {
  TOURNAMENT_CLOSE_SUBMISSIONS: "tournament_close_submissions",
  TOURNAMENT_LOCK: "tournament_lock",
  TOURNAMENT_FINALIZE_RESULTS: "tournament_finalize_results",
  TOURNAMENT_SETTLE: "tournament_settle",
  TOURNAMENT_PUBLISH: "tournament_publish",
} as const;

export type AutomationJobType = (typeof AUTOMATION_JOB_TYPES)[keyof typeof AUTOMATION_JOB_TYPES];
