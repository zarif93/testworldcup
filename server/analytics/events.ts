/**
 * Phase 11/12: Analytics foundation – event tracking for joins, retention, funnel, ranking, growth.
 * Phase 15: Metrics counter for tournament joins.
 * Writes to analytics_events table; no third-party SDK. Fire-and-forget.
 */

import { insertAnalyticsEvent } from "../db";
import { logger } from "../_core/logger";
import { incrementTournamentJoin } from "../_core/metrics";

const EVENT_NAMES = {
  TOURNAMENT_JOIN: "tournament_join",
  RANKING_CHECK: "ranking_check",
  FUNNEL_STEP: "funnel_step",
  LEADERBOARD_VIEW: "leaderboard_view",
  /** Phase 12: Growth analytics depth */
  TOURNAMENT_COMPLETION: "tournament_completion",
  RANKING_CHANGE_VIEW: "ranking_change_view",
  SESSION_RETURN: "session_return",
  TOURNAMENT_ABANDONMENT: "tournament_abandonment",
} as const;

function track(eventName: string, data: { userId?: number | null; tournamentId?: number | null; payload?: Record<string, unknown> }) {
  insertAnalyticsEvent({
    eventName,
    userId: data.userId ?? null,
    tournamentId: data.tournamentId ?? null,
    payload: data.payload ?? null,
  }).catch((err) => {
    logger.debug?.("Analytics event failed (non-fatal)", { eventName, error: err instanceof Error ? err.message : String(err) });
  });
}

/** User joined a tournament (submission approved or created). */
export function trackTournamentJoin(userId: number, tournamentId: number, payload?: { entryCost?: number }) {
  incrementTournamentJoin();
  track(EVENT_NAMES.TOURNAMENT_JOIN, { userId, tournamentId, payload });
}

/** User viewed ranking/leaderboard. */
export function trackRankingCheck(userId: number | null, tournamentId: number) {
  track(EVENT_NAMES.RANKING_CHECK, { userId: userId ?? null, tournamentId });
}

/** Funnel step (e.g. homepage_view, predict_start, predict_submit). */
export function trackFunnelStep(step: string, userId?: number | null, payload?: Record<string, unknown>) {
  track(EVENT_NAMES.FUNNEL_STEP, { userId: userId ?? null, payload: { step, ...payload } });
}

/** Leaderboard page or teaser view. */
export function trackLeaderboardView(userId: number | null, tournamentId: number) {
  track(EVENT_NAMES.LEADERBOARD_VIEW, { userId: userId ?? null, tournamentId });
}

/** Phase 12: Tournament reached completion (results finalized / prizes distributed). */
export function trackTournamentCompletion(tournamentId: number, payload?: { participantCount?: number; winnerCount?: number }) {
  track(EVENT_NAMES.TOURNAMENT_COMPLETION, { tournamentId, payload });
}

/** Phase 12: User viewed ranking change (e.g. moved up/down). */
export function trackRankingChangeView(userId: number | null, tournamentId: number, payload?: { previousRank?: number; currentRank?: number }) {
  track(EVENT_NAMES.RANKING_CHANGE_VIEW, { userId: userId ?? null, tournamentId, payload });
}

/** Phase 12: User returned in same session or next visit (retention signal). */
export function trackSessionReturn(userId: number, payload?: { lastSeenAt?: string; returnSource?: string }) {
  track(EVENT_NAMES.SESSION_RETURN, { userId, payload });
}

/** Phase 12: User abandoned tournament flow (e.g. started but did not submit). */
export function trackTournamentAbandonment(userId: number | null, tournamentId: number, payload?: { step?: string }) {
  track(EVENT_NAMES.TOURNAMENT_ABANDONMENT, { userId: userId ?? null, tournamentId, payload });
}
