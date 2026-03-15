import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getAgentPnL,
  getDb,
  getPlayerPnL,
  insertFinancialRecord,
  insertSubmission,
  recordAgentCommission,
} from "./db";
import { agentCommissions, financialRecords, submissions, tournaments, users } from "../drizzle/schema-sqlite";
import { eq, inArray } from "drizzle-orm";

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

describe("pnl upgrade", () => {
  const unique = Date.now();
  const suf = String(unique).slice(-6);
  const player1Username = `pnl_player1_${unique}`;
  const player2Username = `pnl_player2_${unique}`;
  const agentUsername = `pnl_agent_${unique}`;
  const tournamentName = `P/L Upgrade Tournament ${unique}`;
  const player1Phone = `0501${suf}`;
  const player2Phone = `0502${suf}`;
  const agentPhone = `0503${suf}`;
  let player1Id = 0;
  let player2Id = 0;
  let agentId = 0;
  let tournamentId = 0;
  let submissionIds: number[] = [];

  beforeAll(async () => {
    const publicCaller = appRouter.createCaller(createContext(null));
    const adminCaller = appRouter.createCaller(createContext(adminUser));
    const player1 = await publicCaller.auth.register({
      username: player1Username,
      phone: player1Phone,
      password: "TestPass123",
      name: "Pnl Player One",
    });
    const player2 = await publicCaller.auth.register({
      username: player2Username,
      phone: player2Phone,
      password: "TestPass123",
      name: "Pnl Player Two",
    });
    player1Id = player1.user.id;
    player2Id = player2.user.id;

    const agentRes = await adminCaller.admin.createAgent({
      username: agentUsername,
      phone: agentPhone,
      password: "AgentPass123",
      name: "Pnl Agent",
    });
    agentId = (agentRes.agent as { id: number }).id;

    await adminCaller.admin.assignAgent({ playerId: player1Id, agentId });
    await adminCaller.admin.assignAgent({ playerId: player2Id, agentId });

    const day = (unique % 28) + 1;
    await adminCaller.admin.createTournament({
      name: tournamentName,
      amount: 100,
      type: "chance",
      drawDate: `2030-06-${String(day).padStart(2, "0")}`,
      drawTime: "12:00",
    });
    const tournamentsList = await adminCaller.tournaments.getAll();
    const tournament = tournamentsList.find((t: { name?: string }) => t.name === tournamentName);
    tournamentId = (tournament as { id: number }).id;

    const sub1 = await insertSubmission({
      userId: player1Id,
      username: player1Username,
      tournamentId,
      agentId,
      predictions: { heart: "7", club: "8", diamond: "9", spade: "10" },
      status: "approved",
      paymentStatus: "completed",
    });
    const sub2 = await insertSubmission({
      userId: player1Id,
      username: player1Username,
      tournamentId,
      agentId,
      predictions: { heart: "J", club: "Q", diamond: "K", spade: "A" },
      status: "approved",
      paymentStatus: "completed",
    });
    const sub3 = await insertSubmission({
      userId: player2Id,
      username: player2Username,
      tournamentId,
      agentId,
      predictions: { heart: "2", club: "3", diamond: "4", spade: "5" },
      status: "approved",
      paymentStatus: "completed",
    });
    submissionIds = [sub1, sub2, sub3];

    await recordAgentCommission({
      agentId,
      submissionId: sub1,
      userId: player1Id,
      entryAmount: 100,
      commissionAmount: 6,
    });
    await recordAgentCommission({
      agentId,
      submissionId: sub2,
      userId: player1Id,
      entryAmount: 100,
      commissionAmount: 6,
    });
    await recordAgentCommission({
      agentId,
      submissionId: sub3,
      userId: player2Id,
      entryAmount: 100,
      commissionAmount: 6,
    });

    const db = await getDb();
    if (!db) throw new Error("db unavailable");
    await db
      .update(submissions)
      .set({ createdAt: new Date("2026-01-05T10:00:00.000Z") })
      .where(eq(submissions.id, sub1));
    await db
      .update(submissions)
      .set({ createdAt: new Date("2026-02-05T10:00:00.000Z") })
      .where(eq(submissions.id, sub2));
    await db
      .update(submissions)
      .set({ createdAt: new Date("2026-02-10T10:00:00.000Z") })
      .where(eq(submissions.id, sub3));

    await insertFinancialRecord({
      competitionId: tournamentId,
      competitionName: tournamentName,
      type: "chance",
      totalCollected: 300,
      siteFee: 39,
      totalPrizes: 150,
      netProfit: 39,
      participantsCount: 3,
      winnersCount: 1,
      closedAt: new Date("2026-02-12T00:00:00.000Z"),
      participantSnapshot: {
        participants: [
          { submissionId: sub1, userId: player1Id, username: player1Username, amountPaid: 100, prizeWon: 150 },
          { submissionId: sub2, userId: player1Id, username: player1Username, amountPaid: 100, prizeWon: 0 },
          { submissionId: sub3, userId: player2Id, username: player2Username, amountPaid: 100, prizeWon: 0 },
        ],
      },
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (submissionIds.length > 0) {
      await db.delete(agentCommissions).where(inArray(agentCommissions.submissionId, submissionIds));
      await db.delete(submissions).where(inArray(submissions.id, submissionIds));
    }
    if (tournamentId) {
      await db.delete(financialRecords).where(eq(financialRecords.competitionId, tournamentId));
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    }
    await db.delete(users).where(inArray(users.username, [player1Username, player2Username, agentUsername]));
  });

  it("calculates player totals from bets and winnings", async () => {
    const report = await getPlayerPnL(player1Id);
    expect(report.totalBets).toBe(200);
    expect(report.totalWinnings).toBe(150);
    expect(report.totalCommission).toBe(26);
    expect(report.totalProfit).toBe(0);
    expect(report.totalLoss).toBe(50);
    expect(report.net).toBe(-50);
    expect(report.betsCount).toBe(2);
    expect(report.entries).toHaveLength(2);
  });

  it("filters by bet creation date", async () => {
    const report = await getPlayerPnL(player1Id, { from: "2026-01-01", to: "2026-01-31" });
    expect(report.totalBets).toBe(100);
    expect(report.totalWinnings).toBe(150);
    expect(report.net).toBe(50);
    expect(report.betsCount).toBe(1);
    expect(report.entries).toHaveLength(1);
  });

  it("calculates agent summary and player breakdown", async () => {
    const report = await getAgentPnL(agentId);
    expect(report.totalBets).toBe(300);
    expect(report.totalWinnings).toBe(150);
    expect(report.totalPlatformCommission).toBe(21);
    expect(report.totalAgentCommission).toBe(18);
    expect(report.agentNetResult).toBe(18);
    expect(report.net).toBe(-150);
    expect(report.players).toHaveLength(2);
    const firstPlayer = report.players.find((player) => player.playerId === player1Id);
    expect(firstPlayer?.totalBets).toBe(200);
    expect(firstPlayer?.totalWinnings).toBe(150);
    expect(firstPlayer?.agentCommissionShare).toBe(12);
    expect(firstPlayer?.commissionGenerated).toBe(26);
  });

  it("exports structured agent report as JSON and player report as Excel", async () => {
    const caller = appRouter.createCaller(createContext(adminUser as never));
    const agentExport = await caller.admin.exportAgentPnLCSV({
      agentId,
      format: "json",
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(agentExport.format).toBe("json");
    expect(agentExport.json).toMatchObject({
      agentUsername,
      summary: {
        totalBets: 300,
        totalAgentCommission: 18,
      },
    });

    const playerExport = await caller.admin.exportPlayerPnLCSV({
      userId: player1Id,
      format: "excel",
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(playerExport.format).toBe("excel");
    expect(playerExport.mimeType).toBe("application/vnd.ms-excel");
    expect(playerExport.content).toContain("<Workbook");
    expect(playerExport.content).toContain("דוח שחקן");
  });
});
