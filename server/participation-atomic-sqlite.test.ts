/**
 * SQLite atomic participation: executeParticipationWithLock (runParticipationAtomicSqlite).
 * Ensures: single transaction, idempotency on retry, no partial writes, no double deduction.
 * Run with SQLite only: pnpm test -- server/participation-atomic-sqlite.test.ts
 */
import { describe, expect, it, beforeAll } from "vitest";
import {
  USE_SQLITE,
  getDb,
  getSqlite,
  executeParticipationWithLock,
  getUserPoints,
  getSubmissionsByTournament,
} from "./db";
import { getFinancialEventsByTournament } from "./finance/financialEventService";

describe("SQLite atomic participation", () => {
  beforeAll(async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;
    await getDb();
  });

  it("skips when not SQLite", async () => {
    if (USE_SQLITE) return;
    const result = await executeParticipationWithLock({
      userId: 1,
      username: "u",
      tournamentId: 1,
      cost: 0,
      agentId: null,
      predictions: {},
      status: "approved",
      paymentStatus: "completed",
      description: "test",
      referenceId: 1,
    });
    expect(result.success).toBe(false);
  });

  it("successful paid participation creates submission + ENTRY_FEE + deducts once", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const userId = 900000 + (now % 100000);
    const tournamentId = 800000 + (now % 100000);
    const cost = 50;
    const initialPoints = 200;

    sqlite.transaction(() => {
      sqlite.prepare(
        "INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', ?, 0, ?, ?)"
      ).run(userId, `open-${userId}`, `user${userId}`, initialPoints, now, now);
      sqlite.prepare(
        "INSERT OR REPLACE INTO tournaments (id, amount, name, status, isLocked, createdAt) VALUES (?, ?, ?, 'OPEN', 0, ?)"
      ).run(tournamentId, cost, `Tournament ${tournamentId}`, now);
    })();

    const result = await executeParticipationWithLock({
      userId,
      username: `user${userId}`,
      tournamentId,
      cost,
      entryFee: cost,
      jackpotContribution: 0,
      agentId: null,
      predictions: { numbers: [1, 2, 3, 4, 5, 6], strongNumber: 1 },
      status: "approved",
      paymentStatus: "completed",
      description: "Test participation",
      referenceId: tournamentId,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.submissionId).toBeGreaterThan(0);
    expect(result.balanceAfter).toBe(initialPoints - cost);

    const subs = await getSubmissionsByTournament(tournamentId);
    expect(subs.some((s) => s.id === result.submissionId && s.userId === userId)).toBe(true);
    const events = await getFinancialEventsByTournament(tournamentId);
    const entryFees = events.filter((e) => e.eventType === "ENTRY_FEE" && e.submissionId === result.submissionId);
    expect(entryFees.length).toBe(1);
    expect(entryFees[0].amountPoints).toBe(cost);
    const balance = await getUserPoints(userId);
    expect(balance).toBe(initialPoints - cost);
  });

  it("retry after success returns same submission and does not double-deduct", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const userId = 900100 + (now % 100000);
    const tournamentId = 800100 + (now % 100000);
    const cost = 30;
    const initialPoints = 100;

    sqlite.transaction(() => {
      sqlite.prepare(
        "INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', ?, 0, ?, ?)"
      ).run(userId, `open-${userId}`, `user${userId}`, initialPoints, now, now);
      sqlite.prepare(
        "INSERT OR REPLACE INTO tournaments (id, amount, name, status, isLocked, createdAt) VALUES (?, ?, ?, 'OPEN', 0, ?)"
      ).run(tournamentId, cost, `Tournament ${tournamentId}`, now);
    })();

    const first = await executeParticipationWithLock({
      userId,
      username: `user${userId}`,
      tournamentId,
      cost,
      entryFee: cost,
      jackpotContribution: 0,
      agentId: null,
      predictions: {},
      status: "approved",
      paymentStatus: "completed",
      description: "First",
      referenceId: tournamentId,
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    const balanceAfterFirst = await getUserPoints(userId);
    expect(balanceAfterFirst).toBe(initialPoints - cost);

    const second = await executeParticipationWithLock({
      userId,
      username: `user${userId}`,
      tournamentId,
      cost,
      entryFee: cost,
      jackpotContribution: 0,
      agentId: null,
      predictions: {},
      status: "approved",
      paymentStatus: "completed",
      description: "Retry",
      referenceId: tournamentId,
    });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.submissionId).toBe(first.submissionId);
    const balanceAfterRetry = await getUserPoints(userId);
    expect(balanceAfterRetry).toBe(balanceAfterFirst);

    const events = await getFinancialEventsByTournament(tournamentId);
    const entryFees = events.filter((e) => e.eventType === "ENTRY_FEE" && e.tournamentId === tournamentId);
    expect(entryFees.length).toBe(1);
  });

  it("FreeRoll (cost 0) creates submission and ENTRY_FEE with zero amount", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const userId = 900200 + (now % 100000);
    const tournamentId = 800200 + (now % 100000);
    const cost = 0;

    sqlite.transaction(() => {
      sqlite.prepare(
        "INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', 0, 0, ?, ?)"
      ).run(userId, `open-${userId}`, `user${userId}`, now, now);
      sqlite.prepare(
        "INSERT OR REPLACE INTO tournaments (id, amount, name, status, isLocked, createdAt) VALUES (?, ?, ?, 'OPEN', 0, ?)"
      ).run(tournamentId, cost, `FreeRoll ${tournamentId}`, now);
    })();

    const result = await executeParticipationWithLock({
      userId,
      username: `user${userId}`,
      tournamentId,
      cost,
      entryFee: cost,
      jackpotContribution: 0,
      agentId: null,
      predictions: {},
      status: "approved",
      paymentStatus: "completed",
      description: "FreeRoll",
      referenceId: tournamentId,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const events = await getFinancialEventsByTournament(tournamentId);
    const entryFees = events.filter((e) => e.eventType === "ENTRY_FEE" && e.submissionId === result.submissionId);
    expect(entryFees.length).toBe(1);
    expect(entryFees[0].amountPoints).toBe(0);
  });

  it("concurrent join attempts yield one submission and one ENTRY_FEE", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const userId = 900300 + (now % 100000);
    const tournamentId = 800300 + (now % 100000);
    const cost = 20;
    const initialPoints = 100;

    sqlite.transaction(() => {
      sqlite.prepare(
        "INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', ?, 0, ?, ?)"
      ).run(userId, `open-${userId}`, `user${userId}`, initialPoints, now, now);
      sqlite.prepare(
        "INSERT OR REPLACE INTO tournaments (id, amount, name, status, isLocked, createdAt) VALUES (?, ?, ?, 'OPEN', 0, ?)"
      ).run(tournamentId, cost, `Concurrent ${tournamentId}`, now);
    })();

    const params = {
      userId,
      username: `user${userId}`,
      tournamentId,
      cost,
      entryFee: cost,
      jackpotContribution: 0,
      agentId: null,
      predictions: {} as unknown,
      status: "approved" as const,
      paymentStatus: "completed" as const,
      description: "Concurrent",
      referenceId: tournamentId,
    };

    const [a, b] = await Promise.all([
      executeParticipationWithLock(params),
      executeParticipationWithLock(params),
    ]);

    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    if (!a.success || !b.success) return;
    expect(a.submissionId).toBe(b.submissionId);
    const events = await getFinancialEventsByTournament(tournamentId);
    const entryFees = events.filter((e) => e.eventType === "ENTRY_FEE" && e.tournamentId === tournamentId);
    expect(entryFees.length).toBe(1);
    expect(await getUserPoints(userId)).toBe(initialPoints - cost);
  });
});
