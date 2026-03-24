/** Handicap / spread math — sport-agnostic. */

export const SPREAD_FLOAT_EPS = 1e-9;

export type SpreadResult = "HOME_COVER" | "AWAY_COVER" | "PUSH";

export function approxEqual(a: number, b: number, eps = SPREAD_FLOAT_EPS): boolean {
  return Math.abs(a - b) < eps;
}

export function assertMirroredSpreads(homeSpread: number, awaySpread: number, eps = SPREAD_FLOAT_EPS): boolean {
  return approxEqual(homeSpread + awaySpread, 0, eps);
}

export function computeAdjustedScores(
  homeScore: number,
  awayScore: number,
  homeSpread: number,
  awaySpread: number
): { adjustedHomeScore: number; adjustedAwayScore: number } {
  return {
    adjustedHomeScore: homeScore + homeSpread,
    adjustedAwayScore: awayScore + awaySpread,
  };
}

export function spreadResultFromAdjusted(adjustedHomeScore: number, adjustedAwayScore: number): SpreadResult {
  if (approxEqual(adjustedHomeScore, adjustedAwayScore)) return "PUSH";
  return adjustedHomeScore > adjustedAwayScore ? "HOME_COVER" : "AWAY_COVER";
}

export function computeSpreadResult(
  homeScore: number,
  awayScore: number,
  homeSpread: number,
  awaySpread: number
): {
  adjustedHomeScore: number;
  adjustedAwayScore: number;
  spreadResult: SpreadResult;
} {
  const { adjustedHomeScore, adjustedAwayScore } = computeAdjustedScores(homeScore, awayScore, homeSpread, awaySpread);
  return {
    adjustedHomeScore,
    adjustedAwayScore,
    spreadResult: spreadResultFromAdjusted(adjustedHomeScore, adjustedAwayScore),
  };
}

export function parseSpreadNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const s = String(raw).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
