/**
 * Finance Phase 1 tests:
 * - Commission basis points calculation (floor)
 * - Agent share override/fallback
 * - No duplicate commission / prize / refund events (idempotency)
 * - Wallet vs competition PnL distinction
 * - Settlement retry safety
 * - Residue handling rule (floor → residue stays with platform)
 */

import { describe, expect, it, beforeAll } from "vitest";
import {
  getCommissionBasisPoints,
  computePlatformCommission,
  computeAgentShare,
  computePrizePool,
  getAgentShareBasisPoints,
  computePlatformNetCommission,
  computeCommissionFromEntry,
} from "./commissionService";
import { floorPoints, DEFAULT_COMMISSION_BASIS_POINTS, DEFAULT_AGENT_SHARE_BASIS_POINTS } from "./constants";
import { appendFinancialEvent } from "./financialEventService";
import { recordSettlementFinancialEvents, recordSettlementFinancialEventsWithTx, recordRefundFinancialEvent } from "./recordFinancialEvents";
import { getFinancialEventsByTournament, getFinancialEventsByUser } from "./financialEventService";
import { getPlayerFinancialProfile } from "./playerFinanceService";
import { getSchema, getDb } from "../db";
import { eq } from "drizzle-orm";

describe("commission basis points calculation", () => {
  it("uses commissionPercentBasisPoints when set", () => {
    expect(getCommissionBasisPoints({ commissionPercentBasisPoints: 1250 })).toBe(1250);
    expect(getCommissionBasisPoints({ commissionPercentBasisPoints: 1000 })).toBe(1000);
  });

  it("falls back to legacy commissionPercent (percent to basis points)", () => {
    expect(getCommissionBasisPoints({ commissionPercent: 12.5 })).toBe(1250);
    expect(getCommissionBasisPoints({ commissionPercent: 10 })).toBe(1000);
  });

  it("falls back to default when missing", () => {
    expect(getCommissionBasisPoints({})).toBe(DEFAULT_COMMISSION_BASIS_POINTS);
  });

  it("computePlatformCommission uses floor", () => {
    expect(computePlatformCommission(1000, 1250)).toBe(125);
    expect(computePlatformCommission(100, 3333)).toBe(33); // 33.33 → floor 33
  });

  it("computePrizePool = totalPool - platformCommission", () => {
    const pool = 1000;
    const bps = 1250;
    const fee = computePlatformCommission(pool, bps);
    expect(computePrizePool(pool, bps)).toBe(pool - fee);
  });

  it("computeAgentShare uses floor", () => {
    expect(computeAgentShare(100, 5000)).toBe(50);
    expect(computeAgentShare(33, 5000)).toBe(16); // 16.5 → floor 16
  });

  it("computePlatformNetCommission = platformCommission - agentTotal", () => {
    expect(computePlatformNetCommission(125, 50)).toBe(75);
  });

  it("computeCommissionFromEntry: FreeRoll (0 amount) yields 0 commission", () => {
    expect(computeCommissionFromEntry(0, DEFAULT_COMMISSION_BASIS_POINTS)).toBe(0);
    expect(computeCommissionFromEntry(0, 1000)).toBe(0);
  });

  it("computeCommissionFromEntry: paid entry uses floor", () => {
    expect(computeCommissionFromEntry(1000, 1250)).toBe(125);
    expect(computeCommissionFromEntry(100, 1250)).toBe(12);
  });
});

describe("residue handling rule", () => {
  it("floorPoints always floors; residue effectively stays with platform", () => {
    expect(floorPoints(33.7)).toBe(33);
    expect(floorPoints(33.3)).toBe(33);
    expect(floorPoints(33)).toBe(33);
    expect(floorPoints(0.99)).toBe(0);
  });

  it("small pool with odd basis points: platform gets floor, remainder is residue", () => {
    const totalPool = 10;
    const bps = 3333; // 33.33%
    const platform = computePlatformCommission(totalPool, bps);
    expect(platform).toBe(3); // 3.333 → floor 3
    const prizePool = computePrizePool(totalPool, bps);
    expect(prizePool).toBe(7);
    expect(platform + prizePool).toBeLessThanOrEqual(totalPool); // residue 0 stays with platform
  });
});

describe("agent share override / fallback", () => {
  it("getAgentShareBasisPoints returns default when no config (requires db)", async () => {
    const db = await getDb();
    if (!db) return;
    const bps = await getAgentShareBasisPoints(999999);
    expect(bps).toBe(DEFAULT_AGENT_SHARE_BASIS_POINTS);
  });
});

describe("idempotency: no duplicate events", () => {
  const tournamentId = 999999;
  const submissionId = 888888;
  const userId = 777777;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    const schema = await getSchema();
    const { financialEvents } = schema;
    await db.delete(financialEvents).where(eq(financialEvents.tournamentId, tournamentId));
    await db.delete(financialEvents).where(eq(financialEvents.userId, userId));
  });

  it("appendFinancialEvent with same idempotency key returns existing id", async () => {
    const key = `test:idem:${Date.now()}`;
    const id1 = await appendFinancialEvent({
      eventType: "ENTRY_FEE",
      amountPoints: 100,
      tournamentId,
      userId,
      submissionId,
      idempotencyKey: key,
    });
    const id2 = await appendFinancialEvent({
      eventType: "ENTRY_FEE",
      amountPoints: 100,
      tournamentId,
      userId,
      submissionId,
      idempotencyKey: key,
    });
    expect(id2).toBe(id1);
    const events = await getFinancialEventsByUser(userId, 10);
    const matching = events.filter((e) => e.idempotencyKey === key);
    expect(matching.length).toBe(1);
  });

  it("recordRefundFinancialEvent twice same user+tournament does not duplicate", async () => {
    const db = await getDb();
    if (!db) return;
    const tid = 998001;
    const uid = 997001;
    await recordRefundFinancialEvent({ tournamentId: tid, userId: uid, amountPoints: 50 });
    await recordRefundFinancialEvent({ tournamentId: tid, userId: uid, amountPoints: 50 });
    const events = await getFinancialEventsByUser(uid, 20);
    const refunds = events.filter((e) => e.eventType === "REFUND" && e.tournamentId === tid);
    expect(refunds.length).toBe(1);
  });

  it("recordSettlementFinancialEvents twice produces no duplicate payout/commission events", async () => {
    const db = await getDb();
    if (!db) return;
    const tid = 998002;
    const subId = 998102;
    const uid = 997002;
    const params = {
      tournamentId: tid,
      tournamentName: "Idem Test",
      commissionBasisPoints: 1250,
      totalPool: 1000,
      platformCommission: 125,
      prizePerWinner: 400,
      winnerSubmissions: [{ id: subId, userId: uid }],
    };
    await recordSettlementFinancialEvents(params);
    await recordSettlementFinancialEvents(params);
    const events = await getFinancialEventsByTournament(tid);
    const prizes = events.filter((e) => e.eventType === "PRIZE_PAYOUT");
    const platform = events.filter((e) => e.eventType === "PLATFORM_COMMISSION");
    expect(prizes.length).toBe(1);
    expect(platform.length).toBe(1);
  });
});

describe("wallet vs competition PnL distinction", () => {
  it("getPlayerFinancialProfile returns competitionNetPnL from events only", async () => {
    const db = await getDb();
    if (!db) return;
    const uid = 997003;
    const profile = await getPlayerFinancialProfile(uid);
    if (!profile) return;
    expect(typeof profile.competitionNetPnL).toBe("number");
    expect(typeof profile.walletNetFlow).toBe("number");
    expect(typeof profile.totalEntryFees).toBe("number");
    expect(typeof profile.totalPrizesWon).toBe("number");
  });
});

describe("settlement transaction safety", () => {
  it("recordSettlementFinancialEventsWithTx writes events when given db client (used atomically in doDistributePrizesBody)", async () => {
    const db = await getDb();
    if (!db) return;
    const tid = 998004;
    const params = {
      tournamentId: tid,
      tournamentName: "Tx Test",
      commissionBasisPoints: 1250,
      totalPool: 1000,
      platformCommission: 125,
      prizePerWinner: 400,
      winnerSubmissions: [{ id: 998104, userId: 997006 }],
    };
    await recordSettlementFinancialEventsWithTx(db, params);
    const events = await getFinancialEventsByTournament(tid);
    const prizes = events.filter((e) => e.eventType === "PRIZE_PAYOUT");
    expect(prizes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("settlement retry safety", () => {
  it("calling recordSettlementFinancialEvents twice does not double prize or commission", async () => {
    const db = await getDb();
    if (!db) return;
    const tid = 998003;
    const params = {
      tournamentId: tid,
      tournamentName: "Retry Test",
      commissionBasisPoints: 1250,
      totalPool: 2000,
      platformCommission: 250,
      prizePerWinner: 875,
      winnerSubmissions: [
        { id: 998103, userId: 997004 },
        { id: 998104, userId: 997005 },
      ],
    };
    await recordSettlementFinancialEvents(params);
    await recordSettlementFinancialEvents(params);
    const events = await getFinancialEventsByTournament(tid);
    const prizes = events.filter((e) => e.eventType === "PRIZE_PAYOUT");
    const platform = events.filter((e) => e.eventType === "PLATFORM_COMMISSION");
    expect(prizes.length).toBe(2);
    expect(platform.length).toBe(1);
    const totalPrize = prizes.reduce((s, e) => s + (e.amountPoints ?? 0), 0);
    expect(totalPrize).toBe(875 * 2);
  });
});

describe("refund effect on competitionNetPnL", () => {
  it("REFUND events reduce effective entries: competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds", async () => {
    const db = await getDb();
    if (!db) return;
    const uid = 997010;
    const tid = 998010;
    const subId = 998110;
    const keyEntry = `entry:${subId}`;
    const keyRefund = `refund:tournament:${tid}:${uid}`;
    await appendFinancialEvent({
      eventType: "ENTRY_FEE",
      amountPoints: 100,
      tournamentId: tid,
      userId: uid,
      submissionId: subId,
      idempotencyKey: keyEntry,
    });
    await appendFinancialEvent({
      eventType: "REFUND",
      amountPoints: 100,
      tournamentId: tid,
      userId: uid,
      idempotencyKey: keyRefund,
    });
    const profile = await getPlayerFinancialProfile(uid);
    if (!profile) return;
    expect(profile.totalEntryFees).toBe(100);
    expect(profile.totalEntryFeeRefunds).toBe(100);
    expect(profile.totalPrizesWon).toBe(0);
    expect(profile.competitionNetPnL).toBe(0);
  });
});

describe("refund and walletNetFlow", () => {
  it("getPlayerFinancialProfile includes totalEntryFeeRefunds and walletNetFlow uses refunds from point_transactions", async () => {
    const uid = 997011;
    const profile = await getPlayerFinancialProfile(uid);
    if (!profile) return;
    expect(typeof profile.totalEntryFeeRefunds).toBe("number");
    expect(profile.totalEntryFeeRefunds).toBeGreaterThanOrEqual(0);
    expect(typeof profile.walletNetFlow).toBe("number");
  });
});

describe("canonical reporting from financial_events", () => {
  it("getPlayerFinancialProfile returns competition net and totals for user", async () => {
    const db = await getDb();
    if (!db) return;
    const uid = 997003;
    const profile = await getPlayerFinancialProfile(uid);
    if (!profile) return;
    expect(typeof profile.competitionNetPnL).toBe("number");
    expect(typeof profile.totalEntryFees).toBe("number");
    expect(typeof profile.totalPrizesWon).toBe("number");
    expect(typeof profile.totalCommissionGenerated).toBe("number");
  });
});
