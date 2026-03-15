/**
 * Agent dashboard metrics – canonical source: financial_events.
 */

import { getUserById } from "../db";
import { getUsersByAgentId } from "../db";
import { getFinancialEventsByAgent } from "./financialEventService";
import { getPlayerFinancialProfile, type PlayerFinancialProfileFilter } from "./playerFinanceService";
import type { AgentDashboardMetrics } from "./types";

export async function getAgentDashboardMetrics(
  agentId: number,
  opts?: PlayerFinancialProfileFilter
): Promise<AgentDashboardMetrics | null> {
  const agent = await getUserById(agentId);
  if (!agent) return null;
  const events = await getFinancialEventsByAgent(agentId, 10_000);
  let agentTotalCommissionEarned = 0;
  for (const e of events) {
    if (e.eventType === "AGENT_COMMISSION" && e.agentId === agentId) agentTotalCommissionEarned += e.amountPoints ?? 0;
  }
  const players = await getUsersByAgentId(agentId);
  let totalPlayerEntryFees = 0;
  let totalCommissionGenerated = 0;
  const playerListWithPnL: AgentDashboardMetrics["playerListWithPnL"] = [];
  for (const p of players) {
    const profile = await getPlayerFinancialProfile(p.id, opts);
    if (!profile) continue;
    totalPlayerEntryFees += profile.totalEntryFees;
    totalCommissionGenerated += profile.totalCommissionGenerated;
    const u = p as { name?: string | null };
    playerListWithPnL.push({
      userId: p.id,
      username: profile.username,
      fullName: u.name ?? profile.username ?? null,
      totalParticipations: profile.totalParticipations,
      totalEntryFees: profile.totalEntryFees,
      totalEntryFeeRefunds: profile.totalEntryFeeRefunds,
      totalPrizesWon: profile.totalPrizesWon,
      competitionNetPnL: profile.competitionNetPnL,
      commissionGenerated: profile.totalCommissionGenerated,
      agentCommissionFromPlayer: profile.agentCommissionFromPlayer,
      platformShareFromPlayer: profile.platformProfitFromPlayer,
    });
  }
  const platformNetProfitFromAgent = totalCommissionGenerated - agentTotalCommissionEarned;

  const sumEntryFees = playerListWithPnL.reduce((s, p) => s + p.totalEntryFees, 0);
  const sumCommissionGen = playerListWithPnL.reduce((s, p) => s + p.commissionGenerated, 0);
  const sumAgentComm = playerListWithPnL.reduce((s, p) => s + (p.agentCommissionFromPlayer ?? 0), 0);
  const sumPlatformShare = playerListWithPnL.reduce((s, p) => s + (p.platformShareFromPlayer ?? 0), 0);
  if (playerListWithPnL.length > 0) {
    if (sumEntryFees !== totalPlayerEntryFees || sumCommissionGen !== totalCommissionGenerated) {
      throw new Error(
        `Agent report consistency: sum(playerList) must match agent totals. EntryFees ${sumEntryFees}/${totalPlayerEntryFees} CommissionGen ${sumCommissionGen}/${totalCommissionGenerated}`
      );
    }
    if (sumAgentComm !== agentTotalCommissionEarned) {
      throw new Error(`Agent report consistency: sum(agentCommissionFromPlayer)=${sumAgentComm} must equal agentTotalCommissionEarned=${agentTotalCommissionEarned}`);
    }
    if (sumPlatformShare !== platformNetProfitFromAgent) {
      throw new Error(`Agent report consistency: sum(platformShareFromPlayer)=${sumPlatformShare} must equal platformNetProfitFromAgent=${platformNetProfitFromAgent}`);
    }
  }

  const a = agent as { username?: string | null; name?: string | null };
  return {
    agentId,
    agentUsername: a.username ?? null,
    agentName: a.name ?? null,
    numberOfPlayers: players.length,
    totalPlayerEntryFees,
    totalCommissionGenerated,
    agentTotalCommissionEarned,
    platformNetProfitFromAgent,
    playerListWithPnL,
  };
}
