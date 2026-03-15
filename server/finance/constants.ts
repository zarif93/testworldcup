/**
 * Finance constants and idempotency key patterns.
 * Rounding: floor everywhere. Residue: stays with platform.
 */

/** Commission: 1250 basis points = 12.50% */
export const DEFAULT_COMMISSION_BASIS_POINTS = 1250;
/** Agent share: 5000 basis points = 50% */
export const DEFAULT_AGENT_SHARE_BASIS_POINTS = 5000;
export const BASIS_POINTS_PER_PERCENT = 100;

/** Idempotency key patterns – must match FINANCE-DESIGN.md */
export const IDEMPOTENCY = {
  entry: (submissionId: number) => `entry:${submissionId}`,
  settlementPlatform: (tournamentId: number) => `settlement:${tournamentId}:platform`,
  settlementAgent: (tournamentId: number, agentId: number) => `settlement:${tournamentId}:agent:${agentId}`,
  settlementPrize: (tournamentId: number, submissionId: number) => `settlement:${tournamentId}:prize:${submissionId}`,
  refund: (refundId: string) => `refund:${refundId}`,
  adjustment: (adjustmentId: string) => `adjustment:${adjustmentId}`,
} as const;

/** Floor rounding for all points calculations */
export function floorPoints(value: number): number {
  const n = Math.floor(value);
  return Number.isFinite(n) ? n : 0;
}
