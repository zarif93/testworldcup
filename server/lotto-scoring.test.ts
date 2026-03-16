/**
 * בדיקות ניקוד לוטו:
 * - כל מספר רגיל שנפגע = נקודה אחת
 * - פגיעה במספר החזק = נקודה נוספת
 *
 * Isolation: one tournament per test so setLottoResult rescores only the submission
 * created in that test. No cross-test state; scoring applies to intended submission only.
 *
 * מקרי בדיקה:
 * 1. 5 מספרים בלי חזק  → 5 נקודות
 * 2. 4 מספרים + חזק    → 5 נקודות
 * 3. 5 מספרים + חזק    → 6 נקודות
 * 4. 0 מספרים + חזק    → 1 נקודה
 * 5. 0 מספרים בלי חזק  → 0 נקודות
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, getSubmissionsByUserAndTournament } from "./db";
import { users, submissions } from "../drizzle/schema-sqlite";
import { eq } from "drizzle-orm";

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
  unlimitedPoints: true,
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

describe("lotto scoring", () => {
  const testUsername = `lottotest_${Date.now()}`;
  const testPassword = "TestPassword123";
  let testUserId: number;

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const reg = await publicCaller.auth.register({
      username: testUsername,
      phone: "0509998888",
      password: testPassword,
      name: "Lotto Test User",
    });
    testUserId = reg.user.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(submissions).where(eq(submissions.userId, testUserId));
      await db.delete(users).where(eq(users.username, testUsername));
    }
  });

  function testUserContext(): TrpcContext {
    return createContext({
      id: testUserId,
      openId: `local-${testUsername}`,
      username: testUsername,
      name: "Lotto Test User",
      role: "user",
      points: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      email: null,
      loginMethod: "local",
      phone: "0509998888",
      passwordHash: null,
      agentId: null,
      referralCode: null,
      isBlocked: false,
      deletedAt: null,
    } as TrpcContext["user"]);
  }

  /** Create a fresh tournament for this test; submit one entry; set draw; return the single submission's points/strongHit. */
  async function runScenario(
    numbers: number[],
    strongNumber: number,
    draw: { nums: number[]; strong: number }
  ): Promise<{ points: number; strongHit: boolean }> {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    const unique = `lotto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await adminCaller.admin.createTournament({
      name: `Lotto ${unique}`,
      amount: 10,
      type: "lotto",
      drawCode: unique,
      drawDate: "2030-01-15",
      drawTime: "23:00",
    });
    const list = await adminCaller.tournaments.getAll();
    const t = list.find((tt: { drawCode?: string }) => tt.drawCode === unique);
    const tournamentId = (t as { id: number }).id;

    await adminCaller.admin.depositPoints({ userId: testUserId, amount: 100 });
    const caller = appRouter.createCaller(testUserContext());
    await caller.submissions.submit({
      tournamentId,
      predictionsLotto: { numbers, strongNumber },
    });

    await adminCaller.admin.updateLottoResults({
      tournamentId,
      num1: draw.nums[0],
      num2: draw.nums[1],
      num3: draw.nums[2],
      num4: draw.nums[3],
      num5: draw.nums[4],
      num6: draw.nums[5],
      strongNumber: draw.strong,
      drawDate: "2030-01-01",
    });

    const listSubs = await getSubmissionsByUserAndTournament(testUserId, tournamentId);
    expect(listSubs.length).toBe(1);
    const sub = listSubs[0];
    return {
      points: sub.points ?? 0,
      strongHit: !!((sub as { strongHit?: boolean | null }).strongHit),
    };
  }

  it("5 מספרים בלי חזק = 5 נקודות", async () => {
    const result = await runScenario(
      [1, 2, 3, 4, 5, 6],
      7,
      { nums: [1, 2, 3, 4, 5, 8], strong: 1 }
    );
    expect(result.points).toBe(5);
    expect(result.strongHit).toBe(false);
  });

  it("4 מספרים + חזק = 5 נקודות", async () => {
    const result = await runScenario(
      [1, 2, 3, 4, 5, 6],
      7,
      { nums: [1, 2, 3, 4, 9, 10], strong: 7 }
    );
    expect(result.points).toBe(5);
    expect(result.strongHit).toBe(true);
  });

  it("5 מספרים + חזק = 6 נקודות", async () => {
    const result = await runScenario(
      [1, 2, 3, 4, 5, 6],
      7,
      { nums: [1, 2, 3, 4, 5, 9], strong: 7 }
    );
    expect(result.points).toBe(6);
    expect(result.strongHit).toBe(true);
  });

  it("0 מספרים + חזק = 1 נקודה", async () => {
    const result = await runScenario(
      [11, 12, 13, 14, 15, 16],
      7,
      { nums: [1, 2, 3, 4, 5, 6], strong: 7 }
    );
    expect(result.points).toBe(1);
    expect(result.strongHit).toBe(true);
  });

  it("0 מספרים בלי חזק = 0 נקודות", async () => {
    const result = await runScenario(
      [11, 12, 13, 14, 15, 16],
      7,
      { nums: [1, 2, 3, 4, 5, 6], strong: 1 }
    );
    expect(result.points).toBe(0);
    expect(result.strongHit).toBe(false);
  });
});

