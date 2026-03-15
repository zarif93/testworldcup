/**
 * Phase 2B: Resolve competition type display name for admin (client-side).
 * Uses competition types from API when available; falls back to legacy labels for tournament.type.
 */

export type LegacyCompetitionType = "football" | "football_custom" | "lotto" | "chance" | "custom";

export const LEGACY_TYPE_LABELS: Record<string, string> = {
  football: "מונדיאל / כדורגל",
  football_custom: "כדורגל מותאם",
  lotto: "לוטו",
  chance: "צ'אנס",
  custom: "מותאם",
};

export interface CompetitionTypeFromApi {
  id: number;
  code: string;
  name: string | null;
  description?: string | null;
  category?: string | null;
}

/**
 * Get display name for a tournament in the admin list.
 * Prefers type from API (by competitionTypeId); otherwise uses legacy label for tournament.type.
 */
export function getCompetitionTypeDisplayName(
  tournament: { competitionTypeId?: number | null; type?: string | null },
  typesFromApi: CompetitionTypeFromApi[] | undefined
): string {
  if (tournament.competitionTypeId != null && tournament.competitionTypeId > 0 && typesFromApi?.length) {
    const t = typesFromApi.find((x) => x.id === tournament.competitionTypeId);
    if (t?.name) return t.name;
  }
  const type = tournament.type ?? "football";
  return LEGACY_TYPE_LABELS[type] ?? type;
}
