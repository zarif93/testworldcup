/**
 * Phase 5: Schema-driven settlement — select winners and distribute prizes (no side effects).
 */

import type { CompetitionSettlementConfig } from "../schema/competitionSettlementConfig";
import type { ScoredSubmission } from "./types";
import type { SchemaSettlementResult } from "./types";
import { SETTLEMENT_ENGINE_VERSION } from "./types";
import { rankSubmissions, buildTieGroups, selectWinnersBySchema } from "./selectWinnersBySchema";
import { distributePrizesBySchema } from "./distributePrizesBySchema";
import { computePrizePool as computePrizePoolFromFinance } from "../finance/commissionService";

/** Prize pool = total pool minus platform commission. commissionBasisPoints required (from competition). */
export function computePrizePool(
  participantCount: number,
  entryAmount: number,
  commissionBasisPoints: number
): number {
  const totalPool = participantCount * entryAmount;
  return computePrizePoolFromFinance(totalPool, commissionBasisPoints);
}

/**
 * Run schema-based settlement: rank, select winners, distribute.
 * Returns structured result; does not persist or call addUserPoints.
 * When guaranteedPrizeAmount > 0, it is used as prize pool (freeroll / site-funded).
 * commissionBasisPoints must be provided (from competition; no runtime default).
 */
export function settleTournamentBySchema(
  config: CompetitionSettlementConfig,
  submissions: ScoredSubmission[],
  options: { tournamentType: string; entryAmount: number; guaranteedPrizeAmount?: number; commissionBasisPoints: number }
): SchemaSettlementResult {
  const warnings: string[] = [];
  const bps = options.commissionBasisPoints;
  const prizePoolTotal =
    (options.guaranteedPrizeAmount != null && options.guaranteedPrizeAmount > 0)
      ? options.guaranteedPrizeAmount
      : computePrizePool(submissions.length, options.entryAmount, bps);
  const ranked = rankSubmissions(submissions, options.tournamentType);
  const tieGroups = buildTieGroups(ranked);
  const winnersWithRank = selectWinnersBySchema(config, ranked);
  const { winnerEntries, prizePerWinner, totalDistributed } = distributePrizesBySchema(
    config,
    winnersWithRank,
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
    winnerCount: winnersWithRank.length,
    warnings,
    metadata: {
      prizeMode: config.prizeMode,
      tieHandling: config.tieHandling,
      minParticipants: config.minParticipants,
    },
  };
}
