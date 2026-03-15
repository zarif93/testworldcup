/**
 * Phase 2C: Resolve form schema, scoring config, and settlement config for a tournament.
 * Phase 17: Builder overrides from tournament.rulesJson and tournament fields take priority.
 * Priority: 1) builder override (rulesJson / tournament columns), 2) competition_type config, 3) legacy default.
 */

import { getCompetitionTypeById, getCompetitionTypeByCode } from "../db";
import { getLegacyTypeFromCompetitionType } from "../competitionTypeUtils";
import type { LegacyCompetitionType } from "./competitionFormSchema";
import {
  parseCompetitionFormSchema,
  getDefaultFormSchemaForLegacyType,
  type CompetitionFormSchema,
} from "./competitionFormSchema";
import {
  parseCompetitionScoringConfig,
  getDefaultScoringConfigForLegacyType,
  type CompetitionScoringConfig,
} from "./competitionScoringConfig";
import {
  parseCompetitionSettlementConfig,
  getDefaultSettlementConfigForLegacyType,
  type CompetitionSettlementConfig,
} from "./competitionSettlementConfig";

export type ResolutionSource = "builder" | "type" | "legacy";

export interface ResolvedSchemasResult {
  legacyType: LegacyCompetitionType;
  competitionTypeId: number | null;
  competitionTypeCode: string | null;
  formSchema: CompetitionFormSchema;
  formSchemaWarnings: string[];
  scoringConfig: CompetitionScoringConfig;
  scoringConfigWarnings: string[];
  settlementConfig: CompetitionSettlementConfig;
  settlementConfigWarnings: string[];
  /** Phase 17: which source was used for each area (for debug/admin). */
  resolutionSource?: { form: ResolutionSource; scoring: ResolutionSource; settlement: ResolutionSource };
  /** Phase 17: raw builder overrides present on tournament (for debug). */
  builderOverrides?: {
    formSchemaOverride?: unknown;
    scoringOverride?: unknown;
    pointsPerCorrect?: number;
    tieHandling?: string;
    minParticipants?: number;
    prizeDistribution?: Record<string, number>;
  };
}

/** Competition type row with optional JSON fields. */
interface CompetitionTypeRow {
  id: number;
  code: string;
  formSchemaJson?: unknown;
  scoringConfigJson?: unknown;
  settlementConfigJson?: unknown;
}

/** Tournament row may include Phase 16 builder fields. */
interface TournamentWithBuilder {
  competitionTypeId?: number | null;
  type?: string | null;
  rulesJson?: unknown;
  minParticipants?: number | null;
  prizeDistribution?: Record<string, number> | null;
}

function parseRulesJson(rulesJson: unknown): Record<string, unknown> | null {
  if (rulesJson == null) return null;
  try {
    const raw = typeof rulesJson === "string" ? JSON.parse(rulesJson) : rulesJson;
    if (raw != null && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  } catch {
    /* ignore invalid JSON */
  }
  return null;
}

/**
 * Resolve all schemas for a tournament. Safe for null competitionTypeId (uses tournament.type).
 * Phase 17: Builder overrides in tournament.rulesJson / tournament columns are applied first.
 */
export async function resolveTournamentSchemas(tournament: TournamentWithBuilder): Promise<ResolvedSchemasResult> {
  const legacyType: LegacyCompetitionType =
    getLegacyTypeFromCompetitionType(tournament.type ?? "football") ?? "football";

  const rules = parseRulesJson(tournament.rulesJson);
  const builderOverrides: ResolvedSchemasResult["builderOverrides"] = {};
  if (rules?.formSchemaOverride != null) builderOverrides.formSchemaOverride = rules.formSchemaOverride;
  if (rules?.scoringOverride != null) builderOverrides.scoringOverride = rules.scoringOverride;
  if (typeof rules?.pointsPerCorrect === "number") builderOverrides.pointsPerCorrect = rules.pointsPerCorrect;
  if (rules?.tieHandling === "first_wins" || rules?.tieHandling === "split") builderOverrides.tieHandling = rules.tieHandling as string;
  if (tournament.minParticipants != null && tournament.minParticipants >= 0) builderOverrides.minParticipants = tournament.minParticipants;
  let prizeDist: Record<string, number> | null = null;
  if (tournament.prizeDistribution != null) {
    if (typeof tournament.prizeDistribution === "object" && !Array.isArray(tournament.prizeDistribution)) {
      prizeDist = tournament.prizeDistribution as Record<string, number>;
    } else if (typeof tournament.prizeDistribution === "string") {
      try {
        const parsed = JSON.parse(tournament.prizeDistribution) as unknown;
        if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) prizeDist = parsed as Record<string, number>;
      } catch {
        /* ignore */
      }
    }
  }
  if (prizeDist != null && Object.keys(prizeDist).length > 0) builderOverrides.prizeDistribution = prizeDist;

  let ct: CompetitionTypeRow | null = null;
  if (tournament.competitionTypeId != null && tournament.competitionTypeId > 0) {
    const row = await getCompetitionTypeById(tournament.competitionTypeId);
    if (row) ct = row as CompetitionTypeRow;
  }
  if (!ct && tournament.type) {
    const row = await getCompetitionTypeByCode(tournament.type);
    if (row) ct = row as CompetitionTypeRow;
  }

  const effectiveLegacyType: LegacyCompetitionType = ct
    ? (getLegacyTypeFromCompetitionType(ct.code) ?? legacyType)
    : legacyType;

  let formSchema: CompetitionFormSchema;
  let formSchemaWarnings: string[];
  let formSource: ResolutionSource = "legacy";

  if (rules?.formSchemaOverride != null && typeof rules.formSchemaOverride === "object" && !Array.isArray(rules.formSchemaOverride)) {
    try {
      const parsed = parseCompetitionFormSchema(rules.formSchemaOverride, effectiveLegacyType);
      formSchema = parsed.schema;
      formSchemaWarnings = [...parsed.warnings, "Using builder formSchemaOverride"];
      formSource = "builder";
    } catch {
      formSchemaWarnings = ["Invalid builder formSchemaOverride, falling back to type/legacy"];
      if (ct?.formSchemaJson != null) {
        const parsed = parseCompetitionFormSchema(ct.formSchemaJson, effectiveLegacyType);
        formSchema = parsed.schema;
        formSchemaWarnings.push(...parsed.warnings);
        formSource = "type";
      } else {
        formSchema = getDefaultFormSchemaForLegacyType(effectiveLegacyType);
        formSource = "legacy";
      }
    }
  } else if (ct?.formSchemaJson != null) {
    const parsed = parseCompetitionFormSchema(ct.formSchemaJson, effectiveLegacyType);
    formSchema = parsed.schema;
    formSchemaWarnings = parsed.warnings;
    formSource = "type";
  } else {
    formSchema = getDefaultFormSchemaForLegacyType(effectiveLegacyType);
    formSchemaWarnings = [];
  }

  let scoringConfig: CompetitionScoringConfig;
  let scoringConfigWarnings: string[];
  let scoringSource: ResolutionSource = "legacy";

  if (rules?.scoringOverride != null && typeof rules.scoringOverride === "object" && !Array.isArray(rules.scoringOverride)) {
    try {
      const parsed = parseCompetitionScoringConfig(rules.scoringOverride, effectiveLegacyType);
      scoringConfig = parsed.config;
      scoringConfigWarnings = [...parsed.warnings, "Using builder scoringOverride"];
      scoringSource = "builder";
    } catch {
      scoringConfigWarnings = ["Invalid builder scoringOverride, falling back to type/legacy"];
      if (ct?.scoringConfigJson != null) {
        const parsed = parseCompetitionScoringConfig(ct.scoringConfigJson, effectiveLegacyType);
        scoringConfig = parsed.config;
        scoringConfigWarnings.push(...parsed.warnings);
        scoringSource = "type";
      } else {
        scoringConfig = getDefaultScoringConfigForLegacyType(effectiveLegacyType);
        scoringSource = "legacy";
      }
    }
  } else if (ct?.scoringConfigJson != null) {
    const parsed = parseCompetitionScoringConfig(ct.scoringConfigJson, effectiveLegacyType);
    scoringConfig = parsed.config;
    scoringConfigWarnings = parsed.warnings;
    scoringSource = "type";
  } else {
    scoringConfig = getDefaultScoringConfigForLegacyType(effectiveLegacyType);
    scoringConfigWarnings = [];
  }

  if (typeof builderOverrides.pointsPerCorrect === "number" && scoringConfig && "pointsPerCorrectResult" in scoringConfig) {
    scoringConfig = { ...scoringConfig, pointsPerCorrectResult: builderOverrides.pointsPerCorrect };
    if (scoringSource !== "builder") scoringConfigWarnings = [...scoringConfigWarnings, "Applied builder pointsPerCorrect override"];
    scoringSource = scoringSource === "legacy" ? "builder" : scoringSource;
  }

  let settlementConfig: CompetitionSettlementConfig;
  let settlementConfigWarnings: string[];
  let settlementSource: ResolutionSource = "legacy";

  if (ct?.settlementConfigJson != null) {
    const parsed = parseCompetitionSettlementConfig(ct.settlementConfigJson, effectiveLegacyType);
    settlementConfig = parsed.config;
    settlementConfigWarnings = parsed.warnings;
    settlementSource = "type";
  } else {
    settlementConfig = getDefaultSettlementConfigForLegacyType(effectiveLegacyType);
    settlementConfigWarnings = [];
  }

  if (builderOverrides.minParticipants != null) {
    settlementConfig = { ...settlementConfig, minParticipants: builderOverrides.minParticipants };
    settlementConfigWarnings = [...settlementConfigWarnings, "Using builder minParticipants"];
    settlementSource = settlementSource === "legacy" ? "builder" : settlementSource;
  }
  if (builderOverrides.prizeDistribution != null && Object.keys(builderOverrides.prizeDistribution).length > 0) {
    settlementConfig = { ...settlementConfig, prizeDistributionDefault: builderOverrides.prizeDistribution };
    settlementConfigWarnings = [...settlementConfigWarnings, "Using builder prizeDistribution"];
    settlementSource = settlementSource === "legacy" ? "builder" : settlementSource;
  }
  if (builderOverrides.tieHandling === "first_wins" || builderOverrides.tieHandling === "split") {
    settlementConfig = { ...settlementConfig, tieHandling: builderOverrides.tieHandling };
    settlementConfigWarnings = [...settlementConfigWarnings, "Using builder tieHandling"];
    settlementSource = settlementSource === "legacy" ? "builder" : settlementSource;
  }

  return {
    legacyType: effectiveLegacyType,
    competitionTypeId: ct?.id ?? null,
    competitionTypeCode: ct?.code ?? null,
    formSchema,
    formSchemaWarnings,
    scoringConfig,
    scoringConfigWarnings,
    settlementConfig,
    settlementConfigWarnings,
    resolutionSource: { form: formSource, scoring: scoringSource, settlement: settlementSource },
    builderOverrides: Object.keys(builderOverrides).length > 0 ? builderOverrides : undefined,
  };
}

/** Resolve only form schema. Accepts full tournament (Phase 17: rulesJson used for builder override). */
export async function resolveTournamentFormSchema(
  tournament: TournamentWithBuilder
): Promise<{ schema: CompetitionFormSchema; warnings: string[] }> {
  const full = await resolveTournamentSchemas(tournament);
  return { schema: full.formSchema, warnings: full.formSchemaWarnings };
}

/** Resolve only scoring config. Accepts full tournament (Phase 17: rulesJson + pointsPerCorrect used). */
export async function resolveTournamentScoringConfig(
  tournament: TournamentWithBuilder
): Promise<{ config: CompetitionScoringConfig; warnings: string[] }> {
  const full = await resolveTournamentSchemas(tournament);
  return { config: full.scoringConfig, warnings: full.scoringConfigWarnings };
}

/** Resolve only settlement config. Accepts full tournament (Phase 17: minParticipants, prizeDistribution, rulesJson.tieHandling). */
export async function resolveTournamentSettlementConfig(
  tournament: TournamentWithBuilder
): Promise<{ config: CompetitionSettlementConfig; warnings: string[] }> {
  const full = await resolveTournamentSchemas(tournament);
  return { config: full.settlementConfig, warnings: full.settlementConfigWarnings };
}
