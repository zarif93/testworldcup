/**
 * Settlement financial events – PRIZE_PAYOUT, PLATFORM_COMMISSION, AGENT_COMMISSION.
 * Commission recognized only at settlement (no double-count with participation).
 * Idempotency keys per FINANCE-DESIGN.md. amountPoints always positive.
 */

import { getSchema, getDb } from "../db";
import { inArray, eq } from "drizzle-orm";
import { auditFinance } from "../_core/logger";
import { appendFinancialEvent } from "./financialEventService";
import { IDEMPOTENCY } from "./constants";

export interface SettlementFinancialParams {
  tournamentId: number;
  tournamentName: string;
  commissionBasisPoints: number;
  totalPool: number;
  platformCommission: number;
  prizePerWinner: number;
  winnerSubmissions: Array<{ id: number; userId: number }>;
}

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Writes settlement events into the provided transaction. Idempotent per key. Use inside a single transaction with tournament status update for atomicity. */
export async function recordSettlementFinancialEventsWithTx(tx: DbClient, params: SettlementFinancialParams): Promise<void> {
  const { financialEvents, agentCommissions, submissions } = await getSchema();

  for (const sub of params.winnerSubmissions) {
    if (params.prizePerWinner > 0) {
      const key = IDEMPOTENCY.settlementPrize(params.tournamentId, sub.id);
      await appendFinancialEvent(
        {
          eventType: "PRIZE_PAYOUT",
          amountPoints: params.prizePerWinner,
          tournamentId: params.tournamentId,
          userId: sub.userId,
          submissionId: sub.id,
          idempotencyKey: key,
          payloadJson: { tournamentName: params.tournamentName },
        },
        tx
      );
    }
  }

  const platformKey = IDEMPOTENCY.settlementPlatform(params.tournamentId);
  await appendFinancialEvent(
    {
      eventType: "PLATFORM_COMMISSION",
      amountPoints: params.platformCommission,
      tournamentId: params.tournamentId,
      idempotencyKey: platformKey,
      payloadJson: { totalPool: params.totalPool, commissionBasisPoints: params.commissionBasisPoints },
    },
    tx
  );

  const allSubs = await tx.select({ id: submissions.id }).from(submissions).where(eq(submissions.tournamentId, params.tournamentId));
  const allSubIds = allSubs.map((s) => s.id);
  if (allSubIds.length > 0) {
    const acRows = await tx
      .select({ agentId: agentCommissions.agentId, commissionAmount: agentCommissions.commissionAmount })
      .from(agentCommissions)
      .where(inArray(agentCommissions.submissionId, allSubIds));
    const byAgent = new Map<number, number>();
    for (const r of acRows) {
      const a = r.agentId ?? 0;
      byAgent.set(a, (byAgent.get(a) ?? 0) + (r.commissionAmount ?? 0));
    }
    for (const [agentId, amount] of byAgent) {
      if (amount > 0) {
        const key = IDEMPOTENCY.settlementAgent(params.tournamentId, agentId);
        await appendFinancialEvent(
          {
            eventType: "AGENT_COMMISSION",
            amountPoints: amount,
            tournamentId: params.tournamentId,
            agentId,
            idempotencyKey: key,
            payloadJson: { tournamentName: params.tournamentName },
          },
          tx
        );
      }
    }
  }
  auditFinance("SETTLEMENT", {
    tournamentId: params.tournamentId,
    amountPoints: params.platformCommission,
    totalPool: params.totalPool,
    platformCommission: params.platformCommission,
    winnerCount: params.winnerSubmissions.length,
  });
}

/** Writes settlement events with idempotency. Call after prizes are credited. Safe to retry. Uses standalone db (no transaction). */
export async function recordSettlementFinancialEvents(params: SettlementFinancialParams): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await recordSettlementFinancialEventsWithTx(db, params);
}

/** Record ENTRY_FEE when participation is recorded outside the transactional path (e.g. SQLite). Idempotent by submissionId. */
export async function recordEntryFeeFinancialEvent(params: {
  submissionId: number;
  tournamentId: number;
  userId: number;
  agentId: number | null;
  amountPoints: number;
  payloadJson?: Record<string, unknown>;
}): Promise<number> {
  const key = IDEMPOTENCY.entry(params.submissionId);
  const eventId = await appendFinancialEvent({
    eventType: "ENTRY_FEE",
    amountPoints: params.amountPoints,
    tournamentId: params.tournamentId,
    userId: params.userId,
    agentId: params.agentId,
    submissionId: params.submissionId,
    idempotencyKey: key,
    payloadJson: params.payloadJson ?? null,
  });
  auditFinance("ENTRY_FEE", {
    tournamentId: params.tournamentId,
    userId: params.userId,
    agentId: params.agentId,
    submissionId: params.submissionId,
    amountPoints: params.amountPoints,
    idempotencyKey: key,
    eventId,
  });
  return eventId;
}

/** Idempotency key for tournament refund per user: refund:tournament:{tournamentId}:{userId} */
export function refundIdempotencyKey(tournamentId: number, userId: number): string {
  return IDEMPOTENCY.refund(`tournament:${tournamentId}:${userId}`);
}

/** Append REFUND event for a tournament participant. Refund rule: ENTRY_FEE only (base entry). Safe to call multiple times (idempotent). */
export async function recordRefundFinancialEvent(params: {
  tournamentId: number;
  userId: number;
  amountPoints: number;
  payloadJson?: Record<string, unknown>;
}): Promise<number> {
  const key = refundIdempotencyKey(params.tournamentId, params.userId);
  const eventId = await appendFinancialEvent({
    eventType: "REFUND",
    amountPoints: params.amountPoints,
    tournamentId: params.tournamentId,
    userId: params.userId,
    idempotencyKey: key,
    payloadJson: params.payloadJson ?? null,
  });
  auditFinance("REFUND", {
    tournamentId: params.tournamentId,
    userId: params.userId,
    amountPoints: params.amountPoints,
    idempotencyKey: key,
    eventId,
  });
  return eventId;
}

/** Append ADJUSTMENT event. Caller must supply unique adjustmentId for idempotency. */
export async function recordAdjustmentFinancialEvent(params: {
  adjustmentId: string;
  amountPoints: number;
  userId?: number | null;
  tournamentId?: number | null;
  payloadJson?: Record<string, unknown>;
}): Promise<number> {
  const key = IDEMPOTENCY.adjustment(params.adjustmentId);
  return appendFinancialEvent({
    eventType: "ADJUSTMENT",
    amountPoints: params.amountPoints,
    tournamentId: params.tournamentId ?? null,
    userId: params.userId ?? null,
    idempotencyKey: key,
    payloadJson: params.payloadJson ?? null,
  });
}
