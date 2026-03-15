/**
 * Phase 4: Schema-driven football (1/X/2) scoring.
 * Mirrors legacy: one outcome per match, points per correct result (default 3).
 */

import type { MatchResultScoringConfig } from "../schema/competitionScoringConfig";
import type { FootballScoringContext } from "./types";
import type { SchemaScoreResult } from "./types";
import { SCORING_ENGINE_VERSION } from "./types";

function actualOutcome(homeScore: number, awayScore: number): "1" | "X" | "2" {
  return homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X";
}

export function scoreFootballBySchema(
  config: MatchResultScoringConfig,
  ctx: FootballScoringContext
): SchemaScoreResult {
  const warnings: string[] = [];
  const pointsPerCorrect = config.pointsPerCorrectResult ?? 3;
  let total = 0;
  const breakdown: Record<string, number> = {};
  let matchedCount = 0;

  for (const p of ctx.predictions) {
    const res = ctx.matchResults.get(p.matchId);
    if (res == null) continue;
    const actual = actualOutcome(res.homeScore, res.awayScore);
    const correct = p.prediction === actual;
    const pts = correct ? pointsPerCorrect : 0;
    total += pts;
    if (correct) matchedCount++;
    breakdown[`match_${p.matchId}`] = pts;
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
