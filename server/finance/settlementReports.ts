/**
 * Settlement-based financial reporting. Real-money accounting (points as internal credit).
 *
 * Rules:
 * - Commission is always 12.5% (generated only after prize distribution).
 * - Cancelled competitions: full refunds; must not appear in reports.
 * - Locked (not settled): must not affect financial reports.
 * - Freeroll: no commission; tracked as site expense.
 * - Only SETTLED competitions affect reports.
 */

import { getAllUsers, getUserById, getTournamentStatuses, getSettledTournamentIds, getTournamentNames, getAgents } from "../db";
import { getPlayerReportDetailed } from "./playerReportService";
import { getAgentDashboardMetrics } from "./agentFinanceService";
import { getPlayerFinancialProfile } from "./playerFinanceService";
import { getFinancialEventsFiltered } from "./financialEventService";
import type { PlayerFinancialProfileFilter } from "./playerFinanceService";

const SETTLED = "SETTLED";
const CANCELLED = "CANCELLED";

function isExcludedFromReport(row: { status: string; deletedAt: Date | null }): boolean {
  return row.status === CANCELLED || row.deletedAt != null;
}

export interface SettlementFilter {
  from?: string;
  to?: string;
}

// —— Player Report (settled only) ——
// Competition | Entry | Winnings | Commission | Result. Final signed balance. Entity report only.
export interface PlayerSettlementRow {
  competition: string;
  entry: number;
  winnings: number;
  commission: number;
  result: number;
}

export interface PlayerSettlementSummary {
  finalResult: number;
}

export interface PlayerSettlementReport {
  userId: number;
  username: string | null;
  rows: PlayerSettlementRow[];
  summary: PlayerSettlementSummary;
  from: string | null;
  to: string | null;
}

/** Only SETTLED competitions. Locked/cancelled/deleted excluded. Result = winnings − entry − commission. */
export async function getPlayerSettlementReport(
  userId: number,
  filter?: SettlementFilter
): Promise<PlayerSettlementReport | null> {
  const detailed = await getPlayerReportDetailed(userId, { from: filter?.from, to: filter?.to });
  if (!detailed) return null;

  const tournamentIds = [...new Set(detailed.rows.map((r) => r.tournamentId))];
  const statusMap = await getTournamentStatuses(tournamentIds);

  const rows: PlayerSettlementRow[] = [];
  for (const r of detailed.rows) {
    const info = statusMap.get(r.tournamentId);
    if (!info || isExcludedFromReport(info) || info.status !== SETTLED) continue; // only SETTLED in reports
    const entry = r.entryFee - r.refund;
    const commission = r.totalCommission ?? 0;
    const result = r.winnings - entry - commission;
    rows.push({
      competition: r.tournamentName,
      entry,
      winnings: r.winnings,
      commission,
      result,
    });
  }

  const finalResult = rows.reduce((s, r) => s + r.result, 0);

  return {
    userId,
    username: detailed.username,
    rows,
    summary: { finalResult },
    from: filter?.from ?? null,
    to: filter?.to ?? null,
  };
}

// —— Agent Settlement Report ——
// Player | Total Entries | Agent Commission | Player Result. Summary: Total Agent Commission, Total Players Result.
export interface AgentSettlementRow {
  player: string;
  userId: number;
  entries: number;
  agentCommission: number;
  result: number; // player result = winnings − entries
}

export interface AgentSettlementSummary {
  totalAgentCommission: number;
  totalPlayersResult: number;
  agentFinalBalanceVsSite: number; // signed: + site owes agent
}

export interface AgentSettlementReport {
  agentId: number;
  agentName: string | null;
  rows: AgentSettlementRow[];
  summary: AgentSettlementSummary;
  from: string | null;
  to: string | null;
}

/** Settled competitions only. Commission generated only after prize distribution. */
export async function getAgentSettlementReport(
  agentId: number,
  filter?: SettlementFilter
): Promise<AgentSettlementReport | null> {
  const settledIds = await getSettledTournamentIds();
  const opts: PlayerFinancialProfileFilter = {
    from: filter?.from,
    to: filter?.to,
    tournamentIds: settledIds,
  };
  const metrics = await getAgentDashboardMetrics(agentId, opts);
  if (!metrics) return null;

  const rows: AgentSettlementRow[] = metrics.playerListWithPnL.map((p) => {
    const entries = p.totalEntryFees - (p.totalEntryFeeRefunds ?? 0);
    const winnings = p.totalPrizesWon ?? 0;
    const result = winnings - entries;
    const agentCommission = p.agentCommissionFromPlayer ?? 0;
    return {
      player: p.fullName ?? p.username ?? `#${p.userId}`,
      userId: p.userId,
      entries,
      agentCommission,
      result,
    };
  });

  const totalAgentCommission = rows.reduce((s, r) => s + r.agentCommission, 0);
  const totalPlayersResult = rows.reduce((s, r) => s + r.result, 0);
  const agentFinalBalanceVsSite = metrics.agentTotalCommissionEarned;

  return {
    agentId,
    agentName: metrics.agentName ?? metrics.agentUsername ?? null,
    rows,
    summary: { totalAgentCommission, totalPlayersResult, agentFinalBalanceVsSite },
    from: filter?.from ?? null,
    to: filter?.to ?? null,
  };
}

// —— Global Settlement Report (user-based) ——
// Player | Agent | Total Entries | Winnings | Site Commission | Result. Total site profit summary.
export interface GlobalSettlementRow {
  player: string;
  userId: number;
  agent: string | null;
  agentId: number | null;
  entries: number;
  winnings: number;
  siteCommission: number;
  result: number;
}

export interface GlobalSettlementSummary {
  totalSiteProfit: number;
}

export interface GlobalSettlementReport {
  rows: GlobalSettlementRow[];
  summary: GlobalSettlementSummary;
  from: string | null;
  to: string | null;
}

type TournAgg = { entryFees: number; refunds: number; prizes: number; totalCommission: number; agentCommission: number };

/** Total site profit from settled competitions only (from financial events). */
async function getGlobalSettledProfit(filter?: SettlementFilter): Promise<number> {
  const events = await getFinancialEventsFiltered({
    from: filter?.from,
    to: filter?.to,
    limit: 200_000,
  });
  const byTournament = new Map<number, TournAgg>();
  for (const e of events) {
    const tid = e.tournamentId ?? 0;
    if (!tid) continue;
    let agg = byTournament.get(tid);
    if (!agg) {
      agg = { entryFees: 0, refunds: 0, prizes: 0, totalCommission: 0, agentCommission: 0 };
      byTournament.set(tid, agg);
    }
    const amt = e.amountPoints ?? 0;
    const payload = (e.payloadJson ?? {}) as { commissionAmount?: number };
    switch (e.eventType) {
      case "ENTRY_FEE":
        agg.entryFees += amt;
        if (typeof payload.commissionAmount === "number") agg.totalCommission += payload.commissionAmount;
        break;
      case "REFUND":
        agg.refunds += amt;
        break;
      case "PRIZE_PAYOUT":
        agg.prizes += amt;
        break;
      case "AGENT_COMMISSION":
        agg.agentCommission += amt;
        break;
      default:
        break;
    }
  }
  const tournamentIds = [...byTournament.keys()];
  const statusMap = await getTournamentStatuses(tournamentIds);
  let totalSiteProfit = 0;
  for (const [tid, agg] of byTournament) {
    const info = statusMap.get(tid);
    if (!info || isExcludedFromReport(info) || info.status !== SETTLED) continue;
    const entries = agg.entryFees - agg.refunds;
    const payout = agg.prizes;
    const siteCommission = agg.totalCommission - agg.agentCommission;
    totalSiteProfit += entries - payout; // site margin
  }
  return totalSiteProfit;
}

/** User-based global report. One row per player; settled competitions only. */
export async function getGlobalSettlementReport(filter?: SettlementFilter): Promise<GlobalSettlementReport> {
  const settledIds = await getSettledTournamentIds();
  const dateFilter: PlayerFinancialProfileFilter = {
    from: filter?.from,
    to: filter?.to,
    tournamentIds: settledIds,
  };

  const [totalSiteProfit, all, agentList] = await Promise.all([
    getGlobalSettledProfit(filter),
    getAllUsers({ includeDeleted: false }),
    getAgents(),
  ]);
  const players = all.filter((u) => (u as { role?: string }).role === "user");
  const agentMap = new Map(agentList.map((a) => [(a as { id: number }).id, a]));

  const rows: GlobalSettlementRow[] = [];

  for (const u of players) {
    const userId = (u as { id: number }).id;
    const profile = await getPlayerFinancialProfile(userId, dateFilter);
    const entries = (profile?.totalEntryFees ?? 0) - (profile?.totalEntryFeeRefunds ?? 0);
    const winnings = profile?.totalPrizesWon ?? 0;
    const result = winnings - entries;
    const totalCommission = profile?.totalCommissionGenerated ?? 0;
    const agentCommission = profile?.agentCommissionFromPlayer ?? 0;
    const siteCommission = totalCommission - agentCommission;

    const agentId = (u as { agentId?: number | null }).agentId ?? null;
    let agentName: string | null = null;
    if (agentId != null) {
      const agent = agentMap.get(agentId) ?? (await getUserById(agentId));
      if (agent)
        agentName = (agent as { username?: string | null }).username ?? (agent as { name?: string | null }).name ?? `#${agentId}`;
    }

    rows.push({
      player: (u as { username?: string | null }).username ?? profile?.username ?? `#${userId}`,
      userId,
      agent: agentName,
      agentId,
      entries,
      winnings,
      siteCommission,
      result,
    });
  }

  return {
    rows: rows.sort((a, b) => (b.player ?? "").localeCompare(a.player ?? "")),
    summary: { totalSiteProfit },
    from: filter?.from ?? null,
    to: filter?.to ?? null,
  };
}

// —— Freeroll Settlement Report ——
// Competition | Prize Paid | Site Expense. Freeroll = settled competitions with zero entry revenue; prize paid is site expense.
export interface FreerollSettlementRow {
  competition: string;
  tournamentId: number;
  prizePaid: number;
  siteExpense: number;
}

export interface FreerollSettlementSummary {
  totalSiteExpense: number;
}

export interface FreerollSettlementReport {
  rows: FreerollSettlementRow[];
  summary: FreerollSettlementSummary;
  from: string | null;
  to: string | null;
}

/** Settled competitions where total entry fees (after refunds) = 0. Prize paid = site expense. */
export async function getFreerollSettlementReport(filter?: SettlementFilter): Promise<FreerollSettlementReport> {
  const events = await getFinancialEventsFiltered({
    from: filter?.from,
    to: filter?.to,
    limit: 200_000,
  });

  const byTournament = new Map<number, { entryFees: number; refunds: number; prizes: number }>();

  for (const e of events) {
    const tid = e.tournamentId ?? 0;
    if (!tid) continue;
    let agg = byTournament.get(tid);
    if (!agg) {
      agg = { entryFees: 0, refunds: 0, prizes: 0 };
      byTournament.set(tid, agg);
    }
    const amt = e.amountPoints ?? 0;
    switch (e.eventType) {
      case "ENTRY_FEE":
        agg.entryFees += amt;
        break;
      case "REFUND":
        agg.refunds += amt;
        break;
      case "PRIZE_PAYOUT":
        agg.prizes += amt;
        break;
      default:
        break;
    }
  }

  const tournamentIds = [...byTournament.keys()];
  const [statusMap, nameMap] = await Promise.all([
    getTournamentStatuses(tournamentIds),
    getTournamentNames(tournamentIds),
  ]);

  const rows: FreerollSettlementRow[] = [];
  let totalSiteExpense = 0;

  for (const [tid, agg] of byTournament) {
    const info = statusMap.get(tid);
    if (!info || isExcludedFromReport(info) || info.status !== SETTLED) continue;
    const netEntries = agg.entryFees - agg.refunds;
    if (netEntries > 0) continue; // only freerolls (no entry revenue)
    const prizePaid = agg.prizes;
    if (prizePaid <= 0) continue;
    totalSiteExpense += prizePaid;

    rows.push({
      competition: nameMap.get(tid) ?? `#${tid}`,
      tournamentId: tid,
      prizePaid,
      siteExpense: prizePaid,
    });
  }

  rows.sort((a, b) => b.prizePaid - a.prizePaid);

  return {
    rows,
    summary: { totalSiteExpense },
    from: filter?.from ?? null,
    to: filter?.to ?? null,
  };
}
