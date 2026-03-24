/**
 * ניקוד: כל תוצאה נכונה (ניצחון או תיקו) = 3 נקודות. טעות = 0.
 * 1 = ניצחון בית, X = תיקו, 2 = ניצחון חוץ
 * Spread: HOME_SPREAD / AWAY_SPREAD מול קו הניקוד (מטא-דאטה לפי משחק).
 */
import type { MatchMarketMeta } from "../matchMarkets/types";
import { pointsForMatchMarket } from "../matchMarkets/marketGrading";
import { normalizeMatchIdKey } from "../matchMarkets/marketMeta";

const LEGACY_POINTS_PER = 3;

export function calcPoints(
  prediction: "1" | "X" | "2",
  homeScore: number,
  awayScore: number
): number {
  const actual = homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X";
  return prediction === actual ? LEGACY_POINTS_PER : 0;
}

export function calcSubmissionPoints(
  predictions: Array<{ matchId: number; prediction: string }>,
  matchResults: Map<number, { homeScore: number; awayScore: number }>,
  matchMarkets?: Map<number, MatchMarketMeta>
): number {
  let total = 0;
  for (const p of predictions) {
    const mid = normalizeMatchIdKey((p as { matchId: unknown }).matchId);
    if (mid == null) continue;
    const res = matchResults.get(mid);
    if (!res) continue;
    const meta = matchMarkets?.get(mid) ?? ({
      marketType: "REGULAR_1X2" as const,
      homeSpread: null,
      awaySpread: null,
    } satisfies MatchMarketMeta);
    total += pointsForMatchMarket(meta, p.prediction, res.homeScore, res.awayScore, LEGACY_POINTS_PER).points;
  }
  return total;
}
