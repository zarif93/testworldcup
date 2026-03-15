/**
 * Phase 2C: Schema contracts, parsing, resolution, validation, and renderer preparation.
 */

export type { LegacyCompetitionType, CompetitionFormSchema, FormSchemaField, FootballMatchFormSchema, LottoFormSchema, ChanceFormSchema } from "./competitionFormSchema";
export { parseCompetitionFormSchema, getDefaultFormSchemaForLegacyType } from "./competitionFormSchema";

export type { CompetitionScoringConfig, MatchResultScoringConfig, LottoScoringConfig, ChanceScoringConfig } from "./competitionScoringConfig";
export { parseCompetitionScoringConfig, getDefaultScoringConfigForLegacyType } from "./competitionScoringConfig";

export type { CompetitionSettlementConfig } from "./competitionSettlementConfig";
export { parseCompetitionSettlementConfig, getDefaultSettlementConfigForLegacyType } from "./competitionSettlementConfig";

export type { ResolvedSchemasResult } from "./resolveTournamentSchemas";
export { resolveTournamentSchemas, resolveTournamentFormSchema, resolveTournamentScoringConfig, resolveTournamentSettlementConfig } from "./resolveTournamentSchemas";

export type { ValidationResult, ValidationError } from "./validateEntryAgainstFormSchema";
export { validateEntryAgainstFormSchema } from "./validateEntryAgainstFormSchema";

export type { RendererModel, RendererFieldDef, RendererFieldType } from "./buildRendererModel";
export { buildRendererModelFromFormSchema, getFieldRendererType } from "./buildRendererModel";
