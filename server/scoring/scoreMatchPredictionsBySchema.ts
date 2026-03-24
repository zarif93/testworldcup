/**
 * Schema-driven scoring for custom match lists (1X2, moneyline, spread) — sport-agnostic.
 */

import type { MatchResultScoringConfig } from "../schema/competitionScoringConfig";
import type { FootballScoringContext } from "./types";
import type { SchemaScoreResult } from "./types";
import { SCORING_ENGINE_VERSION } from "./types";
import type { MatchMarketMeta } from "../matchMarkets/types";
import { pointsForMatchMarket } from "../matchMarkets/marketGrading";
import { normalizeMatchIdKey } from "../matchMarkets/marketMeta";

function defaultMarketMeta(): MatchMarketMeta {
  return { marketType: "REGULAR_1X2", homeSpread: null, awaySpread: null };
}

export function scoreMatchPredictionsBySchema(
  config: MatchResultScoringConfig,
  ctx: FootballScoringContext
): SchemaScoreResult {
  const warnings: string[] = [];
  const pointsPerCorrect = config.pointsPerCorrectResult ?? 3;
  let total = 0;
  const breakdown: Record<string, number> = {};
  let matchedCount = 0;

  for (const p of ctx.predictions) {
    const mid = normalizeMatchIdKey((p as { matchId: unknown }).matchId);
    if (mid == null) continue;
    const res = ctx.matchResults.get(mid);
    if (res == null) continue;
    const meta = ctx.matchMarkets?.get(mid) ?? defaultMarketMeta();
    if (meta.marketType === "SPREAD" && (meta.homeSpread == null || meta.awaySpread == null)) {
      warnings.push(`Match ${mid}: SPREAD market missing spread lines — not scored`);
      breakdown[`match_${mid}`] = 0;
      continue;
    }
    const { points, detail } = pointsForMatchMarket(
      meta,
      p.prediction,
      res.homeScore,
      res.awayScore,
      pointsPerCorrect
    );
    total += points;
    if (detail === "correct") matchedCount++;
    breakdown[`match_${mid}`] = points;
  }

  return {
    totalPoints: total,
    scoringSource: "schema",
    engineVersion: SCORING_ENGINE_VERSION,
    breakdown,
    matchedItems: matchedCount,
    warnings,
    metadata: { pointsPerCorrectResult: pointsPerCorrect, outcomeType: config.outcomeType },
  };
}
