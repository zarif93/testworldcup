/**
 * Phase 5: Schema-driven settlement engine.
 */

export type {
  ScoredSubmission,
  TieGroup,
  WinnerEntry,
  SchemaSettlementResult,
  SettlementSource,
} from "./types";
export { SETTLEMENT_ENGINE_VERSION } from "./types";
export { rankSubmissions, buildTieGroups, selectWinnersBySchema } from "./selectWinnersBySchema";
export { distributePrizesBySchema } from "./distributePrizesBySchema";
export { settleTournamentBySchema, computePrizePool } from "./settleTournamentBySchema";
export type { ResolvedSettlementResult, SubmissionRow } from "./resolveSettlement";
export { resolveSettlement, getLegacySettlementResult } from "./resolveSettlement";
