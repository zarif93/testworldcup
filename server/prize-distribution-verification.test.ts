/**
 * Final verification for flexible prize distribution:
 * 1. 3-winner standard distribution
 * 2. Tie for 1st place
 * 3. Tie across overlapping prize places
 * 4. Default fallback distribution
 * 5. totalDistributed never exceeds prizePoolTotal (rounding)
 */

import { describe, it, expect } from "vitest";
import {
  rankSubmissions,
  selectWinnersBySchema,
  getMaxPrizePlace,
} from "./settlement/selectWinnersBySchema";
import { distributePrizesBySchema } from "./settlement/distributePrizesBySchema";
import { settleTournamentBySchema } from "./settlement/settleTournamentBySchema";
import type { CompetitionSettlementConfig } from "./schema/competitionSettlementConfig";
import type { ScoredSubmission } from "./settlement/types";

function makeConfig(prizeDistribution: Record<string, number>): CompetitionSettlementConfig {
  return {
    prizeMode: "top_n",
    minParticipants: 1,
    prizeDistributionDefault: prizeDistribution,
    tieHandling: "split",
  };
}

function scored(id: number, userId: number, points: number, username?: string | null): ScoredSubmission {
  return { id, userId, username: username ?? `u${userId}`, points };
}

describe("prize distribution verification", () => {
  it("1. 3-winner standard distribution (50%, 30%, 20%)", () => {
    const config = makeConfig({ "1": 50, "2": 30, "3": 20 });
    const subs: ScoredSubmission[] = [
      scored(1, 101, 30),
      scored(2, 102, 20),
      scored(3, 103, 10),
    ];
    const prizePool = 1000;
    const result = settleTournamentBySchema(config, subs, {
      tournamentType: "football",
      entryAmount: 100,
      guaranteedPrizeAmount: prizePool,
      commissionBasisPoints: 1250,
    });

    expect(result.winners).toHaveLength(3);
    expect(result.prizePoolTotal).toBe(prizePool);
    expect(result.totalPrizeDistributed).toBeLessThanOrEqual(prizePool);

    const byRank = result.winners.reduce((acc, w) => {
      acc[w.rank] = (acc[w.rank] ?? 0) + w.prizeAmount;
      return acc;
    }, {} as Record<number, number>);

    expect(byRank[1]).toBe(500); // 50%
    expect(byRank[2]).toBe(300); // 30%
    expect(byRank[3]).toBe(200); // 20%
    expect(result.winners.find((w) => w.rank === 1)?.prizeAmount).toBe(500);
    expect(result.winners.find((w) => w.rank === 2)?.prizeAmount).toBe(300);
    expect(result.winners.find((w) => w.rank === 3)?.prizeAmount).toBe(200);
  });

  it("2. Tie for 1st place – two share 1st+2nd (80%), next gets 3rd (20%)", () => {
    const config = makeConfig({ "1": 50, "2": 30, "3": 20 });
    const subs: ScoredSubmission[] = [
      scored(1, 101, 25),
      scored(2, 102, 25),
      scored(3, 103, 10),
    ];
    const ranked = rankSubmissions(subs, "football");
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);

    const winnersWithRank = selectWinnersBySchema(config, ranked);
    expect(winnersWithRank).toHaveLength(3);
    expect(winnersWithRank.filter((w) => w.rank === 1)).toHaveLength(2);
    expect(winnersWithRank.filter((w) => w.rank === 3)).toHaveLength(1);

    const prizePool = 1000;
    const { winnerEntries, totalDistributed } = distributePrizesBySchema(
      config,
      winnersWithRank,
      prizePool
    );

    expect(totalDistributed).toBeLessThanOrEqual(prizePool);
    const [w1, w2, w3] = winnerEntries;
    expect(w1.rank).toBe(1);
    expect(w2.rank).toBe(1);
    expect(w3.rank).toBe(3);
    expect(w1.prizeAmount).toBe(w2.prizeAmount);
    expect(w1.prizeAmount + w2.prizeAmount).toBe(800);
    expect(w3.prizeAmount).toBe(200);
    expect(w1.prizeAmount + w2.prizeAmount + w3.prizeAmount).toBe(totalDistributed);
  });

  it("3. Tie across overlapping prize places – 2 tie for 2nd share 2nd+3rd", () => {
    const config = makeConfig({ "1": 50, "2": 30, "3": 20 });
    const subs: ScoredSubmission[] = [
      scored(1, 101, 30),
      scored(2, 102, 20),
      scored(3, 103, 20),
    ];
    const ranked = rankSubmissions(subs, "football");
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2]);

    const winnersWithRank = selectWinnersBySchema(config, ranked);
    expect(winnersWithRank).toHaveLength(3);
    const prizePool = 1000;
    const { winnerEntries, totalDistributed } = distributePrizesBySchema(
      config,
      winnersWithRank,
      prizePool
    );

    expect(totalDistributed).toBeLessThanOrEqual(prizePool);
    const first = winnerEntries.find((w) => w.rank === 1);
    const secondGroup = winnerEntries.filter((w) => w.rank === 2);
    expect(first?.prizeAmount).toBe(500);
    expect(secondGroup).toHaveLength(2);
    expect(secondGroup[0].prizeAmount).toBe(secondGroup[1].prizeAmount);
    expect(secondGroup[0].prizeAmount + secondGroup[1].prizeAmount).toBe(500);
  });

  it("4. Default fallback distribution – single place 100%", () => {
    const config = makeConfig({ "1": 100 });
    expect(getMaxPrizePlace(config)).toBe(1);

    const subs: ScoredSubmission[] = [
      scored(1, 101, 10),
      scored(2, 102, 10),
    ];
    const ranked = rankSubmissions(subs, "football");
    const winnersWithRank = selectWinnersBySchema(config, ranked);
    expect(winnersWithRank).toHaveLength(2);
    expect(winnersWithRank.every((w) => w.rank === 1)).toBe(true);

    const prizePool = 100;
    const { winnerEntries, totalDistributed } = distributePrizesBySchema(
      config,
      winnersWithRank,
      prizePool
    );
    expect(winnerEntries).toHaveLength(2);
    expect(winnerEntries[0].prizeAmount).toBe(50);
    expect(winnerEntries[1].prizeAmount).toBe(50);
    expect(totalDistributed).toBe(100);
  });

  it("5. totalDistributed never exceeds prizePoolTotal (rounding safety)", () => {
    const config = makeConfig({ "1": 17, "2": 17, "3": 17, "4": 17, "5": 16, "6": 16 });
    const subs: ScoredSubmission[] = [
      scored(1, 1, 100),
      scored(2, 2, 90),
      scored(3, 3, 80),
      scored(4, 4, 70),
      scored(5, 5, 60),
      scored(6, 6, 50),
    ];
    const prizePool = 100;
    const result = settleTournamentBySchema(config, subs, {
      tournamentType: "football",
      entryAmount: 10,
      guaranteedPrizeAmount: prizePool,
      commissionBasisPoints: 1250,
    });
    expect(result.prizePoolTotal).toBe(prizePool);
    expect(result.totalPrizeDistributed).toBeLessThanOrEqual(result.prizePoolTotal);
  });

  it("6. Many small percentages – total distributed <= pool", () => {
    const pct: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) pct[String(i)] = 10;
    const config = makeConfig(pct);
    const subs: ScoredSubmission[] = Array.from({ length: 10 }, (_, i) =>
      scored(i + 1, i + 1, 100 - i)
    );
    const prizePool = 99;
    const result = settleTournamentBySchema(config, subs, {
      tournamentType: "football",
      entryAmount: 10,
      commissionBasisPoints: 1250,
    });
    expect(result.totalPrizeDistributed).toBeLessThanOrEqual(result.prizePoolTotal);
  });

  it("6b. Rounding cannot cause totalDistributed > prizePoolTotal", () => {
    const config = makeConfig({ "1": 17, "2": 17, "3": 17, "4": 17, "5": 16, "6": 16 });
    const subs: ScoredSubmission[] = Array.from({ length: 6 }, (_, i) =>
      scored(i + 1, i + 1, 100 - i)
    );
    const prizePool = 100;
    const result = settleTournamentBySchema(config, subs, {
      tournamentType: "football",
      entryAmount: 1,
      guaranteedPrizeAmount: prizePool,
      commissionBasisPoints: 1250,
    });
    expect(result.prizePoolTotal).toBe(prizePool);
    expect(result.totalPrizeDistributed).toBeLessThanOrEqual(prizePool);
  });

  it("6c. Six equal shares (16.67% each) – sum of round(pool*pct) can exceed pool; must not overpay", () => {
    const config = makeConfig({ "1": 17, "2": 17, "3": 17, "4": 17, "5": 16, "6": 16 });
    const subs: ScoredSubmission[] = Array.from({ length: 6 }, (_, i) =>
      scored(i + 1, i + 1, 100 - i)
    );
    const prizePool = 100;
    const { winnerEntries, totalDistributed } = distributePrizesBySchema(
      config,
      selectWinnersBySchema(config, rankSubmissions(subs, "football")),
      prizePool
    );
    expect(winnerEntries.length).toBe(6);
    expect(totalDistributed).toBeLessThanOrEqual(prizePool);
  });

  it("7. Old competition style – no custom distribution uses default", () => {
    const config = makeConfig({ "1": 100 });
    const subs: ScoredSubmission[] = [scored(1, 101, 5)];
    const result = settleTournamentBySchema(config, subs, {
      tournamentType: "chance",
      entryAmount: 100,
      guaranteedPrizeAmount: 100,
      commissionBasisPoints: 1250,
    });
    expect(result.winners).toHaveLength(1);
    expect(result.winners[0].prizeAmount).toBe(100);
    expect(result.winners[0].rank).toBe(1);
    expect(result.totalPrizeDistributed).toBe(100);
  });
});
