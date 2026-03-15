/**
 * Phase 13: Tournament lifecycle state machine – strict states and illegal transition prevention.
 * Deterministic, auditable competition engine.
 */

import { getTournamentById, updateTournamentStatus } from "../db";

/** Canonical lifecycle states. SETTLING is transient during settlement. */
export const TOURNAMENT_LIFECYCLE_STATES = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  LOCKED: "LOCKED",
  SCORING: "SCORING",
  RESULTS_READY: "RESULTS_READY",
  SETTLING: "SETTLING",
  SETTLED: "SETTLED",
} as const;

export type TournamentLifecycleState = keyof typeof TOURNAMENT_LIFECYCLE_STATES;

/** Map DB status to lifecycle state. */
const DB_TO_LIFECYCLE: Record<string, TournamentLifecycleState> = {
  DRAFT: "DRAFT",
  UPCOMING: "DRAFT",
  OPEN: "OPEN",
  LOCKED: "LOCKED",
  RESULTS_UPDATED: "SCORING",
  CLOSED: "RESULTS_READY",
  SETTLING: "SETTLING",
  PRIZES_DISTRIBUTED: "SETTLED",
  ARCHIVED: "SETTLED",
};

/** Map lifecycle state to DB status (for writes). */
const LIFECYCLE_TO_DB: Record<TournamentLifecycleState, string> = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  LOCKED: "LOCKED",
  SCORING: "RESULTS_UPDATED",
  RESULTS_READY: "CLOSED",
  SETTLING: "SETTLING",
  SETTLED: "ARCHIVED",
};

/** Allowed transitions: from -> set of to. Settlement can be run from LOCKED, SCORING, or RESULTS_READY. */
const ALLOWED_TRANSITIONS: Record<TournamentLifecycleState, TournamentLifecycleState[]> = {
  DRAFT: ["OPEN"],
  OPEN: ["LOCKED"],
  LOCKED: ["SCORING", "RESULTS_READY", "SETTLING"],
  SCORING: ["RESULTS_READY", "SETTLING"],
  RESULTS_READY: ["SETTLING"],
  SETTLING: ["SETTLED"],
  SETTLED: [],
};

export function getLifecycleState(dbStatus: string | null | undefined): TournamentLifecycleState {
  if (!dbStatus) return "DRAFT";
  const s = String(dbStatus).toUpperCase();
  return DB_TO_LIFECYCLE[s] ?? "DRAFT";
}

export function canTransition(from: TournamentLifecycleState, to: TournamentLifecycleState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/** Get current lifecycle state for a tournament. */
export async function getTournamentLifecycleState(tournamentId: number): Promise<TournamentLifecycleState | null> {
  const t = await getTournamentById(tournamentId);
  if (!t) return null;
  const status = (t as { status?: string }).status;
  return getLifecycleState(status);
}

/** Transition tournament to target lifecycle state. Throws if transition is illegal. Returns true if updated. */
export async function transitionTournamentTo(
  tournamentId: number,
  targetState: TournamentLifecycleState
): Promise<boolean> {
  const current = await getTournamentLifecycleState(tournamentId);
  if (current === null) throw new Error("Tournament not found");
  if (!canTransition(current, targetState)) {
    throw new Error(`Illegal transition: ${current} -> ${targetState}`);
  }
  const dbStatus = LIFECYCLE_TO_DB[targetState];
  return updateTournamentStatus(tournamentId, dbStatus);
}

/** True if tournament is in a state where results are final and no score/prize changes allowed. */
export function isFinalState(state: TournamentLifecycleState): boolean {
  return state === "SETTLED";
}
