/**
 * Phase 4: Resolve scoring path (schema vs legacy) and return points to persist.
 * Safe fallback to legacy when schema scoring is not applicable or fails.
 */

import type { CompetitionScoringConfig } from "../schema/competitionScoringConfig";
import { resolveTournamentScoringConfig } from "../schema/resolveTournamentSchemas";
import { getLegacyTypeFromCompetitionType } from "../competitionTypeUtils";
import { calcSubmissionPoints } from "../services/scoringService";
import { scoreBySchema } from "./schemaScoringEngine";
import type { SchemaScoreResult, ScoringContext, ScoringSource } from "./types";
import { logger } from "../_core/logger";

const SUPPORTED_LEGACY_TYPES = ["football", "football_custom", "lotto", "chance"] as const;

export interface ResolvedScoreResult {
  points: number;
  scoringSource: ScoringSource;
  strongHit?: boolean;
  warnings: string[];
  /** Optional schema breakdown for debug */
  schemaResult?: SchemaScoreResult;
}

export type TournamentRow = { competitionTypeId?: number | null; type?: string | null };

/**
 * Decide whether to use schema scoring for this tournament + context.
 */
export function shouldUseSchemaScoring(
  tournament: TournamentRow,
  config: CompetitionScoringConfig,
  ctx: ScoringContext
): boolean {
  const legacyType = getLegacyTypeFromCompetitionType(tournament.type ?? "football") ?? "football";
  if (!SUPPORTED_LEGACY_TYPES.includes(legacyType as (typeof SUPPORTED_LEGACY_TYPES)[number])) {
    return false;
  }
  if (config.mode === "custom") {
    return false;
  }
  if (ctx.type === "football" && config.mode !== "match_result") return false;
  if (ctx.type === "lotto" && config.mode !== "lotto_match") return false;
  if (ctx.type === "chance" && config.mode !== "chance_suits") return false;
  return true;
}

/**
 * Resolve scoring: try schema first when applicable, else legacy.
 * Returns points (and strongHit for lotto) to persist; does not persist.
 */
export async function resolveScoring(
  tournament: TournamentRow & { id?: number },
  context: ScoringContext
): Promise<ResolvedScoreResult> {
  const warnings: string[] = [];
  let config: CompetitionScoringConfig;
  try {
    const resolved = await resolveTournamentScoringConfig(tournament);
    config = resolved.config;
    if (resolved.warnings.length > 0) {
      warnings.push(...resolved.warnings);
    }
  } catch (e) {
    warnings.push("Failed to resolve scoring config: " + String(e));
    return resolveLegacyScoring(context, warnings);
  }

  if (!shouldUseSchemaScoring(tournament, config, context)) {
    if (process.env.NODE_ENV === "development" || warnings.length > 0) {
      logger.debug?.("Scoring fallback to legacy", {
        tournamentId: tournament.id,
        configMode: config.mode,
        contextType: context.type,
      });
    }
    return resolveLegacyScoring(context, warnings);
  }

  try {
    const schemaResult = scoreBySchema(config, context);
    if (schemaResult.warnings.length > 0) {
      warnings.push(...schemaResult.warnings);
    }
    return {
      points: schemaResult.totalPoints,
      scoringSource: "schema",
      strongHit: schemaResult.strongHit,
      warnings,
      schemaResult,
    };
  } catch (e) {
    warnings.push("Schema scoring failed, using legacy: " + String(e));
    logger.warn("Schema scoring failed, fallback to legacy", {
      tournamentId: tournament.id,
      error: String(e),
    });
    return resolveLegacyScoring(context, warnings);
  }
}

/** Phase 4: Compute legacy score only (for debug comparison). Does not persist. */
export function getLegacyScoreForContext(context: ScoringContext): { points: number; strongHit?: boolean } {
  const r = resolveLegacyScoring(context, []);
  return { points: r.points, strongHit: r.strongHit };
}

function resolveLegacyScoring(
  context: ScoringContext,
  existingWarnings: string[]
): ResolvedScoreResult {
  if (context.type === "football") {
    const pts = calcSubmissionPoints(context.predictions, context.matchResults, context.matchMarkets);
    return {
      points: pts,
      scoringSource: "legacy",
      warnings: existingWarnings,
    };
  }
  if (context.type === "lotto") {
    const winningSet = new Set([
      context.draw.num1,
      context.draw.num2,
      context.draw.num3,
      context.draw.num4,
      context.draw.num5,
      context.draw.num6,
    ]);
    let regularMatches = 0;
    for (const n of context.predictions.numbers) {
      if (winningSet.has(Number(n))) regularMatches++;
    }
    const strongHit = context.predictions.strongNumber === context.draw.strongNumber;
    const total = regularMatches + (strongHit ? 1 : 0);
    return {
      points: total,
      scoringSource: "legacy",
      strongHit,
      warnings: existingWarnings,
    };
  }
  if (context.type === "chance") {
    let hits = 0;
    if (String(context.predictions.heart) === context.draw.heartCard) hits++;
    if (String(context.predictions.club) === context.draw.clubCard) hits++;
    if (String(context.predictions.diamond) === context.draw.diamondCard) hits++;
    if (String(context.predictions.spade) === context.draw.spadeCard) hits++;
    return {
      points: hits,
      scoringSource: "legacy",
      warnings: existingWarnings,
    };
  }
  return {
    points: 0,
    scoringSource: "legacy",
    warnings: [...existingWarnings, "Unknown context type"],
  };
}
