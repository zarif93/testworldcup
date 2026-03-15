/**
 * Phase 4: Shared types for schema-driven scoring engine.
 */

export const SCORING_ENGINE_VERSION = "4.0-schema";

export type ScoringSource = "schema" | "legacy";

export interface SchemaScoreResult {
  totalPoints: number;
  scoringSource: ScoringSource;
  engineVersion?: string;
  breakdown?: Record<string, number>;
  matchedItems?: number;
  strongHit?: boolean;
  warnings: string[];
  /** For debugging: raw breakdown per match/number/suit */
  metadata?: Record<string, unknown>;
}

/** Context for football scoring: match results + predictions. */
export interface FootballScoringContext {
  type: "football";
  matchResults: Map<number, { homeScore: number; awayScore: number }>;
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }>;
}

/** Context for lotto scoring: draw result + prediction. */
export interface LottoScoringContext {
  type: "lotto";
  draw: { num1: number; num2: number; num3: number; num4: number; num5: number; num6: number; strongNumber: number };
  predictions: { numbers: number[]; strongNumber: number };
}

/** Context for chance scoring: draw result + prediction. */
export interface ChanceScoringContext {
  type: "chance";
  draw: { heartCard: string; clubCard: string; diamondCard: string; spadeCard: string };
  predictions: { heart: string; club: string; diamond: string; spade: string };
}

export type ScoringContext = FootballScoringContext | LottoScoringContext | ChanceScoringContext;
