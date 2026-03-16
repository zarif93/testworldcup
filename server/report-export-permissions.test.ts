import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

const agentUser = {
  ...adminUser,
  id: 2,
  openId: "agent-open-id",
  username: "AgentUser",
  name: "Agent",
  role: "agent" as const,
};

const playerUser = {
  ...adminUser,
  id: 3,
  openId: "player-open-id",
  username: "PlayerUser",
  name: "Player",
  role: "user" as const,
};

/**
 * Report export permissions aligned with current API (settlement CSV exports).
 * Old PnL procedures (exportPnLSummaryCSV, exportPnLReportCSV, exportMyPlayerReport) were removed.
 */
describe("report export permissions", () => {
  it("admin can export admin report", async () => {
    const caller = appRouter.createCaller(createContext(adminUser as never));
    const result = await caller.admin.exportGlobalSettlementCSV({});
    expect(typeof result.csv).toBe("string");
    expect(result.csv.length).toBeGreaterThan(0);
  });

  it("agent cannot export admin report (403)", async () => {
    const caller = appRouter.createCaller(createContext(agentUser as never));
    await expect(caller.admin.exportGlobalSettlementCSV({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("player cannot export admin report (403)", async () => {
    const caller = appRouter.createCaller(createContext(playerUser as never));
    await expect(caller.admin.exportGlobalSettlementCSV({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("agent cannot call admin-only agent export (403)", async () => {
    const caller = appRouter.createCaller(createContext(agentUser as never));
    await expect(caller.agent.exportCommissionReportCSV({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("player cannot export admin player report (403)", async () => {
    const caller = appRouter.createCaller(createContext(playerUser as never));
    await expect(
      caller.admin.exportPlayerSettlementCSV({ userId: (playerUser as { id: number }).id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

