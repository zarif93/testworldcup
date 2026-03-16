/**
 * Numerical proof: commission calculations for 10 participants × 100 entry.
 * Verifies total collected, commission %, commission amount, prize pool, platform revenue.
 * Agent share uses default 50% of commission when applicable.
 */

import { describe, expect, it } from "vitest";
import {
  computePlatformCommission,
  computePrizePool,
  computeCommissionFromEntry,
  computeReportCommissionSplit,
} from "./commissionService";
import { DEFAULT_AGENT_SHARE_BASIS_POINTS } from "./constants";

const PARTICIPANTS = 10;
const ENTRY = 100;
const TOTAL_COLLECTED = PARTICIPANTS * ENTRY; // 1000

describe("Commission numerical proof: 10 participants × 100 entry", () => {
  it("Case A: 0% commission", () => {
    const bps = 0;
    const commissionAmount = computePlatformCommission(TOTAL_COLLECTED, bps);
    const prizePool = computePrizePool(TOTAL_COLLECTED, bps);
    expect(commissionAmount).toBe(0);
    expect(prizePool).toBe(1000);
    expect(commissionAmount + prizePool).toBe(TOTAL_COLLECTED);
    const perEntry = computeCommissionFromEntry(ENTRY, bps);
    expect(perEntry).toBe(0);
    const { agentCommission, platformCommission } = computeReportCommissionSplit(commissionAmount, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(agentCommission).toBe(0);
    expect(platformCommission).toBe(0);
    // Summary
    // Total collected: 1000
    // Commission %: 0
    // Commission amount: 0
    // Prize pool: 1000
    // Platform revenue: 0
    // Agent share: 0
  });

  it("Case B: 12.5% commission", () => {
    const bps = 1250;
    const commissionAmount = computePlatformCommission(TOTAL_COLLECTED, bps);
    const prizePool = computePrizePool(TOTAL_COLLECTED, bps);
    expect(commissionAmount).toBe(125); // floor(1000 * 12.5%)
    expect(prizePool).toBe(875);
    expect(commissionAmount + prizePool).toBe(TOTAL_COLLECTED);
    const perEntry = computeCommissionFromEntry(ENTRY, bps);
    expect(perEntry).toBe(12); // floor(100 * 12.5%) = 12
    const { agentCommission, platformCommission } = computeReportCommissionSplit(commissionAmount, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(agentCommission).toBe(62); // floor(125 * 50%)
    expect(platformCommission).toBe(63); // 125 - 62
    // Summary
    // Total collected: 1000
    // Commission %: 12.5
    // Commission amount: 125
    // Prize pool: 875
    // Platform revenue: 63 (after 50% to agent)
    // Agent share: 62
  });

  it("Case C: 50% commission", () => {
    const bps = 5000;
    const commissionAmount = computePlatformCommission(TOTAL_COLLECTED, bps);
    const prizePool = computePrizePool(TOTAL_COLLECTED, bps);
    expect(commissionAmount).toBe(500);
    expect(prizePool).toBe(500);
    expect(commissionAmount + prizePool).toBe(TOTAL_COLLECTED);
    const perEntry = computeCommissionFromEntry(ENTRY, bps);
    expect(perEntry).toBe(50);
    const { agentCommission, platformCommission } = computeReportCommissionSplit(commissionAmount, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(agentCommission).toBe(250);
    expect(platformCommission).toBe(250);
    // Summary
    // Total collected: 1000
    // Commission %: 50
    // Commission amount: 500
    // Prize pool: 500
    // Platform revenue: 250
    // Agent share: 250
  });

  it("Case D: 100% commission", () => {
    const bps = 10_000;
    const commissionAmount = computePlatformCommission(TOTAL_COLLECTED, bps);
    const prizePool = computePrizePool(TOTAL_COLLECTED, bps);
    expect(commissionAmount).toBe(1000);
    expect(prizePool).toBe(0);
    expect(commissionAmount + prizePool).toBe(TOTAL_COLLECTED);
    const perEntry = computeCommissionFromEntry(ENTRY, bps);
    expect(perEntry).toBe(100);
    const { agentCommission, platformCommission } = computeReportCommissionSplit(commissionAmount, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(agentCommission).toBe(500);
    expect(platformCommission).toBe(500);
    // Summary
    // Total collected: 1000
    // Commission %: 100
    // Commission amount: 1000
    // Prize pool: 0
    // Platform revenue: 500
    // Agent share: 500
  });
});

describe("Large-scale numerical stress proof", () => {
  it("Case A: 10,000 participants × 137 entry, 17.5% commission", () => {
    const participants = 10_000;
    const entry = 137;
    const bps = 1750; // 17.5%
    const totalCollected = participants * entry; // 1_370_000
    const commissionAmount = computePlatformCommission(totalCollected, bps);
    const prizePool = computePrizePool(totalCollected, bps);
    const { agentCommission, platformCommission } = computeReportCommissionSplit(commissionAmount, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(totalCollected).toBe(1_370_000);
    expect(commissionAmount).toBe(239_750); // floor(1_370_000 * 1750 / 10_000)
    expect(prizePool).toBe(1_130_250);
    expect(commissionAmount + prizePool).toBe(totalCollected);
    expect(agentCommission).toBe(119_875); // floor(239_750 * 50%)
    expect(platformCommission).toBe(119_875); // residue from floor stays with platform; 239750 - 119875
    const perEntryCommission = computeCommissionFromEntry(entry, bps);
    expect(perEntryCommission).toBe(23); // floor(137 * 1750 / 10_000)
    // Rounding: aggregate commission uses floor(totalCollected * bps / 10_000). Per-entry uses floor(entry * bps / 10_000); sum(per-entry) = 230_000 <= aggregate 239_750; settlement uses aggregate.
  });

  it("Case B: 25,000 participants × 59 entry, 33.3% commission", () => {
    const participants = 25_000;
    const entry = 59;
    const bps = 3333; // 33.33%
    const totalCollected = participants * entry; // 1_475_000
    const commissionAmount = computePlatformCommission(totalCollected, bps);
    const prizePool = computePrizePool(totalCollected, bps);
    const { agentCommission, platformCommission } = computeReportCommissionSplit(commissionAmount, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(totalCollected).toBe(1_475_000);
    expect(commissionAmount).toBe(491_617); // floor(1_475_000 * 3333 / 10_000) — exact integer math
    expect(prizePool).toBe(983_383);
    expect(commissionAmount + prizePool).toBe(totalCollected);
    expect(agentCommission).toBe(245_808); // floor(491_617 * 50%)
    expect(platformCommission).toBe(245_809); // residue stays with platform
    const perEntryCommission = computeCommissionFromEntry(entry, bps);
    expect(perEntryCommission).toBe(19); // floor(59 * 3333 / 10_000)
    // Rounding: floor at each step; no cumulative drift; settlement = aggregate commission.
  });

  it("Case C: 3,000 participants × 999 entry, 8.75% commission", () => {
    const participants = 3_000;
    const entry = 999;
    const bps = 875; // 8.75%
    const totalCollected = participants * entry; // 2_997_000
    const commissionAmount = computePlatformCommission(totalCollected, bps);
    const prizePool = computePrizePool(totalCollected, bps);
    const { agentCommission, platformCommission } = computeReportCommissionSplit(commissionAmount, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(totalCollected).toBe(2_997_000);
    expect(commissionAmount).toBe(262_237); // floor(2_997_000 * 875 / 10_000)
    expect(prizePool).toBe(2_734_763);
    expect(commissionAmount + prizePool).toBe(totalCollected);
    expect(agentCommission).toBe(131_118); // floor(262_237 * 50%)
    expect(platformCommission).toBe(131_119); // residue stays with platform
    const perEntryCommission = computeCommissionFromEntry(entry, bps);
    expect(perEntryCommission).toBe(87); // floor(999 * 875 / 10_000)
    // Rounding: consistent floor; sum(per-entry commissions) may be <= aggregate; settlement uses aggregate; no drift.
  });
});

describe("Rounding consistency guarantee", () => {
  it("aggregate commission equals floor(totalPool * bps / 10000); no fractional cents", () => {
    const total = 100_000;
    const bps = 1250;
    const commission = computePlatformCommission(total, bps);
    expect(commission).toBe(12_500);
    expect(Number.isInteger(commission)).toBe(true);
  });

  it("sum of per-entry commission ≤ aggregate commission (floor per entry then sum)", () => {
    const entry = 137;
    const bps = 1750;
    const n = 10_000;
    const totalCollected = n * entry;
    const aggregate = computePlatformCommission(totalCollected, bps);
    const perEntry = computeCommissionFromEntry(entry, bps);
    const sumPerEntry = n * perEntry;
    expect(sumPerEntry).toBeLessThanOrEqual(aggregate);
    expect(aggregate - sumPerEntry).toBe(239_750 - 230_000); // residue from floor stays with platform
  });

  it("prize pool + commission = total collected (exact, no drift)", () => {
    const total = 2_997_000;
    const bps = 875;
    const commission = computePlatformCommission(total, bps);
    const prizePool = computePrizePool(total, bps);
    expect(commission + prizePool).toBe(total);
  });

  it("agent share + platform share = total commission (exact)", () => {
    const totalCommission = 262_237;
    const { agentCommission, platformCommission } = computeReportCommissionSplit(totalCommission, DEFAULT_AGENT_SHARE_BASIS_POINTS);
    expect(agentCommission + platformCommission).toBe(totalCommission);
  });
});
