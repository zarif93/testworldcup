/**
 * Phase 14: Distributed locking for settlement and state transitions.
 * Uses DB-backed locks (tournament_locks); replace with Redis for multi-instance if needed.
 */

import { acquireTournamentLock, releaseTournamentLock } from "../db";

const INSTANCE_ID = process.env.INSTANCE_ID ?? `node-${process.pid}-${Date.now()}`;
const SETTLEMENT_LOCK_TTL_MS = 10 * 60 * 1000;

export function getInstanceId(): string {
  return INSTANCE_ID;
}

/** Lock key for settlement – only one instance can run settlement for this tournament. */
export function settlementLockKey(tournamentId: number): string {
  return `settlement:${tournamentId}`;
}

/** Lock key for tournament state transition. */
export function transitionLockKey(tournamentId: number): string {
  return `transition:${tournamentId}`;
}

export async function acquireSettlementLock(tournamentId: number): Promise<boolean> {
  return acquireTournamentLock(settlementLockKey(tournamentId), INSTANCE_ID, SETTLEMENT_LOCK_TTL_MS);
}

export async function releaseSettlementLock(tournamentId: number): Promise<void> {
  return releaseTournamentLock(settlementLockKey(tournamentId), INSTANCE_ID);
}

export async function acquireTransitionLock(tournamentId: number, ttlMs = 30_000): Promise<boolean> {
  return acquireTournamentLock(transitionLockKey(tournamentId), INSTANCE_ID, ttlMs);
}

export async function releaseTransitionLock(tournamentId: number): Promise<void> {
  return releaseTournamentLock(transitionLockKey(tournamentId), INSTANCE_ID);
}
