/**
 * Phase 15: Lightweight internal metrics – counters/gauges for observability.
 * In-memory; for production consider exporting to Prometheus/StatsD.
 */

export const metrics = {
  settlementRuns: 0,
  settlementFailures: 0,
  notificationDeliverySuccess: 0,
  notificationDeliveryFailure: 0,
  tournamentJoins: 0,
  rateLimitHits: 0,
  reconciliationAnomalies: 0,
};

export function incrementSettlementRun(): void {
  metrics.settlementRuns += 1;
}

export function incrementSettlementFailure(): void {
  metrics.settlementFailures += 1;
}

export function incrementNotificationSuccess(): void {
  metrics.notificationDeliverySuccess += 1;
}

export function incrementNotificationFailure(): void {
  metrics.notificationDeliveryFailure += 1;
}

export function incrementTournamentJoin(): void {
  metrics.tournamentJoins += 1;
}

export function incrementRateLimitHit(): void {
  metrics.rateLimitHits += 1;
}

export function incrementReconciliationAnomaly(): void {
  metrics.reconciliationAnomalies += 1;
}

/** Snapshot for health/status endpoints. */
export function getMetricsSnapshot(): Record<string, number> {
  return { ...metrics };
}
