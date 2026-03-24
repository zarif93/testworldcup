/**
 * Generic grading for custom match rows (any sport / market type).
 */

import type { LegacyPick1X2, MatchMarketKind, MatchMarketMeta } from "./types";
import { assertMirroredSpreads, computeSpreadResult, type SpreadResult } from "./spreadMath";
import { actual1X2Key, normalizeToLegacy1X2Key } from "./legacyPrediction";
import { rowToMeta } from "./marketMeta";

export { matchMarketsMapFromRows, normalizeStoredMarketType, rowToMeta } from "./marketMeta";

/** Spread side picks only */
export function isSpreadPick(p: string): boolean {
  return p === "HOME_SPREAD" || p === "AWAY_SPREAD";
}

export function validateSpreadPairForMarket(
  marketType: MatchMarketKind,
  homeSpread: number | null,
  awaySpread: number | null
): string | null {
  if (marketType !== "SPREAD") return null;
  if (homeSpread == null || awaySpread == null) {
    return "חסרים ערכי קו לבית ולחוץ";
  }
  if (!assertMirroredSpreads(homeSpread, awaySpread)) {
    return `הקווים חייבים להיות מראה (בית+חוץ=0); התקבלו בית ${homeSpread} וחוץ ${awaySpread}`;
  }
  return null;
}

function grade1X2Pick(pred: string, homeScore: number, awayScore: number): boolean {
  const key = normalizeToLegacy1X2Key(pred);
  if (!key) return false;
  return key === actual1X2Key(homeScore, awayScore);
}

function gradeMoneylinePick(pred: string, homeScore: number, awayScore: number): boolean {
  if (homeScore === awayScore) return false;
  const actual: "HOME" | "AWAY" = homeScore > awayScore ? "HOME" : "AWAY";
  if (pred !== "HOME" && pred !== "AWAY") return false;
  return pred === actual;
}

function gradeSpreadPick(pred: "HOME_SPREAD" | "AWAY_SPREAD", spreadResult: SpreadResult): "win" | "loss" | "push" {
  if (spreadResult === "PUSH") return "push";
  if (pred === "HOME_SPREAD" && spreadResult === "HOME_COVER") return "win";
  if (pred === "AWAY_SPREAD" && spreadResult === "AWAY_COVER") return "win";
  return "loss";
}

export function validatePickAgainstMatchMarket(
  matchId: number,
  market: MatchMarketMeta,
  prediction: string
): string | null {
  const mt = market.marketType;
  if (mt === "REGULAR_1X2") {
    if (normalizeToLegacy1X2Key(prediction) == null) {
      return `Match ${matchId}: 1X2 market requires HOME / DRAW / AWAY or 1 / X / 2`;
    }
    return null;
  }
  if (mt === "MONEYLINE") {
    if (prediction !== "HOME" && prediction !== "AWAY") {
      return `Match ${matchId}: moneyline market requires HOME or AWAY`;
    }
    return null;
  }
  if (!isSpreadPick(prediction)) {
    return `Match ${matchId}: spread market requires HOME_SPREAD or AWAY_SPREAD`;
  }
  return null;
}

export function validateCustomMatchPredictionsAgainstMarkets(
  predictions: Array<{ matchId: number; prediction: string }>,
  matches: Array<{ id: number; marketType: string; homeSpread: number | null; awaySpread: number | null }>
): string | null {
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const p of predictions) {
    const row = byId.get(p.matchId);
    if (!row) return `משחק לא תקין: ${p.matchId}`;
    const meta = rowToMeta(row);
    const err = validatePickAgainstMatchMarket(p.matchId, meta, p.prediction);
    if (err) return err;
  }
  return null;
}

export function pointsForMatchMarket(
  market: MatchMarketMeta,
  prediction: string,
  homeScore: number,
  awayScore: number,
  pointsPerCorrect: number
): { points: number; detail: "correct" | "wrong" | "push" } {
  const mt = market.marketType;
  if (mt === "REGULAR_1X2") {
    if (normalizeToLegacy1X2Key(prediction) == null) return { points: 0, detail: "wrong" };
    const ok = grade1X2Pick(prediction, homeScore, awayScore);
    return { points: ok ? pointsPerCorrect : 0, detail: ok ? "correct" : "wrong" };
  }
  if (mt === "MONEYLINE") {
    if (prediction !== "HOME" && prediction !== "AWAY") return { points: 0, detail: "wrong" };
    const ok = gradeMoneylinePick(prediction, homeScore, awayScore);
    return { points: ok ? pointsPerCorrect : 0, detail: ok ? "correct" : "wrong" };
  }
  const hs = market.homeSpread;
  const as = market.awaySpread;
  if (hs == null || as == null) return { points: 0, detail: "wrong" };
  if (!isSpreadPick(prediction)) return { points: 0, detail: "wrong" };
  const { spreadResult } = computeSpreadResult(homeScore, awayScore, hs, as);
  const g = gradeSpreadPick(prediction as "HOME_SPREAD" | "AWAY_SPREAD", spreadResult);
  if (g === "push") return { points: 0, detail: "push" };
  return { points: g === "win" ? pointsPerCorrect : 0, detail: g === "win" ? "correct" : "wrong" };
}

/** Used by World Cup scoring: pure 1/X/2 vs score */
export function gradeWorldCupStylePick(prediction: LegacyPick1X2, homeScore: number, awayScore: number): boolean {
  return prediction === actual1X2Key(homeScore, awayScore);
}
