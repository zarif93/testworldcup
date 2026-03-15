/**
 * Phase 14: Settlement orchestration – job queue, retry-safe execution, resumable payout.
 * Acquires distributed lock before running settlement; recovery path re-runs doDistributePrizesBody (idempotent per-winner).
 */

import { logger } from "../_core/logger";
import { incrementSettlementRun, incrementSettlementFailure } from "../_core/metrics";
import { getTournamentsToSettleNow, getTournamentsWithStatusSettling } from "../db";
import { distributePrizesForTournament } from "../db";
import { runRecoverSettlements } from "../db";
import { acquireSettlementLock, releaseSettlementLock } from "./distributedLock";

export type SettlementJobResult = {
  tournamentId: number;
  ok: boolean;
  error?: string;
  winnerCount?: number;
  distributed?: number;
};

/** Run settlement for one tournament with distributed lock. Retry-safe: payout loop is resumable (skips already-paid winners). */
export async function runSettlementJobWithLock(tournamentId: number): Promise<SettlementJobResult> {
  const acquired = await acquireSettlementLock(tournamentId);
  if (!acquired) {
    return { tournamentId, ok: false, error: "Could not acquire settlement lock" };
  }
  try {
    const result = await distributePrizesForTournament(tournamentId);
    incrementSettlementRun();
    return {
      tournamentId,
      ok: true,
      winnerCount: result.winnerCount,
      distributed: result.distributed,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("Settlement job failed", { tournamentId, error: message });
    incrementSettlementFailure();
    return { tournamentId, ok: false, error: message };
  } finally {
    await releaseSettlementLock(tournamentId);
  }
}

/** Run settlement for all tournaments due now (from getTournamentsToSettleNow). Each runs with lock. */
export async function runSettlementCycle(): Promise<SettlementJobResult[]> {
  const toSettle = await getTournamentsToSettleNow();
  const results: SettlementJobResult[] = [];
  for (const { id } of toSettle) {
    const result = await runSettlementJobWithLock(id);
    results.push(result);
  }
  return results;
}

/** Recovery: process tournaments stuck in SETTLING. Resumable – doDistributePrizesBody skips already-paid winners. */
export async function runSettlementRecovery(opts?: { onlyTournamentIds?: number[] }): Promise<{ recovered: number[]; errors: { tournamentId: number; error: string }[] }> {
  return runRecoverSettlements(opts);
}

/** Get list of tournament IDs that are due for settlement (for job queue / cron). */
export async function getSettlementDueTournamentIds(): Promise<number[]> {
  const rows = await getTournamentsToSettleNow();
  return rows.map((r) => r.id);
}

/** Get list of tournament IDs stuck in SETTLING (for recovery job). */
export async function getStuckSettlementTournamentIds(): Promise<number[]> {
  const rows = await getTournamentsWithStatusSettling();
  return rows.map((r) => r.id);
}
