/**
 * General financial report – ALL registered users (including zero activity).
 * Columns: Username | Agent | Total Bets | Total Wins | Commission | Profit/Loss | Final Balance
 * Summary: Total Bets, Total Wins, Total Commission, Total Site Profit, Total Site Loss, Total Open Balance
 */

import { getAllUsers, getUserById } from "../db";
import { getPlayerFinancialProfile } from "./playerFinanceService";
import type { PlayerFinancialProfileFilter } from "./playerFinanceService";

export interface GeneralReportRow {
  userId: number;
  username: string | null;
  agentName: string | null;
  agentUsername: string | null;
  totalBets: number;
  totalWins: number;
  commission: number;
  profitLoss: number;
  finalBalance: number;
}

export interface GeneralReportSummary {
  totalBets: number;
  totalWins: number;
  totalCommission: number;
  totalSiteProfit: number;
  totalSiteLoss: number;
  totalOpenBalance: number;
}

export interface GeneralFinanceReport {
  rows: GeneralReportRow[];
  summary: GeneralReportSummary;
  from: string | null;
  to: string | null;
}

export interface GeneralReportFilter {
  from?: string;
  to?: string;
}

/**
 * Build general report: ALL users with role 'user', with financial profile and current balance.
 * Commission = agent commission from this player's activity (for summary: total agent commission).
 * Profit/Loss = player PnL (wins - bets + refunds). Site profit/loss = sum of (commission - player PnL) per player? No.
 * Spec: Total Site Profit = sum of positive platform gains; Total Site Loss = sum of payouts/refunds over intake; Total Open Balance = sum of all final balances (what site "owes" users).
 */
export async function getGeneralFinanceReport(filter?: GeneralReportFilter): Promise<GeneralFinanceReport> {
  const all = await getAllUsers({ includeDeleted: false });
  const players = all.filter((u) => (u as { role?: string }).role === "user");
  const dateFilter: PlayerFinancialProfileFilter | undefined =
    filter?.from != null || filter?.to != null ? { from: filter.from, to: filter.to } : undefined;

  const rows: GeneralReportRow[] = [];
  let totalBets = 0;
  let totalWins = 0;
  let totalCommission = 0;
  let totalSiteProfit = 0;
  let totalSiteLoss = 0;
  let totalOpenBalance = 0;

  for (const u of players) {
    const userId = (u as { id: number }).id;
    const profile = await getPlayerFinancialProfile(userId, dateFilter);
    const points = Number((u as { points?: number }).points ?? 0);
    const agentId = (u as { agentId?: number | null }).agentId ?? null;
    let agentName: string | null = null;
    let agentUsername: string | null = null;
    if (agentId != null) {
      const agent = await getUserById(agentId);
      if (agent) {
        agentName = (agent as { name?: string | null }).name ?? null;
        agentUsername = (agent as { username?: string | null }).username ?? null;
      }
    }
    const totalBetsRow = profile?.totalEntryFees ?? 0;
    const totalWinsRow = profile?.totalPrizesWon ?? 0;
    const commissionRow = profile?.agentCommissionFromPlayer ?? 0;
    const profitLossRow = profile?.competitionNetPnL ?? 0;
    totalBets += totalBetsRow;
    totalWins += totalWinsRow;
    totalCommission += commissionRow;
    totalOpenBalance += points;
    if (profitLossRow > 0) totalSiteLoss += profitLossRow;
    else if (profitLossRow < 0) totalSiteProfit += -profitLossRow;
    rows.push({
      userId,
      username: (u as { username?: string | null }).username ?? profile?.username ?? null,
      agentName,
      agentUsername,
      totalBets: totalBetsRow,
      totalWins: totalWinsRow,
      commission: commissionRow,
      profitLoss: profitLossRow,
      finalBalance: points,
    });
  }

  const summary: GeneralReportSummary = {
    totalBets,
    totalWins,
    totalCommission,
    totalSiteProfit,
    totalSiteLoss,
    totalOpenBalance,
  };

  return {
    rows: rows.sort((a, b) => (b.username ?? "").localeCompare(a.username ?? "")),
    summary,
    from: filter?.from ?? null,
    to: filter?.to ?? null,
  };
}
