import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, getUserPoints, runFinancialIntegrityCheck } from "./db";
import { pointTransactions, submissions, tournaments, users } from "../drizzle/schema-sqlite";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    adminCodeVerified: true,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("unlimited admin points", () => {
  const unique = Date.now();
  const adminUsername = `unlimited_admin_${unique}`;
  let adminId = 0;
  let tournamentId = 0;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const openId = `local-admin-${unique}`;
    await db.insert(users).values({
      openId,
      username: adminUsername,
      name: "Unlimited Admin",
      loginMethod: "local",
      role: "admin",
      points: 0,
      unlimitedPoints: true,
      passwordHash: "test",
      isBlocked: false,
    });
    const createdAdmin = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    adminId = createdAdmin[0]!.id;

    const adminCaller = appRouter.createCaller(createContext({
      ...createdAdmin[0],
      unlimitedPoints: true,
    } as TrpcContext["user"]));
    const tournamentName = `Unlimited Admin Tournament ${unique}`;
    const drawDate = `2031-01-${String((unique % 28) + 1).padStart(2, "0")}`;
    const drawTime = `12:${String(unique % 60).padStart(2, "0")}`;

    const createResult = await adminCaller.admin.createTournament({
      name: tournamentName,
      amount: 25,
      type: "chance",
      drawDate,
      drawTime,
    });
    expect(createResult.success).toBe(true);
    const createdTournament = await db.select().from(tournaments).where(eq(tournaments.name, tournamentName)).limit(1);
    tournamentId = createdTournament[0]!.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (tournamentId) {
      await db.delete(pointTransactions).where(eq(pointTransactions.referenceId, tournamentId));
      await db.delete(submissions).where(eq(submissions.tournamentId, tournamentId));
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    }
    if (adminId) {
      await db.delete(pointTransactions).where(eq(pointTransactions.userId, adminId));
      await db.delete(users).where(eq(users.id, adminId));
    }
  });

  it("lets admin submit with zero balance without creating a participation debit", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const admin = await db.select().from(users).where(eq(users.id, adminId)).limit(1);
    const adminCaller = appRouter.createCaller(createContext(admin[0] as TrpcContext["user"]));

    const beforePoints = await getUserPoints(adminId);
    expect(beforePoints).toBe(0);

    await adminCaller.submissions.submit({
      tournamentId,
      predictionsChance: {
        heart: "A",
        club: "K",
        diamond: "Q",
        spade: "J",
      },
    });

    const afterPoints = await getUserPoints(adminId);
    expect(afterPoints).toBe(0);

    const participationRows = await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, adminId));
    expect(participationRows.filter((row) => row.actionType === "participation")).toHaveLength(0);
  });

  it("ignores unlimited admin balances in financial integrity totals", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const before = await runFinancialIntegrityCheck();

    await db.update(users).set({ points: 5000 }).where(eq(users.id, adminId));
    const after = await runFinancialIntegrityCheck();

    expect(after.systemBalance).toBe(before.systemBalance);
    expect(after.delta).toBe(before.delta);
  });
});
