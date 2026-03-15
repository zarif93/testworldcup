/**
 * Phase 5: Select winners from scored submissions using settlement config.
 * Mirrors legacy: max points = rank 1; tieHandling "split" = all rank-1 win, "first_wins" = single winner.
 */

import type { CompetitionSettlementConfig } from "../schema/competitionSettlementConfig";
import type { ScoredSubmission } from "./types";
import type { TieGroup } from "./types";

/** Sort key for lotto: points then strongHit (true first). */
function lottoSortKey(s: ScoredSubmission): [number, number] {
  return [s.points, s.strongHit === true ? 1 : 0];
}

/** Rank submissions by points descending; for lotto use strongHit as tie-break for ordering. */
export function rankSubmissions(
  submissions: ScoredSubmission[],
  tournamentType: string
): Array<{ submission: ScoredSubmission; rank: number; points: number }> {
  if (submissions.length === 0) return [];
  const sorted =
    tournamentType === "lotto"
      ? [...submissions].sort((a, b) => {
          const [pa, sa] = lottoSortKey(a);
          const [pb, sb] = lottoSortKey(b);
          return pb - pa || sb - sa;
        })
      : [...submissions].sort((a, b) => b.points - a.points);

  const maxPoints = sorted[0].points;
  let rank = 1;
  let prevPoints = sorted[0].points;
  const result: Array<{ submission: ScoredSubmission; rank: number; points: number }> = [];
  for (const submission of sorted) {
    if (submission.points < prevPoints) {
      rank = result.length + 1;
      prevPoints = submission.points;
    }
    result.push({ submission, rank, points: submission.points });
  }
  return result;
}

/** Build tie groups from ranked list. */
export function buildTieGroups(
  ranked: Array<{ submission: ScoredSubmission; rank: number; points: number }>
): TieGroup[] {
  const byRank = new Map<number, { points: number; ids: number[] }>();
  for (const { submission, rank, points } of ranked) {
    const existing = byRank.get(rank);
    if (!existing) byRank.set(rank, { points, ids: [submission.id] });
    else existing.ids.push(submission.id);
  }
  return Array.from(byRank.entries())
    .sort(([a], [b]) => a - b)
    .map(([rank, { points, ids }]) => ({ rank, points, submissionIds: ids }));
}

/** Max number of prize places from config (e.g. { "1": 50, "2": 30, "3": 20 } => 3). */
export function getMaxPrizePlace(config: CompetitionSettlementConfig): number {
  const pd = config.prizeDistributionDefault;
  if (!pd || typeof pd !== "object") return 1;
  let max = 0;
  for (const k of Object.keys(pd)) {
    const n = parseInt(k, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 1000) max = Math.max(max, n);
  }
  return max >= 1 ? max : 1;
}

/**
 * Select winner submissions from ranked list per config.
 * Returns all ranked entries that fall within prize places (rank <= maxPrizePlace), with their rank.
 * tieHandling "split" = all at same rank share the place; "first_wins" = only first at rank 1 (single winner).
 */
export function selectWinnersBySchema(
  config: CompetitionSettlementConfig,
  ranked: Array<{ submission: ScoredSubmission; rank: number; points: number }>
): Array<{ submission: ScoredSubmission; rank: number }> {
  if (ranked.length === 0) return [];
  const maxPlace = getMaxPrizePlace(config);
  const rank1 = ranked.filter((r) => r.rank === 1);
  const maxPoints = rank1[0]?.points ?? 0;
  if (maxPoints <= 0) return [];
  if (config.tieHandling === "first_wins") {
    return rank1.length > 0 ? [{ submission: rank1[0].submission, rank: 1 }] : [];
  }
  return ranked.filter((r) => r.rank <= maxPlace).map((r) => ({ submission: r.submission, rank: r.rank }));
}
