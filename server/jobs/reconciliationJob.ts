/**
 * Phase 14: Financial reconciliation job – periodic verifyPrizePoolIntegrity, anomaly detection hooks.
 */

import { getFinancialRecords, verifyPrizePoolIntegrity } from "../db";
import { logger } from "../_core/logger";
import { incrementReconciliationAnomaly } from "../_core/metrics";

export type ReconciliationAnomaly = {
  tournamentId: number;
  ok: boolean;
  prizePoolExpected: number;
  totalDistributed: number;
  delta: number;
  participantCount: number;
};

export type ReconciliationResult = {
  checked: number;
  anomalies: ReconciliationAnomaly[];
};

/** Run integrity check for recently settled tournaments. Optionally call onAnomaly for each anomaly (e.g. alerting). */
export async function runFinancialReconciliationJob(opts?: {
  /** Only check tournaments closed in the last N ms. Default 7 days. */
  sinceMs?: number;
  /** Called for each tournament where verifyPrizePoolIntegrity returns ok: false. */
  onAnomaly?: (anomaly: ReconciliationAnomaly) => void;
}): Promise<ReconciliationResult> {
  const sinceMs = opts?.sinceMs ?? 7 * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - sinceMs);
  const records = await getFinancialRecords({ from: since });
  const tournamentIds = [...new Set(records.map((r) => r.competitionId))];
  const anomalies: ReconciliationAnomaly[] = [];

  for (const tournamentId of tournamentIds) {
    const result = await verifyPrizePoolIntegrity(tournamentId);
    if (!result.ok) {
      const anomaly: ReconciliationAnomaly = {
        tournamentId,
        ok: result.ok,
        prizePoolExpected: result.prizePoolExpected,
        totalDistributed: result.totalDistributed,
        delta: result.delta,
        participantCount: result.participantCount,
      };
      anomalies.push(anomaly);
      logger.warn("Financial reconciliation anomaly", anomaly);
      incrementReconciliationAnomaly();
      opts?.onAnomaly?.(anomaly);
    }
  }

  return { checked: tournamentIds.length, anomalies };
}
