/**
 * Phase 5: Shared types for schema-driven settlement engine.
 */

export const SETTLEMENT_ENGINE_VERSION = "5.0-schema";

export type SettlementSource = "schema" | "legacy";

/** Minimal scored submission for settlement input. */
export interface ScoredSubmission {
  id: number;
  userId: number;
  username: string | null;
  points: number;
  strongHit?: boolean;
}

/** A group of submissions that share the same rank (e.g. tied for 1st). */
export interface TieGroup {
  rank: number;
  points: number;
  submissionIds: number[];
}

/** Winner entry for prize distribution. */
export interface WinnerEntry {
  submissionId: number;
  userId: number;
  username: string | null;
  rank: number;
  points: number;
  prizeAmount: number;
}

/** Result of schema-driven settlement (no side effects). */
export interface SchemaSettlementResult {
  settlementSource: SettlementSource;
  engineVersion?: string;
  winners: WinnerEntry[];
  /** All submissions ranked by points (and optional tie-break). */
  rankedSubmissions: Array<{ submissionId: number; userId: number; points: number; rank: number }>;
  tieGroups: TieGroup[];
  prizePoolTotal: number;
  totalPrizeDistributed: number;
  prizePerWinner: number;
  winnerCount: number;
  warnings: string[];
  metadata?: Record<string, unknown>;
}
