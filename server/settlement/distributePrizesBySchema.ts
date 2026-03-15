/**
 * Phase 5: Distribute prize pool to winners using settlement config.
 * Current legacy: single tier (rank 1 = 100%), split equally among winners.
 */

import type { CompetitionSettlementConfig } from "../schema/competitionSettlementConfig";
import type { ScoredSubmission } from "./types";
import type { WinnerEntry } from "./types";

/**
 * Compute prize per winner and build winner entries.
 * Uses prizeDistributionDefault: if only "1": 100, entire pool is split among rank-1 winners.
 * If multiple ranks (e.g. "1": 50, "2": 30, "3": 20), assign percent to each rank group and split within group.
 */
export function distributePrizesBySchema(
  config: CompetitionSettlementConfig,
  winners: ScoredSubmission[],
  prizePoolTotal: number
): { winnerEntries: WinnerEntry[]; prizePerWinner: number; totalDistributed: number } {
  if (winners.length === 0) {
    return { winnerEntries: [], prizePerWinner: 0, totalDistributed: 0 };
  }
  const pct = config.prizeDistributionDefault["1"] ?? 100;
  const poolForRank1 = Math.round((prizePoolTotal * pct) / 100);
  const prizePerWinner = Math.floor(poolForRank1 / winners.length);
  const totalDistributed = prizePerWinner * winners.length;
  const winnerEntries: WinnerEntry[] = winners.map((s) => ({
    submissionId: s.id,
    userId: s.userId,
    username: s.username,
    rank: 1,
    points: s.points,
    prizeAmount: prizePerWinner,
  }));
  return { winnerEntries, prizePerWinner, totalDistributed };
}
