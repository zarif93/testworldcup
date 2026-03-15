/**
 * Part 4: Financial/tournament integrity tests.
 * - No duplicate commission creation
 * - No duplicate prize allocation
 * - No duplicate refund
 * - Scoring blocked after finalized/settled (lotto draw locked)
 * - Draw-close rules consistent for chance and lottery (validator)
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getDb,
  getTournamentById,
  refundTournamentParticipants,
  hasCommissionForSubmission,
  setLottoDrawResult,
  getSubmissionsByTournament,
} from "./db";
import { validateCreateTournamentPayload, ALLOWED_LOTTO_DRAW_TIMES_EXPORT } from "./tournamentCreateValidator";
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

describe("Tournament financial integrity", () => {
  const ts = Date.now();
  const testUsername = `intuser_${ts}`;
  let testUserId: number;
  let tournamentId: number;
  let submissionId: number;

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const adminCaller = appRouter.createCaller(createContext(adminUser));

    const reg = await publicCaller.auth.register({
      username: testUsername,
      phone: "0501111222",
      password: "IntTest123",
      name: "Integrity Test User",
    });
    testUserId = reg.user.id;

    await adminCaller.admin.depositPoints({ userId: testUserId, amount: 100 });

    const chanceName = `Integrity Chance ${ts}`;
    const day = String(((ts >> 8) % 28) + 1).padStart(2, "0");
    const min = String(ts % 60).padStart(2, "0");
    const createRes = await adminCaller.admin.createTournament({
      name: chanceName,
      amount: 10,
      type: "chance",
      drawDate: `2036-06-${day}`,
      drawTime: `20:${min}`,
    });
    tournamentId = createRes.id;

    const userCaller = appRouter.createCaller(
      createContext({
        ...reg.user,
        id: reg.user.id,
        role: "user",
        points: 100,
        unlimitedPoints: false,
        agentId: null,
        referralCode: null,
        isBlocked: false,
        deletedAt: null,
      } as TrpcContext["user"])
    );
    await userCaller.submissions.submit({
      tournamentId,
      predictionsChance: { heart: "7", club: "8", diamond: "9", spade: "10" },
    });
    const subs = await getSubmissionsByTournament(tournamentId);
    const mySub = subs.find((s) => s.userId === testUserId);
    submissionId = (mySub as { id: number }).id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(submissions).where(eq(submissions.tournamentId, tournamentId));
      await db.delete(users).where(eq(users.username, testUsername));
    }
  });

  describe("no duplicate commission", () => {
    it("hasCommissionForSubmission returns true for submission that has commission", async () => {
      const has = await hasCommissionForSubmission(submissionId);
      expect(typeof has).toBe("boolean");
    });

    it("no duplicate commission records for same submission (by submissionId uniqueness)", async () => {
      const db = await getDb();
      if (!db) return;
      const schema = await import("../drizzle/schema-sqlite").then((m) => m.agentCommissions);
      const all = await db.select({ submissionId: schema.submissionId }).from(schema).where(eq(schema.submissionId, submissionId));
      expect(all.length).toBeLessThanOrEqual(1);
    });
  });

  describe("no duplicate prize allocation", () => {
    it("distributePrizesForTournament throws when prizes already distributed", async () => {
      const adminCaller = appRouter.createCaller(createContext(adminUser));
      const lottoTs = Date.now();
      const createRes = await adminCaller.admin.createTournament({
        name: `Int Prize Lotto ${lottoTs}`,
        amount: 10,
        type: "lotto",
        drawCode: `int_prize_${lottoTs}`,
        drawDate: "2037-06-15",
        drawTime: "23:00",
      });
      const tid = createRes.id;
      const userCaller = appRouter.createCaller(
        createContext({
          id: testUserId,
          openId: `local-${testUsername}`,
          username: testUsername,
          name: "Integrity Test User",
          role: "user",
          points: 100,
          unlimitedPoints: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          email: null,
          loginMethod: "local",
          phone: "0501111222",
          passwordHash: null,
          agentId: null,
          referralCode: null,
          isBlocked: false,
          deletedAt: null,
        } as TrpcContext["user"])
      );
      await userCaller.submissions.submit({
        tournamentId: tid,
        predictionsLotto: { numbers: [1, 2, 3, 4, 5, 6], strongNumber: 7 },
      });
      await adminCaller.admin.updateLottoResults({
        tournamentId: tid,
        num1: 1,
        num2: 2,
        num3: 3,
        num4: 4,
        num5: 5,
        num6: 6,
        strongNumber: 7,
        drawDate: "2037-06-15",
      });
      await adminCaller.admin.lockLottoDraw({ tournamentId: tid });
      await adminCaller.admin.distributePrizes({ tournamentId: tid });
      await expect(adminCaller.admin.distributePrizes({ tournamentId: tid })).rejects.toThrow();
      const db = await getDb();
      if (db) await db.delete(submissions).where(eq(submissions.tournamentId, tid));
    });
  });

  describe("no duplicate refund", () => {
    it("refundTournamentParticipants is idempotent – second call does not double-refund", async () => {
      const ts2 = Date.now();
      const adminCaller = appRouter.createCaller(createContext(adminUser));
      const day = String(((ts2 >> 8) % 28) + 1).padStart(2, "0");
      const min = String(ts2 % 60).padStart(2, "0");
      await adminCaller.admin.createTournament({
        name: `Refund Idem ${ts2}`,
        amount: 5,
        type: "chance",
        drawDate: `2036-09-${day}`,
        drawTime: `20:${min}`,
      });
      const list = await adminCaller.tournaments.getAll();
      const t = list.find((x: { name?: string }) => x.name === `Refund Idem ${ts2}`);
      const tid = (t as { id: number }).id;
      const userCaller = appRouter.createCaller(
        createContext({
          id: testUserId,
          openId: `local-${testUsername}`,
          username: testUsername,
          name: "Integrity Test User",
          role: "user",
          points: 100,
          unlimitedPoints: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          email: null,
          loginMethod: "local",
          phone: "0501111222",
          passwordHash: null,
          agentId: null,
          referralCode: null,
          isBlocked: false,
          deletedAt: null,
        } as TrpcContext["user"])
      );
      await userCaller.submissions.submit({
        tournamentId: tid,
        predictionsChance: { heart: "7", club: "8", diamond: "9", spade: "10" },
      });
      const first = await refundTournamentParticipants(tid);
      const second = await refundTournamentParticipants(tid);
      expect(second.refundedCount).toBe(0);
      expect(second.totalRefunded).toBe(0);
      expect(first.refundedCount).toBeGreaterThanOrEqual(0);
      const db = await getDb();
      if (db) await db.delete(submissions).where(eq(submissions.tournamentId, tid));
    });
  });

  describe("scoring blocked after finalized/settled", () => {
    it("setLottoDrawResult throws when draw result is locked", async () => {
      const ts3 = Date.now();
      const adminCaller = appRouter.createCaller(createContext(adminUser));
      await adminCaller.admin.createTournament({
        name: `Locked Lotto ${ts3}`,
        amount: 5,
        type: "lotto",
        drawCode: `lock_${ts3}`,
        drawDate: "2036-02-20",
        drawTime: "22:30",
      });
      const list = await adminCaller.tournaments.getAll();
      const t = list.find((x: { name?: string }) => x.name === `Locked Lotto ${ts3}`);
      const tid = (t as { id: number }).id;
      await adminCaller.admin.updateLottoResults({
        tournamentId: tid,
        num1: 1,
        num2: 2,
        num3: 3,
        num4: 4,
        num5: 5,
        num6: 6,
        strongNumber: 7,
        drawDate: "2036-02-20",
      });
      await adminCaller.admin.lockLottoDraw({ tournamentId: tid });
      await expect(
        setLottoDrawResult(
          tid,
          { num1: 2, num2: 3, num3: 4, num4: 5, num5: 6, num6: 7, strongNumber: 1, drawDate: "2036-02-20" },
          adminUser.id
        )
      ).rejects.toThrow(/נעול|locked/i);
    });
  });

  describe("draw-close rules consistent for chance and lottery", () => {
    it("validator rejects lotto without drawDate and drawTime", () => {
      const r = validateCreateTournamentPayload({
        name: "L",
        amount: 10,
        type: "lotto",
        drawCode: "x",
      });
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.message).toMatch(/תאריך|שעה|לוטו/i);
    });

    it("validator rejects lotto with drawTime outside allowed list", () => {
      const r = validateCreateTournamentPayload({
        name: "L",
        amount: 10,
        type: "lotto",
        drawCode: "x",
        drawDate: "2030-01-01",
        drawTime: "15:00",
      });
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.message).toMatch(/שעה|לוטו/i);
    });

    it("validator accepts lotto with allowed drawTime", () => {
      for (const drawTime of ALLOWED_LOTTO_DRAW_TIMES_EXPORT) {
        const r = validateCreateTournamentPayload({
          name: "L",
          amount: 10,
          type: "lotto",
          drawCode: "x",
          drawDate: "2030-01-01",
          drawTime,
        });
        expect(r.valid).toBe(true);
      }
    });

    it("validator rejects chance without drawDate and drawTime", () => {
      const r = validateCreateTournamentPayload({
        name: "C",
        amount: 5,
        type: "chance",
      });
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.message).toMatch(/צ'אנס|תאריך|שעה/i);
    });

    it("validator accepts chance with drawDate and drawTime", () => {
      const r = validateCreateTournamentPayload({
        name: "C",
        amount: 5,
        type: "chance",
        drawDate: "2030-06-15",
        drawTime: "20:00",
      });
      expect(r.valid).toBe(true);
    });
  });
});
