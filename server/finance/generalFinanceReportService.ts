/**
 * General finance report: one row per user, summary totals.
 * Used for financial validation tests. Built from getPlayerFinancialProfile + users.points.
 */

import { getAllUsers } from "../db";
import { getPlayerFinancialProfile } from "./playerFinanceService";

export interface GeneralFinanceReportRow {
  userId: number;
  totalBets: number;
  totalWins: number;
  commission: number;
  finalBalance: number;
  profitLoss: number;
}

export interface GeneralFinanceReportSummary {
  totalBets: number;
  totalWins: number;
  totalCommission: number;
  totalOpenBalance: number;
  totalSiteLoss: number;
  totalSiteProfit: number;
}

export interface GeneralFinanceReport {
  rows: GeneralFinanceReportRow[];
  summary: GeneralFinanceReportSummary;
}

export interface GeneralFinanceReportFilter {
  /** Limit rows (e.g. for tests). Omit for all users. */
  limit?: number;
}

/**
 * Build general finance report: one row per user (from getAllUsers), totals from profiles + points.
 * Summary totals equal sum of rows. profitLoss = competitionNetPnL (wins - bets + refunds).
 */
export async function getGeneralFinanceReport(
  _opts?: GeneralFinanceReportFilter
): Promise<GeneralFinanceReport> {
  const users = await getAllUsers({ includeDeleted: false });
  const limit = _opts?.limit ?? users.length;
  const rows: GeneralFinanceReportRow[] = [];

  for (let i = 0; i < Math.min(users.length, limit); i++) {
    const u = users[i];
    const userId = (u as { id: number }).id;
    const points = Number((u as { points?: number }).points ?? 0);
    const profile = await getPlayerFinancialProfile(userId);

    const totalBets = profile?.totalEntryFees ?? 0;
    const totalWins = profile?.totalPrizesWon ?? 0;
    const commission = profile?.totalCommissionGenerated ?? 0;
    const profitLoss = profile?.competitionNetPnL ?? 0;

    rows.push({
      userId,
      totalBets,
      totalWins,
      commission,
      finalBalance: points,
      profitLoss,
    });
  }

  const totalBets = rows.reduce((s, r) => s + r.totalBets, 0);
  const totalWins = rows.reduce((s, r) => s + r.totalWins, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalOpenBalance = rows.reduce((s, r) => s + r.finalBalance, 0);
  const sumProfitLoss = rows.reduce((s, r) => s + r.profitLoss, 0);
  const totalSiteLoss = rows.reduce((s, r) => s + Math.max(0, r.profitLoss), 0);
  const totalSiteProfit = rows.reduce((s, r) => s + Math.max(0, -r.profitLoss), 0);

  return {
    rows,
    summary: {
      totalBets,
      totalWins,
      totalCommission,
      totalOpenBalance,
      totalSiteLoss,
      totalSiteProfit,
    },
  };
}
