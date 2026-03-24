/**
 * @deprecated Prefer scoreMatchPredictionsBySchema — kept for call sites that still reference "football" naming.
 * World Cup / football_custom schema scoring uses the same match-market engine.
 */

import type { MatchResultScoringConfig } from "../schema/competitionScoringConfig";
import type { FootballScoringContext } from "./types";
import type { SchemaScoreResult } from "./types";
import { scoreMatchPredictionsBySchema } from "./scoreMatchPredictionsBySchema";

export function scoreFootballBySchema(
  config: MatchResultScoringConfig,
  ctx: FootballScoringContext
): SchemaScoreResult {
  return scoreMatchPredictionsBySchema(config, ctx);
}
