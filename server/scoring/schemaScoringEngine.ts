/**
 * Phase 4: Schema-driven scoring engine — single entry that dispatches by config mode.
 */

import type { CompetitionScoringConfig } from "../schema/competitionScoringConfig";
import type { SchemaScoreResult, ScoringContext } from "./types";
import { scoreFootballBySchema } from "./scoreFootballBySchema";
import { scoreLottoBySchema } from "./scoreLottoBySchema";
import { scoreChanceBySchema } from "./scoreChanceBySchema";

/**
 * Score a submission using resolved scoring config.
 * Returns structured result with totalPoints, breakdown, scoringSource: "schema".
 * Throws or returns invalid result if config/context mismatch.
 */
export function scoreBySchema(
  config: CompetitionScoringConfig,
  ctx: ScoringContext
): SchemaScoreResult {
  if (config.mode === "match_result" && ctx.type === "football") {
    return scoreFootballBySchema(config, ctx);
  }
  if (config.mode === "lotto_match" && ctx.type === "lotto") {
    return scoreLottoBySchema(config, ctx);
  }
  if (config.mode === "chance_suits" && ctx.type === "chance") {
    return scoreChanceBySchema(config, ctx);
  }
  return {
    totalPoints: 0,
    scoringSource: "schema",
    warnings: ["Config/context mode mismatch – cannot score by schema"],
    metadata: { configMode: config.mode, contextType: ctx.type },
  };
}
