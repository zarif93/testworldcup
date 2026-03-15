/**
 * Phase 7: Universal competition items – shared types.
 * Items can come from legacy (matches, custom_football_matches, lotto/chance) or from competition_items table.
 */

export type SourceType = "legacy" | "universal";

/** Phase 8: Display label for admin/debug to distinguish source. */
export type SourceLabel =
  | "universal_db"
  | "legacy_worldcup"
  | "legacy_custom_matches"
  | "legacy_lotto"
  | "legacy_chance";

export interface CompetitionItemSetResolved {
  id: string;
  tournamentId: number;
  title: string;
  description?: string | null;
  itemType: string;
  sourceType: SourceType;
  /** Phase 8: Human-readable source for admin (e.g. legacy_worldcup, universal_db). */
  sourceLabel?: SourceLabel | null;
  stage?: string | null;
  round?: string | null;
  groupKey?: string | null;
  sortOrder: number;
  metadata?: Record<string, unknown> | null;
  items: CompetitionItemResolved[];
}

export interface CompetitionItemResolved {
  id: string;
  itemSetId: string;
  externalKey?: string | null;
  title: string;
  subtitle?: string | null;
  itemKind: string;
  startsAt?: number | null;
  closesAt?: number | null;
  sortOrder: number;
  status: string;
  sourceType: SourceType;
  /** Phase 8: Same as set sourceLabel when from legacy/universal set. */
  sourceLabel?: SourceLabel | null;
  /** For form/renderer: options schema (e.g. 1/X/2 for football, numbers for lotto). */
  optionSchema?: Record<string, unknown> | null;
  /** For scoring: result schema (e.g. homeScore, awayScore). */
  resultSchema?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  /** Legacy match id when source is legacy football/custom (for predictions keying). */
  legacyMatchId?: number | null;
}

/** Renderer-friendly model: one item for display in forms/lists. */
export interface CompetitionItemRendererModel {
  id: string;
  title: string;
  subtitle?: string | null;
  itemKind: string;
  sourceType: SourceType;
  legacyMatchId?: number | null;
  optionSchema?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** Result model: for scoring/admin result entry. */
export interface CompetitionItemResultModel {
  id: string;
  externalKey?: string | null;
  title: string;
  itemKind: string;
  resultSchema?: Record<string, unknown> | null;
  legacyMatchId?: number | null;
  metadata?: Record<string, unknown> | null;
}

/** Option model: selectable options for prediction (e.g. 1/X/2, or number set). */
export interface CompetitionItemOptionModel {
  itemId: string;
  itemKind: string;
  options: unknown;
  optionSchema?: Record<string, unknown> | null;
}
