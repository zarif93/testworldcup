/**
 * Phase 4: Schema-driven scoring engine.
 */

export type { SchemaScoreResult, ScoringSource, ScoringContext, FootballScoringContext, LottoScoringContext, ChanceScoringContext } from "./types";
export { SCORING_ENGINE_VERSION } from "./types";
export { scoreFootballBySchema } from "./scoreFootballBySchema";
export { scoreLottoBySchema } from "./scoreLottoBySchema";
export { scoreChanceBySchema } from "./scoreChanceBySchema";
export { scoreBySchema } from "./schemaScoringEngine";
export type { ResolvedScoreResult } from "./resolveScoring";
export { resolveScoring, shouldUseSchemaScoring, getLegacyScoreForContext } from "./resolveScoring";
