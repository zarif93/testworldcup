/**
 * בדיקות ניקוד לוטו:
 * - כל מספר רגיל שנפגע = נקודה אחת
 * - פגיעה במספר החזק = נקודה נוספת
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
import { getDb } from "./db";
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
  let tournamentId: number;

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const adminCaller = appRouter.createCaller(createContext(adminUser));

    // יצירת משתמש בדיקה
    const reg = await publicCaller.auth.register({
      username: testUsername,
      phone: "0509998888",
      password: testPassword,
      name: "Lotto Test User",
    });
    testUserId = reg.user.id;

    // יצירת תחרות לוטו בודדת (חובה תאריך ושעת סגירה)
    await adminCaller.admin.createTournament({
      name: "Lotto Scoring Test",
      amount: 10,
      type: "lotto",
      drawCode: `lotto-test-${Date.now()}`,
      drawDate: "2030-01-15",
      drawTime: "22:00",
    });
    const list = await adminCaller.tournaments.getAll();
    const t = list.find((tt: { name?: string }) => tt.name === "Lotto Scoring Test");
    tournamentId = (t as { id: number }).id;
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

  async function submitLotto(numbers: number[], strongNumber: number) {
    // מוודאים שלמשתמש יש מספיק נקודות להשתתפות
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    await adminCaller.admin.depositPoints({ userId: testUserId, amount: 100 });
    const caller = appRouter.createCaller(testUserContext());
    await caller.submissions.submit({
      tournamentId,
      predictionsLotto: { numbers, strongNumber },
    });
  }

  async function setLottoResult(draw: { nums: number[]; strong: number }) {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
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
  }

  async function getLastSubmissionPoints() {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db
      .select({ points: submissions.points, strongHit: submissions.strongHit })
      .from(submissions)
      .where(eq(submissions.userId, testUserId));
    const last = rows[rows.length - 1];
    return last as { points: number; strongHit: number | boolean | null };
  }

  it("5 מספרים בלי חזק = 5 נקודות", async () => {
    await submitLotto([1, 2, 3, 4, 5, 6], 7);
    await setLottoResult({ nums: [1, 2, 3, 4, 5, 8], strong: 1 });
    const sub = await getLastSubmissionPoints();
    expect(sub.points).toBe(5);
    expect(!!sub.strongHit).toBe(false);
  });

  it("4 מספרים + חזק = 5 נקודות", async () => {
    await submitLotto([1, 2, 3, 4, 5, 6], 7);
    await setLottoResult({ nums: [1, 2, 3, 4, 9, 10], strong: 7 });
    const sub = await getLastSubmissionPoints();
    expect(sub.points).toBe(5);
    expect(!!sub.strongHit).toBe(true);
  });

  it("5 מספרים + חזק = 6 נקודות", async () => {
    await submitLotto([1, 2, 3, 4, 5, 6], 7);
    await setLottoResult({ nums: [1, 2, 3, 4, 5, 9], strong: 7 });
    const sub = await getLastSubmissionPoints();
    expect(sub.points).toBe(6);
    expect(!!sub.strongHit).toBe(true);
  });

  it("0 מספרים + חזק = 1 נקודה", async () => {
    await submitLotto([11, 12, 13, 14, 15, 16], 7);
    await setLottoResult({ nums: [1, 2, 3, 4, 5, 6], strong: 7 });
    const sub = await getLastSubmissionPoints();
    expect(sub.points).toBe(1);
    expect(!!sub.strongHit).toBe(true);
  });

  it("0 מספרים בלי חזק = 0 נקודות", async () => {
    await submitLotto([11, 12, 13, 14, 15, 16], 7);
    await setLottoResult({ nums: [1, 2, 3, 4, 5, 6], strong: 1 });
    const sub = await getLastSubmissionPoints();
    expect(sub.points).toBe(0);
    expect(!!sub.strongHit).toBe(false);
  });
});

