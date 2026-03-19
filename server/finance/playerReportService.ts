/**
 * Player detailed report – real data from financial_events.
 * Summary + per-participation (per tournament) table; date-range filter; same commission constants.
 */

import { getFinancialEventsByUserFiltered } from "./financialEventService";
import { getPlayerFinancialProfile } from "./playerFinanceService";
import { getCommissionBasisPoints, computeCommissionFromEntry, computeReportCommissionSplit } from "./commissionService";
import { getUserById, getTournamentById, getSubmissionById } from "../db";
import { DEFAULT_AGENT_SHARE_BASIS_POINTS } from "./constants";

export interface PlayerReportSummary {
  totalParticipations: number;
  totalEntryFees: number;
  totalWinningsPaid: number;
  totalRefunds: number;
  netProfitLoss: number;
  totalCommissionGenerated: number;
  agentShare: number;
  platformShare: number;
}

export type PlayerReportRowStatus = "profit" | "loss" | "even";

/** Result for display: Win / Loss / Refund */
export type PlayerReportResultDisplay = "Win" | "Loss" | "Refund";

export interface PlayerReportParticipationRow {
  tournamentId: number;
  tournamentName: string;
  tournamentType: string;
  date: Date | null;
  entryFee: number;
  winnings: number;
  refund: number;
  netResult: number;
  totalCommission: number;
  agentShare: number;
  platformShare: number;
  status: PlayerReportRowStatus;
  submissionId: number | null;
  /** Submission status for display (e.g. מאושר, ממתין) */
  submissionStatus: string;
  /** Result for display: Win | Loss | Refund */
  resultDisplay: PlayerReportResultDisplay;
}

export interface PlayerReportDetailed {
  summary: PlayerReportSummary;
  rows: PlayerReportParticipationRow[];
  userId: number;
  username: string | null;
  fullName: string | null;
  /** Current wallet balance (user.points) – full ledger, not just game PnL */
  currentWalletBalance: number;
}

export interface PlayerReportFilter {
  from?: string;
  to?: string;
  /** When set, only events for these tournament IDs (e.g. settled-only reporting). */
  tournamentIds?: number[];
}

function rowStatus(netResult: number): PlayerReportRowStatus {
  if (netResult > 0) return "profit";
  if (netResult < 0) return "loss";
  return "even";
}

/**
 * Build player report from financial_events.
 * One row per ENTRY_FEE (participation); PRIZE_PAYOUT and REFUND matched by submissionId / tournamentId.
 */
export async function getPlayerReportDetailed(
  userId: number,
  filter?: PlayerReportFilter
): Promise<PlayerReportDetailed | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  const events = await getFinancialEventsByUserFiltered(userId, {
    from: filter?.from,
    to: filter?.to,
    tournamentIds: filter?.tournamentIds,
    limit: 10_000,
  });

  if (process.env.NODE_ENV !== "production") {
    const entryEvents = events.filter((e) => e.eventType === "ENTRY_FEE");
    const payoutEvents = events.filter((e) => e.eventType === "PRIZE_PAYOUT");
    const refundEvents = events.filter((e) => e.eventType === "REFUND");
    console.log("[PlayerReportDetailed] events loaded", {
      playerId: userId,
      dateRange: { from: filter?.from ?? null, to: filter?.to ?? null },
      tournamentIdsFilter: filter?.tournamentIds?.length ?? 0,
      totalEvents: events.length,
      entryFeeEvents: entryEvents.length,
      prizePayoutEvents: payoutEvents.length,
      refundEvents: refundEvents.length,
      sampleEntryEvents: entryEvents.slice(0, 3).map((e) => ({
        id: (e as { id?: number }).id,
        tournamentId: e.tournamentId,
        submissionId: e.submissionId,
        amountPoints: e.amountPoints,
        createdAt: e.createdAt,
      })),
    });
  }

  const entryRows: Array<{
    submissionId: number | null;
    tournamentId: number;
    amountPoints: number;
    createdAt: Date | null;
    commissionAmount: number;
    agentCommissionAmount: number;
  }> = [];
  const prizeBySubmission = new Map<number, number>();
  const refundByTournament = new Map<number, number>();
  /** Sum of all PRIZE_PAYOUT amounts (canonical total winnings from events) */
  let totalPrizesFromEvents = 0;

  for (const e of events) {
    const amt = e.amountPoints ?? 0;
    const payload = (e.payloadJson ?? {}) as { commissionAmount?: number; agentCommissionAmount?: number };
    switch (e.eventType) {
      case "PRIZE_PAYOUT":
        totalPrizesFromEvents += amt;
        if (e.submissionId != null) {
          prizeBySubmission.set(e.submissionId, (prizeBySubmission.get(e.submissionId) ?? 0) + amt);
        }
        break;
      case "ENTRY_FEE":
        entryRows.push({
          submissionId: e.submissionId ?? null,
          tournamentId: e.tournamentId ?? 0,
          amountPoints: amt,
          createdAt: e.createdAt ?? null,
          commissionAmount: typeof payload.commissionAmount === "number" ? payload.commissionAmount : 0,
          agentCommissionAmount: typeof payload.agentCommissionAmount === "number" ? payload.agentCommissionAmount : 0,
        });
        break;
      case "REFUND":
        if (e.tournamentId != null) {
          refundByTournament.set(e.tournamentId, (refundByTournament.get(e.tournamentId) ?? 0) + amt);
        }
        break;
      default:
        break;
    }
  }

  const tournamentCache = new Map<number, { name: string; type: string }>();
  const getTournamentInfo = async (tournamentId: number) => {
    if (tournamentId === 0) return { name: "יתר זכיות", type: "other" };
    let c = tournamentCache.get(tournamentId);
    if (!c) {
      const t = await getTournamentById(tournamentId);
      const name = (t as { name?: string })?.name ?? String(tournamentId);
      const type = (t as { type?: string })?.type ?? "football";
      c = { name, type };
      tournamentCache.set(tournamentId, c);
    }
    return c;
  };

  const submissionStatusCache = new Map<number, string>();
  const getSubmissionStatusDisplay = async (submissionId: number | null): Promise<string> => {
    if (submissionId == null) return "—";
    let s = submissionStatusCache.get(submissionId);
    if (s != null) return s;
    const sub = await getSubmissionById(submissionId);
    const status = (sub as { status?: string })?.status ?? "";
    s = status === "approved" ? "מאושר" : status === "pending" ? "ממתין" : status ? status : "—";
    submissionStatusCache.set(submissionId, s);
    return s;
  };

  const rows: PlayerReportParticipationRow[] = [];
  const refundConsumed = new Map<number, number>();

  for (const entry of entryRows) {
    const tournamentId = entry.tournamentId;
    const info = await getTournamentInfo(tournamentId);
    const entryFee = entry.amountPoints;
    const winnings = entry.submissionId != null ? prizeBySubmission.get(entry.submissionId) ?? 0 : 0;
    const refundForTournament = refundByTournament.get(tournamentId) ?? 0;
    const consumed = refundConsumed.get(tournamentId) ?? 0;
    const refundThisRow = refundForTournament > consumed ? Math.min(refundForTournament - consumed, entryFee) : 0;
    if (refundThisRow > 0) refundConsumed.set(tournamentId, consumed + refundThisRow);
    const netResult = winnings + refundThisRow - entryFee;

    let totalCommission = entry.commissionAmount;
    let agentShare = entry.agentCommissionAmount;
    if (totalCommission === 0 && entryFee > 0 && tournamentId !== 0) {
      const tournament = await getTournamentById(tournamentId);
      if (!tournament) throw new Error("Tournament not found for report: " + tournamentId);
      const bps = getCommissionBasisPoints(tournament as { id?: number; name?: string; commissionPercentBasisPoints?: number | null });
      totalCommission = computeCommissionFromEntry(entryFee, bps);
      const split = computeReportCommissionSplit(totalCommission, DEFAULT_AGENT_SHARE_BASIS_POINTS);
      agentShare = split.agentCommission;
    }
    const platformShare = totalCommission - agentShare;

    const resultDisplay: PlayerReportResultDisplay = winnings > 0 ? "Win" : refundThisRow > 0 ? "Refund" : "Loss";
    const submissionStatus = await getSubmissionStatusDisplay(entry.submissionId);

    rows.push({
      tournamentId,
      tournamentName: info.name,
      tournamentType: info.type,
      date: entry.createdAt,
      entryFee,
      winnings,
      refund: refundThisRow,
      netResult,
      totalCommission,
      agentShare,
      platformShare,
      status: rowStatus(netResult),
      submissionId: entry.submissionId,
      submissionStatus,
      resultDisplay,
    });
  }

  const totalWinningsInRows = rows.reduce((s, r) => s + r.winnings, 0);
  const orphanPrizes = totalPrizesFromEvents - totalWinningsInRows;
  /** Sentinel: synthetic row for orphan prizes (not from ENTRY_FEE); 0 is used for null tournamentId from events */
  const SYNTHETIC_ROW_TOURNAMENT_ID = -1;
  if (orphanPrizes > 0) {
    rows.push({
      tournamentId: SYNTHETIC_ROW_TOURNAMENT_ID,
      tournamentName: "יתר זכיות",
      tournamentType: "other",
      date: null,
      entryFee: 0,
      winnings: orphanPrizes,
      refund: 0,
      netResult: orphanPrizes,
      totalCommission: 0,
      agentShare: 0,
      platformShare: 0,
      status: "profit",
      submissionId: null,
      submissionStatus: "—",
      resultDisplay: "Win",
    });
  }

  const totalParticipations = rows.length;
  const totalEntryFees = rows.reduce((s, r) => s + r.entryFee, 0);
  const totalWinningsPaid = totalPrizesFromEvents;
  const totalRefunds = rows.reduce((s, r) => s + r.refund, 0);
  const netProfitLoss = totalWinningsPaid - totalEntryFees + totalRefunds;
  const totalCommissionGenerated = rows.reduce((s, r) => s + r.totalCommission, 0);
  const agentShareSum = rows.reduce((s, r) => s + r.agentShare, 0);
  const platformShareSum = rows.reduce((s, r) => s + r.platformShare, 0);

  const netFromRows = rows.reduce((s, r) => s + r.netResult, 0);
  if (netFromRows !== netProfitLoss) {
    throw new Error(
      `Player report consistency: sum(rows.netResult)=${netFromRows} must equal netProfitLoss=${netProfitLoss}`
    );
  }
  if (platformShareSum + agentShareSum !== totalCommissionGenerated) {
    throw new Error(`Player report commission: agentShare+platformShare=${agentShareSum + platformShareSum} must equal totalCommissionGenerated=${totalCommissionGenerated}`);
  }

  const summary: PlayerReportSummary = {
    totalParticipations,
    totalEntryFees,
    totalWinningsPaid,
    totalRefunds,
    netProfitLoss,
    totalCommissionGenerated,
    agentShare: agentShareSum,
    platformShare: platformShareSum,
  };

  if (process.env.NODE_ENV !== "production" && rows.length > 0) {
    console.log("[PlayerReportDetailed] raw rows before settlement filter", {
      playerId: userId,
      rowCount: rows.length,
      firstRow: rows[0]
        ? {
            tournamentId: rows[0].tournamentId,
            tournamentName: rows[0].tournamentName,
            entryFee: rows[0].entryFee,
            winnings: rows[0].winnings,
            refund: rows[0].refund,
            netResult: rows[0].netResult,
            resultDisplay: rows[0].resultDisplay,
          }
        : null,
    });
  }

  const u = user as { username?: string | null; name?: string | null; points?: number };
  return {
    summary,
    rows,
    userId,
    username: u.username ?? null,
    fullName: u.name ?? u.username ?? null,
    currentWalletBalance: Number(u.points ?? 0),
  };
}
