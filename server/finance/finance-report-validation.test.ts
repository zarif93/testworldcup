/**
 * Financial report validation tests:
 * - Summary totals equal sum of rows (General report)
 * - Player report: netProfitLoss = winnings - bets + refunds; commission split consistent
 * - Agent report: detail totals consistent with playerListWithPnL
 * - No double counting; edge cases (zero activity, refunds, multiple agents)
 */

import { describe, expect, it, beforeAll } from "vitest";
import { getGeneralFinanceReport } from "./generalFinanceReportService";
import { getPlayerReportDetailed } from "./playerReportService";
import { getAgentDashboardMetrics } from "./agentFinanceService";
import { getPlayerFinancialProfile } from "./playerFinanceService";
import { getDb } from "../db";

describe("General report financial consistency", () => {
  it("summary totals equal sum of rows (totalBets, totalWins, commission, finalBalance)", async () => {
    const report = await getGeneralFinanceReport({});
    const rows = report.rows;
    const sumBets = rows.reduce((s, r) => s + r.totalBets, 0);
    const sumWins = rows.reduce((s, r) => s + r.totalWins, 0);
    const sumCommission = rows.reduce((s, r) => s + r.commission, 0);
    const sumFinalBalance = rows.reduce((s, r) => s + r.finalBalance, 0);
    const sumProfitLoss = rows.reduce((s, r) => s + r.profitLoss, 0);

    expect(report.summary.totalBets).toBe(sumBets);
    expect(report.summary.totalWins).toBe(sumWins);
    expect(report.summary.totalCommission).toBe(sumCommission);
    expect(report.summary.totalOpenBalance).toBe(sumFinalBalance);
    expect(sumProfitLoss).toBe(report.summary.totalSiteLoss - report.summary.totalSiteProfit);
  });

  it("each row profitLoss equals wins - bets + refunds (competitionNetPnL) via profile", async () => {
    const report = await getGeneralFinanceReport({});
    for (const row of report.rows.slice(0, 20)) {
      const profile = await getPlayerFinancialProfile(row.userId);
      const expectedPnL = profile
        ? profile.totalPrizesWon - profile.totalEntryFees + profile.totalEntryFeeRefunds
        : 0;
      expect(row.profitLoss).toBe(expectedPnL);
    }
  });

  it("zero-activity users appear with zeros and do not break summary", async () => {
    const report = await getGeneralFinanceReport({});
    const zeroRows = report.rows.filter(
      (r) => r.totalBets === 0 && r.totalWins === 0 && r.commission === 0
    );
    const sumBets = report.rows.reduce((s, r) => s + r.totalBets, 0);
    expect(report.summary.totalBets).toBe(sumBets);
    zeroRows.forEach((r) => {
      expect(r.profitLoss).toBe(0);
    });
  });
});

describe("Player report financial consistency", () => {
  it("netProfitLoss = totalWinningsPaid - totalEntryFees + totalRefunds", async () => {
    const db = await getDb();
    if (!db) return;
    const { getAllUsers } = await import("../db");
    const all = await getAllUsers({ includeDeleted: false });
    const players = all.filter((u) => (u as { role?: string }).role === "user").slice(0, 5);
    for (const u of players) {
      const userId = (u as { id: number }).id;
      const report = await getPlayerReportDetailed(userId);
      if (!report || report.rows.length === 0) continue;
      const { summary } = report;
      const expectedNet =
        summary.totalWinningsPaid - summary.totalEntryFees + summary.totalRefunds;
      expect(summary.netProfitLoss).toBe(expectedNet);
    }
  });

  it("sum(rows.netResult) equals summary.netProfitLoss", async () => {
    const db = await getDb();
    if (!db) return;
    const { getAllUsers } = await import("../db");
    const all = await getAllUsers({ includeDeleted: false });
    const players = all.filter((u) => (u as { role?: string }).role === "user").slice(0, 5);
    for (const u of players) {
      const userId = (u as { id: number }).id;
      const report = await getPlayerReportDetailed(userId);
      if (!report || report.rows.length === 0) continue;
      const sumNet = report.rows.reduce((s, r) => s + r.netResult, 0);
      expect(sumNet).toBe(report.summary.netProfitLoss);
    }
  });

  it("agentShare + platformShare equals totalCommissionGenerated", async () => {
    const db = await getDb();
    if (!db) return;
    const { getAllUsers } = await import("../db");
    const all = await getAllUsers({ includeDeleted: false });
    const players = all.filter((u) => (u as { role?: string }).role === "user").slice(0, 5);
    for (const u of players) {
      const userId = (u as { id: number }).id;
      const report = await getPlayerReportDetailed(userId);
      if (!report || report.rows.length === 0) continue;
      const { summary } = report;
      expect(summary.agentShare + summary.platformShare).toBe(
        summary.totalCommissionGenerated
      );
    }
  });
});

describe("Agent report financial consistency", () => {
  it("sum(playerListWithPnL) matches agent totals (entryFees, commissionGenerated, agentCommission)", async () => {
    const db = await getDb();
    if (!db) return;
    const { getAgents } = await import("../db");
    const agents = await getAgents();
    const ids = agents.slice(0, 5).map((a) => a.id);
    for (const agentId of ids) {
      const metrics = await getAgentDashboardMetrics(agentId);
      if (!metrics || metrics.playerListWithPnL.length === 0) continue;
      const sumEntryFees = metrics.playerListWithPnL.reduce(
        (s, p) => s + p.totalEntryFees,
        0
      );
      const sumCommissionGen = metrics.playerListWithPnL.reduce(
        (s, p) => s + p.commissionGenerated,
        0
      );
      const sumAgentComm = metrics.playerListWithPnL.reduce(
        (s, p) => s + (p.agentCommissionFromPlayer ?? 0),
        0
      );
      const sumPlatform = metrics.playerListWithPnL.reduce(
        (s, p) => s + (p.platformShareFromPlayer ?? 0),
        0
      );
      expect(sumEntryFees).toBe(metrics.totalPlayerEntryFees);
      expect(sumCommissionGen).toBe(metrics.totalCommissionGenerated);
      expect(sumAgentComm).toBe(metrics.agentTotalCommissionEarned);
      expect(sumPlatform).toBe(metrics.platformNetProfitFromAgent);
    }
  });

  it("platformNetProfitFromAgent = totalCommissionGenerated - agentTotalCommissionEarned", async () => {
    const db = await getDb();
    if (!db) return;
    const { getAgents } = await import("../db");
    const agents = await getAgents();
    const ids = agents.slice(0, 5).map((a) => a.id);
    for (const agentId of ids) {
      const metrics = await getAgentDashboardMetrics(agentId);
      if (!metrics) continue;
      expect(metrics.platformNetProfitFromAgent).toBe(
        metrics.totalCommissionGenerated - metrics.agentTotalCommissionEarned
      );
    }
  });
});

describe("No double counting", () => {
  it("General report includes each user once", async () => {
    const report = await getGeneralFinanceReport({});
    const userIds = report.rows.map((r) => r.userId);
    const set = new Set(userIds);
    expect(set.size).toBe(userIds.length);
  });

  it("Player report rows are one per ENTRY_FEE (participation)", async () => {
    const db = await getDb();
    if (!db) return;
    const { getAllUsers } = await import("../db");
    const all = await getAllUsers({ includeDeleted: false });
    const players = all.filter((u) => (u as { role?: string }).role === "user").slice(0, 3);
    for (const u of players) {
      const userId = (u as { id: number }).id;
      const report = await getPlayerReportDetailed(userId);
      if (!report) continue;
      const profile = await getPlayerFinancialProfile(userId);
      if (!profile) continue;
      expect(report.rows.length).toBe(profile.totalParticipations);
    }
  });
});
