/**
 * בדיקות סגירת הגרלת לוטו אוטומטית:
 * 1. פתיחת תחרות לוטו בלי תאריך/שעה → נחסם
 * 2. פתיחת תחרות לוטו עם תאריך ושעה → עובד
 * 3. שליחת טופס אחרי זמן הסגירה → נחסם עם הודעה מתאימה
 * 4. עריכת טופס אחרי זמן הסגירה → נחסם
 * 5. מנהל יכול לעדכן תוצאות הגרלה אחרי סגירה
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

const LOTTO_CLOSED_SUBMIT_MSG = "ההגרלה נסגרה ולא ניתן לשלוח טפסים";
const LOTTO_CLOSED_EDIT_MSG = "ההגרלה נסגרה ולא ניתן לערוך טפסים";
const LOTTO_REQUIRED_DATE_TIME_MSG = "בתחרות לוטו חובה לבחור תאריך ושעת סגירת ההגרלה";
const LOTTO_TIME_RANGE_MSG = "שעת סגירת הגרלת לוטו חייבת להיות אחת מהשעות: 20:00, 22:30, 23:00, 23:30, 00:00";

describe("lotto draw close", () => {
  const testUsername = `lottoclose_${Date.now()}`;
  const testPassword = "TestPassword123";
  let testUserId: number;
  let tournamentOpenId: number;
  let tournamentClosedId: number;

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const adminCaller = appRouter.createCaller(createContext(adminUser));

    const reg = await publicCaller.auth.register({
      username: testUsername,
      phone: "0501112233",
      password: testPassword,
      name: "Lotto Close Test User",
    });
    testUserId = reg.user.id;

    // תחרות עם הגרלה בעתיד – פתוחה (שעה חייבת 22:00–00:00)
    await adminCaller.admin.createTournament({
      name: "Lotto Open Test",
      amount: 5,
      type: "lotto",
      drawCode: `lotto-open-${Date.now()}`,
      drawDate: "2035-06-15",
      drawTime: "22:00",
    });
    const listOpen = await adminCaller.tournaments.getAll();
    const tOpen = listOpen.find((tt: { name?: string }) => tt.name === "Lotto Open Test");
    tournamentOpenId = (tOpen as { id: number }).id;

    // תחרות עם הגרלה בעבר – סגורה לפי זמן
    await adminCaller.admin.createTournament({
      name: "Lotto Past Draw Test",
      amount: 5,
      type: "lotto",
      drawCode: `lotto-past-${Date.now()}`,
      drawDate: "2020-01-01",
      drawTime: "00:00",
    });
    const listPast = await adminCaller.tournaments.getAll();
    const tPast = listPast.find((tt: { name?: string }) => tt.name === "Lotto Past Draw Test");
    tournamentClosedId = (tPast as { id: number }).id;

    const { addUserPoints } = await import("./db");
    await addUserPoints(testUserId, 100, "admin_grant", { description: "test" });
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(submissions).where(eq(submissions.userId, testUserId));
      await db.delete(users).where(eq(users.username, testUsername));
    }
  });

  it("blocks creating lotto without draw date and time", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    await expect(
      adminCaller.admin.createTournament({
        name: "Lotto No Date",
        amount: 10,
        type: "lotto",
        drawCode: `lotto-nodate-${Date.now()}`,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: LOTTO_REQUIRED_DATE_TIME_MSG });
  });

  it("blocks creating lotto with only drawDate", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    await expect(
      adminCaller.admin.createTournament({
        name: "Lotto No Time",
        amount: 10,
        type: "lotto",
        drawCode: `lotto-notime-${Date.now()}`,
        drawDate: "2030-01-01",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: LOTTO_REQUIRED_DATE_TIME_MSG });
  });

  it("blocks creating lotto with draw time 21:00 (outside 22:00–00:00)", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    await expect(
      adminCaller.admin.createTournament({
        name: "Lotto Bad Time",
        amount: 10,
        type: "lotto",
        drawCode: `lotto-21-${Date.now()}`,
        drawDate: "2030-01-01",
        drawTime: "21:00",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: LOTTO_TIME_RANGE_MSG });
  });

  it("allows creating lotto with draw time 22:30", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    const name = `Lotto 2230 ${Date.now()}`;
    await adminCaller.admin.createTournament({
      name,
      amount: 10,
      type: "lotto",
      drawCode: `lotto-2230-${Date.now()}`,
      drawDate: "2032-05-20",
      drawTime: "22:30",
    });
    const list = await adminCaller.tournaments.getAll();
    const t = list.find((tt: { name?: string }) => tt.name === name);
    expect(t).toBeDefined();
    expect((t as { drawTime?: string }).drawTime).toBe("22:30");
  });

  it("allows creating lotto with draw time 00:00", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    const name = `Lotto Midnight ${Date.now()}`;
    await adminCaller.admin.createTournament({
      name,
      amount: 10,
      type: "lotto",
      drawCode: `lotto-00-${Date.now()}`,
      drawDate: "2032-06-01",
      drawTime: "00:00",
    });
    const list = await adminCaller.tournaments.getAll();
    const t = list.find((tt: { name?: string }) => tt.name === name);
    expect(t).toBeDefined();
    expect((t as { drawTime?: string }).drawTime).toBe("00:00");
  });

  it("allows creating lotto with drawDate and drawTime", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    const name = `Lotto With Date ${Date.now()}`;
    await adminCaller.admin.createTournament({
      name,
      amount: 10,
      type: "lotto",
      drawCode: `lotto-ok-${Date.now()}`,
      drawDate: "2032-05-20",
      drawTime: "23:00",
    });
    const list = await adminCaller.tournaments.getAll();
    const t = list.find((tt: { name?: string }) => tt.name === name);
    expect(t).toBeDefined();
    expect((t as { drawDate?: string }).drawDate).toBe("2032-05-20");
    expect((t as { drawTime?: string }).drawTime).toBe("23:00");
  });

  it("blocks submit when draw time has passed (closesAt <= now)", async () => {
    const userCaller = appRouter.createCaller(
      createContext({
        id: testUserId,
        openId: `local-${testUsername}`,
        username: testUsername,
        name: "Lotto Close Test User",
        role: "user",
        points: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        email: null,
        loginMethod: "local",
        phone: null,
        passwordHash: null,
        agentId: null,
        referralCode: null,
        isBlocked: false,
        deletedAt: null,
      })
    );
    await expect(
      userCaller.submissions.submit({
        tournamentId: tournamentClosedId,
        predictionsLotto: {
          numbers: [1, 2, 3, 4, 5, 6],
          strongNumber: 1,
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: LOTTO_CLOSED_SUBMIT_MSG });
  });

  it("allows submit when draw is in the future", async () => {
    const userCaller = appRouter.createCaller(
      createContext({
        id: testUserId,
        openId: `local-${testUsername}`,
        username: testUsername,
        name: "Lotto Close Test User",
        role: "user",
        points: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        email: null,
        loginMethod: "local",
        phone: null,
        passwordHash: null,
        agentId: null,
        referralCode: null,
        isBlocked: false,
        deletedAt: null,
      })
    );
    const result = await userCaller.submissions.submit({
      tournamentId: tournamentOpenId,
      predictionsLotto: {
        numbers: [7, 8, 9, 10, 11, 12],
        strongNumber: 2,
      },
    });
    expect(result).toBeDefined();
    expect((result as { success?: boolean }).success).toBe(true);
  });

  it("blocks edit submission when draw time has passed", async () => {
    const { getSubmissionsByTournament, insertSubmission } = await import("./db");
    const subs = await getSubmissionsByTournament(tournamentClosedId);
    let subIdForEdit: number;
    if (subs.length > 0) {
      subIdForEdit = (subs[0] as { id: number }).id;
    } else {
      subIdForEdit = await insertSubmission({
        userId: testUserId,
        username: testUsername,
        tournamentId: tournamentClosedId,
        agentId: null,
        predictions: { numbers: [1, 2, 3, 4, 5, 6], strongNumber: 1 },
        status: "approved",
        paymentStatus: "completed",
      });
    }

    const userCaller = appRouter.createCaller(
      createContext({
        id: testUserId,
        openId: `local-${testUsername}`,
        username: testUsername,
        name: "Lotto Close Test User",
        role: "user",
        points: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        email: null,
        loginMethod: "local",
        phone: null,
        passwordHash: null,
        agentId: null,
        referralCode: null,
        isBlocked: false,
        deletedAt: null,
      })
    );
    await expect(
      userCaller.submissions.update({
        submissionId: subIdForEdit,
        predictionsLotto: {
          numbers: [2, 3, 4, 5, 6, 7],
          strongNumber: 3,
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: LOTTO_CLOSED_EDIT_MSG });
  });

  it("admin can set lotto draw result after draw time has passed", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    const t = await adminCaller.tournaments.getAll();
    const lottoPast = t.find((tt: { name?: string }) => tt.name === "Lotto Past Draw Test");
    const tid = (lottoPast as { id: number }).id;
    await expect(
      adminCaller.admin.updateLottoResults({
        tournamentId: tid,
        num1: 1,
        num2: 2,
        num3: 3,
        num4: 4,
        num5: 5,
        num6: 6,
        strongNumber: 1,
        drawDate: "2020-01-01",
      })
    ).resolves.toEqual({ success: true });
  });
});
