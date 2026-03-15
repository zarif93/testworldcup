/**
 * Phase 11/12: Payment system readiness – balance, winnings, deposits, locked/available.
 * Re-exports and aggregates from db; single place for payment-related reads.
 * No payment provider integration – internal structure only.
 */

import {
  getUserPoints,
  getWinningsTotal,
  getDepositsTotal,
  getLockedBalance,
} from "../db";

/** User balance (points). Single source of truth from users.points. */
export const getBalance = getUserPoints;

/** Phase 12: Locked balance = entry fees for active tournament submissions. */
export const getLockedBalanceForUser = getLockedBalance;

/** Phase 12: Available balance = total − locked (for spending/entry). */
export async function getAvailableBalance(userId: number): Promise<number> {
  const total = await getUserPoints(userId);
  const locked = await getLockedBalance(userId);
  return Math.max(0, total - locked);
}

/** Phase 12: Full balance summary for monetization logic. */
export async function getBalanceSummary(userId: number): Promise<{
  total: number;
  locked: number;
  available: number;
  totalWinnings: number;
  totalDeposits: number;
}> {
  const [total, locked, totalWinnings, totalDeposits] = await Promise.all([
    getUserPoints(userId),
    getLockedBalance(userId),
    getWinningsTotal(userId),
    getDepositsTotal(userId),
  ]);
  const available = Math.max(0, total - locked);
  return { total, locked, available, totalWinnings, totalDeposits };
}

/** Total prize winnings ever credited to the user. */
export async function getWinningsSummary(userId: number): Promise<{ totalWinnings: number }> {
  const totalWinnings = await getWinningsTotal(userId);
  return { totalWinnings };
}

/** Total deposits (deposit + admin_approval) ever for the user. */
export async function getDepositsSummary(userId: number): Promise<{ totalDeposits: number }> {
  const totalDeposits = await getDepositsTotal(userId);
  return { totalDeposits };
}
