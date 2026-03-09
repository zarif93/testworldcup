/**
 * בדיקות עמלות סוכן בהגשת טופס:
 * 1. שחקן שולח טופס → עמלת סוכן נרשמת לסוכן שלו
 * 2. סוכן שולח טופס → העמלה נרשמת לאותו סוכן
 * 3. אין כפילות עמלות
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, getAgentCommissionsByAgentId, hasCommissionForSubmission } from "./db";
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

describe("agent commission on submit", () => {
  const playerUsername = `commplayer_${Date.now()}`;
  const agentUsername = `commagent_${Date.now()}`;
  let playerId: number;
  let agentId: number;
  let tournamentId: number;
  const unique = Date.now();
  const drawDate = `2030-03-${String((unique % 28) + 1).padStart(2, "0")}`;
  const drawTime = `12:${String(unique % 60).padStart(2, "0")}`;

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const adminCaller = appRouter.createCaller(createContext(adminUser));

    const playerReg = await publicCaller.auth.register({
      username: playerUsername,
      phone: "0503333333",
      password: "TestPass123",
      name: "Commission Test Player",
    });
    playerId = playerReg.user.id;

    const agentRes = await adminCaller.admin.createAgent({
      username: agentUsername,
      phone: "0504444444",
      password: "AgentPass123",
      name: "Commission Test Agent",
    });
    agentId = (agentRes.agent as { id: number }).id;

    await adminCaller.admin.assignAgent({ playerId, agentId });

    await adminCaller.admin.createTournament({
      name: "Commission Test Tournament",
      amount: 10,
      type: "chance",
      drawDate,
      drawTime,
    });
    const list = await adminCaller.tournaments.getAll();
    const t = list.find((x: { name?: string }) => x.name === "Commission Test Tournament");
    tournamentId = (t as { id: number }).id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(submissions).where(eq(submissions.tournamentId, tournamentId));
      await db.delete(users).where(eq(users.username, playerUsername));
      await db.delete(users).where(eq(users.username, agentUsername));
    }
  });

  it("שחקן שולח טופס – עמלת סוכן נרשמת לסוכן שלו", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    await adminCaller.admin.depositPoints({ userId: playerId, amount: 50 });

    const playerContext = createContext({
      id: playerId,
      openId: `local-${playerUsername}`,
      username: playerUsername,
      name: "Commission Test Player",
      role: "user",
      points: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      email: null,
      loginMethod: "local",
      phone: "0503333333",
      passwordHash: null,
      agentId,
      referralCode: null,
      isBlocked: false,
      deletedAt: null,
    } as TrpcContext["user"]);

    const caller = appRouter.createCaller(playerContext);
    const result = await caller.submissions.submit({
      tournamentId,
      predictionsChance: { heart: "7", club: "8", diamond: "9", spade: "10" },
    });
    expect((result as { success?: boolean }).success).toBe(true);

    const commissions = await getAgentCommissionsByAgentId(agentId);
    const forThisSubmission = commissions.filter(
      (c) => c.userId === playerId && c.submissionId
    );
    expect(forThisSubmission.length).toBeGreaterThanOrEqual(1);
    expect(forThisSubmission.some((c) => c.agentId === agentId)).toBe(true);
  });

  it("סוכן שולח טופס – העמלה נרשמת לאותו סוכן", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    await adminCaller.admin.depositPoints({ userId: agentId, amount: 50 });

    const agentContext = createContext({
      id: agentId,
      openId: `local-${agentUsername}`,
      username: agentUsername,
      name: "Commission Test Agent",
      role: "agent",
      points: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      email: null,
      loginMethod: "local",
      phone: "0504444444",
      passwordHash: null,
      agentId: null,
      referralCode: null,
      isBlocked: false,
      deletedAt: null,
    } as TrpcContext["user"]);

    const caller = appRouter.createCaller(agentContext);
    const result = await caller.submissions.submit({
      tournamentId,
      predictionsChance: { heart: "J", club: "Q", diamond: "K", spade: "A" },
    });
    expect((result as { success?: boolean }).success).toBe(true);

    const commissions = await getAgentCommissionsByAgentId(agentId);
    const fromAgentOwnSubmit = commissions.filter((c) => c.userId === agentId);
    expect(fromAgentOwnSubmit.length).toBeGreaterThanOrEqual(1);
    expect(fromAgentOwnSubmit.every((c) => c.agentId === agentId)).toBe(true);
  });

  it("אין כפילות עמלות – לכל טופס רשומה עמלה אחת", async () => {
    const commissions = await getAgentCommissionsByAgentId(agentId);
    const subIds = commissions.map((c) => c.submissionId);
    const uniqueSubIds = new Set(subIds);
    expect(uniqueSubIds.size).toBe(subIds.length);
    for (const subId of subIds) {
      const has = await hasCommissionForSubmission(subId);
      expect(has).toBe(true);
    }
  });
});
