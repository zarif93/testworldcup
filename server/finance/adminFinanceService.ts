/**
 * Admin global financial dashboard – canonical source: financial_events (+ time range).
 */

import { getSchema, getDb } from "../db";
import { eq, inArray, and, sql, isNull } from "drizzle-orm";
import { getFinancialEventsByTimeRange } from "./financialEventService";
import { getTournamentFinancialSummary } from "./tournamentFinanceService";
import { getAgentDashboardMetrics } from "./agentFinanceService";
import { getPlayerFinancialProfile } from "./playerFinanceService";
import type { AdminGlobalDashboard, DashboardPeriod, AdminFinanceDashboardSummary, TournamentFinanceRow, AgentFinanceRow, FinancialEventRow, FinanceInsightItem } from "./types";
import type { TournamentFinancialSummary } from "./types";

function periodToRange(period: DashboardPeriod): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (period === "day") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setMonth(from.getMonth() - 1);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

export interface GetFinanceDashboardSummaryInput {
  period?: DashboardPeriod;
  from?: string;
  to?: string;
}

export async function getAdminFinanceDashboardSummary(opts: GetFinanceDashboardSummaryInput = {}): Promise<AdminFinanceDashboardSummary> {
  const { users, tournaments } = await getSchema();
  const db = await getDb();
  let from: Date;
  let to: Date;
  let period: DashboardPeriod | undefined;
  if (opts.from != null && opts.to != null) {
    from = new Date(opts.from);
    to = new Date(opts.to);
    to.setHours(23, 59, 59, 999);
  } else {
    period = opts.period ?? "month";
    const range = periodToRange(period);
    from = range.from;
    to = range.to;
  }
  const events = await getFinancialEventsByTimeRange(from, to);
  let totalPlatformProfit = 0;
  let totalCommissions = 0;
  let totalAgentCommissions = 0;
  let totalPrizePayouts = 0;
  let totalRefundedPoints = 0;
  const byTournament = new Map<number, number>();
  const byAgent = new Map<number, number>();
  const byUser = new Map<number, { entryFees: number; prizes: number }>();
  for (const e of events) {
    const amt = e.amountPoints ?? 0;
    const tid = e.tournamentId ?? 0;
    const uid = e.userId ?? 0;
    const aid = e.agentId ?? 0;
    switch (e.eventType) {
      case "PLATFORM_COMMISSION":
        totalCommissions += amt;
        totalPlatformProfit += amt;
        if (tid) byTournament.set(tid, (byTournament.get(tid) ?? 0) + amt);
        break;
      case "AGENT_COMMISSION":
        totalAgentCommissions += amt;
        totalPlatformProfit -= amt;
        if (tid) byTournament.set(tid, (byTournament.get(tid) ?? 0) - amt);
        if (aid) byAgent.set(aid, (byAgent.get(aid) ?? 0) - amt);
        break;
      case "PRIZE_PAYOUT":
        totalPrizePayouts += amt;
        if (tid) byTournament.set(tid, (byTournament.get(tid) ?? 0) - amt);
        if (uid) {
          const u = byUser.get(uid) ?? { entryFees: 0, prizes: 0 };
          u.prizes += amt;
          byUser.set(uid, u);
        }
        break;
      case "REFUND":
        totalRefundedPoints += amt;
        break;
      case "ENTRY_FEE":
        if (uid) {
          const u = byUser.get(uid) ?? { entryFees: 0, prizes: 0 };
          u.entryFees += amt;
          byUser.set(uid, u);
        }
        break;
      default:
        break;
    }
  }
  let activeTournamentsCount = 0;
  let totalPlayersCount = 0;
  let totalAgentsCount = 0;
  let mostProfitableTournament: FinanceInsightItem | null = null;
  let mostProfitableAgent: FinanceInsightItem | null = null;
  let topLosingPlayer: FinanceInsightItem | null = null;
  let topProfitablePlayer: FinanceInsightItem | null = null;
  if (db) {
    const [activeRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tournaments)
      .where(and(isNull(tournaments.deletedAt), inArray(tournaments.status, ["OPEN", "LOCKED", "RESULTS_UPDATED", "SETTLING"])));
    activeTournamentsCount = Number(activeRow?.count ?? 0);
    const [playersRow] = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "user"), isNull(users.deletedAt)));
    totalPlayersCount = Number(playersRow?.count ?? 0);
    const [agentsRow] = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "agent"), isNull(users.deletedAt)));
    totalAgentsCount = Number(agentsRow?.count ?? 0);

    const tournamentEntries = Array.from(byTournament.entries()).filter(([, profit]) => profit > 0);
    if (tournamentEntries.length > 0) {
      const [tournamentId, profit] = tournamentEntries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
      const rows = await db.select({ name: tournaments.name }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      mostProfitableTournament = { id: tournamentId, name: rows[0]?.name ?? `#${tournamentId}`, value: profit, kind: "תחרות" };
    }
    const agentEntries = Array.from(byAgent.entries()).map(([id, commissionOut]) => ({ id, platformNet: -commissionOut })).filter((a) => a.platformNet > 0);
    if (agentEntries.length > 0) {
      const best = agentEntries.reduce((b, c) => (c.platformNet > b.platformNet ? c : b));
      const rows = await db.select({ username: users.username, name: users.name }).from(users).where(eq(users.id, best.id)).limit(1);
      const display = rows[0]?.name ?? rows[0]?.username ?? `#${best.id}`;
      mostProfitableAgent = { id: best.id, name: display, value: best.platformNet, kind: "סוכן" };
    }
    const playerPnL = Array.from(byUser.entries()).map(([userId, v]) => ({ userId, net: v.prizes - v.entryFees }));
    const losing = playerPnL.filter((p) => p.net < 0).sort((a, b) => a.net - b.net);
    const profitable = playerPnL.filter((p) => p.net > 0).sort((a, b) => b.net - a.net);
    if (losing.length > 0) {
      const { userId, net } = losing[0];
      const rows = await db.select({ username: users.username, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      const display = rows[0]?.name ?? rows[0]?.username ?? `#${userId}`;
      topLosingPlayer = { id: userId, name: display, value: net, kind: "שחקן" };
    }
    if (profitable.length > 0) {
      const { userId, net } = profitable[0];
      const rows = await db.select({ username: users.username, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      const display = rows[0]?.name ?? rows[0]?.username ?? `#${userId}`;
      topProfitablePlayer = { id: userId, name: display, value: net, kind: "שחקן" };
    }
  }
  return {
    from,
    to,
    period,
    totalPlatformProfit,
    totalCommissions,
    totalAgentCommissions,
    totalPrizePayouts,
    totalRefundedPoints,
    activeTournamentsCount,
    totalPlayersCount,
    totalAgentsCount,
    mostProfitableTournament: mostProfitableTournament ?? undefined,
    mostProfitableAgent: mostProfitableAgent ?? undefined,
    topLosingPlayer: topLosingPlayer ?? undefined,
    topProfitablePlayer: topProfitablePlayer ?? undefined,
  };
}

export async function getAdminGlobalDashboard(period: DashboardPeriod = "month"): Promise<AdminGlobalDashboard> {
  const { from, to } = periodToRange(period);
  const events = await getFinancialEventsByTimeRange(from, to);
  const result: AdminGlobalDashboard = {
    period,
    from,
    to,
    totalProfit: 0,
    profitByTournament: [],
    profitByAgent: [],
    topProfitablePlayers: [],
    topLosingPlayers: [],
    riskAlerts: [],
  };
  const byTournament = new Map<number, { profit: number; totalPool: number; name?: string }>();
  const byAgent = new Map<number, { platformNetProfit: number; agentCommission: number }>();
  const byUser = new Map<number, { entryFees: number; prizes: number }>();
  for (const e of events) {
    const amt = e.amountPoints ?? 0;
    const tid = e.tournamentId ?? 0;
    const uid = e.userId ?? 0;
    const aid = e.agentId ?? 0;
    switch (e.eventType) {
      case "ENTRY_FEE":
        if (tid) {
          const t = byTournament.get(tid) ?? { profit: 0, totalPool: 0 };
          t.totalPool += amt;
          byTournament.set(tid, t);
        }
        if (uid) {
          const u = byUser.get(uid) ?? { entryFees: 0, prizes: 0 };
          u.entryFees += amt;
          byUser.set(uid, u);
        }
        break;
      case "PRIZE_PAYOUT":
        if (tid) {
          const t = byTournament.get(tid) ?? { profit: 0, totalPool: 0 };
          t.profit -= amt;
          byTournament.set(tid, t);
        }
        if (uid) {
          const u = byUser.get(uid) ?? { entryFees: 0, prizes: 0 };
          u.prizes += amt;
          byUser.set(uid, u);
        }
        break;
      case "PLATFORM_COMMISSION":
        if (tid) {
          const t = byTournament.get(tid) ?? { profit: 0, totalPool: 0 };
          t.profit += amt;
          byTournament.set(tid, t);
        }
        result.totalProfit += amt;
        break;
      case "AGENT_COMMISSION":
        if (tid) {
          const t = byTournament.get(tid) ?? { profit: 0, totalPool: 0 };
          t.profit -= amt;
          byTournament.set(tid, t);
        }
        if (aid) {
          const a = byAgent.get(aid) ?? { platformNetProfit: 0, agentCommission: 0 };
          a.agentCommission += amt;
          byAgent.set(aid, a);
        }
        result.totalProfit -= amt;
        break;
      default:
        break;
    }
  }
  result.profitByTournament = Array.from(byTournament.entries()).map(([tournamentId, v]) => ({
    tournamentId,
    name: v.name ?? String(tournamentId),
    profit: v.profit,
    totalPool: v.totalPool,
  }));
  const { users } = await getSchema();
  const db = await getDb();
  for (const [agentId, v] of byAgent) {
    let username: string | null = null;
    if (db) {
      const r = await db.select({ username: users.username }).from(users).where(eq(users.id, agentId)).limit(1);
      username = r[0]?.username ?? null;
    }
    result.profitByAgent.push({
      agentId,
      username,
      platformNetProfit: -v.agentCommission,
      agentCommission: v.agentCommission,
    });
  }
  const playerPnL: Array<{ userId: number; username: string | null; competitionNetPnL: number }> = [];
  for (const [userId, v] of byUser) {
    const net = v.prizes - v.entryFees;
    let username: string | null = null;
    if (db) {
      const r = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
      username = r[0]?.username ?? null;
    }
    playerPnL.push({ userId, username, competitionNetPnL: net });
  }
  playerPnL.sort((a, b) => b.competitionNetPnL - a.competitionNetPnL);
  result.topProfitablePlayers = playerPnL.filter((p) => p.competitionNetPnL > 0).slice(0, 20);
  result.topLosingPlayers = playerPnL.filter((p) => p.competitionNetPnL < 0).sort((a, b) => a.competitionNetPnL - b.competitionNetPnL).slice(0, 20);
  if (result.totalProfit < 0) result.riskAlerts.push("Period net profit is negative");
  const bigLosers = result.topLosingPlayers.filter((p) => p.competitionNetPnL < -1000);
  if (bigLosers.length > 0) result.riskAlerts.push(`${bigLosers.length} player(s) with significant losses in period`);
  return result;
}

/** Tournament finance list for admin table – all non-deleted tournaments with financial summary. */
export async function getTournamentFinanceList(): Promise<TournamentFinanceRow[]> {
  const { getTournaments } = await import("../db");
  const list = await getTournaments();
  const rows: TournamentFinanceRow[] = [];
  for (const t of list) {
    const summary = await getTournamentFinancialSummary((t as { id: number }).id);
    const status = (t as { status?: string }).status ?? "";
    if (summary) {
      rows.push({ ...summary, status });
    } else {
      const name = (t as { name?: string }).name ?? String((t as { id: number }).id);
      rows.push({
        tournamentId: (t as { id: number }).id,
        tournamentName: name,
        totalPool: 0,
        commissionBasisPoints: 1250,
        platformCommission: 0,
        agentCommissionTotal: 0,
        prizePool: 0,
        totalPrizesDistributed: 0,
        totalRefunded: 0,
        platformNetProfit: 0,
        participantCount: 0,
        winnerCount: 0,
        roi: null,
        status,
      });
    }
  }
  return rows.sort((a, b) => b.tournamentId - a.tournamentId);
}

/** Tournament finance detail + event ledger for audit. */
export async function getTournamentFinanceDetail(tournamentId: number): Promise<{
  summary: TournamentFinancialSummary | null;
  events: FinancialEventRow[];
}> {
  const { getFinancialEventsByTournament } = await import("./financialEventService");
  const summary = await getTournamentFinancialSummary(tournamentId);
  const eventsRaw = await getFinancialEventsByTournament(tournamentId);
  const events: FinancialEventRow[] = eventsRaw.map((e) => ({
    id: e.id,
    eventType: e.eventType ?? "",
    amountPoints: e.amountPoints ?? 0,
    tournamentId: e.tournamentId ?? null,
    userId: e.userId ?? null,
    agentId: e.agentId ?? null,
    submissionId: e.submissionId ?? null,
    idempotencyKey: e.idempotencyKey ?? null,
    createdAt: e.createdAt ?? new Date(0),
    payloadJson: (e.payloadJson as Record<string, unknown>) ?? null,
  }));
  return { summary, events };
}

/** Agent finance list for admin table. */
export async function getAgentFinanceList(): Promise<AgentFinanceRow[]> {
  const { getAgents } = await import("../db");
  const agents = await getAgents();
  const rows: AgentFinanceRow[] = [];
  for (const a of agents) {
    const id = (a as { id: number }).id;
    const metrics = await getAgentDashboardMetrics(id);
    const totalPlayerPrizes = metrics?.playerListWithPnL.reduce((s, p) => s + p.totalPrizesWon, 0) ?? 0;
    rows.push({
      agentId: id,
      agentUsername: (a as { username?: string | null }).username ?? null,
      agentName: (a as { name?: string | null }).name ?? null,
      numberOfPlayers: metrics?.numberOfPlayers ?? 0,
      totalPlayerEntryFees: metrics?.totalPlayerEntryFees ?? 0,
      totalCommissionGenerated: metrics?.totalCommissionGenerated ?? 0,
      agentTotalCommissionEarned: metrics?.agentTotalCommissionEarned ?? 0,
      platformNetProfitFromAgent: metrics?.platformNetProfitFromAgent ?? 0,
      totalPlayerPrizes,
    });
  }
  return rows.sort((a, b) => b.totalPlayerEntryFees - a.totalPlayerEntryFees);
}

/** Player finance list for admin table – with optional search, agent filter, date filter. */
export interface GetPlayerFinanceListInput {
  search?: string;
  agentId?: number | null;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: number;
}

export async function getPlayerFinanceList(opts: GetPlayerFinanceListInput = {}): Promise<{
  players: import("./types").PlayerFinancialProfile[];
  nextCursor: number | null;
}> {
  const { getAllUsers } = await import("../db");
  const all = await getAllUsers({ includeDeleted: false });
  const users = all.filter((u) => (u as { role?: string }).role === "user");
  let filtered = users;
  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    filtered = filtered.filter(
      (u) =>
        String((u as { username?: string }).username ?? "").toLowerCase().includes(q) ||
        String((u as { name?: string }).name ?? "").toLowerCase().includes(q)
    );
  }
  if (opts.agentId != null && opts.agentId > 0) {
    filtered = filtered.filter((u) => (u as { agentId?: number | null }).agentId === opts.agentId);
  }
  const limit = Math.min(opts.limit ?? 200, 500);
  const cursor = opts.cursor ?? 0;
  const slice = filtered.slice(cursor, cursor + limit);
  const players: import("./types").PlayerFinancialProfile[] = [];
  const filter = opts.from != null || opts.to != null ? { from: opts.from, to: opts.to } : undefined;
  for (const u of slice) {
    const id = (u as { id: number }).id;
    const profile = await getPlayerFinancialProfile(id, filter);
    if (profile) players.push(profile);
  }
  const nextCursor = cursor + slice.length < filtered.length ? cursor + slice.length : null;
  return { players, nextCursor };
}
