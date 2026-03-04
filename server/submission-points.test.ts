/**
 * בדיקות ולידציית נקודות לפני שליחת טופס – submissions.submit
 * בודק: 0 נקודות → נכשל, פחות מהנדרש → נכשל, בדיוק הסכום → עובר, יותר מהנדרש → עובר
 * הרצה: pnpm test -- server/submission-points.test.ts
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users } from "../drizzle/schema-sqlite";
import { eq } from "drizzle-orm";

const INSUFFICIENT_POINTS_MESSAGE = "אין לך מספיק נקודות להשתתפות בתחרות זו";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    adminCodeVerified: true,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
  };
}

const adminUser = {
  id: 1,
  openId: "admin-open-id",
  username: "AdminUser",
  name: "Admin",
  role: "admin" as const,
  points: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  email: null as string | null,
  loginMethod: "local" as const,
  phone: null as string | null,
  passwordHash: null as string | null,
  agentId: null as number | null,
  referralCode: null as string | null,
  isBlocked: false,
  deletedAt: null as Date | null,
};

describe("submission points validation", () => {
  const testUsername = `pointstest_${Date.now()}`;
  const testPassword = "TestPassword123";
  let testUserId: number;
  let tournament1Id: number;
  let tournament2Id: number;
  const COST = 10;

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const adminCaller = appRouter.createCaller(createContext(adminUser));

    // יצירת משתמש בדיקה
    const reg = await publicCaller.auth.register({
      username: testUsername,
      phone: "0501234567",
      password: testPassword,
      name: "Points Test User",
    });
    testUserId = reg.user.id;

    // יצירת שתי תחרויות צ'אנס (הגרלה בעתיד – פתוח להרשמה)
    await adminCaller.admin.createTournament({
      name: "Test Points Tournament 1",
      amount: COST,
      type: "chance",
      drawDate: "2030-01-01",
      drawTime: "10:00",
    });
    await adminCaller.admin.createTournament({
      name: "Test Points Tournament 2",
      amount: COST,
      type: "chance",
      drawDate: "2030-01-02",
      drawTime: "10:00",
    });
    const list = await adminCaller.tournaments.getAll();
    const t1 = list.find((t: { name?: string }) => t.name === "Test Points Tournament 1");
    const t2 = list.find((t: { name?: string }) => t.name === "Test Points Tournament 2");
    tournament1Id = (t1 as { id: number }).id;
    tournament2Id = (t2 as { id: number }).id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(users).where(eq(users.username, testUsername));
    }
  });

  async function setUserPoints(points: number) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(users).set({ points, updatedAt: new Date() }).where(eq(users.id, testUserId));
  }

  function testUserContext() {
    return createContext({
      id: testUserId,
      openId: `local-${testUsername}`,
      username: testUsername,
      name: "Points Test User",
      role: "user",
      points: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      email: null,
      loginMethod: "local",
      phone: "0501234567",
      passwordHash: null,
      agentId: null,
      referralCode: null,
      isBlocked: false,
      deletedAt: null,
    } as TrpcContext["user"]);
  }

  const validChancePayload = {
    heart: "7" as const,
    club: "8" as const,
    diamond: "9" as const,
    spade: "10" as const,
  };

  it("משתמש עם 0 נקודות – נכשל עם BAD_REQUEST והודעה מתאימה", async () => {
    await setUserPoints(0);
    const caller = appRouter.createCaller(testUserContext());
    await expect(
      caller.submissions.submit({
        tournamentId: tournament1Id,
        predictionsChance: validChancePayload,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: INSUFFICIENT_POINTS_MESSAGE,
    });
  });

  it("משתמש עם פחות מהנדרש – נכשל", async () => {
    await setUserPoints(COST - 1);
    const caller = appRouter.createCaller(testUserContext());
    await expect(
      caller.submissions.submit({
        tournamentId: tournament1Id,
        predictionsChance: validChancePayload,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: INSUFFICIENT_POINTS_MESSAGE,
    });
  });

  it("משתמש עם בדיוק הסכום הנדרש – עובר", async () => {
    await setUserPoints(COST);
    const caller = appRouter.createCaller(testUserContext());
    const result = await caller.submissions.submit({
      tournamentId: tournament1Id,
      predictionsChance: validChancePayload,
    });
    expect(result).toEqual({ success: true, pendingApproval: false });
  });

  it("משתמש עם יותר מהנדרש – עובר", async () => {
    await setUserPoints(COST * 2);
    const caller = appRouter.createCaller(testUserContext());
    const result = await caller.submissions.submit({
      tournamentId: tournament2Id,
      predictionsChance: validChancePayload,
    });
    expect(result).toEqual({ success: true, pendingApproval: false });
  });
});
