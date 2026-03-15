/**
 * Commission resolution – basis points, floor rounding, residue to platform.
 * Agent share: per-agent override from agent_commission_config, else default 5000 bps.
 */

import { getSchema, getDb } from "../db";
import { eq } from "drizzle-orm";
import { DEFAULT_COMMISSION_BASIS_POINTS, DEFAULT_AGENT_SHARE_BASIS_POINTS, BASIS_POINTS_PER_PERCENT, floorPoints } from "./constants";

const TEN_THOUSAND = 10_000;

/** Effective commission basis points for a tournament (commissionPercentBasisPoints or legacy houseFeeRate*100, else default) */
export function getCommissionBasisPoints(tournament: {
  commissionPercentBasisPoints?: number | null;
  commissionPercent?: number | null;
  houseFeeRate?: number | null;
}): number {
  if (tournament.commissionPercentBasisPoints != null && Number.isFinite(tournament.commissionPercentBasisPoints))
    return Math.max(0, Math.floor(tournament.commissionPercentBasisPoints));
  const legacy = tournament.commissionPercent ?? tournament.houseFeeRate ?? 12.5;
  return Math.max(0, Math.floor(Number(legacy) * BASIS_POINTS_PER_PERCENT)) || DEFAULT_COMMISSION_BASIS_POINTS;
}

/** Platform commission from total pool (floor). Residue stays with platform. */
export function computePlatformCommission(totalPool: number, commissionBasisPoints: number = DEFAULT_COMMISSION_BASIS_POINTS): number {
  return floorPoints((totalPool * commissionBasisPoints) / TEN_THOUSAND);
}

/** Prize pool after commission */
export function computePrizePool(totalPool: number, commissionBasisPoints: number = DEFAULT_COMMISSION_BASIS_POINTS): number {
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

/** Total commission from a single paid entry (12.5% = 1250 bps). Use for reports and display. */
export function computeCommissionFromEntry(entryAmount: number, commissionBasisPoints: number = DEFAULT_COMMISSION_BASIS_POINTS): number {
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
