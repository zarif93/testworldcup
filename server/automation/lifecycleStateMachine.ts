/**
 * Phase 23: Lifecycle state machine – read-only mapping from DB status to canonical phases.
 * Does NOT change any DB status values; used for observability and chaining logic.
 */

import { getNextScheduledActions, type NextScheduledAction } from "./getNextScheduledActions";
import { AUTOMATION_JOB_TYPES } from "./jobTypes";

/** Canonical lifecycle phases (for display and chain logic). */
export const LIFECYCLE_PHASES = [
  "DRAFT",
  "PUBLISHED",
  "OPEN",
  "CLOSED",
  "RESULTS_PENDING",
  "RESULTS_FINALIZED",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "ARCHIVED",
] as const;

export type LifecyclePhase = (typeof LIFECYCLE_PHASES)[number];

export type TournamentLifecycleRow = {
  id: number;
  status?: string | null;
  type?: string | null;
  closesAt?: Date | number | null;
  resultsFinalizedAt?: Date | number | null;
  settledAt?: Date | number | null;
  dataCleanedAt?: Date | number | null;
  drawDate?: string | null;
  drawTime?: string | null;
};

/**
 * Map DB status (and related fields) to a single canonical lifecycle phase.
 * Safe: unknown statuses map to OPEN or CLOSED; no throw.
 */
export function getLifecyclePhase(t: TournamentLifecycleRow): LifecyclePhase {
  const status = (t?.status ?? "OPEN").toUpperCase();
  if (status === "ARCHIVED" || status === "PRIZES_DISTRIBUTED") return "ARCHIVED";
  if (status === "SETTLING") return "SETTLEMENT_PENDING";
  if (status === "RESULTS_UPDATED") return "RESULTS_FINALIZED";
  if (status === "OPEN") return "OPEN";
  if (status === "LOCKED" || status === "CLOSED") {
    const hasResults = t?.resultsFinalizedAt != null;
    return hasResults ? "RESULTS_FINALIZED" : "CLOSED";
  }
  if (status === "UPCOMING" || status === "DRAFT") return "DRAFT";
  return "CLOSED";
}

/**
 * Human-readable label for phase (for admin UI).
 */
export function getLifecyclePhaseLabel(phase: LifecyclePhase): string {
  const labels: Record<LifecyclePhase, string> = {
    DRAFT: "טיוטה",
    PUBLISHED: "פורסם",
    OPEN: "פתוח",
    CLOSED: "נסגר",
    RESULTS_PENDING: "ממתין לתוצאות",
    RESULTS_FINALIZED: "תוצאות סופיות",
    SETTLEMENT_PENDING: "ממתין להסדרה",
    SETTLED: "הוסדר",
    ARCHIVED: "בארכיון",
  };
  return labels[phase] ?? phase;
}

/**
 * Next possible automation transitions from this phase (for display only).
 * Actual execution still respects getNextScheduledActions and job conditions.
 */
export function getNextPossibleTransitions(phase: LifecyclePhase): string[] {
  switch (phase) {
    case "OPEN":
      return ["CLOSED (close submissions when closesAt)"];
    case "CLOSED":
    case "RESULTS_PENDING":
      return ["RESULTS_FINALIZED (lock draw / enter results)"];
    case "RESULTS_FINALIZED":
      return ["SETTLED (distribute prizes)"];
    case "SETTLEMENT_PENDING":
      return ["SETTLED (recovery or complete settlement)"];
    case "SETTLED":
    case "ARCHIVED":
      return ["ARCHIVED (cleanup after display window)"];
    default:
      return [];
  }
}

/**
 * Pending automation actions for this tournament (derived from state; read-only).
 */
export function getPendingLifecycleActions(tournament: TournamentLifecycleRow): NextScheduledAction[] {
  return getNextScheduledActions(tournament);
}
