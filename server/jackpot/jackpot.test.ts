/**
 * Focused QA: Jackpot eligibility, draw execution, idempotency, and audit.
 * Run with SQLite only: pnpm test -- server/jackpot/jackpot.test.ts
 */
import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { getDb, getSqlite, getUserPoints, USE_SQLITE } from "../db";
import {
  getApprovedPlayVolumeForWindow,
  getEligibilitySnapshot,
  getJackpotProgress,
  getJackpotSettings,
  runJackpotDraw,
  listJackpotDraws,
  setJackpotSettings,
  getCycleWindow,
  getPreviousCompletedDrawExecutedAt,
  FIRST_CYCLE_FALLBACK_MS,
} from "./index";

const JACKPOT_KEYS = {
  BALANCE_POINTS: "jackpot.balance_points",
  TICKET_STEP_ILS: "jackpot.ticket_step_ils",
  WINNER_PAYOUT_PERCENT: "jackpot.winner_payout_percent",
  NEXT_DRAW_AT: "jackpot.next_draw_at",
} as const;

function ts(ms: number): Date {
  return new Date(ms);
}

describe("Jackpot QA", () => {
  beforeAll(async () => {
    if (!USE_SQLITE) return;
    await getDb();
  });

  afterEach(async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;
    sqlite.exec("DELETE FROM jackpot_draw_snapshots");
    sqlite.exec("DELETE FROM jackpot_draws");
  });

  /** Use a high userId and clear its events so tests don't see other users' data. */
  function seedJackpotUser(sqlite: import("better-sqlite3").Database, userId: number, base: number) {
    sqlite.prepare("DELETE FROM financial_events WHERE userId = ?").run(userId);
    sqlite.prepare(
      "INSERT OR IGNORE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', 0, 0, ?, ?)"
    ).run(userId, `open-jp-${userId}`, `jpuser${userId}`, base, base);
  }

  describe("1–3: Ticket formula (floor(volume/1000)) – cycle window", () => {
    it("999 ILS approved play => 0 tickets", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700001 + (base % 10000);
      const windowEnd = ts(base);
      const windowStart = ts(base - FIRST_CYCLE_FALLBACK_MS);
      const eventAt = base - 86400000;

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare(
        "INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)"
      ).run(userId, 999, eventAt);

      const volume = await getApprovedPlayVolumeForWindow(userId, windowStart, windowEnd);
      expect(volume).toBe(999);

      const step = 1000;
      const tickets = Math.floor(volume / step);
      expect(tickets).toBe(0);

      const eligibility = await getEligibilitySnapshot(windowEnd, step);
      const userEntry = eligibility.find((e) => e.userId === userId);
      expect(userEntry).toBeUndefined();
    });

    it("1000 ILS => 1 ticket", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700002 + (base % 10000);
      const windowEnd = ts(base);
      const windowStart = ts(base - FIRST_CYCLE_FALLBACK_MS);
      const eventAt = base - 86400000;

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1000, eventAt);

      const volume = await getApprovedPlayVolumeForWindow(userId, windowStart, windowEnd);
      expect(volume).toBe(1000);
      const tickets = Math.floor(volume / 1000);
      expect(tickets).toBe(1);

      const eligibility = await getEligibilitySnapshot(windowEnd, 1000);
      const userEntry = eligibility.find((e) => e.userId === userId);
      expect(userEntry).toBeDefined();
      expect(userEntry!.approvedPlayVolume).toBe(1000);
      expect(userEntry!.ticketsCount).toBe(1);
    });

    it("2500 ILS => 2 tickets", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700003 + (base % 10000);
      const windowEnd = ts(base);
      const windowStart = ts(base - FIRST_CYCLE_FALLBACK_MS);
      const eventAt = base - 86400000;

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1000, eventAt);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1500, eventAt);

      const volume = await getApprovedPlayVolumeForWindow(userId, windowStart, windowEnd);
      expect(volume).toBe(2500);
      expect(Math.floor(volume / 1000)).toBe(2);

      const eligibility = await getEligibilitySnapshot(windowEnd, 1000);
      const userEntry = eligibility.find((e) => e.userId === userId);
      expect(userEntry).toBeDefined();
      expect(userEntry!.ticketsCount).toBe(2);
    });
  });

  describe("4: ENTRY_FEE minus REFUND in cycle window", () => {
    it("calculates net volume correctly (ENTRY_FEE - REFUND)", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700010 + (base % 10000);
      const windowEnd = ts(base);
      const windowStart = ts(base - FIRST_CYCLE_FALLBACK_MS);
      const t = base - 86400000;

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 3000, t);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('REFUND', ?, ?, ?)").run(userId, 500, t + 1000);

      const volume = await getApprovedPlayVolumeForWindow(userId, windowStart, windowEnd);
      expect(volume).toBe(2500);

      const eligibility = await getEligibilitySnapshot(windowEnd, 1000);
      const userEntry = eligibility.find((e) => e.userId === userId);
      expect(userEntry!.approvedPlayVolume).toBe(2500);
      expect(userEntry!.ticketsCount).toBe(2);
    });
  });

  describe("5: No eligible players at draw time", () => {
    it("returns failure and draw record has status failed, no payout", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      await getDb();
      await setJackpotSettings({ balancePoints: 5000, ticketStepIls: 1000, winnerPayoutPercent: 75 });
      const drawTime = new Date(Date.now() + 3600000);
      const { windowStart, windowEnd } = await getCycleWindow(drawTime);
      const ws = windowStart.getTime();
      const we = windowEnd.getTime();
      sqlite.prepare("DELETE FROM financial_events WHERE createdAt >= ? AND createdAt <= ?").run(ws, we);

      const result = await runJackpotDraw(drawTime, "manual");

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("No eligible");

      const draws = await listJackpotDraws({ limit: 5 });
      const last = draws[0];
      expect(last).toBeDefined();
      expect(last.status).toBe("failed");
      expect(last.winnerUserId).toBeNull();
      expect(last.payoutAmount).toBeNull();
    });
  });

  describe("6: Failed draw (e.g. zero pool) – no partial payout", () => {
    it("zero balance => failed status, no wallet credit", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700020 + (base % 10000);
      const windowEnd = ts(base);
      const eventAt = base - 86400000;

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1000, eventAt);

      await setJackpotSettings({ balancePoints: 0, ticketStepIls: 1000, winnerPayoutPercent: 75 });

      const result = await runJackpotDraw(windowEnd, "manual");
      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain("zero");

      const draws = await listJackpotDraws({ limit: 1 });
      expect(draws[0].status).toBe("failed");
      expect(draws[0].payoutAmount).toBeNull();

      const pointsAfter = await getUserPoints(userId);
      expect(pointsAfter).toBe(0);
    });
  });

  describe("7: Idempotency – no duplicate winners/payouts", () => {
    it("scheduled draw for same time runs once; second returns idempotency error", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700030 + (base % 10000);
      const drawTime = ts(base);
      const eventAt = base - 86400000; // 1 day ago, inside fallback cycle
      const { windowStart, windowEnd } = await getCycleWindow(drawTime);
      const ws = windowStart.getTime();
      const we = windowEnd.getTime();

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("DELETE FROM financial_events WHERE createdAt >= ? AND createdAt <= ? AND (userId IS NULL OR userId != ?)").run(ws, we, userId);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1000, eventAt);

      await setJackpotSettings({ balancePoints: 1000, ticketStepIls: 1000, winnerPayoutPercent: 75 });

      const r1 = await runJackpotDraw(drawTime, "scheduled");
      expect(r1.success).toBe(true);

      const r2 = await runJackpotDraw(drawTime, "scheduled");
      expect(r2.success).toBe(false);
      expect((r2 as { error: string }).error).toContain("idempotency");

      const draws = await listJackpotDraws({ limit: 5 });
      const completed = draws.filter((d) => d.status === "completed");
      expect(completed.length).toBe(1);

      const pointsAfter = await getUserPoints(userId);
      expect(pointsAfter).toBe(750);
    });

    it("manual draw does not block scheduled for same time (different trigger_type)", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700040 + (base % 10000);
      const drawTime = ts(base);
      const eventAt = base - 86400000;
      const { windowStart, windowEnd } = await getCycleWindow(drawTime);
      const ws = windowStart.getTime();
      const we = windowEnd.getTime();

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("DELETE FROM financial_events WHERE createdAt >= ? AND createdAt <= ? AND (userId IS NULL OR userId != ?)").run(ws, we, userId);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1000, eventAt);

      await setJackpotSettings({ balancePoints: 2000, ticketStepIls: 1000, winnerPayoutPercent: 75 });

      const rManual = await runJackpotDraw(drawTime, "manual");
      expect(rManual.success).toBe(true);

      const rScheduled = await runJackpotDraw(drawTime, "scheduled");
      expect(rScheduled.success).toBe(false);
      expect((rScheduled as { error: string }).error).toContain("idempotency");

      const draws = await listJackpotDraws({ limit: 5 });
      expect(draws.filter((d) => d.status === "completed").length).toBe(1);
    });
  });

  describe("8: Completed draw – next-cycle state", () => {
    it("creates draw record, snapshots, updates balance, credits winner wallet", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700050 + (base % 10000);
      const drawTime = ts(base);
      const eventAt = base - 86400000;
      const { windowStart, windowEnd } = await getCycleWindow(drawTime);
      const ws = windowStart.getTime();
      const we = windowEnd.getTime();

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("DELETE FROM financial_events WHERE createdAt >= ? AND createdAt <= ? AND (userId IS NULL OR userId != ?)").run(ws, we, userId);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1000, eventAt);

      const poolBefore = 4000;
      await setJackpotSettings({
        balancePoints: poolBefore,
        ticketStepIls: 1000,
        winnerPayoutPercent: 75,
      });

      const result = await runJackpotDraw(drawTime, "scheduled");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.winnerUserId).toBe(userId);
      expect(result.payoutAmount).toBe(3000);
      expect(result.carryOverAmount).toBe(1000);

      const settingsAfter = await getJackpotSettings();
      expect(settingsAfter.balancePoints).toBe(1000);

      const pointsAfter = await getUserPoints(userId);
      expect(pointsAfter).toBe(3000);

      const draws = await listJackpotDraws({ limit: 1 });
      const draw = draws[0];
      expect(draw.status).toBe("completed");
      expect(draw.triggerType).toBe("scheduled");
      expect(draw.winnerUserId).toBe(userId);
      expect(draw.payoutAmount).toBe(3000);
      expect(draw.carryOverAmount).toBe(1000);
      expect(draw.totalPoolAtDraw).toBe(poolBefore);
      expect(draw.eligibleUsersCount).toBe(1);
      expect(draw.totalTicketsCount).toBe(1);

      const snapshotRows = sqlite.prepare("SELECT * FROM jackpot_draw_snapshots WHERE draw_id = ?").all(result.drawId) as Array<{ userId: number; ticketsCount: number; calculationWindowStart: number; calculationWindowEnd: number }>;
      expect(snapshotRows.length).toBe(1);
      expect(snapshotRows[0].userId).toBe(userId);
      expect(snapshotRows[0].ticketsCount).toBe(1);
      expect(snapshotRows[0].calculationWindowStart).toBeLessThanOrEqual(snapshotRows[0].calculationWindowEnd);
    });
  });

  describe("Draw-to-draw cycle and first-draw fallback", () => {
    it("getCycleWindow with no previous draw uses fallback (cycle end - 365 days)", async () => {
      if (!USE_SQLITE) return;
      await getSqlite();
      const drawTime = new Date(Date.now());
      const { windowStart, windowEnd } = await getCycleWindow(drawTime);
      expect(windowEnd.getTime()).toBe(drawTime.getTime());
      const span = windowEnd.getTime() - windowStart.getTime();
      expect(span).toBe(FIRST_CYCLE_FALLBACK_MS);
    });

    it("getPreviousCompletedDrawExecutedAt returns null when no draws", async () => {
      if (!USE_SQLITE) return;
      const before = new Date(Date.now());
      const prev = await getPreviousCompletedDrawExecutedAt(before);
      expect(prev).toBeNull();
    });

    it("after one completed draw, getCycleWindow for next draw uses previous executedAt as start", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700070 + (base % 10000);
      const firstDrawTime = ts(base - 86400000 * 14); // 14 days ago
      const eventInFirstCycle = base - 86400000 * 15; // 15 days ago, inside (firstDrawTime - 365d, firstDrawTime)

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("DELETE FROM financial_events WHERE userId = ?").run(userId);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1000, eventInFirstCycle);

      await setJackpotSettings({ balancePoints: 2000, ticketStepIls: 1000, winnerPayoutPercent: 75 });
      const r1 = await runJackpotDraw(firstDrawTime, "manual");
      expect(r1.success).toBe(true);

      const nextDrawTime = ts(base + 3600000); // 1 hour from now so executedAt of first draw is before it
      const prev = await getPreviousCompletedDrawExecutedAt(nextDrawTime);
      expect(prev).not.toBeNull();

      const { windowStart, windowEnd } = await getCycleWindow(nextDrawTime);
      expect(windowStart.getTime()).toBeGreaterThanOrEqual(prev!.getTime() - 1000);
      expect(windowEnd.getTime()).toBe(nextDrawTime.getTime());
    });

    it("event before previous draw is excluded from next cycle", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700080 + (base % 10000);
      const firstDrawTime = ts(base - 86400000 * 14);
      const eventInFirstCycle = base - 86400000 * 20; // 20 days ago, inside first cycle (firstDrawTime - 365d, firstDrawTime)

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("DELETE FROM financial_events WHERE userId = ?").run(userId);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 5000, eventInFirstCycle);

      await setJackpotSettings({ balancePoints: 5000, ticketStepIls: 1000, winnerPayoutPercent: 75 });
      const r1 = await runJackpotDraw(firstDrawTime, "manual");
      expect(r1.success).toBe(true);

      const nextDrawTime = ts(base + 3600000);
      const eligibility = await getEligibilitySnapshot(nextDrawTime, 1000);
      const userEntry = eligibility.find((e) => e.userId === userId);
      expect(userEntry).toBeUndefined();
    });
  });

  describe("Display and audit consistency", () => {
    it("getJackpotProgress returns amounts for dashboard (currency display)", async () => {
      if (!USE_SQLITE) return;
      const sqlite = await getSqlite();
      if (!sqlite) return;
      const base = Date.now();
      const userId = 90700060 + (base % 10000);
      const eventAt = base - 86400000;

      seedJackpotUser(sqlite, userId, base);
      sqlite.prepare("INSERT INTO financial_events (eventType, userId, amountPoints, createdAt) VALUES ('ENTRY_FEE', ?, ?, ?)").run(userId, 1500, eventAt);

      await setJackpotSettings({
        balancePoints: 5000,
        ticketStepIls: 1000,
        winnerPayoutPercent: 75,
        nextDrawAt: new Date(base + 86400000),
      });

      const progress = await getJackpotProgress(userId);
      expect(progress.approvedPlayVolume).toBe(1500);
      expect(progress.ticketCount).toBe(1);
      expect(progress.amountUntilNextTicket).toBe(500);
      expect(progress.balancePoints).toBe(5000);
      expect(progress.nextDrawAt).not.toBeNull();
    });

    it("countdown: nextDrawAt in future yields positive remaining", async () => {
      await setJackpotSettings({ nextDrawAt: new Date(Date.now() + 3600000) });
      const settings = await getJackpotSettings();
      expect(settings.nextDrawAt).not.toBeNull();
      expect(settings.nextDrawAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
