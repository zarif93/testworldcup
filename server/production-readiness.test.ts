/**
 * בדיקות מוכנות Production: הרשאות, תרחישי קיצון כספיים (לוגיקה), ושחזור לאחר קריסה.
 * הרצה: pnpm test -- server/production-readiness.test.ts
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"], adminCodeVerified = true): TrpcContext {
  return {
    user,
    adminCodeVerified,
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
};

const superAdminUser = {
  ...adminUser,
  id: 2,
  username: "Yoven!",
  openId: "super-admin-open-id",
};

const normalUser = {
  id: 3,
  openId: "user-open-id",
  username: "NormalUser",
  name: "User",
  role: "user" as const,
  points: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const agentUser = {
  ...normalUser,
  id: 4,
  username: "AgentUser",
  role: "agent" as const,
};

describe("Production readiness – הרשאות", () => {
  describe("משתמש רגיל (user) לא יכול לגשת לפעולות Admin", () => {
    it("getUsers – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("deleteTournament – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.deleteTournament({ id: 999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("distributePrizes – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.distributePrizes({ tournamentId: 999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getFinancialReport – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.getFinancialReport()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getDataFinancialRecords – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.getDataFinancialRecords({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("סוכן (agent) לא יכול לגשת לפעולות Admin", () => {
    it("getUsers – 403", async () => {
      const ctx = createContext(agentUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("משתמש רגיל (user) לא יכול לגשת לפעולות ארנק סוכן", () => {
    it("agent.getWallet – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.agent.getWallet()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("agent.withdrawFromPlayer – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.agent.withdrawFromPlayer({ playerId: 1, amount: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("agent.depositToPlayer – 403", async () => {
      const ctx = createContext(normalUser);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.agent.depositToPlayer({ playerId: 1, amount: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("מנהל (admin) שאינו סופר-מנהל לא יכול למחוק היסטוריה מלאה", () => {
    it("deleteFinancialHistory – 403", async () => {
      const ctx = createContext(adminUser); // admin but not Yoven!
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.deleteFinancialHistory({ password: "any" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("deleteTransparencyHistory – 403", async () => {
      const ctx = createContext(adminUser);
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.deleteTransparencyHistory({ password: "any", confirmPhrase: "DELETE FOREVER" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("מנהל יכול לפעולות Admin רגילות", () => {
    it("getUsers – 200 (מחזיר מערך)", async () => {
      const ctx = createContext(adminUser);
      const caller = appRouter.createCaller(ctx);
      const users = await caller.admin.getUsers();
      expect(Array.isArray(users)).toBe(true);
    });

    it("getFinancialReport – 200", async () => {
      const ctx = createContext(adminUser);
      const caller = appRouter.createCaller(ctx);
      const report = await caller.admin.getFinancialReport();
      expect(report).toBeDefined();
    });
  });

  describe("משתמש לא מחובר – פרוצדורות מוגנות", () => {
    it("submissions.getMine – 401", async () => {
      const ctx = createContext(null);
      const caller = appRouter.createCaller(ctx);
      await expect(caller.submissions.getMine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});

describe("Production readiness – לוגיקה כספית", () => {
  it("distributePrizes לתחרות לא קיימת – זורק", async () => {
    const ctx = createContext(adminUser);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.distributePrizes({ tournamentId: 999999 })).rejects.toThrow();
  });
});

describe("Production readiness – טיימרים ושחזור", () => {
  it("getTournamentsToCleanup ו-cleanupTournamentData (ארכוב ללא מחיקה) – פונקציות קיימות", async () => {
    const { getTournamentsToCleanup, cleanupTournamentData } = await import("./db");
    const list = await getTournamentsToCleanup();
    expect(Array.isArray(list)).toBe(true);
    if (list.length > 0) {
      await expect(cleanupTournamentData(list[0].id)).resolves.not.toThrow();
    }
  });
});
