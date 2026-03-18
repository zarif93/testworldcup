/**
 * Jackpot eligibility and winner selection.
 *
 * Rules:
 * - Eligibility: current Jackpot cycle = from previous completed draw execution time until current draw time.
 *   If no previous draw: use jackpot.cycle_start_at (site setting) or fallback to (drawTime - 365 days).
 * - Tickets: floor(approved_play_volume / ticket_step_ils), default 1000 ILS per ticket.
 * - Approved play volume: ENTRY_FEE minus REFUND only; no JACKPOT_CONTRIBUTION, bonuses, manual credits.
 * - Snapshot stores calculation_window_start/end = cycle window (draw-to-draw).
 */

import { getDb, getSchema, getSiteSettings, setSiteSetting } from "../db";
import { and, desc, eq, gte, lte, lt, isNotNull, sql } from "drizzle-orm";

const JACKPOT_KEYS = {
  BALANCE_POINTS: "jackpot.balance_points",
  ENABLED: "jackpot.enabled",
  CONTRIBUTION_BASIS_POINTS: "jackpot.contribution_basis_points",
  TICKET_STEP_ILS: "jackpot.ticket_step_ils",
  WINNER_PAYOUT_PERCENT: "jackpot.winner_payout_percent",
  NEXT_DRAW_AT: "jackpot.next_draw_at",
  CYCLE_START_AT: "jackpot.cycle_start_at",
} as const;

/** Default 2.5% = 250 basis points. */
export const DEFAULT_JACKPOT_CONTRIBUTION_BASIS_POINTS = 250;

const DEFAULT_TICKET_STEP_ILS = 1000;
const DEFAULT_WINNER_PAYOUT_PERCENT = 75;
/** Fallback when there is no previous completed draw: cycle start = end - this many ms (max 1 year). */
export const FIRST_CYCLE_FALLBACK_MS = 365 * 24 * 60 * 60 * 1000;

export type JackpotSettings = {
  enabled: boolean;
  balancePoints: number;
  contributionBasisPoints: number;
  ticketStepIls: number;
  winnerPayoutPercent: number;
  nextDrawAt: Date | null;
};

export type JackpotProgress = {
  /** Approved play volume in the current Jackpot cycle (from previous draw until next draw). */
  approvedPlayVolume: number;
  ticketCount: number;
  amountUntilNextTicket: number;
  nextDrawAt: Date | null;
  balancePoints: number;
};

export type EligibilityRow = {
  userId: number;
  approvedPlayVolume: number;
  ticketsCount: number;
};

/** Get jackpot settings from site_settings (with defaults). */
export async function getJackpotSettings(): Promise<JackpotSettings> {
  const raw = await getSiteSettings();
  const enabledRaw = raw[JACKPOT_KEYS.ENABLED];
  const enabled = enabledRaw !== "0" && enabledRaw !== "false" && String(enabledRaw).toLowerCase() !== "false";
  const balancePoints = parseInt(raw[JACKPOT_KEYS.BALANCE_POINTS] ?? "0", 10) || 0;
  const contributionBasisPoints = parseInt(raw[JACKPOT_KEYS.CONTRIBUTION_BASIS_POINTS] ?? String(DEFAULT_JACKPOT_CONTRIBUTION_BASIS_POINTS), 10) || DEFAULT_JACKPOT_CONTRIBUTION_BASIS_POINTS;
  const ticketStepIls = parseInt(raw[JACKPOT_KEYS.TICKET_STEP_ILS] ?? String(DEFAULT_TICKET_STEP_ILS), 10) || DEFAULT_TICKET_STEP_ILS;
  const winnerPayoutPercent = parseInt(raw[JACKPOT_KEYS.WINNER_PAYOUT_PERCENT] ?? String(DEFAULT_WINNER_PAYOUT_PERCENT), 10) || DEFAULT_WINNER_PAYOUT_PERCENT;
  const nextRaw = raw[JACKPOT_KEYS.NEXT_DRAW_AT];
  const nextDrawAt = nextRaw ? new Date(nextRaw) : null;
  if (nextDrawAt && Number.isNaN(nextDrawAt.getTime())) (nextDrawAt as unknown as { _invalid?: boolean })._invalid = true;
  return {
    enabled,
    balancePoints,
    contributionBasisPoints,
    ticketStepIls,
    winnerPayoutPercent: Math.min(100, Math.max(0, winnerPayoutPercent)),
    nextDrawAt: nextDrawAt && !Number.isNaN((nextDrawAt as Date).getTime()) ? nextDrawAt : null,
  };
}

export async function setJackpotSetting(key: keyof typeof JACKPOT_KEYS, value: string): Promise<void> {
  const k = JACKPOT_KEYS[key];
  if (!k) return;
  await setSiteSetting(k, value);
}

/** Add points to Jackpot balance (e.g. after recording JACKPOT_CONTRIBUTION). */
export async function incrementJackpotBalance(amountPoints: number): Promise<void> {
  if (amountPoints <= 0) return;
  const settings = await getJackpotSettings();
  const newBal = settings.balancePoints + amountPoints;
  await setSiteSetting("jackpot.balance_points", String(newBal));
}

/** Approved play volume = sum(ENTRY_FEE) - sum(REFUND) for user in [windowStart, windowEnd). Base entry only; no jackpot extra, bonuses, manual. */
export async function getApprovedPlayVolumeForWindow(
  userId: number,
  windowStart: Date,
  windowEnd: Date
): Promise<number> {
  const schema = await getSchema();
  const db = await getDb();
  if (!db) return 0;
  const { financialEvents } = schema as { financialEvents: { userId: unknown; eventType: unknown; amountPoints: unknown; createdAt: unknown } };
  if (!financialEvents) return 0;

  const ws = windowStart.getTime();
  const we = windowEnd.getTime();

  const rows = await db
    .select({ eventType: financialEvents.eventType, amountPoints: financialEvents.amountPoints })
    .from(financialEvents)
    .where(
      and(
        eq(financialEvents.userId, userId),
        sql`${financialEvents.createdAt} >= ${ws}`,
        sql`${financialEvents.createdAt} <= ${we}`
      )
    );

  let total = 0;
  for (const r of rows) {
    const ev = (r as { eventType: string; amountPoints: number }).eventType;
    const amt = Number((r as { amountPoints: number }).amountPoints ?? 0);
    if (ev === "ENTRY_FEE") total += amt;
    else if (ev === "REFUND") total -= amt;
  }
  return Math.max(0, total);
}

/** Most recent completed draw's executedAt strictly before the given time. Used to define cycle start. */
export async function getPreviousCompletedDrawExecutedAt(beforeTimestamp: Date): Promise<Date | null> {
  const db = await getDb();
  if (!db) return null;
  const schema = await getSchema();
  const { jackpotDraws } = schema as { jackpotDraws: { id: unknown; executedAt: unknown; status: unknown } };
  if (!jackpotDraws) return null;
  const beforeMs = beforeTimestamp.getTime();
  const rows = await db
    .select({ executedAt: jackpotDraws.executedAt })
    .from(jackpotDraws)
    .where(
      and(
        eq(jackpotDraws.status, "completed"),
        isNotNull(jackpotDraws.executedAt),
        lt(jackpotDraws.executedAt, beforeTimestamp)
      )
    )
    .orderBy(desc(jackpotDraws.executedAt))
    .limit(1);
  const executedAt = (rows[0] as { executedAt: Date | null } | undefined)?.executedAt;
  return executedAt instanceof Date && !Number.isNaN(executedAt.getTime()) ? executedAt : null;
}

/** Cycle window for a draw: from previous completed draw execution (or fallback) until draw timestamp. */
export async function getCycleWindow(drawTimestamp: Date): Promise<{ windowStart: Date; windowEnd: Date }> {
  const windowEnd = new Date(drawTimestamp.getTime());
  const prevExecutedAt = await getPreviousCompletedDrawExecutedAt(drawTimestamp);
  if (prevExecutedAt) {
    return { windowStart: new Date(prevExecutedAt.getTime()), windowEnd };
  }
  const raw = await getSiteSettings();
  const cycleStartRaw = raw[JACKPOT_KEYS.CYCLE_START_AT];
  if (cycleStartRaw && cycleStartRaw.trim()) {
    const d = new Date(cycleStartRaw.trim());
    if (!Number.isNaN(d.getTime())) return { windowStart: d, windowEnd };
  }
  const windowStart = new Date(drawTimestamp.getTime() - FIRST_CYCLE_FALLBACK_MS);
  return { windowStart, windowEnd };
}

/** All users with approved play volume and ticket count for the draw-to-draw cycle ending at drawTimestamp. */
export async function getEligibilitySnapshot(
  drawTimestamp: Date,
  ticketStepIls: number
): Promise<Array<{ userId: number; approvedPlayVolume: number; ticketsCount: number }>> {
  const { windowStart, windowEnd } = await getCycleWindow(drawTimestamp);
  const schema = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const { financialEvents } = schema as {
    financialEvents: {
      userId: unknown;
      eventType: unknown;
      amountPoints: unknown;
      createdAt: unknown;
    };
  };
  if (!financialEvents) return [];

  const ws = windowStart.getTime();
  const we = windowEnd.getTime();

  const rows = await db
    .select({
      userId: financialEvents.userId,
      amountPoints: financialEvents.amountPoints,
    })
    .from(financialEvents)
    .where(
      and(
        isNotNull(financialEvents.userId),
        sql`${financialEvents.createdAt} >= ${ws}`,
        sql`${financialEvents.createdAt} <= ${we}`,
        eq(financialEvents.eventType, "ENTRY_FEE")
      )
    );

  const refundRows = await db
    .select({
      userId: financialEvents.userId,
      amountPoints: financialEvents.amountPoints,
    })
    .from(financialEvents)
    .where(
      and(
        isNotNull(financialEvents.userId),
        sql`${financialEvents.createdAt} >= ${ws}`,
        sql`${financialEvents.createdAt} <= ${we}`,
        eq(financialEvents.eventType, "REFUND")
      )
    );

  const volumeByUser = new Map<number, number>();
  for (const r of rows) {
    const uid = (r as { userId: number }).userId;
    if (uid == null) continue;
    const amt = Number((r as { amountPoints: number }).amountPoints ?? 0);
    volumeByUser.set(uid, (volumeByUser.get(uid) ?? 0) + amt);
  }
  for (const r of refundRows) {
    const uid = (r as { userId: number }).userId;
    if (uid == null) continue;
    const amt = Number((r as { amountPoints: number }).amountPoints ?? 0);
    volumeByUser.set(uid, Math.max(0, (volumeByUser.get(uid) ?? 0) - amt));
  }

  const step = Math.max(1, ticketStepIls);
  const result: Array<{ userId: number; approvedPlayVolume: number; ticketsCount: number }> = [];
  for (const [userId, approvedPlayVolume] of volumeByUser) {
    const ticketsCount = Math.floor(approvedPlayVolume / step);
    if (ticketsCount > 0) result.push({ userId, approvedPlayVolume, ticketsCount });
  }
  return result;
}

/** User progress for dashboard: volume in current cycle, tickets, amount until next ticket, next draw. */
export async function getJackpotProgress(userId: number): Promise<JackpotProgress> {
  const settings = await getJackpotSettings();
  const now = new Date();
  const cycleEnd = settings.nextDrawAt && settings.nextDrawAt > now ? settings.nextDrawAt : now;
  const { windowStart, windowEnd } = await getCycleWindow(cycleEnd);

  const approvedPlayVolume = await getApprovedPlayVolumeForWindow(userId, windowStart, windowEnd);
  const step = Math.max(1, settings.ticketStepIls);
  const ticketCount = Math.floor(approvedPlayVolume / step);
  const remainder = approvedPlayVolume % step;
  const amountUntilNextTicket = remainder === 0 ? step : step - remainder;

  return {
    approvedPlayVolume,
    ticketCount,
    amountUntilNextTicket,
    nextDrawAt: settings.nextDrawAt,
    balancePoints: settings.balancePoints,
  };
}

/** Idempotency: for scheduled draw at T, prevent running twice. Returns true if a completed draw already exists for this scheduled time (same minute). */
async function hasCompletedDrawForScheduledTime(db: Awaited<ReturnType<typeof getDb>>, scheduledFor: Date): Promise<boolean> {
  if (!db) return false;
  const schema = await getSchema();
  const { jackpotDraws } = schema as { jackpotDraws: { id: unknown; scheduledFor: unknown; status: unknown } };
  if (!jackpotDraws) return false;
  const minuteStart = new Date(scheduledFor);
  minuteStart.setSeconds(0, 0);
  const minuteEnd = new Date(minuteStart.getTime() + 60 * 1000 - 1);
  const existing = await db
    .select({ id: jackpotDraws.id })
    .from(jackpotDraws)
    .where(
      and(
        gte(jackpotDraws.scheduledFor, minuteStart),
        lte(jackpotDraws.scheduledFor, minuteEnd),
        eq(jackpotDraws.status, "completed")
      )
    )
    .limit(1);
  return existing.length > 0;
}

export type TriggerType = "scheduled" | "manual";

/** Run draw at drawTimestamp. triggerType: 'scheduled' = automatic (default), 'manual' = admin override. Lifecycle: pending → running → completed|failed. Idempotent for scheduled draws. */
export async function runJackpotDraw(
  drawTimestamp: Date,
  triggerType: TriggerType = "scheduled"
): Promise<
  | { success: true; drawId: number; winnerUserId: number; winnerUsername: string; payoutAmount: number; carryOverAmount: number }
  | { success: false; error: string }
> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const schema = await getSchema();
  const { jackpotDraws, jackpotDrawSnapshots, users } = schema as {
    jackpotDraws: typeof import("../drizzle/schema-sqlite").jackpotDraws;
    jackpotDrawSnapshots: typeof import("../drizzle/schema-sqlite").jackpotDrawSnapshots;
    users: { id: unknown; username: unknown };
  };
  if (!jackpotDraws || !jackpotDrawSnapshots) return { success: false, error: "Jackpot schema not available" };

  if (triggerType === "scheduled") {
    const already = await hasCompletedDrawForScheduledTime(db, drawTimestamp);
    if (already) return { success: false, error: "Draw for this scheduled time already executed (idempotency)." };
  }

  const settings = await getJackpotSettings();
  const { windowStart, windowEnd } = await getCycleWindow(drawTimestamp);
  const carryOverPercent = Math.max(0, 100 - settings.winnerPayoutPercent);

  const eligibility = await getEligibilitySnapshot(drawTimestamp, settings.ticketStepIls);
  const totalPool = settings.balancePoints;

  const totalTicketsCount = eligibility.reduce((s, r) => s + r.ticketsCount, 0);
  const eligibleUsersCount = eligibility.length;

  const [drawRow] = await db
    .insert(jackpotDraws)
    .values({
      scheduledFor: drawTimestamp,
      calculationWindowStart: windowStart,
      calculationWindowEnd: windowEnd,
      ticketStepIls: settings.ticketStepIls,
      winnerPayoutPercent: settings.winnerPayoutPercent,
      carryOverPercent,
      totalPoolAtDraw: totalPool,
      eligibleUsersCount,
      totalTicketsCount,
      triggerType,
      status: "pending",
    })
    .returning({ id: jackpotDraws.id });

  const drawId = drawRow!.id;

  try {
    await db.update(jackpotDraws).set({ status: "running", updatedAt: new Date() }).where(eq(jackpotDraws.id, drawId));

    if (eligibility.length === 0) {
      await db
        .update(jackpotDraws)
        .set({ status: "failed", errorMessage: "No eligible players in this Jackpot cycle", updatedAt: new Date() })
        .where(eq(jackpotDraws.id, drawId));
      return { success: false, error: "No eligible players in this Jackpot cycle" };
    }

    if (totalPool <= 0) {
      await db
        .update(jackpotDraws)
        .set({ status: "failed", errorMessage: "Jackpot balance is zero", updatedAt: new Date() })
        .where(eq(jackpotDraws.id, drawId));
      return { success: false, error: "Jackpot balance is zero" };
    }

  const payoutPercent = settings.winnerPayoutPercent / 100;
  const payoutAmount = Math.floor(totalPool * payoutPercent);
  const carryOverAmount = totalPool - payoutAmount;

  const pool: number[] = [];
  for (const row of eligibility) {
    for (let i = 0; i < row.ticketsCount; i++) pool.push(row.userId);
  }
  if (pool.length === 0) {
    await db
      .update(jackpotDraws)
      .set({ status: "failed", errorMessage: "Ticket pool is empty", updatedAt: new Date() })
      .where(eq(jackpotDraws.id, drawId));
    return { success: false, error: "Ticket pool is empty" };
  }

  const winnerIndex = Math.floor(Math.random() * pool.length);
  const winnerUserId = pool[winnerIndex];

  const usernames = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, winnerUserId));
  const winnerUsername = (usernames[0] as { username: string | null } | undefined)?.username ?? `#${winnerUserId}`;

  await db.insert(jackpotDrawSnapshots).values(
    eligibility.map((row) => ({
      drawId,
      userId: row.userId,
      approvedPlayVolume: row.approvedPlayVolume,
      ticketsCount: row.ticketsCount,
      calculationWindowStart: windowStart,
      calculationWindowEnd: windowEnd,
    }))
  );

  const executedAt = new Date();
  await db
    .update(jackpotDraws)
    .set({
      status: "completed",
      executedAt,
      winnerUserId,
      winnerUsername,
      payoutAmount,
      carryOverAmount,
      updatedAt: executedAt,
    })
    .where(eq(jackpotDraws.id, drawId));

  await setSiteSetting(JACKPOT_KEYS.BALANCE_POINTS, String(carryOverAmount));

  const { addUserPoints } = await import("../db");
  await addUserPoints(winnerUserId, payoutAmount, "prize", { description: `Jackpot draw #${drawId} (${triggerType})` });

  return {
    success: true,
    drawId,
    winnerUserId,
    winnerUsername,
    payoutAmount,
    carryOverAmount,
  };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(jackpotDraws)
      .set({ status: "failed", errorMessage: msg, updatedAt: new Date() })
      .where(eq(jackpotDraws.id, drawId));
    return { success: false, error: msg };
  }
}

export type JackpotDrawListItem = {
  id: number;
  drawId: number;
  scheduledFor: Date;
  executedAt: Date | null;
  triggerType: "scheduled" | "manual";
  status: string;
  winnerUserId: number | null;
  winnerUsername: string | null;
  payoutAmount: number | null;
  carryOverAmount: number | null;
  totalPoolAtDraw: number;
  eligibleUsersCount: number;
  totalTicketsCount: number;
  ticketStepIls: number;
  winnerPayoutPercent: number;
  carryOverPercent: number;
  errorMessage: string | null;
  createdAt: Date;
};

/** List draws (main audit) for admin (newest first). */
export async function listJackpotDraws(opts?: { limit?: number; offset?: number }): Promise<JackpotDrawListItem[]> {
  const db = await getDb();
  if (!db) return [];
  const schema = await getSchema();
  const { jackpotDraws } = schema as { jackpotDraws: typeof import("../drizzle/schema-sqlite").jackpotDraws };
  if (!jackpotDraws) return [];
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 20));
  const offset = Math.max(0, opts?.offset ?? 0);
  const rows = await db
    .select()
    .from(jackpotDraws)
    .orderBy(desc(jackpotDraws.scheduledFor))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    id: (r as { id: number }).id,
    drawId: (r as { id: number }).id,
    scheduledFor: (r as { scheduledFor: Date }).scheduledFor,
    executedAt: (r as { executedAt: Date | null }).executedAt,
    triggerType: (r as { triggerType: "scheduled" | "manual" }).triggerType,
    status: (r as { status: string }).status,
    winnerUserId: (r as { winnerUserId: number | null }).winnerUserId,
    winnerUsername: (r as { winnerUsername: string | null }).winnerUsername,
    payoutAmount: (r as { payoutAmount: number | null }).payoutAmount,
    carryOverAmount: (r as { carryOverAmount: number | null }).carryOverAmount,
    totalPoolAtDraw: (r as { totalPoolAtDraw: number }).totalPoolAtDraw,
    eligibleUsersCount: (r as { eligibleUsersCount: number }).eligibleUsersCount,
    totalTicketsCount: (r as { totalTicketsCount: number }).totalTicketsCount,
    ticketStepIls: (r as { ticketStepIls: number }).ticketStepIls,
    winnerPayoutPercent: (r as { winnerPayoutPercent: number }).winnerPayoutPercent,
    carryOverPercent: (r as { carryOverPercent: number }).carryOverPercent,
    errorMessage: (r as { errorMessage: string | null }).errorMessage,
    createdAt: (r as { createdAt: Date }).createdAt,
  }));
}

/** Public-safe last draws for homepage: winners, payout, time, and optional eligible/tickets for trust. */
export async function getJackpotLastDrawsPublic(limit: number = 5): Promise<Array<{
  winnerUsername: string;
  payoutAmount: number;
  executedAt: string;
  eligibleUsersCount?: number;
  totalTicketsCount?: number;
  carryOverAmount?: number;
}>> {
  const draws = await listJackpotDraws({ limit: Math.min(20, Math.max(1, limit)), offset: 0 });
  return draws
    .filter((d) => d.status === "completed" && d.winnerUsername != null && d.payoutAmount != null)
    .map((d) => ({
      winnerUsername: d.winnerUsername!,
      payoutAmount: d.payoutAmount!,
      executedAt: (d.executedAt ?? d.scheduledFor) instanceof Date ? (d.executedAt ?? d.scheduledFor).toISOString() : String(d.executedAt ?? d.scheduledFor),
      eligibleUsersCount: d.eligibleUsersCount,
      totalTicketsCount: d.totalTicketsCount,
      carryOverAmount: d.carryOverAmount ?? undefined,
    }));
}

/** Backwards-compatible: list completed draws with audit shape; includes triggerType and status. */
export async function listJackpotDrawAudit(opts?: { limit?: number; offset?: number }): Promise<
  Array<{
    id: number;
    drawId: string;
    drawTimestamp: Date;
    winnerUserId: number;
    winnerUsername: string;
    payoutAmount: number;
    carryOverAmount: number;
    totalPoolAtDraw: number;
    createdAt: Date;
    triggerType: "scheduled" | "manual";
    status: string;
  }>
> {
  const draws = await listJackpotDraws(opts);
  return draws
    .filter((d) => d.status === "completed" && d.winnerUserId != null && d.winnerUsername != null && d.payoutAmount != null && d.carryOverAmount != null)
    .map((d) => ({
      id: d.id,
      drawId: String(d.drawId),
      drawTimestamp: d.executedAt ?? d.scheduledFor,
      winnerUserId: d.winnerUserId!,
      winnerUsername: d.winnerUsername!,
      payoutAmount: d.payoutAmount!,
      carryOverAmount: d.carryOverAmount!,
      totalPoolAtDraw: d.totalPoolAtDraw,
      createdAt: d.createdAt,
      triggerType: d.triggerType,
      status: d.status,
    }));
}

/** Batch update jackpot settings (only provided keys). */
export async function setJackpotSettings(settings: {
  enabled?: boolean;
  balancePoints?: number;
  contributionBasisPoints?: number;
  ticketStepIls?: number;
  winnerPayoutPercent?: number;
  nextDrawAt?: string | Date | null;
}): Promise<void> {
  if (settings.enabled !== undefined) await setSiteSetting(JACKPOT_KEYS.ENABLED, settings.enabled ? "1" : "0");
  if (settings.balancePoints !== undefined) await setSiteSetting(JACKPOT_KEYS.BALANCE_POINTS, String(settings.balancePoints));
  if (settings.contributionBasisPoints !== undefined) await setSiteSetting(JACKPOT_KEYS.CONTRIBUTION_BASIS_POINTS, String(settings.contributionBasisPoints));
  if (settings.ticketStepIls !== undefined) await setSiteSetting(JACKPOT_KEYS.TICKET_STEP_ILS, String(settings.ticketStepIls));
  if (settings.winnerPayoutPercent !== undefined) await setSiteSetting(JACKPOT_KEYS.WINNER_PAYOUT_PERCENT, String(settings.winnerPayoutPercent));
  if (settings.nextDrawAt !== undefined) await setSiteSetting(JACKPOT_KEYS.NEXT_DRAW_AT, settings.nextDrawAt == null ? "" : typeof settings.nextDrawAt === "string" ? settings.nextDrawAt : settings.nextDrawAt.toISOString());
}
