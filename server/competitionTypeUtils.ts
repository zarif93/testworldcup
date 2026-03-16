/**
 * Phase 2A: Compatibility helpers between legacy tournament.type and competition_types table.
 * Use these so existing code can work unchanged; when competitionTypeId is set, prefer type from DB.
 */

import { getCompetitionTypeById, getCompetitionTypeByCode } from "./db";

/** Legacy type values stored in tournaments.type (and used in createTournament input). */
export type LegacyCompetitionType = "football" | "football_custom" | "lotto" | "chance" | "custom";

/** Map from competition type code to legacy type (for create/submit/score flows that still use type). */
const CODE_TO_LEGACY: Record<string, LegacyCompetitionType> = {
  football: "football",
  football_custom: "football_custom",
  lotto: "lotto",
  chance: "chance",
  custom: "custom",
};

/** Map from legacy type to display name (Hebrew) when type is not in DB. */
const LEGACY_DISPLAY_NAMES: Record<string, string> = {
  football: "מונדיאל",
  football_custom: "תחרויות ספורט",
  lotto: "לוטו",
  chance: "צ'אנס",
  custom: "מותאם",
};

export interface ResolvedCompetitionType {
  id: number;
  code: string;
  name: string;
  /** Legacy type for use in existing branches (e.g. scoring, submit). */
  legacyType: LegacyCompetitionType;
}

/**
 * Resolve competition type for a tournament. Uses competitionTypeId when set; otherwise
 * derives from tournament.type and looks up by code. Existing competitions with null
 * competitionTypeId continue to work via legacy type.
 */
export async function resolveCompetitionTypeForTournament(tournament: {
  competitionTypeId?: number | null;
  type?: string | null;
}): Promise<ResolvedCompetitionType | null> {
  if (tournament.competitionTypeId != null && tournament.competitionTypeId > 0) {
    const ct = await getCompetitionTypeById(tournament.competitionTypeId);
    if (ct) {
      const legacyType = getLegacyTypeFromCompetitionType(ct.code) ?? ("custom" as LegacyCompetitionType);
      return {
        id: ct.id,
        code: ct.code,
        name: (ct as { name?: string }).name ?? ct.code,
        legacyType,
      };
    }
  }
  const legacy = getLegacyTypeFromCompetitionType(tournament.type ?? "football");
  if (!legacy) return null;
  const ct = await getCompetitionTypeByCode(tournament.type ?? "football");
  if (ct) {
    return {
      id: ct.id,
      code: ct.code,
      name: (ct as { name?: string }).name ?? ct.code,
      legacyType: legacy,
    };
  }
  return null;
}

/**
 * Get legacy tournament.type from a competition type code or entity.
 * Used when existing code expects football | football_custom | lotto | chance | custom.
 */
export function getLegacyTypeFromCompetitionType(
  codeOrEntity: string | { code: string }
): LegacyCompetitionType | null {
  const code = typeof codeOrEntity === "string" ? codeOrEntity : codeOrEntity.code;
  const normalized = (code ?? "").trim().toLowerCase();
  return CODE_TO_LEGACY[normalized] ?? null;
}

/**
 * Display name for a competition type. Accepts either a tournament row (with optional
 * competitionTypeId/type) or a competition type entity. When only legacy type is available,
 * returns Hebrew label from LEGACY_DISPLAY_NAMES.
 */
export async function getCompetitionTypeDisplayName(
  tournamentOrType:
    | { competitionTypeId?: number | null; type?: string | null }
    | { code: string; name?: string | null }
): Promise<string> {
  if ("code" in tournamentOrType && "name" in tournamentOrType && tournamentOrType.name) {
    return tournamentOrType.name;
  }
  if ("code" in tournamentOrType) {
    const legacy = getLegacyTypeFromCompetitionType(tournamentOrType.code);
    return (legacy && LEGACY_DISPLAY_NAMES[legacy]) || tournamentOrType.code;
  }
  const resolved = await resolveCompetitionTypeForTournament(tournamentOrType);
  if (resolved) return resolved.name;
  const legacy = getLegacyTypeFromCompetitionType(tournamentOrType.type ?? "football");
  return (legacy && LEGACY_DISPLAY_NAMES[legacy]) || String(tournamentOrType.type ?? "תחרות");
}

/** Sync display name when you only have legacy type (e.g. in admin filter list before API). */
export function getLegacyTypeDisplayName(legacyType: string): string {
  return LEGACY_DISPLAY_NAMES[legacyType] ?? legacyType;
}
