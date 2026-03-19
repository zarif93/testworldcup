/**
 * Player financial profile – canonical source: financial_events.
 * Refund rule: entry-fee REFUND events reduce effective entries; competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds.
 * walletNetFlow = deposits + prizes + refunds - entries - withdrawals (refunds from point_transactions).
 */

import { getSchema, getDb } from "../db";
import { getDepositsTotal, getWinningsTotal, getRefundsTotal, getUserById, getReportFilterTournamentIds, getTournamentById } from "../db";
import { eq, and } from "drizzle-orm";
import { getFinancialEventsByUser, getFinancialEventsByUserFiltered } from "./financialEventService";
import { getCommissionBasisPoints, computeCommissionFromEntry } from "./commissionService";
import { logError } from "../_core/logger";
import type { PlayerFinancialProfile } from "./types";

export interface PlayerFinancialProfileFilter {
  from?: string;
  to?: string;
  tournamentType?: string;
  sourceLabel?: "legacy" | "universal";
  /** When set, only events from these tournament IDs (e.g. settled-only reporting). */
  tournamentIds?: number[];
}

export async function getPlayerFinancialProfile(
  userId: number,
  opts?: PlayerFinancialProfileFilter
): Promise<PlayerFinancialProfile | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  const hasFilter =
    opts?.from != null ||
    opts?.to != null ||
    opts?.tournamentType != null ||
    opts?.sourceLabel != null ||
    opts?.tournamentIds != null;
  const events = hasFilter
    ? await getFinancialEventsByUserFiltered(userId, {
        from: opts!.from,
        to: opts!.to,
        tournamentIds:
          opts!.tournamentIds != null
            ? opts!.tournamentIds
            : opts!.tournamentType != null || opts!.sourceLabel != null
              ? await getReportFilterTournamentIds({ tournamentType: opts!.tournamentType, sourceLabel: opts!.sourceLabel })
              : undefined,
        limit: 10_000,
      })
    : await getFinancialEventsByUser(userId, 10_000);
  let totalParticipations = 0;
  let totalEntryFees = 0;
  let totalEntryFeeRefunds = 0;
  let totalPrizesWon = 0;
  let totalCommissionGenerated = 0;
  let agentCommissionFromPlayer = 0;
  const tournamentCache = new Map<number, { commissionPercentBasisPoints?: number | null }>();
  for (const e of events) {
    const amt = e.amountPoints ?? 0;
    const payload = (e.payloadJson ?? {}) as { commissionAmount?: number; agentCommissionAmount?: number };
    switch (e.eventType) {
      case "ENTRY_FEE":
        totalParticipations += 1;
        totalEntryFees += amt;
        if (typeof payload.commissionAmount === "number") {
          totalCommissionGenerated += payload.commissionAmount;
        } else {
          const tid = e.tournamentId ?? 0;
          let t = tournamentCache.get(tid);
          if (!t && tid !== 0) {
            const tour = await getTournamentById(tid);
            if (!tour) {
              logError("getPlayerFinancialProfile", new Error("Tournament not found for entry; commission for this entry set to 0"), { tournamentId: tid, userId });
            } else {
              t = tour as { commissionPercentBasisPoints?: number | null };
              tournamentCache.set(tid, t);
            }
          }
          if (t) {
            const bps = getCommissionBasisPoints(t as { id?: number; name?: string; commissionPercentBasisPoints?: number | null });
            totalCommissionGenerated += computeCommissionFromEntry(amt, bps);
          }
        }
        if (typeof payload.agentCommissionAmount === "number") agentCommissionFromPlayer += payload.agentCommissionAmount;
        break;
      case "REFUND":
        totalEntryFeeRefunds += amt;
        break;
      case "PRIZE_PAYOUT":
        totalPrizesWon += amt;
        break;
      default:
        break;
    }
  }
  const competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds;
  const platformProfitFromPlayer = totalCommissionGenerated - agentCommissionFromPlayer;
  const totalDeposits = await getDepositsTotal(userId);
  const winningsFromPt = await getWinningsTotal(userId);
  const refundsFromPt = await getRefundsTotal(userId);
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  let withdrawals = 0;
  if (db) {
    const rows = await db.select({ amount: pointTransactions.amount }).from(pointTransactions).where(and(eq(pointTransactions.userId, userId), eq(pointTransactions.actionType, "withdraw")));
    withdrawals = rows.reduce((s, r) => s + Math.abs(Number(r.amount ?? 0)), 0);
  }
  const walletNetFlow = totalDeposits + winningsFromPt + refundsFromPt - totalEntryFees - withdrawals;
  const u = user as { username?: string | null; agentId?: number | null; name?: string | null };
  return {
    userId,
    username: u.username ?? null,
    assignedAgentId: u.agentId ?? null,
    totalParticipations,
    totalEntryFees,
    totalEntryFeeRefunds,
    totalPrizesWon,
    competitionNetPnL,
    totalCommissionGenerated,
    agentCommissionFromPlayer,
    platformProfitFromPlayer,
    walletNetFlow,
    totalDeposits,
  };
}
