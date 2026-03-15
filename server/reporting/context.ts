/**
 * Phase 9: Resolve reporting context and tournament reporting model.
 * Uses competition_types, schema resolution, and universal items.
 */

import { getTournamentById, getCompetitionItemSetsByTournament, getCompetitionTypeById } from "../db";
import { resolveTournamentSchemas } from "../schema/resolveTournamentSchemas";
import { resolveTournamentItems } from "../competitionItems";
import { getLegacyTypeDisplayName } from "../competitionTypeUtils";
import type { ReportContext, TournamentReportingModel } from "./types";
import type { SourceLabel } from "../competitionItems/types";

const SOURCE_UNIVERSAL: SourceLabel = "universal_db";

/**
 * Build ReportContext for a tournament. Safe for missing tournament (returns null).
 */
export async function resolveReportContextForTournament(tournamentId: number): Promise<ReportContext | null> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return null;
  const t = tournament as { id: number; name?: string | null; competitionTypeId?: number | null; type?: string | null };
  const schemas = await resolveTournamentSchemas(t);
  const dbSets = await getCompetitionItemSetsByTournament(tournamentId);
  const hasUniversalSets = Array.isArray(dbSets) && dbSets.length > 0;
  let itemSourceLabel: SourceLabel | null = hasUniversalSets ? SOURCE_UNIVERSAL : null;
  if (!itemSourceLabel) {
    const legacySets = await resolveTournamentItems(tournamentId);
    const first = legacySets[0];
    if (first?.sourceLabel) itemSourceLabel = first.sourceLabel;
  }
  let competitionTypeName: string | null = null;
  if (schemas.competitionTypeId != null) {
    const ct = await getCompetitionTypeById(schemas.competitionTypeId);
    if (ct) competitionTypeName = (ct as { name?: string | null }).name ?? schemas.competitionTypeCode;
  }
  if (!competitionTypeName && schemas.competitionTypeCode)
    competitionTypeName = getLegacyTypeDisplayName(schemas.competitionTypeCode);
  return {
    tournamentId: t.id,
    tournamentName: t.name ?? null,
    competitionTypeId: schemas.competitionTypeId ?? null,
    competitionTypeCode: schemas.competitionTypeCode ?? (t.type ?? null),
    competitionTypeName,
    settlementConfig: schemas.settlementConfig ?? null,
    scoringConfig: schemas.scoringConfig ?? null,
    itemSourceLabel,
  };
}

/**
 * Full reporting model for a tournament: context + resolved item sets.
 * Use for grouping by set/round and per-event participation stats.
 */
export async function resolveTournamentReportingModel(tournamentId: number): Promise<TournamentReportingModel | null> {
  const context = await resolveReportContextForTournament(tournamentId);
  if (!context) return null;
  const itemSets = await resolveTournamentItems(tournamentId);
  const totalItemCount = itemSets.reduce((sum, set) => sum + set.items.length, 0);
  return {
    context,
    itemSets,
    totalItemCount,
  };
}
