/**
 * Phase 7: Universal competition items – public API.
 */

export type {
  SourceType,
  CompetitionItemSetResolved,
  CompetitionItemResolved,
  CompetitionItemRendererModel,
  CompetitionItemResultModel,
  CompetitionItemOptionModel,
} from "./types";

export {
  resolveTournamentItems,
  resolveLegacyMatchesAsCompetitionItems,
  resolveLegacyCustomMatchesAsCompetitionItems,
  resolveLottoAsCompetitionItems,
  resolveChanceAsCompetitionItems,
} from "./resolve";

export {
  getCompetitionItemRendererModel,
  getCompetitionItemResultModel,
  getCompetitionItemOptionModel,
} from "./helpers";

export {
  parseJsonField,
  validateOptionSchema,
  validateResultSchema,
  validateMetadataJson,
  stringifyJson,
} from "./validation";
export type { JsonValidationResult } from "./validation";
