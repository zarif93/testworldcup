/**
 * Phase 5: Distribute prize pool to winners using settlement config.
 * Supports flexible N places and tie handling: tied users occupy consecutive places and share combined percentage.
 */

import type { CompetitionSettlementConfig } from "../schema/competitionSettlementConfig";
import type { ScoredSubmission } from "./types";
import type { WinnerEntry } from "./types";

/** Get prize percentage for place (1-based). Returns 0 if not defined. */
function getPlacePct(dist: Record<string, number>, place: number): number {
  const v = dist[String(place)];
  return typeof v === "number" && v >= 0 ? v : 0;
}

/**
 * Compute prize per winner and build winner entries.
 * - winnersWithRank: list of { submission, rank } in rank order (rank 1 first, then 2, etc.).
 * - For each distinct rank R with K tied winners: they occupy places R..R+K-1; combined pct = sum of pct for those places; each gets (combinedPct/100 * pool) / K.
 * - prizePerWinner in return is the first winner's amount (for backward compat); totalDistributed is sum of all prizeAmounts.
 */
export function distributePrizesBySchema(
  config: CompetitionSettlementConfig,
  winnersWithRank: Array<{ submission: ScoredSubmission; rank: number }>,
  prizePoolTotal: number
): { winnerEntries: WinnerEntry[]; prizePerWinner: number; totalDistributed: number } {
  if (winnersWithRank.length === 0) {
    return { winnerEntries: [], prizePerWinner: 0, totalDistributed: 0 };
  }
  const dist = config.prizeDistributionDefault ?? { "1": 100 };
  const winnerEntries: WinnerEntry[] = [];
  let rankIndex = 0;
  while (rankIndex < winnersWithRank.length) {
    const rank = winnersWithRank[rankIndex].rank;
    const group = winnersWithRank.filter((w) => w.rank === rank);
    const count = group.length;
    let combinedPct = 0;
    for (let place = rank; place < rank + count; place++) {
      combinedPct += getPlacePct(dist, place);
    }
    const poolShare = Math.round((prizePoolTotal * combinedPct) / 100);
    const perPerson = Math.floor(poolShare / count);
    const remainder = poolShare - perPerson * count;
    for (let i = 0; i < group.length; i++) {
      const s = group[i].submission;
      const amount = perPerson + (i < remainder ? 1 : 0);
      winnerEntries.push({
        submissionId: s.id,
        userId: s.userId,
        username: s.username,
        rank,
        points: s.points,
        prizeAmount: amount,
      });
    }
    rankIndex += count;
  }
  let totalDistributed = winnerEntries.reduce((sum, e) => sum + e.prizeAmount, 0);
  if (totalDistributed > prizePoolTotal) {
    let excess = totalDistributed - prizePoolTotal;
    for (let i = winnerEntries.length - 1; i >= 0 && excess > 0; i--) {
      const reduce = Math.min(winnerEntries[i].prizeAmount, excess);
      winnerEntries[i].prizeAmount -= reduce;
      excess -= reduce;
    }
    totalDistributed = winnerEntries.reduce((sum, e) => sum + e.prizeAmount, 0);
  }
  const prizePerWinner = winnerEntries[0]?.prizeAmount ?? 0;
  return { winnerEntries, prizePerWinner, totalDistributed };
}
