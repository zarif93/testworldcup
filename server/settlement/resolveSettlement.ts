/**
 * Phase 5: Resolve settlement path (schema vs legacy) and return winners + prize amounts.
 * Safe fallback to legacy when schema settlement is not applicable or fails.
 */

import type { CompetitionSettlementConfig } from "../schema/competitionSettlementConfig";
import { resolveTournamentSettlementConfig } from "../schema/resolveTournamentSchemas";
import { getLegacyTypeFromCompetitionType } from "../competitionTypeUtils";
import { settleTournamentBySchema } from "./settleTournamentBySchema";
import type { ScoredSubmission } from "./types";
import type { SchemaSettlementResult } from "./types";
import type { SettlementSource } from "./types";
import { logger } from "../_core/logger";

const SUPPORTED_LEGACY_TYPES = ["football", "football_custom", "lotto", "chance"] as const;

/** Full submission row as used in doDistributePrizesBody (has id, userId, username, points, strongHit?). */
export type SubmissionRow = ScoredSubmission & { strongHit?: boolean };

/** Winner submission with optional per-winner prize and rank (schema path); legacy uses same prizePerWinner for all. */
export type WinnerSubmissionRow = SubmissionRow & { prizeAmount?: number; rank?: number };

export interface ResolvedSettlementResult {
  winnerSubmissions: WinnerSubmissionRow[];
  prizePerWinner: number;
  distributed: number;
  settlementSource: SettlementSource;
  warnings: string[];
  schemaResult?: SchemaSettlementResult;
}

export type TournamentRow = { competitionTypeId?: number | null; type?: string | null; amount?: number; id?: number; guaranteedPrizeAmount?: number | null };

function shouldUseSchemaSettlement(
  tournament: TournamentRow,
  config: CompetitionSettlementConfig,
  submissionCount: number
): boolean {
  const legacyType = getLegacyTypeFromCompetitionType(tournament.type ?? "football") ?? "football";
  if (!SUPPORTED_LEGACY_TYPES.includes(legacyType as (typeof SUPPORTED_LEGACY_TYPES)[number])) {
    return false;
  }
  if (config.prizeMode === "custom") return false;
  if (submissionCount < (config.minParticipants ?? 1)) return false;
  return true;
}

/**
 * Resolve settlement: try schema first when applicable, else legacy.
 * Returns winner submissions (full rows), prizePerWinner, and distributed total for use by doDistributePrizesBody.
 */
export async function resolveSettlement(
  tournament: TournamentRow & { amount?: number; id?: number },
  submissions: SubmissionRow[]
): Promise<ResolvedSettlementResult> {
  const warnings: string[] = [];
  const tType = (tournament as { type?: string }).type ?? "football";
  const entryAmount = Number((tournament as { amount?: number }).amount ?? 0);
  const guaranteedPrize = Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0;

  let config: CompetitionSettlementConfig;
  try {
    const resolved = await resolveTournamentSettlementConfig(tournament);
    config = resolved.config;
    if (resolved.warnings.length > 0) warnings.push(...resolved.warnings);
  } catch (e) {
    warnings.push("Failed to resolve settlement config: " + String(e));
    return legacySettlement(submissions, tType, entryAmount, warnings, guaranteedPrize);
  }

  if (!shouldUseSchemaSettlement(tournament, config, submissions.length)) {
    if (process.env.NODE_ENV === "development" || warnings.length > 0) {
      logger.debug?.("Settlement fallback to legacy", {
        tournamentId: tournament.id,
        prizeMode: config.prizeMode,
        submissionCount: submissions.length,
      });
    }
    return legacySettlement(submissions, tType, entryAmount, warnings, guaranteedPrize);
  }

  try {
    const scored: ScoredSubmission[] = submissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      username: s.username,
      points: s.points,
      strongHit: s.strongHit,
    }));
    const schemaResult = settleTournamentBySchema(config, scored, {
      tournamentType: tType,
      entryAmount,
      guaranteedPrizeAmount: guaranteedPrize > 0 ? guaranteedPrize : undefined,
    });
    const winnerSubmissions: WinnerSubmissionRow[] = schemaResult.winners.map((w) => {
      const s = submissions.find((sub) => sub.id === w.submissionId);
      if (!s) throw new Error("Winner submission not in list");
      return { ...s, prizeAmount: w.prizeAmount, rank: w.rank };
    });
    return {
      winnerSubmissions,
      prizePerWinner: schemaResult.prizePerWinner,
      distributed: schemaResult.totalPrizeDistributed,
      settlementSource: "schema",
      warnings,
      schemaResult,
    };
  } catch (e) {
    warnings.push("Schema settlement failed, using legacy: " + String(e));
    logger.warn("Schema settlement failed, fallback to legacy", {
      tournamentId: tournament.id,
      error: String(e),
    });
    return legacySettlement(submissions, tType, entryAmount, warnings, guaranteedPrize);
  }
}

/** Phase 5: Compute legacy settlement only (for admin compare). No side effects. */
export function getLegacySettlementResult(
  submissions: SubmissionRow[],
  tournamentType: string,
  entryAmount: number,
  guaranteedPrizeAmount?: number
): { winnerSubmissions: SubmissionRow[]; prizePerWinner: number; distributed: number; prizePool: number } {
  const r = legacySettlement(submissions, tournamentType, entryAmount, [], guaranteedPrizeAmount ?? 0);
  const pool = (guaranteedPrizeAmount != null && guaranteedPrizeAmount > 0)
    ? guaranteedPrizeAmount
    : Math.round(submissions.length * entryAmount * 0.875);
  return {
    winnerSubmissions: r.winnerSubmissions,
    prizePerWinner: r.prizePerWinner,
    distributed: r.distributed,
    prizePool: pool,
  };
}

function legacySettlement(
  submissions: SubmissionRow[],
  tType: string,
  entryAmount: number,
  existingWarnings: string[],
  guaranteedPrizeAmount: number = 0
): ResolvedSettlementResult {
  const calculatedPool = Math.round(submissions.length * entryAmount * 0.875);
  const prizePool = (guaranteedPrizeAmount != null && guaranteedPrizeAmount > 0) ? guaranteedPrizeAmount : calculatedPool;
  let winnerSubmissions: SubmissionRow[];
  if (tType === "chance") {
    const maxPoints = submissions.length ? Math.max(...submissions.map((s) => s.points)) : 0;
    winnerSubmissions = maxPoints > 0 ? submissions.filter((s) => s.points === maxPoints) : [];
  } else if (tType === "lotto") {
    const maxScore = submissions.length ? Math.max(...submissions.map((s) => s.points)) : 0;
    winnerSubmissions = maxScore > 0 ? submissions.filter((s) => s.points === maxScore) : [];
  } else {
    const maxPoints = submissions.length ? Math.max(...submissions.map((s) => s.points), 0) : 0;
    winnerSubmissions = maxPoints > 0 ? submissions.filter((s) => s.points === maxPoints) : [];
  }
  const winnerCount = winnerSubmissions.length;
  const prizePerWinner = winnerCount > 0 ? Math.floor(prizePool / winnerCount) : 0;
  const distributed = prizePerWinner * winnerCount;
  return {
    winnerSubmissions,
    prizePerWinner,
    distributed,
    settlementSource: "legacy",
    warnings: existingWarnings,
  };
}
