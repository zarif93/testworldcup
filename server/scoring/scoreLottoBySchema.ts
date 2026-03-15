/**
 * Phase 4: Schema-driven lotto scoring.
 * Mirrors legacy: points per matching regular number + points for strong hit (default 1 each).
 */

import type { LottoScoringConfig } from "../schema/competitionScoringConfig";
import type { LottoScoringContext } from "./types";
import type { SchemaScoreResult } from "./types";
import { SCORING_ENGINE_VERSION } from "./types";

export function scoreLottoBySchema(
  config: LottoScoringConfig,
  ctx: LottoScoringContext
): SchemaScoreResult {
  const warnings: string[] = [];
  const winningSet = new Set([
    ctx.draw.num1,
    ctx.draw.num2,
    ctx.draw.num3,
    ctx.draw.num4,
    ctx.draw.num5,
    ctx.draw.num6,
  ]);
  let regularMatches = 0;
  for (const n of ctx.predictions.numbers) {
    if (winningSet.has(Number(n))) regularMatches++;
  }
  const strongHit = ctx.predictions.strongNumber === ctx.draw.strongNumber;
  const pointsPerNumber = config.pointsPerMatchingNumber ?? 1;
  const pointsForStrong = config.pointsForStrongHit ?? 1;
  const total =
    regularMatches * pointsPerNumber + (strongHit ? pointsForStrong : 0);

  return {
    totalPoints: total,
    scoringSource: "schema",
    engineVersion: SCORING_ENGINE_VERSION,
    breakdown: {
      regularMatches: regularMatches * pointsPerNumber,
      strongHit: strongHit ? pointsForStrong : 0,
    },
    matchedItems: regularMatches,
    strongHit,
    warnings,
    metadata: {
      pointsPerMatchingNumber: pointsPerNumber,
      pointsForStrongHit: pointsForStrong,
    },
  };
}
