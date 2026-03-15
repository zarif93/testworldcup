/**
 * Agent commission report – real data from financial_events.
 * Summary + per-player table; date-range filter; centralized commission logic.
 * Includes ALL players under agent (including zero activity), agent himself as last row, and final balance +/- (site owes / owes site).
 */

import { getUserById, getUsersByAgentId } from "../db";
import { getPlayerFinancialProfile } from "./playerFinanceService";

export interface AgentReportSummary {
  totalEntriesCollected: number;
  totalWinningsPaid: number;
  totalRefunds: number;
  netProfitLoss: number;
  totalCommission: number;
  agentCommissionShare: number;
  platformCommissionShare: number;
  numberOfPlayers: number;
  numberOfSubmissions: number;
}

export type AgentReportPlayerStatus = "profit" | "loss" | "even";

export interface AgentReportPlayerRow {
  userId: number;
  fullName: string | null;
  username: string | null;
  participations: number;
  totalEntryFees: number;
  totalWinnings: number;
  totalRefunds: number;
  netProfitLoss: number;
  totalCommissionGenerated: number;
  agentShareFromPlayer: number;
  platformShareFromPlayer: number;
  status: AgentReportPlayerStatus;
  /** +XXX if site owes player, -XXX if player owes site (current points balance) */
  finalBalanceSigned: number;
  isAgentRow?: boolean;
}

export interface AgentReportDetailed {
  summary: AgentReportSummary;
  players: AgentReportPlayerRow[];
  agentId: number;
  agentUsername: string | null;
  agentName: string | null;
  /** Agent final balance vs site: +XXX if site owes agent, -XXX if agent owes site */
  agentFinalBalanceVsSite: number;
}

export interface AgentReportFilter {
  from?: string;
  to?: string;
}

function playerStatus(netProfitLoss: number): AgentReportPlayerStatus {
  if (netProfitLoss > 0) return "profit";
  if (netProfitLoss < 0) return "loss";
  return "even";
}

/**
 * Build agent report from financial_events via getAgentDashboardMetrics.
 * Uses real DB data only; commission split uses centralized 50% agent / 50% platform.
 */
export async function getAgentReportDetailed(
  agentId: number,
  filter?: AgentReportFilter
): Promise<AgentReportDetailed | null> {
  const agentUser = await getUserById(agentId);
  if (!agentUser) return null;

  const referredPlayers = await getUsersByAgentId(agentId);
  const dateFilter = filter?.from != null || filter?.to != null ? { from: filter.from, to: filter.to } : undefined;

  let totalEntriesCollected = 0;
  let totalWinningsPaid = 0;
  let totalRefunds = 0;
  let totalCommission = 0;
  let agentCommissionShare = 0;
  let platformCommissionShare = 0;
  let numberOfSubmissions = 0;

  const players: AgentReportPlayerRow[] = [];

  for (const p of referredPlayers) {
    const u = await getUserById(p.id);
    const profile = await getPlayerFinancialProfile(p.id, dateFilter);
    const pointsFinal = Number((u as { points?: number })?.points ?? 0);

    const entryFees = profile?.totalEntryFees ?? 0;
    const winnings = profile?.totalPrizesWon ?? 0;
    const refunds = profile?.totalEntryFeeRefunds ?? 0;
    const netPnL = profile?.competitionNetPnL ?? 0;
    const commGen = profile?.totalCommissionGenerated ?? 0;
    const agentShare = profile?.agentCommissionFromPlayer ?? 0;
    const platformShare = profile?.platformProfitFromPlayer ?? 0;

    totalEntriesCollected += entryFees;
    totalWinningsPaid += winnings;
    totalRefunds += refunds;
    totalCommission += commGen;
    agentCommissionShare += agentShare;
    platformCommissionShare += platformShare;
    numberOfSubmissions += profile?.totalParticipations ?? 0;

    const pAsUser = p as { name?: string | null; username?: string | null };
    players.push({
      userId: p.id,
      fullName: pAsUser.name ?? profile?.username ?? null,
      username: (profile?.username ?? pAsUser.username) ?? null,
      participations: profile?.totalParticipations ?? 0,
      totalEntryFees: entryFees,
      totalWinnings: winnings,
      totalRefunds: refunds,
      netProfitLoss: netPnL,
      totalCommissionGenerated: commGen,
      agentShareFromPlayer: agentShare,
      platformShareFromPlayer: platformShare,
      status: playerStatus(netPnL),
      finalBalanceSigned: pointsFinal,
      isAgentRow: false,
    });
  }

  const netProfitLoss = totalEntriesCollected - totalWinningsPaid + totalRefunds;

  const summary: AgentReportSummary = {
    totalEntriesCollected,
    totalWinningsPaid,
    totalRefunds,
    netProfitLoss,
    totalCommission,
    agentCommissionShare,
    platformCommissionShare,
    numberOfPlayers: referredPlayers.length,
    numberOfSubmissions,
  };

  const agentPoints = Number((agentUser as { points?: number })?.points ?? 0);
  const a = agentUser as { username?: string | null; name?: string | null };
  players.push({
    userId: agentId,
    fullName: a.name ?? null,
    username: a.username ?? null,
    participations: 0,
    totalEntryFees: 0,
    totalWinnings: 0,
    totalRefunds: 0,
    netProfitLoss: 0,
    totalCommissionGenerated: 0,
    agentShareFromPlayer: 0,
    platformShareFromPlayer: 0,
    status: "even",
    finalBalanceSigned: agentPoints,
    isAgentRow: true,
  });

  return {
    summary,
    players,
    agentId,
    agentUsername: a.username ?? null,
    agentName: a.name ?? a.username ?? null,
    agentFinalBalanceVsSite: agentPoints,
  };
}
