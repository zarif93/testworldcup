/**
 * בדיקות שיוך שחקן לסוכן – admin.assignAgent
 * מנהל יכול לשייך/להסיר; סוכן לא יכול.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users } from "../drizzle/schema-sqlite";
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

describe("assign agent", () => {
  const testPlayerUsername = `assignagent_player_${Date.now()}`;
  const testAgentUsername = `assignagent_agent_${Date.now()}`;
  let playerId: number;
  let agentId: number;

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const adminCaller = appRouter.createCaller(createContext(adminUser as never));

    const reg = await publicCaller.auth.register({
      username: testPlayerUsername,
      phone: "0501111111",
      password: "TestPass123",
      name: "Assign Agent Test Player",
    });
    playerId = reg.user.id;

    const agentRes = await adminCaller.admin.createAgent({
      username: testAgentUsername,
      phone: "0502222222",
      password: "AgentPass123",
      name: "Assign Agent Test Agent",
    });
    agentId = (agentRes.agent as { id: number }).id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(users).where(eq(users.username, testPlayerUsername));
      await db.delete(users).where(eq(users.username, testAgentUsername));
    }
  });

  it("מנהל יכול לשייך שחקן לסוכן", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser as never));
    await adminCaller.admin.assignAgent({ playerId, agentId });
    const list = await adminCaller.admin.getUsersList({ role: "user" });
    const player = list.find((u) => u.id === playerId);
    expect(player).toBeDefined();
    expect((player as { agentId?: number | null }).agentId).toBe(agentId);
  });

  it("מנהל יכול להסיר שיוך (agentId null)", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser as never));
    await adminCaller.admin.assignAgent({ playerId, agentId: null });
    const list = await adminCaller.admin.getUsersList({ role: "user" });
    const player = list.find((u) => u.id === playerId);
    expect(player).toBeDefined();
    expect((player as { agentId?: number | null }).agentId).toBeNull();
  });

  it("סוכן לא יכול לבצע שיוך (403)", async () => {
    const agentContext = createContext({
      ...adminUser,
      id: agentId,
      username: testAgentUsername,
      role: "agent",
    } as never);
    const agentCaller = appRouter.createCaller(agentContext);
    await expect(
      agentCaller.admin.assignAgent({ playerId, agentId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("שיוך לשחקן עם role לא user נכשל", async () => {
    const adminCaller = appRouter.createCaller(createContext(adminUser as never));
    await expect(
      adminCaller.admin.assignAgent({ playerId: agentId, agentId: null })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: /רק שחקן/ });
  });
});
