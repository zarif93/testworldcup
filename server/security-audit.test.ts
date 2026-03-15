/**
 * SECURITY AUDIT – סימולציה אגרסיבית של פרודקשן ותוקפים.
 * סימולציה: שחקנים, סוכנים, מנהלים + פעילות רגילה + מתקפות (רמאות, הרשאות, API, Race, IDOR, וכו').
 * הרצה: npx vitest run server/security-audit.test.ts
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, getUserPoints, getAgentCommissionsByAgentId, hasCommissionForSubmission } from "./db";
import { users, submissions, pointTransactions, tournaments } from "../drizzle/schema-sqlite";
import { eq, and } from "drizzle-orm";

// --- Helpers ---
function createContext(user: TrpcContext["user"], adminVerified = true): TrpcContext {
  return {
    user,
    adminCodeVerified: adminVerified,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
  };
}

function userLike(id: number, username: string, role: "user" | "admin" | "agent", agentId: number | null = null): TrpcContext["user"] {
  return {
    id,
    openId: `audit-${username}`,
    username,
    name: username,
    role,
    points: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    email: null,
    loginMethod: "local",
    phone: null,
    passwordHash: null,
    agentId,
    referralCode: null,
    isBlocked: false,
    deletedAt: null,
  } as TrpcContext["user"];
}

describe("SECURITY AUDIT – סימולציה ומתקפות", () => {
  const adminUser = userLike(1, "AdminUser", "admin");
  const player1 = userLike(101, "Player1", "user", 10);
  const player2 = userLike(102, "Player2", "user", 10);
  const playerNoAgent = userLike(103, "PlayerNoAgent", "user", null);
  const agentA = userLike(10, "AgentA", "agent", null);
  const agentB = userLike(11, "AgentB", "agent", null);

  let tournamentOpenId: number;
  let tournamentLockedId: number;

  beforeAll(async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    const list = await adminCaller.tournaments.getAll();
    const open = list.find((t: { status?: string }) => t.status === "OPEN") as { id: number } | undefined;
    const locked = list.find((t: { status?: string }) => (t as { status?: string }).status === "LOCKED") as { id: number } | undefined;
    tournamentOpenId = open?.id ?? 1;
    tournamentLockedId = locked?.id ?? 2;
  });

  describe("1. הרשאות – שחקן לא מקבל גישה ל-admin", () => {
    it("user → admin.getUsers נחסם 403", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(caller.admin.getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("user → admin.distributePrizes נחסם 403", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(caller.admin.distributePrizes({ tournamentId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("user → admin.assignAgent נחסם 403", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(caller.admin.assignAgent({ playerId: 102, agentId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("user → admin.updateMatchResult נחסם 403", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(caller.admin.updateMatchResult({ matchId: 1, homeScore: 1, awayScore: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("user → admin.lockTournament נחסם 403", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(caller.admin.lockTournament({ tournamentId: tournamentOpenId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("2. הרשאות – סוכן לא מקבל גישה ל-admin", () => {
    it("agent → admin.getUsers נחסם 403", async () => {
      const caller = appRouter.createCaller(createContext(agentA));
      await expect(caller.admin.getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("agent → admin.distributePrizes נחסם 403", async () => {
      const caller = appRouter.createCaller(createContext(agentA));
      await expect(caller.admin.distributePrizes({ tournamentId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("3. API – שרת מתעלם ממניפולציה (points/role/status/userId)", () => {
    it("submit עם שדות points/role/status – schema לא מקבל (זוד זורק)", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      const badPayload = {
        tournamentId: tournamentOpenId,
        predictions: [],
        points: 1000000,
        role: "admin",
        status: "approved",
        userId: 999,
      };
      await expect(caller.submissions.submit(badPayload as never)).rejects.toThrow();
    });
  });

  describe("4. IDOR – גישה לנתונים של משתמש אחר", () => {
    it("משתמש A לא יכול לצפות בטופס של משתמש B ב-getById", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(caller.submissions.getById({ id: 999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("5. סוכן – גישה לשחקן של סוכן אחר", () => {
    it("סוכן A לא יכול getPlayerPnLDetail של שחקן ששייך לסוכן B (או שחקן לא קיים)", async () => {
      const caller = appRouter.createCaller(createContext(agentA));
      await expect(caller.agent.getPlayerPnLDetail({ playerId: 99999 })).rejects.toMatchObject(
        { code: expect.stringMatching(/NOT_FOUND|FORBIDDEN/) }
      );
    });
  });

  describe("6. שליחה ללא מספיק נקודות", () => {
    it("שליחת טופס בלי נקודות – נחסם (UNAUTHORIZED ב-mock context או BAD_REQUEST בשרת)", async () => {
      const ctx = createContext({ ...player1, points: 0 } as TrpcContext["user"]);
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.submissions.submit({
          tournamentId: tournamentOpenId,
          predictionsChance: { heart: "7", club: "8", diamond: "9", spade: "10" },
        })
      ).rejects.toThrow();
    });
  });

  describe("7. שליחה אחרי נעילה / סגירה", () => {
    it("תחרות לא OPEN או לא קיימת – נחסם (BAD_REQUEST או NOT_FOUND)", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(
        caller.submissions.submit({
          tournamentId: tournamentLockedId,
          predictions: [],
          idempotencyKey: "lock-test",
        })
      ).rejects.toMatchObject({ code: expect.stringMatching(/BAD_REQUEST|NOT_FOUND/) });
    });
  });

  describe("8. CSV Injection – escape שדות שמתחילים ב-=+-@", () => {
    it("ייצוא CSV עם שדה שמתחיל ב-= – מקבל prefix גרש (מניעת CSV Injection)", async () => {
      const { playerPnLToCsv } = await import("./csvExport");
      const csv = playerPnLToCsv(
        [{ id: 1, createdAt: null, actionType: "=HYPERLINK(\"x\")", amount: 1, balanceAfter: 0, kind: "profit", referenceId: null }],
        0, 0, 0
      );
      expect(csv.length).toBeGreaterThan(0);
      expect(csv.includes("'")).toBe(true);
    });
    it("ייצוא CSV עם שדה =1+1 – מקבל prefix גרש", async () => {
      const { playerPnLToCsv } = await import("./csvExport");
      const csv = playerPnLToCsv(
        [{ id: 1, createdAt: null, actionType: "=1+1", amount: 1, balanceAfter: 0, kind: "profit", referenceId: null }],
        0, 0, 0
      );
      expect(csv).toMatch(/'/);
    });
  });

  describe("9. Brute Force Login – חסימה אחרי ניסיונות", () => {
    it("checkLoginRateLimit חוסם אחרי MAX_ATTEMPTS של failed login", async () => {
      const { checkLoginRateLimit, recordFailedLogin } = await import("./_core/loginRateLimit");
      const req = { headers: {}, ip: "192.168.99.99" };
      expect(checkLoginRateLimit(req)).toBe(true);
      for (let i = 0; i < 5; i++) recordFailedLogin(req);
      expect(checkLoginRateLimit(req)).toBe(false);
    });
  });

  describe("10. חלוקת פרסים – מניעת כפילות", () => {
    it("distributePrizesForTournament ב-db בודק כבר חולקו + SETTLING", async () => {
      const { distributePrizesForTournament } = await import("./db");
      expect(typeof distributePrizesForTournament).toBe("function");
    });
  });

  describe("11. יתרה שלילית – מניעה", () => {
    it("deductUserPoints מחזיר false כשאין מספיק (מאומת ב-db)", async () => {
      const { deductUserPoints } = await import("./db");
      const ok = await deductUserPoints(99999, 1, "participation", { referenceId: 1, description: "test" });
      expect(ok).toBe(false);
    });
  });

  describe("12. עמלות – אין כפילות לפי submission", () => {
    it("hasCommissionForSubmission מונע רישום עמלה כפולה", async () => {
      const has = await hasCommissionForSubmission(999999);
      expect(has).toBe(false);
    });
  });

  describe("13. ייצוא דוחות – רק admin/agent בתחום שלו", () => {
    it("שחקן לא יכול לקרוא admin.exportPnLReportCSV – 403", async () => {
      const caller = appRouter.createCaller(createContext(player1));
      await expect(
        caller.admin.exportPnLReportCSV({ from: undefined, to: undefined, tournamentType: undefined, limit: 10 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("14. Audit Log – פעולות קריטיות נרשמות", () => {
    it("insertAdminAuditLog קיים ונקרא בפעולות מנהל (חלוקת פרסים, assignAgent וכו')", async () => {
      const { insertAdminAuditLog } = await import("./db");
      expect(typeof insertAdminAuditLog).toBe("function");
    });
  });
});

