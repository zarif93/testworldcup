/**
 * Commission resolution – basis points, floor rounding, residue to platform.
 * Agent share: per-agent override from agent_commission_config, else default 5000 bps.
 * PRODUCTION: No silent commission defaults. Competition must have commissionPercentBasisPoints set (schema default or explicit).
 */

import { getSchema, getDb } from "../db";
import { eq } from "drizzle-orm";
import { DEFAULT_AGENT_SHARE_BASIS_POINTS, floorPoints } from "./constants";
import { logError } from "../_core/logger";

const TEN_THOUSAND = 10_000;

/** Thrown when a competition has no commission defined. Fail-fast for real-money integrity. */
export class MissingCommissionError extends Error {
  constructor(
    public readonly context: { tournamentId?: number; competitionName?: string }
  ) {
    super(
      `Commission not defined for competition. Set commissionPercentBasisPoints (e.g. run migrations). ${JSON.stringify(context)}`
    );
    this.name = "MissingCommissionError";
  }
}

/**
 * Effective commission basis points for a tournament.
 * Only schema default or explicit DB value is allowed. No runtime fallback.
 * @throws MissingCommissionError if commissionPercentBasisPoints is null/undefined
 */
export function getCommissionBasisPoints(tournament: {
  id?: number;
  name?: string;
  commissionPercentBasisPoints?: number | null;
}): number {
  const bps = tournament.commissionPercentBasisPoints;
  if (bps != null && Number.isFinite(bps)) {
    return Math.max(0, Math.floor(bps));
  }
  const err = new MissingCommissionError({
    tournamentId: tournament.id,
    competitionName: tournament.name ?? undefined,
  });
  logError("getCommissionBasisPoints", err, {
    tournamentId: tournament.id,
    commissionPercentBasisPoints: bps,
  });
  throw err;
}

/** Platform commission from total pool (floor). Residue stays with platform. commissionBasisPoints required. */
export function computePlatformCommission(totalPool: number, commissionBasisPoints: number): number {
  return floorPoints((totalPool * commissionBasisPoints) / TEN_THOUSAND);
}

/** Prize pool after commission. commissionBasisPoints required. */
export function computePrizePool(totalPool: number, commissionBasisPoints: number): number {
  return totalPool - computePlatformCommission(totalPool, commissionBasisPoints);
}

/** Agent share of commission (floor). Residue stays with platform. */
export function computeAgentShare(
  agentGeneratedCommission: number,
  agentShareBasisPoints: number = DEFAULT_AGENT_SHARE_BASIS_POINTS
): number {
  return floorPoints((agentGeneratedCommission * agentShareBasisPoints) / TEN_THOUSAND);
}

/** Resolved agent share basis points: per-agent override > default */
export async function getAgentShareBasisPoints(agentId: number): Promise<number> {
  const { agentCommissionConfig } = await getSchema();
  const db = await getDb();
  if (!db) return DEFAULT_AGENT_SHARE_BASIS_POINTS;
  const row = await db.select({ agentShareBasisPoints: agentCommissionConfig.agentShareBasisPoints }).from(agentCommissionConfig).where(eq(agentCommissionConfig.agentId, agentId)).limit(1);
  const bps = row[0]?.agentShareBasisPoints;
  if (bps != null && Number.isFinite(bps)) return Math.max(0, Math.floor(bps));
  return DEFAULT_AGENT_SHARE_BASIS_POINTS;
}

/** Platform net commission after paying agents (residue from floor stays with platform) */
export function computePlatformNetCommission(platformCommission: number, agentCommissionTotal: number): number {
  return platformCommission - agentCommissionTotal;
}

/** Total commission from a single paid entry. commissionBasisPoints required (from tournament). */
export function computeCommissionFromEntry(entryAmount: number, commissionBasisPoints: number): number {
  return floorPoints((entryAmount * commissionBasisPoints) / TEN_THOUSAND);
}

/** Split total commission 50% agent / 50% platform for report consistency. */
export function computeReportCommissionSplit(
  totalCommission: number,
  agentShareBasisPoints: number = DEFAULT_AGENT_SHARE_BASIS_POINTS
): { agentCommission: number; platformCommission: number } {
  const agentCommission = floorPoints((totalCommission * agentShareBasisPoints) / TEN_THOUSAND);
  return { agentCommission, platformCommission: totalCommission - agentCommission };
}
