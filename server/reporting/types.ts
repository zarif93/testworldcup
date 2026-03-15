/**
 * Phase 9: Reporting context and abstractions.
 * Architecture-driven reporting: competition_type aware, schema aware, universal item aware.
 */

import type { CompetitionItemSetResolved } from "../competitionItems";
import type { CompetitionScoringConfig } from "../schema/competitionScoringConfig";
import type { CompetitionSettlementConfig } from "../schema/competitionSettlementConfig";
import type { SourceLabel } from "../competitionItems/types";

/** Context for a single tournament used in reports. Enables schema-aware and future-type-safe reporting. */
export interface ReportContext {
  tournamentId: number;
  tournamentName: string | null;
  /** DB id when tournament is linked to competition_types. */
  competitionTypeId: number | null;
  /** Code from competition_types or tournament.type (e.g. football, lotto, chance). */
  competitionTypeCode: string | null;
  /** Display name from competition_types or legacy label. */
  competitionTypeName: string | null;
  /** Resolved settlement config for this tournament (mode, rules). */
  settlementConfig: CompetitionSettlementConfig | null;
  /** Resolved scoring config (mode, rules). */
  scoringConfig: CompetitionScoringConfig | null;
  /** Primary item source for this tournament: legacy_* or universal_db. */
  itemSourceLabel: SourceLabel | null;
}

/** Model for reporting: resolved item sets + context. Use for grouping by set/round and per-event stats. */
export interface TournamentReportingModel {
  context: ReportContext;
  itemSets: CompetitionItemSetResolved[];
  /** Total item count across all sets. */
  totalItemCount: number;
}
