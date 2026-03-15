/**
 * Phase 4: Schema-driven chance scoring.
 * Mirrors legacy: one point per matching card per suit (default 1 per match).
 */

import type { ChanceScoringConfig } from "../schema/competitionScoringConfig";
import type { ChanceScoringContext } from "./types";
import type { SchemaScoreResult } from "./types";
import { SCORING_ENGINE_VERSION } from "./types";

const SUITS = ["heart", "club", "diamond", "spade"] as const;

export function scoreChanceBySchema(
  config: ChanceScoringConfig,
  ctx: ChanceScoringContext
): SchemaScoreResult {
  const warnings: string[] = [];
  const pointsPerMatch = config.pointsPerMatch ?? 1;
  let hits = 0;
  const breakdown: Record<string, number> = {};

  const drawKey: Record<(typeof SUITS)[number], string> = {
    heart: "heartCard",
    club: "clubCard",
    diamond: "diamondCard",
    spade: "spadeCard",
  };
  for (const suit of SUITS) {
    const predCard = ctx.predictions[suit];
    const drawCard = (ctx.draw as Record<string, string>)[drawKey[suit]];
    const match = String(predCard) === String(drawCard);
    const pts = match ? pointsPerMatch : 0;
    hits += match ? 1 : 0;
    breakdown[suit] = pts;
  }

  const total = hits * pointsPerMatch;

  return {
    totalPoints: total,
    scoringSource: "schema",
    engineVersion: SCORING_ENGINE_VERSION,
    breakdown,
    matchedItems: hits,
    warnings,
    metadata: { pointsPerMatch, compareCardsPerSuit: config.compareCardsPerSuit },
  };
}
