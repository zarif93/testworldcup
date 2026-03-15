/**
 * Security hardening tests:
 * - Permission/role change invalidates old JWT (tokenVersion)
 * - Malformed admin/export input is rejected
 * - Duplicate/retry join does not duplicate financial effects
 * - Concurrent join attempts remain safe
 * Run: npx vitest run server/security-hardening.test.ts
 */
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createContext } from "./_core/context";
import { COOKIE_NAME } from "@shared/const";
import { loginUser } from "./auth";
import { assignRoleToUser, getDb, USE_SQLITE, getAllRoles } from "./db";

function createContextWithUser(user: TrpcContext["user"], adminVerified = true): TrpcContext {
  return {
    user,
    adminCodeVerified: adminVerified,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
  };
}

function userLike(id: number, username: string, role: "user" | "admin" | "agent"): TrpcContext["user"] {
  return {
    id,
    openId: `hardening-${username}`,
    username,
    name: username,
    role,
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
  } as TrpcContext["user"];
}

describe("security hardening", () => {
  describe("1. Permission/role change invalidates old JWT", () => {
    it("after assignRoleToUser, token with old tokenVersion is rejected (SQLite)", async () => {
      if (!USE_SQLITE) return;
      const db = await getDb();
      if (!db) return;

      const ts = Date.now();
      const uname = `role_inval_${ts}`;
      const password = "TestPassword123";
      const publicCaller = appRouter.createCaller(createContextWithUser(null));
      await publicCaller.auth.register({
        username: uname,
        phone: `050${String(ts).slice(-7)}`,
        password,
        name: "Role Inval Test",
      });
      const { token } = await loginUser({ username: uname, password });
      expect(token).toBeDefined();

      const reqWithCookie = {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
        protocol: "https",
      } as TrpcContext["req"];
      const ctxBefore = await createContext({
        req: reqWithCookie,
        res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
      });
      expect(ctxBefore.user).not.toBeNull();
      expect(ctxBefore.user?.username).toBe(uname);

      const roles = await getAllRoles();
      const roleId = roles[0]?.id ?? 1;
      await assignRoleToUser(ctxBefore.user!.id, roleId);

      const ctxAfter = await createContext({
        req: reqWithCookie,
        res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
      });
      expect(ctxAfter.user).toBeNull();
    });
  });

  describe("2. Malformed admin/export input is rejected", () => {
    const adminUser = userLike(1, "AdminHardening", "admin");

    it("getTransparencyLog rejects invalid date format", async () => {
      const caller = appRouter.createCaller(createContextWithUser(adminUser));
      await expect(
        caller.admin.getTransparencyLog({
          from: "not-a-date",
          to: "2025-01-01",
        } as any)
      ).rejects.toThrow();
    });

    it("depositPoints with zero userId rejected", async () => {
      const caller = appRouter.createCaller(createContextWithUser(adminUser));
      await expect(
        caller.admin.depositPoints({ userId: 0, amount: 10 })
      ).rejects.toThrow();
    });

    it("distributePrizes with non-positive tournamentId rejected", async () => {
      const caller = appRouter.createCaller(createContextWithUser(adminUser));
      await expect(
        caller.admin.distributePrizes({ tournamentId: 0 })
      ).rejects.toThrow();
    });
  });

  describe("3. Duplicate/retry join does not duplicate financial effects", () => {
    it("retry join returns same submission and single deduction (SQLite atomic)", async () => {
      if (!USE_SQLITE) return;
      const { executeParticipationWithLock, getSqlite, getUserPoints } = await import("./db");
      const { getFinancialEventsByTournament } = await import("./finance/financialEventService");
      const sqlite = await getSqlite();
      if (!sqlite) return;

      const now = Date.now();
      const userId = 910000 + (now % 100000);
      const tournamentId = 810000 + (now % 100000);
      const cost = 25;
      const initialPoints = 80;

      sqlite.transaction(() => {
        sqlite.prepare(
          "INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', ?, 0, ?, ?)"
        ).run(userId, `open-${userId}`, `user${userId}`, initialPoints, now, now);
        sqlite.prepare(
          "INSERT OR REPLACE INTO tournaments (id, amount, name, status, isLocked, createdAt) VALUES (?, ?, ?, 'OPEN', 0, ?)"
        ).run(tournamentId, cost, `DupTest ${tournamentId}`, now);
      })();

      const first = await executeParticipationWithLock({
        userId,
        username: `user${userId}`,
        tournamentId,
        cost,
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
      expect(await getUserPoints(userId)).toBe(balanceAfterFirst);
      const events = await getFinancialEventsByTournament(tournamentId);
      const entryFees = events.filter((e) => e.eventType === "ENTRY_FEE" && e.tournamentId === tournamentId);
      expect(entryFees.length).toBe(1);
    });
  });

  describe("4. Concurrent join attempts remain safe", () => {
    it("two simultaneous participations same user+tournament yield one submission and one ENTRY_FEE", async () => {
      if (!USE_SQLITE) return;
      const { executeParticipationWithLock, getSqlite, getUserPoints } = await import("./db");
      const { getFinancialEventsByTournament } = await import("./finance/financialEventService");
      const sqlite = await getSqlite();
      if (!sqlite) return;

      const now = Date.now();
      const userId = 920000 + (now % 100000);
      const tournamentId = 820000 + (now % 100000);
      const cost = 15;
      const initialPoints = 50;

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
});
