/**
 * Global finance report – single date-range report unifying tournaments, agents, players.
 * Source: financial_events only. Commission derived via centralized helpers when not in payload.
 */

import { getFinancialEventsByTimeRange } from "./financialEventService";
import { computeCommissionFromEntry, computeReportCommissionSplit } from "./commissionService";
import { DEFAULT_COMMISSION_BASIS_POINTS, DEFAULT_AGENT_SHARE_BASIS_POINTS } from "./constants";
import { getTournamentById, getUserById } from "../db";

export interface GlobalFinanceReportSummary {
  totalParticipations: number;
  totalEntryFeesCollected: number;
  totalWinningsPaid: number;
  totalRefunds: number;
  netPlatformProfitLoss: number;
  totalCommissionGenerated: number;
  totalAgentCommission: number;
  totalPlatformCommission: number;
  numberOfTournaments: number;
  numberOfActivePlayers: number;
  numberOfActiveAgents: number;
}

export interface GlobalFinanceReportTournamentRow {
  tournamentId: number;
  tournamentName: string;
  tournamentType: string;
  participations: number;
  entryFees: number;
  winningsPaid: number;
  refunds: number;
  netResult: number;
  totalCommission: number;
  agentCommission: number;
  platformCommission: number;
}

export interface GlobalFinanceReportAgentRow {
  agentId: number;
  agentName: string | null;
  agentUsername: string | null;
  numberOfPlayers: number;
  participations: number;
  entryFees: number;
  winningsPaid: number;
  refunds: number;
  totalCommissionGenerated: number;
  agentCommission: number;
  platformShare: number;
}

export interface GlobalFinanceReportPlayerRow {
  userId: number;
  username: string | null;
  fullName: string | null;
  participations: number;
  entryFees: number;
  winningsPaid: number;
  refunds: number;
  netProfitLoss: number;
  totalCommissionGenerated: number;
  agentShare: number;
  platformShare: number;
}

export interface GlobalFinanceReport {
  summary: GlobalFinanceReportSummary;
  byTournament: GlobalFinanceReportTournamentRow[];
  byAgent: GlobalFinanceReportAgentRow[];
  byPlayer: GlobalFinanceReportPlayerRow[];
  from: string | null;
  to: string | null;
}

export interface GlobalFinanceReportFilter {
  from?: string;
  to?: string;
}

function parseDateRange(filter?: GlobalFinanceReportFilter): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  let from = new Date();
  from.setHours(0, 0, 0, 0);
  if (filter?.from) from = new Date(filter.from);
  else {
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
  }
  if (filter?.to) {
    to.setTime(new Date(filter.to).getTime());
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}

/**
 * Build global finance report from financial_events in the given date range.
 */
export async function getGlobalFinanceReport(filter?: GlobalFinanceReportFilter): Promise<GlobalFinanceReport> {
  const { from, to } = parseDateRange(filter);
  const events = await getFinancialEventsByTimeRange(from, to);

  let totalParticipations = 0;
  let totalEntryFeesCollected = 0;
  let totalWinningsPaid = 0;
  let totalRefunds = 0;
  let totalPlatformCommission = 0;
  let totalAgentCommission = 0;

  const tournamentIds = new Set<number>();
  const playerIds = new Set<number>();
  const agentIds = new Set<number>();

  type TournAgg = { participations: number; entryFees: number; winnings: number; refunds: number; platformComm: number; agentComm: number };
  const byTournament = new Map<number, TournAgg>();

  type AgentAgg = { entryFees: number; participations: number; agentComm: number; playerIds: Set<number> };
  const byAgent = new Map<number, AgentAgg>();

  type PlayerAgg = { participations: number; entryFees: number; winnings: number; refunds: number; commissionFromPayload: number; agentFromPayload: number };
  const byPlayer = new Map<number, PlayerAgg>();

  for (const e of events) {
    const amt = e.amountPoints ?? 0;
    const tid = e.tournamentId ?? 0;
    const uid = e.userId ?? 0;
    const aid = e.agentId ?? 0;
    const payload = (e.payloadJson ?? {}) as { commissionAmount?: number; agentCommissionAmount?: number };

    switch (e.eventType) {
      case "ENTRY_FEE":
        totalParticipations += 1;
        totalEntryFeesCollected += amt;
        if (tid) {
          tournamentIds.add(tid);
          let t = byTournament.get(tid);
          if (!t) t = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, platformComm: 0, agentComm: 0 };
          t.participations += 1;
          t.entryFees += amt;
          byTournament.set(tid, t);
        }
        if (aid) {
          agentIds.add(aid);
          let a = byAgent.get(aid);
          if (!a) a = { entryFees: 0, participations: 0, agentComm: 0, playerIds: new Set() };
          a.entryFees += amt;
          a.participations += 1;
          if (uid) a.playerIds.add(uid);
          byAgent.set(aid, a);
        }
        if (uid) {
          playerIds.add(uid);
          let p = byPlayer.get(uid);
          if (!p) p = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, commissionFromPayload: 0, agentFromPayload: 0 };
          p.participations += 1;
          p.entryFees += amt;
          if (typeof payload.commissionAmount === "number") p.commissionFromPayload += payload.commissionAmount;
          if (typeof payload.agentCommissionAmount === "number") p.agentFromPayload += payload.agentCommissionAmount;
          byPlayer.set(uid, p);
        }
        break;
      case "PRIZE_PAYOUT":
        totalWinningsPaid += amt;
        if (tid) {
          let t = byTournament.get(tid);
          if (!t) t = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, platformComm: 0, agentComm: 0 };
          t.winnings += amt;
          byTournament.set(tid, t);
        }
        if (uid) {
          let p = byPlayer.get(uid);
          if (!p) p = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, commissionFromPayload: 0, agentFromPayload: 0 };
          p.winnings += amt;
          byPlayer.set(uid, p);
        }
        break;
      case "REFUND":
        totalRefunds += amt;
        if (tid) {
          let t = byTournament.get(tid);
          if (!t) t = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, platformComm: 0, agentComm: 0 };
          t.refunds += amt;
          byTournament.set(tid, t);
        }
        if (uid) {
          let p = byPlayer.get(uid);
          if (!p) p = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, commissionFromPayload: 0, agentFromPayload: 0 };
          p.refunds += amt;
          byPlayer.set(uid, p);
        }
        break;
      case "PLATFORM_COMMISSION":
        totalPlatformCommission += amt;
        if (tid) {
          let t = byTournament.get(tid);
          if (!t) t = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, platformComm: 0, agentComm: 0 };
          t.platformComm += amt;
          byTournament.set(tid, t);
        }
        break;
      case "AGENT_COMMISSION":
        totalAgentCommission += amt;
        if (tid) {
          let t = byTournament.get(tid);
          if (!t) t = { participations: 0, entryFees: 0, winnings: 0, refunds: 0, platformComm: 0, agentComm: 0 };
          t.agentComm += amt;
          byTournament.set(tid, t);
        }
        if (aid) {
          agentIds.add(aid);
          let a = byAgent.get(aid);
          if (!a) a = { entryFees: 0, participations: 0, agentComm: 0, playerIds: new Set() };
          a.agentComm += amt;
          byAgent.set(aid, a);
        }
        break;
      default:
        break;
    }
  }

  const totalCommissionGenerated = totalPlatformCommission + totalAgentCommission;
  const netPlatformProfitLoss = totalPlatformCommission - totalAgentCommission;

  const summary: GlobalFinanceReportSummary = {
    totalParticipations,
    totalEntryFeesCollected,
    totalWinningsPaid,
    totalRefunds,
    netPlatformProfitLoss,
    totalCommissionGenerated,
    totalAgentCommission,
    totalPlatformCommission,
    numberOfTournaments: tournamentIds.size,
    numberOfActivePlayers: playerIds.size,
    numberOfActiveAgents: agentIds.size,
  };

  const tournamentRows: GlobalFinanceReportTournamentRow[] = [];
  for (const [tournamentId, agg] of byTournament) {
    const t = await getTournamentById(tournamentId);
    const name = (t as { name?: string })?.name ?? String(tournamentId);
    const type = (t as { type?: string })?.type ?? "football";
    const netResult = agg.entryFees - agg.winnings + agg.refunds - agg.agentComm;
    const totalComm = agg.platformComm + agg.agentComm;
    tournamentRows.push({
      tournamentId,
      tournamentName: name,
      tournamentType: type,
      participations: agg.participations,
      entryFees: agg.entryFees,
      winningsPaid: agg.winnings,
      refunds: agg.refunds,
      netResult,
      totalCommission: totalComm,
      agentCommission: agg.agentComm,
      platformCommission: agg.platformComm,
    });
  }
  tournamentRows.sort((a, b) => b.entryFees - a.entryFees);

  const agentRows: GlobalFinanceReportAgentRow[] = [];
  for (const [agentId, agg] of byAgent) {
    const u = await getUserById(agentId);
    const agentName = (u as { name?: string | null })?.name ?? null;
    const agentUsername = (u as { username?: string | null })?.username ?? null;
    let winningsPaid = 0;
    let refunds = 0;
    for (const pid of agg.playerIds) {
      const pa = byPlayer.get(pid);
      if (pa) {
        winningsPaid += pa.winnings;
        refunds += pa.refunds;
      }
    }
    const totalCommissionGenerated = agg.entryFees > 0
      ? events
          .filter((ev) => ev.eventType === "ENTRY_FEE" && ev.agentId === agentId)
          .reduce((s, ev) => {
            const payload = (ev.payloadJson ?? {}) as { commissionAmount?: number };
            if (typeof payload.commissionAmount === "number") return s + payload.commissionAmount;
            return s + computeCommissionFromEntry(ev.amountPoints ?? 0, DEFAULT_COMMISSION_BASIS_POINTS);
          }, 0)
      : 0;
    const platformShare = Math.max(0, totalCommissionGenerated - agg.agentComm);
    agentRows.push({
      agentId,
      agentName,
      agentUsername,
      numberOfPlayers: agg.playerIds.size,
      participations: agg.participations,
      entryFees: agg.entryFees,
      winningsPaid,
      refunds,
      totalCommissionGenerated,
      agentCommission: agg.agentComm,
      platformShare,
    });
  }
  agentRows.sort((a, b) => b.entryFees - a.entryFees);

  const playerRows: GlobalFinanceReportPlayerRow[] = [];
  for (const [userId, agg] of byPlayer) {
    const u = await getUserById(userId);
    const username = (u as { username?: string | null })?.username ?? null;
    const fullName = (u as { name?: string | null })?.name ?? username;
    const netProfitLoss = agg.winnings - agg.entryFees + agg.refunds;
    const comm = agg.commissionFromPayload > 0
      ? agg.commissionFromPayload
      : computeCommissionFromEntry(agg.entryFees, DEFAULT_COMMISSION_BASIS_POINTS);
    const split = computeReportCommissionSplit(comm, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    const agentShare = agg.agentFromPayload >= 0 ? agg.agentFromPayload : split.agentCommission;
    const platformShare = comm - agentShare;
    playerRows.push({
      userId,
      username,
      fullName,
      participations: agg.participations,
      entryFees: agg.entryFees,
      winningsPaid: agg.winnings,
      refunds: agg.refunds,
      netProfitLoss,
      totalCommissionGenerated: comm,
      agentShare,
      platformShare,
    });
  }
  playerRows.sort((a, b) => b.entryFees - a.entryFees);

  return {
    summary,
    byTournament: tournamentRows,
    byAgent: agentRows,
    byPlayer: playerRows,
    from: filter?.from ?? null,
    to: filter?.to ?? null,
  };
}
