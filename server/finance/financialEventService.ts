/**
 * Immutable financial event ledger – append-only.
 * Every monetary action is recorded; no updates/deletes.
 */

import { eq, desc, gte, lte, or, and, inArray } from "drizzle-orm";
import { getSchema, getDb } from "../db";
import type { FinancialEventType } from "./types";
/** Transaction or db client (same interface for select/insert). */
type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export interface AppendFinancialEventInput {
  eventType: FinancialEventType;
  amountPoints: number;
  tournamentId?: number | null;
  userId?: number | null;
  agentId?: number | null;
  submissionId?: number | null;
  idempotencyKey?: string | null;
  payloadJson?: Record<string, unknown> | null;
}

/** Append event using optional transaction client. When tx is provided, uses tx for select/insert (caller commits). */
export async function appendFinancialEvent(
  input: AppendFinancialEventInput,
  tx?: DbClient
): Promise<number> {
  const { financialEvents } = await getSchema();
  const db = tx ?? (await getDb());
  if (!db) throw new Error("Database not available");
  const amount = Math.max(0, Math.floor(input.amountPoints));
  if (input.idempotencyKey) {
    const existing = await db
      .select({ id: financialEvents.id })
      .from(financialEvents)
      .where(eq(financialEvents.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing.length > 0) return existing[0].id;
  }
  const [row] = await db
    .insert(financialEvents)
    .values({
      eventType: input.eventType,
      amountPoints: amount,
      tournamentId: input.tournamentId ?? null,
      userId: input.userId ?? null,
      agentId: input.agentId ?? null,
      submissionId: input.submissionId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      payloadJson: input.payloadJson ?? null,
    })
    .returning({ id: financialEvents.id });
  return row?.id ?? 0;
}

export async function getFinancialEventsByTournament(tournamentId: number) {
  const { financialEvents } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(financialEvents)
    .where(eq(financialEvents.tournamentId, tournamentId))
    .orderBy(desc(financialEvents.createdAt));
}

export async function getFinancialEventsByUser(userId: number, limit = 500) {
  const { financialEvents } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(financialEvents)
    .where(eq(financialEvents.userId, userId))
    .orderBy(desc(financialEvents.createdAt))
    .limit(limit);
}

export interface GetFinancialEventsByUserFilter {
  from?: string;
  to?: string;
  tournamentIds?: number[];
  limit?: number;
}

/** Events for a user with optional date and tournament filter (for canonical PnL with filters). */
export async function getFinancialEventsByUserFiltered(userId: number, filter: GetFinancialEventsByUserFilter = {}) {
  const { financialEvents } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  // Explicit empty tournamentIds => no events (e.g. settled-only report when no tournaments are settled)
  if (filter.tournamentIds !== undefined && filter.tournamentIds.length === 0) return [];
  const conditions = [eq(financialEvents.userId, userId)];
  if (filter.from) conditions.push(gte(financialEvents.createdAt, new Date(filter.from)));
  if (filter.to) {
    const end = new Date(filter.to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(financialEvents.createdAt, end));
  }
  if (filter.tournamentIds != null && filter.tournamentIds.length > 0) {
    conditions.push(inArray(financialEvents.tournamentId, filter.tournamentIds));
  }
  return db
    .select()
    .from(financialEvents)
    .where(and(...conditions))
    .orderBy(desc(financialEvents.createdAt))
    .limit(filter.limit ?? 10_000);
}

export async function getFinancialEventsByAgent(agentId: number, limit = 500) {
  const { financialEvents } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(financialEvents)
    .where(or(eq(financialEvents.agentId, agentId), eq(financialEvents.userId, agentId)))
    .orderBy(desc(financialEvents.createdAt))
    .limit(limit);
}

export async function getFinancialEventsByTimeRange(from: Date, to: Date) {
  const { financialEvents } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(financialEvents)
    .where(and(gte(financialEvents.createdAt, from), lte(financialEvents.createdAt, to)))
    .orderBy(desc(financialEvents.createdAt));
}

export interface GetFinancialEventsFilter {
  from?: string;
  to?: string;
  limit?: number;
}

/** All financial events, optionally filtered by date. For global settlement aggregation by tournament. */
export async function getFinancialEventsFiltered(filter: GetFinancialEventsFilter = {}): Promise<
  Array<{
    id: number;
    eventType: string;
    amountPoints: number | null;
    tournamentId: number | null;
    userId: number | null;
    agentId: number | null;
    submissionId: number | null;
    payloadJson: unknown;
    createdAt: Date | null;
  }>
> {
  const { financialEvents } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (filter.from) conditions.push(gte(financialEvents.createdAt, new Date(filter.from)));
  if (filter.to) {
    const end = new Date(filter.to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(financialEvents.createdAt, end));
  }
  const limit = filter.limit ?? 100_000;
  let q = db
    .select({
      id: financialEvents.id,
      eventType: financialEvents.eventType,
      amountPoints: financialEvents.amountPoints,
      tournamentId: financialEvents.tournamentId,
      userId: financialEvents.userId,
      agentId: financialEvents.agentId,
      submissionId: financialEvents.submissionId,
      payloadJson: financialEvents.payloadJson,
      createdAt: financialEvents.createdAt,
    })
    .from(financialEvents)
    .orderBy(desc(financialEvents.createdAt))
    .limit(limit);
  if (conditions.length > 0) q = q.where(and(...conditions)) as typeof q;
  const rows = await q;
  return rows as Array<{
    id: number;
    eventType: string;
    amountPoints: number | null;
    tournamentId: number | null;
    userId: number | null;
    agentId: number | null;
    submissionId: number | null;
    payloadJson: unknown;
    createdAt: Date | null;
  }>;
}

/** Return existing event id if idempotency key already exists; used inside transactions to avoid duplicate. */
export async function findEventIdByIdempotencyKey(idempotencyKey: string): Promise<number | null> {
  const { financialEvents } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const row = await db.select({ id: financialEvents.id }).from(financialEvents).where(eq(financialEvents.idempotencyKey, idempotencyKey)).limit(1);
  return row[0]?.id ?? null;
}

/**
 * Find a submission for (userId, tournamentId) that already has an ENTRY_FEE event.
 * Used for idempotent submit: if a prior request created the submission but recordEntryFeeFinancialEvent failed,
 * a retry should not create a second submission or double-deduct. Returns the submission id if found.
 */
export async function findSubmissionIdWithEntryFeeForUserAndTournament(
  userId: number,
  tournamentId: number
): Promise<number | null> {
  const schema = await getSchema();
  const { financialEvents, submissions } = schema;
  const db = await getDb();
  if (!db) return null;
  const subs = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.tournamentId, tournamentId)))
    .orderBy(desc(submissions.id))
    .limit(50);
  if (subs.length === 0) return null;
  const ids = subs.map((s) => s.id);
  const withEntry = await db
    .select({ submissionId: financialEvents.submissionId })
    .from(financialEvents)
    .where(
      and(eq(financialEvents.eventType, "ENTRY_FEE"), inArray(financialEvents.submissionId, ids))
    )
    .limit(1);
  const subId = withEntry[0]?.submissionId;
  return subId != null && ids.includes(subId) ? subId : null;
}
