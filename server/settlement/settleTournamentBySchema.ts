/**
 * Phase 5: Schema-driven settlement — select winners and distribute prizes (no side effects).
 */

import type { CompetitionSettlementConfig } from "../schema/competitionSettlementConfig";
import type { ScoredSubmission } from "./types";
import type { SchemaSettlementResult } from "./types";
import { SETTLEMENT_ENGINE_VERSION } from "./types";
import { rankSubmissions, buildTieGroups, selectWinnersBySchema } from "./selectWinnersBySchema";
import { distributePrizesBySchema } from "./distributePrizesBySchema";

/** Prize pool formula: 87.5% of (participant count * entry amount), matching legacy. */
export function computePrizePool(participantCount: number, entryAmount: number): number {
  return Math.round(participantCount * entryAmount * 0.875);
}

/**
 * Run schema-based settlement: rank, select winners, distribute.
 * Returns structured result; does not persist or call addUserPoints.
 * When guaranteedPrizeAmount > 0, it is used as prize pool (freeroll / site-funded).
 */
export function settleTournamentBySchema(
  config: CompetitionSettlementConfig,
  submissions: ScoredSubmission[],
  options: { tournamentType: string; entryAmount: number; guaranteedPrizeAmount?: number }
): SchemaSettlementResult {
  const warnings: string[] = [];
  const prizePoolTotal =
    (options.guaranteedPrizeAmount != null && options.guaranteedPrizeAmount > 0)
      ? options.guaranteedPrizeAmount
      : computePrizePool(submissions.length, options.entryAmount);
  const ranked = rankSubmissions(submissions, options.tournamentType);
  const tieGroups = buildTieGroups(ranked);
  const winners = selectWinnersBySchema(config, ranked);
  const { winnerEntries, prizePerWinner, totalDistributed } = distributePrizesBySchema(
    config,
    winners,
    prizePoolTotal
  );
  const rankedSubmissions = ranked.map((r) => ({
    submissionId: r.submission.id,
    userId: r.submission.userId,
    points: r.points,
    rank: r.rank,
  }));

  return {
    settlementSource: "schema",
    engineVersion: SETTLEMENT_ENGINE_VERSION,
    winners: winnerEntries,
    rankedSubmissions,
    tieGroups,
    prizePoolTotal,
    totalPrizeDistributed: totalDistributed,
    prizePerWinner,
    winnerCount: winners.length,
    warnings,
    metadata: {
      prizeMode: config.prizeMode,
      tieHandling: config.tieHandling,
      minParticipants: config.minParticipants,
    },
  };
}
