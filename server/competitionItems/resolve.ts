/**
 * Phase 7: Resolve tournament items from legacy or universal storage.
 * Backward-compatible: existing football/lotto/chance use legacy resolution only.
 */

import {
  getMatches,
  getCustomFootballMatches,
  getTournamentById,
} from "../db";
import type {
  CompetitionItemSetResolved,
  CompetitionItemResolved,
  SourceType,
} from "./types";

const SOURCE_LEGACY: SourceType = "legacy";

/** World cup / global matches → one set, one item per match. */
export async function resolveLegacyMatchesAsCompetitionItems(): Promise<CompetitionItemSetResolved> {
  const rows = await getMatches();
  const items: CompetitionItemResolved[] = rows.map((m) => {
    const id = `legacy:match:${m.id}`;
    return {
      id,
      itemSetId: "legacy:matches",
      externalKey: String(m.id),
      title: `${(m as { homeTeam?: string }).homeTeam} - ${(m as { awayTeam?: string }).awayTeam}`,
      subtitle: (m as { groupName?: string }).groupName
        ? `קבוצה ${(m as { groupName: string }).groupName}`
        : null,
      itemKind: "football_match",
      startsAt: null,
      closesAt: null,
      sortOrder: (m as { matchNumber?: number }).matchNumber ?? m.id,
      status: "open",
      sourceType: SOURCE_LEGACY,
      optionSchema: { type: "1X2", options: ["1", "X", "2"] },
      resultSchema: { type: "score", homeScore: true, awayScore: true },
      metadata: {
        homeTeam: (m as { homeTeam?: string }).homeTeam,
        awayTeam: (m as { awayTeam?: string }).awayTeam,
        groupName: (m as { groupName?: string }).groupName,
        matchDate: (m as { matchDate?: string }).matchDate,
        matchTime: (m as { matchTime?: string }).matchTime,
      },
      legacyMatchId: m.id,
    };
  });
  return {
    id: "legacy:matches",
    tournamentId: 0,
    title: "משחקי מונדיאל",
    description: "משחקי שלב הבתים – מקור legacy",
    itemType: "football_match",
    sourceType: SOURCE_LEGACY,
    sourceLabel: "legacy_worldcup",
    sortOrder: 0,
    items: items.map((i) => ({ ...i, sourceLabel: "legacy_worldcup" as const })),
  };
}

/** Custom football matches for a tournament → one set, one item per match. */
export async function resolveLegacyCustomMatchesAsCompetitionItems(
  tournamentId: number
): Promise<CompetitionItemSetResolved> {
  const rows = await getCustomFootballMatches(tournamentId);
  const items: CompetitionItemResolved[] = rows.map((m, idx) => {
    const id = `legacy:custom:${m.id}`;
    return {
      id,
      itemSetId: `legacy:custom:${tournamentId}`,
      externalKey: String(m.id),
      title: `${m.homeTeam} - ${m.awayTeam}`,
      subtitle: m.matchDate || m.matchTime ? `${m.matchDate ?? ""} ${m.matchTime ?? ""}`.trim() || null : null,
      itemKind: "football_match",
      startsAt: null,
      closesAt: null,
      sortOrder: m.displayOrder ?? idx,
      status: "open",
      sourceType: SOURCE_LEGACY,
      optionSchema: { type: "1X2", options: ["1", "X", "2"] },
      resultSchema: { type: "score", homeScore: true, awayScore: true },
      metadata: {
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        matchDate: m.matchDate,
        matchTime: m.matchTime,
      },
      legacyMatchId: m.id,
    };
  });
  return {
    id: `legacy:custom:${tournamentId}`,
    tournamentId,
    title: "משחקים מותאמים",
    description: "משחקי תחרויות ספורט – מקור legacy",
    itemType: "football_match",
    sourceType: SOURCE_LEGACY,
    sourceLabel: "legacy_custom_matches",
    sortOrder: 0,
    items: items.map((i) => ({ ...i, sourceLabel: "legacy_custom_matches" as const })),
  };
}

/** Lotto: one synthetic set with one item (the draw). */
export async function resolveLottoAsCompetitionItems(
  tournamentId: number
): Promise<CompetitionItemSetResolved> {
  const item: CompetitionItemResolved = {
    id: `legacy:lotto:${tournamentId}`,
    itemSetId: `legacy:lotto:${tournamentId}`,
    externalKey: "draw",
    title: "הגרלת לוטו",
    subtitle: "6 מספרים (1–37) + מספר חזק (1–7)",
    itemKind: "lotto_draw",
    startsAt: null,
    closesAt: null,
    sortOrder: 0,
    status: "open",
    sourceType: SOURCE_LEGACY,
    optionSchema: {
      regularCount: 6,
      regularMin: 1,
      regularMax: 37,
      strongMin: 1,
      strongMax: 7,
    },
    resultSchema: { type: "lotto", num1: true, num2: true, num3: true, num4: true, num5: true, num6: true, strongNumber: true },
    metadata: { tournamentId },
  };
  return {
    id: `legacy:lotto:${tournamentId}`,
    tournamentId,
    title: "הגרלת לוטו",
    description: "מקור legacy",
    itemType: "lotto_draw",
    sourceType: SOURCE_LEGACY,
    sourceLabel: "legacy_lotto",
    sortOrder: 0,
    items: [{ ...item, sourceLabel: "legacy_lotto" as const }],
  };
}

/** Chance: one synthetic set with one item (the draw). */
export async function resolveChanceAsCompetitionItems(
  tournamentId: number
): Promise<CompetitionItemSetResolved> {
  const item: CompetitionItemResolved = {
    id: `legacy:chance:${tournamentId}`,
    itemSetId: `legacy:chance:${tournamentId}`,
    externalKey: "draw",
    title: "הגרלת צ'אנס",
    subtitle: "קלף אחד מכל צורה",
    itemKind: "chance_draw",
    startsAt: null,
    closesAt: null,
    sortOrder: 0,
    status: "open",
    sourceType: SOURCE_LEGACY,
    optionSchema: {
      suits: ["heart", "club", "diamond", "spade"],
      cards: ["7", "8", "9", "10", "J", "Q", "K", "A"],
    },
    resultSchema: { type: "chance", heartCard: true, clubCard: true, diamondCard: true, spadeCard: true },
    metadata: { tournamentId },
  };
  return {
    id: `legacy:chance:${tournamentId}`,
    tournamentId,
    title: "הגרלת צ'אנס",
    description: "מקור legacy",
    itemType: "chance_draw",
    sourceType: SOURCE_LEGACY,
    sourceLabel: "legacy_chance",
    sortOrder: 0,
    items: [{ ...item, sourceLabel: "legacy_chance" as const }],
  };
}

/** Resolve all item sets for a tournament by type. Existing flows stay legacy. */
export async function resolveTournamentItems(
  tournamentId: number
): Promise<CompetitionItemSetResolved[]> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return [];
  const t = tournament as { type?: string };
  const type = (t.type ?? "").toString().toLowerCase().trim();

  if (type === "football" || type === "worldcup" || type === "world_cup" || type === "") {
    const set = await resolveLegacyMatchesAsCompetitionItems();
    return [{ ...set, tournamentId }];
  }
  if (type === "football_custom") {
    const set = await resolveLegacyCustomMatchesAsCompetitionItems(tournamentId);
    return [set];
  }
  if (type === "lotto") {
    return [await resolveLottoAsCompetitionItems(tournamentId)];
  }
  if (type === "chance") {
    return [await resolveChanceAsCompetitionItems(tournamentId)];
  }
  return [];
}
