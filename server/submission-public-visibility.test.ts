/**
 * Public submission read paths: sanitized leaderboard rows + getPublicSubmissionView.
 * Run: pnpm vitest run server/submission-public-visibility.test.ts
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { mapSubmissionToPublicLeaderboardRow, mapSubmissionToPublicView } from "./submissionPublic";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    adminCodeVerified: true,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
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

describe("submission public mappers", () => {
  it("strip internal fields from leaderboard row", () => {
    const row = mapSubmissionToPublicLeaderboardRow(
      {
        id: 5,
        userId: 99,
        username: "u1",
        tournamentId: 3,
        predictions: [{ matchId: 1, prediction: "1" }],
        points: 10,
        status: "approved",
        submissionNumber: 1,
        agentId: 7,
        paymentStatus: "completed",
        approvedBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      false
    );
    expect(row).toMatchObject({
      id: 5,
      username: "u1",
      tournamentId: 3,
      points: 10,
      status: "approved",
      tournamentRemoved: false,
    });
    expect((row as Record<string, unknown>).userId).toBeUndefined();
    expect((row as Record<string, unknown>).agentId).toBeUndefined();
    expect((row as Record<string, unknown>).paymentStatus).toBeUndefined();
    expect((row as Record<string, unknown>).approvedBy).toBeUndefined();
  });

  it("public view includes predictions and strongHit only as safe extras", () => {
    const v = mapSubmissionToPublicView(
      {
        id: 1,
        userId: 2,
        username: "lotto",
        tournamentId: 9,
        predictions: { numbers: [1, 2, 3, 4, 5, 6], strongNumber: 7 },
        points: 5,
        status: "approved",
        strongHit: true,
        agentId: 3,
        paymentStatus: "pending",
      },
      false
    );
    expect(v.strongHit).toBe(true);
    expect((v as Record<string, unknown>).agentId).toBeUndefined();
  });
});

describe("submissions.getPublicSubmissionView", () => {
  it("אורח יכול לקרוא – NOT_FOUND לטופס לא קיים (ללא 401)", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.submissions.getPublicSubmissionView({ id: 999999999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("משתמש רגיל מקבל 403 על admin.getUsers; getPublicSubmissionView לא דורש admin", async () => {
    const userCtx = createContext({
      id: 5001,
      openId: "pub-vis-user",
      username: "pubvis_user",
      name: "Pub Vis",
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
    } as TrpcContext["user"]);
    const caller = appRouter.createCaller(userCtx);
    await expect(caller.admin.getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.submissions.getPublicSubmissionView({ id: 999999998 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("מנהל עדיין יכול לגשת ל-admin.getUsers", async () => {
    const caller = appRouter.createCaller(createContext(adminUser as TrpcContext["user"]));
    const users = await caller.admin.getUsers();
    expect(Array.isArray(users)).toBe(true);
  });
});

describe("submissions.getById נשאר מוגן לבעלים/מנהל", () => {
  it("אורח מקבל UNAUTHORIZED על getById", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.submissions.getById({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("submissions.getByTournament – שדות ציבוריים בלבד", () => {
  it("אין agentId או userId ברשומות מ-getByTournament (כשיש טפסים לטורניר פתוח)", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser as TrpcContext["user"]));
    const list = await adminCaller.tournaments.getAll();
    const open = list.find((t: { status?: string }) => t.status === "OPEN") as { id: number } | undefined;
    if (!open) return;
    const anon = appRouter.createCaller(createContext(null));
    const rows = await anon.submissions.getByTournament({ tournamentId: open.id });
    for (const r of rows) {
      expect((r as Record<string, unknown>).agentId).toBeUndefined();
      expect((r as Record<string, unknown>).userId).toBeUndefined();
      expect((r as Record<string, unknown>).paymentStatus).toBeUndefined();
    }
  });
});
