/**
 * Tournament financial summary – canonical source: financial_events.
 */

import { getTournamentById } from "../db";
import { getFinancialEventsByTournament } from "./financialEventService";
import type { TournamentFinancialSummary } from "./types";

export async function getTournamentFinancialSummary(tournamentId: number): Promise<TournamentFinancialSummary | null> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return null;
  const events = await getFinancialEventsByTournament(tournamentId);
  let totalPool = 0;
  let platformCommission = 0;
  let agentCommissionTotal = 0;
  let totalPrizesDistributed = 0;
  let totalRefunded = 0;
  let participantCount = 0;
  const winnerSubIds = new Set<number>();
  for (const e of events) {
    const amt = e.amountPoints ?? 0;
    switch (e.eventType) {
      case "ENTRY_FEE":
        totalPool += amt;
        participantCount += 1;
        break;
      case "PLATFORM_COMMISSION":
        platformCommission += amt;
        break;
      case "AGENT_COMMISSION":
        agentCommissionTotal += amt;
        break;
      case "PRIZE_PAYOUT":
        totalPrizesDistributed += amt;
        if (e.submissionId != null) winnerSubIds.add(e.submissionId);
        break;
      case "REFUND":
        totalRefunded += amt;
        break;
      default:
        break;
    }
  }
  const prizePool = totalPool - platformCommission;
  const platformNetProfit = platformCommission - agentCommissionTotal;
  const roi = totalPool > 0 ? platformNetProfit / totalPool : null;
  const name = (tournament as { name?: string }).name ?? String(tournamentId);
  const commissionBasisPoints = (tournament as { commissionPercentBasisPoints?: number }).commissionPercentBasisPoints ?? 1250;
  return {
    tournamentId,
    tournamentName: name,
    totalPool,
    commissionBasisPoints,
    platformCommission,
    agentCommissionTotal,
    prizePool,
    totalPrizesDistributed,
    totalRefunded,
    platformNetProfit,
    participantCount,
    winnerCount: winnerSubIds.size,
    roi,
  };
}
