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

describe("report export permissions", () => {
  it("admin can export admin report", async () => {
    const caller = appRouter.createCaller(createContext(adminUser as never));
    const result = await caller.admin.exportPnLSummaryCSV({ from: undefined, to: undefined, tournamentType: undefined });
    expect(typeof result.csv).toBe("string");
    expect(result.csv.length).toBeGreaterThan(0);
  });

  it("agent cannot export admin report (403)", async () => {
    const caller = appRouter.createCaller(createContext(agentUser as never));
    await expect(
      caller.admin.exportPnLSummaryCSV({ from: undefined, to: undefined, tournamentType: undefined })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("player cannot export admin report (403)", async () => {
    const caller = appRouter.createCaller(createContext(playerUser as never));
    await expect(
      caller.admin.exportPnLSummaryCSV({ from: undefined, to: undefined, tournamentType: undefined })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("agent cannot export from agent export endpoints anymore (403)", async () => {
    const caller = appRouter.createCaller(createContext(agentUser as never));
    await expect(
      caller.agent.exportPnLReportCSV({ from: undefined, to: undefined, tournamentType: undefined, limit: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("player cannot export personal report via auth.exportMyPlayerReport (403)", async () => {
    const caller = appRouter.createCaller(createContext(playerUser as never));
    await expect(
      caller.auth.exportMyPlayerReport({ from: undefined, to: undefined, tournamentType: undefined })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

