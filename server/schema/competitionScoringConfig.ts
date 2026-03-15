/**
 * Phase 2C: Typed scoring config contract and parsing.
 * Aligned with: football 3 pts per correct 1/X/2, lotto 1 per number + 1 for strong, chance 1 per matching card.
 */

export type LegacyCompetitionType = "football" | "football_custom" | "lotto" | "chance" | "custom";

export type ScoringMode = "match_result" | "lotto_match" | "chance_suits" | "custom";

/** Config for 1/X/2 match result scoring. */
export interface MatchResultScoringConfig {
  mode: "match_result";
  pointsPerCorrectResult: number;
  outcomeType: "1X2";
}

/** Config for lotto: N numbers + strong number. */
export interface LottoScoringConfig {
  mode: "lotto_match";
  pointsPerMatchingNumber: number;
  pointsForStrongHit: number;
}

/** Config for chance: compare per suit. */
export interface ChanceScoringConfig {
  mode: "chance_suits";
  compareCardsPerSuit: boolean;
  pointsPerMatch?: number;
}

export type CompetitionScoringConfig =
  | MatchResultScoringConfig
  | LottoScoringConfig
  | ChanceScoringConfig
  | { mode: "custom"; rules?: unknown };

const DEFAULT_FOOTBALL_SCORING: MatchResultScoringConfig = {
  mode: "match_result",
  pointsPerCorrectResult: 3,
  outcomeType: "1X2",
};

const DEFAULT_LOTTO_SCORING: LottoScoringConfig = {
  mode: "lotto_match",
  pointsPerMatchingNumber: 1,
  pointsForStrongHit: 1,
};

const DEFAULT_CHANCE_SCORING: ChanceScoringConfig = {
  mode: "chance_suits",
  compareCardsPerSuit: true,
  pointsPerMatch: 1,
};

export function getDefaultScoringConfigForLegacyType(
  legacyType: LegacyCompetitionType
): CompetitionScoringConfig {
  switch (legacyType) {
    case "football":
    case "football_custom":
      return DEFAULT_FOOTBALL_SCORING;
    case "lotto":
      return DEFAULT_LOTTO_SCORING;
    case "chance":
      return DEFAULT_CHANCE_SCORING;
    default:
      return { mode: "custom", rules: undefined };
  }
}

/** Parse and normalize scoringConfigJson. Invalid/missing returns legacy default. */
export function parseCompetitionScoringConfig(
  json: unknown,
  legacyType: LegacyCompetitionType
): { config: CompetitionScoringConfig; warnings: string[] } {
  const warnings: string[] = [];
  if (json == null || json === "") {
    return { config: getDefaultScoringConfigForLegacyType(legacyType), warnings: ["Missing scoringConfigJson, using legacy default"] };
  }
  let raw: unknown;
  try {
    raw = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    warnings.push("Invalid scoringConfigJson JSON, using legacy default");
    return { config: getDefaultScoringConfigForLegacyType(legacyType), warnings };
  }
  if (!raw || typeof raw !== "object") {
    return { config: getDefaultScoringConfigForLegacyType(legacyType), warnings: ["scoringConfigJson is not an object"] };
  }
  const o = raw as Record<string, unknown>;

  if (o.pointsPerCorrectResult != null && (o.outcomeType === "1X2" || o.outcomeType == null)) {
    const pointsPerCorrectResult = typeof o.pointsPerCorrectResult === "number" && o.pointsPerCorrectResult >= 0
      ? o.pointsPerCorrectResult
      : 3;
    return {
      config: { mode: "match_result", pointsPerCorrectResult, outcomeType: "1X2" },
      warnings,
    };
  }

  if (o.pointsPerMatchingNumber != null || o.pointsForStrongHit != null) {
    const pointsPerMatchingNumber = typeof o.pointsPerMatchingNumber === "number" && o.pointsPerMatchingNumber >= 0
      ? o.pointsPerMatchingNumber
      : 1;
    const pointsForStrongHit = typeof o.pointsForStrongHit === "number" && o.pointsForStrongHit >= 0
      ? o.pointsForStrongHit
      : 1;
    return {
      config: { mode: "lotto_match", pointsPerMatchingNumber, pointsForStrongHit },
      warnings,
    };
  }

  if (o.compareCardsPerSuit === true || (o.compareCardsPerSuit == null && legacyType === "chance")) {
    const pointsPerMatch = typeof o.pointsPerMatch === "number" && o.pointsPerMatch >= 0 ? o.pointsPerMatch : 1;
    return {
      config: { mode: "chance_suits", compareCardsPerSuit: true, pointsPerMatch },
      warnings,
    };
  }

  warnings.push("Unrecognized scoring config, using legacy default");
  return { config: getDefaultScoringConfigForLegacyType(legacyType), warnings };
}
