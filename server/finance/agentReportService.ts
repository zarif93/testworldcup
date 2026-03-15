/**
 * Agent commission report – real data from financial_events.
 * Summary + per-player table; date-range filter; centralized commission logic.
 */

import { getAgentDashboardMetrics } from "./agentFinanceService";
import { computeReportCommissionSplit } from "./commissionService";
import type { AgentDashboardMetrics } from "./types";

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
}

export interface AgentReportDetailed {
  summary: AgentReportSummary;
  players: AgentReportPlayerRow[];
  agentId: number;
  agentUsername: string | null;
  agentName: string | null;
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
  const metrics = await getAgentDashboardMetrics(agentId, {
    from: filter?.from,
    to: filter?.to,
  });
  if (!metrics) return null;

  const list = metrics.playerListWithPnL ?? [];
  const totalEntriesCollected = list.reduce((s, p) => s + p.totalEntryFees, 0);
  const totalWinningsPaid = list.reduce((s, p) => s + p.totalPrizesWon, 0);
  const totalRefunds = list.reduce((s, p) => s + (p.totalEntryFeeRefunds ?? 0), 0);
  const totalCommission = list.reduce((s, p) => s + p.commissionGenerated, 0);
  const agentCommissionShare = list.reduce((s, p) => s + p.agentCommissionFromPlayer, 0);
  const platformCommissionShare = list.reduce((s, p) => s + (p.platformShareFromPlayer ?? 0), 0);
  const numberOfSubmissions = list.reduce((s, p) => s + (p.totalParticipations ?? 0), 0);

  const netProfitLoss = totalEntriesCollected - totalWinningsPaid + totalRefunds;

  const summary: AgentReportSummary = {
    totalEntriesCollected,
    totalWinningsPaid,
    totalRefunds,
    netProfitLoss,
    totalCommission,
    agentCommissionShare,
    platformCommissionShare,
    numberOfPlayers: metrics.numberOfPlayers,
    numberOfSubmissions,
  };

  const players: AgentReportPlayerRow[] = list.map((p) => ({
    userId: p.userId,
    fullName: p.fullName ?? null,
    username: p.username ?? null,
    participations: p.totalParticipations ?? 0,
    totalEntryFees: p.totalEntryFees,
    totalWinnings: p.totalPrizesWon,
    totalRefunds: p.totalEntryFeeRefunds ?? 0,
    netProfitLoss: p.competitionNetPnL,
    totalCommissionGenerated: p.commissionGenerated,
    agentShareFromPlayer: p.agentCommissionFromPlayer,
    platformShareFromPlayer: p.platformShareFromPlayer ?? 0,
    status: playerStatus(p.competitionNetPnL),
  }));

  return {
    summary,
    players,
    agentId: metrics.agentId,
    agentUsername: metrics.agentUsername ?? null,
    agentName: metrics.agentName ?? metrics.agentUsername ?? null,
  };
}
