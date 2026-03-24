import { describe, it, expect } from "vitest";
import { computeSpreadResult, assertMirroredSpreads } from "./spreadMath";
import {
  validateSpreadPairForMarket,
  validateCustomMatchPredictionsAgainstMarkets,
  pointsForMatchMarket,
  matchMarketsMapFromRows,
} from "./marketGrading";
import { calcSubmissionPoints } from "../services/scoringService";
import type { MatchMarketMeta } from "./types";

describe("matchMarkets / spreadMath", () => {
  it("example A: home wins game, away covers spread", () => {
    const r = computeSpreadResult(80, 72, -15, 15);
    expect(r.adjustedHomeScore).toBe(65);
    expect(r.adjustedAwayScore).toBe(87);
    expect(r.spreadResult).toBe("AWAY_COVER");
  });

  it("example B: push", () => {
    const r = computeSpreadResult(80, 64, -8, 8);
    expect(r.adjustedHomeScore).toBe(72);
    expect(r.adjustedAwayScore).toBe(72);
    expect(r.spreadResult).toBe("PUSH");
  });

  it("example C: decimal spread", () => {
    const r = computeSpreadResult(90, 84, -4.5, 4.5);
    expect(r.adjustedHomeScore).toBe(85.5);
    expect(r.adjustedAwayScore).toBe(88.5);
    expect(r.spreadResult).toBe("AWAY_COVER");
  });

  it("favorite covers", () => {
    const r = computeSpreadResult(100, 70, -10, 10);
    expect(r.spreadResult).toBe("HOME_COVER");
  });

  it("underdog covers but loses game", () => {
    const r = computeSpreadResult(80, 78, -5, 5);
    expect(r.spreadResult).toBe("AWAY_COVER");
  });

  it("validateSpreadPairForMarket rejects bad mirror", () => {
    expect(validateSpreadPairForMarket("SPREAD", -15, 14)).not.toBeNull();
    expect(validateSpreadPairForMarket("REGULAR_1X2", null, null)).toBeNull();
  });

  it("validateSpreadPairForMarket accepts mirrored", () => {
    expect(validateSpreadPairForMarket("SPREAD", -15, 15)).toBeNull();
    expect(assertMirroredSpreads(-4.5, 4.5)).toBe(true);
  });

  it("validateCustomMatchPredictionsAgainstMarkets rejects mismatch", () => {
    const matches = [
      { id: 1, marketType: "SPREAD", homeSpread: -5, awaySpread: 5 },
      { id: 2, marketType: "REGULAR_1X2", homeSpread: null, awaySpread: null },
    ];
    expect(
      validateCustomMatchPredictionsAgainstMarkets(
        [
          { matchId: 1, prediction: "1" },
          { matchId: 2, prediction: "HOME_SPREAD" },
        ],
        matches
      )
    ).not.toBeNull();
    expect(
      validateCustomMatchPredictionsAgainstMarkets([{ matchId: 1, prediction: "HOME_SPREAD" }], [matches[0]])
    ).toBeNull();
  });

  it("rejects spread-only picks on 1X2 market", () => {
    const matches = [{ id: 1, marketType: "REGULAR_1X2", homeSpread: null, awaySpread: null }];
    expect(validateCustomMatchPredictionsAgainstMarkets([{ matchId: 1, prediction: "HOME_SPREAD" }], matches)).not.toBeNull();
  });

  it("accepts moneyline picks on MONEYLINE market", () => {
    const matches = [{ id: 1, marketType: "MONEYLINE", homeSpread: null, awaySpread: null }];
    expect(validateCustomMatchPredictionsAgainstMarkets([{ matchId: 1, prediction: "HOME" }], matches)).toBeNull();
  });

  it("REGULAR_1X2 scoring: legacy 1/X/2 unchanged", () => {
    const m: MatchMarketMeta = { marketType: "REGULAR_1X2", homeSpread: null, awaySpread: null };
    expect(pointsForMatchMarket(m, "1", 2, 1, 3).points).toBe(3);
    expect(pointsForMatchMarket(m, "X", 2, 2, 3).points).toBe(3);
    expect(pointsForMatchMarket(m, "2", 1, 2, 3).points).toBe(3);
  });

  it("MONEYLINE: home wins", () => {
    const m: MatchMarketMeta = { marketType: "MONEYLINE", homeSpread: null, awaySpread: null };
    expect(pointsForMatchMarket(m, "HOME", 10, 8, 3).points).toBe(3);
    expect(pointsForMatchMarket(m, "AWAY", 10, 8, 3).points).toBe(0);
  });

  it("MONEYLINE: tie — no winner", () => {
    const m: MatchMarketMeta = { marketType: "MONEYLINE", homeSpread: null, awaySpread: null };
    expect(pointsForMatchMarket(m, "HOME", 5, 5, 3).points).toBe(0);
    expect(pointsForMatchMarket(m, "AWAY", 5, 5, 3).points).toBe(0);
  });

  it("pointsForMatchMarket spread push is 0", () => {
    const m: MatchMarketMeta = { marketType: "SPREAD", homeSpread: -8, awaySpread: 8 };
    const p = pointsForMatchMarket(m, "HOME_SPREAD", 80, 64, 3);
    expect(p.detail).toBe("push");
    expect(p.points).toBe(0);
  });

  it("pointsForMatchMarket spread win", () => {
    const m: MatchMarketMeta = { marketType: "SPREAD", homeSpread: -15, awaySpread: 15 };
    expect(pointsForMatchMarket(m, "AWAY_SPREAD", 80, 72, 3).points).toBe(3);
    expect(pointsForMatchMarket(m, "HOME_SPREAD", 80, 72, 3).points).toBe(0);
  });

  it("calcSubmissionPoints: regular market without matchMarkets matches legacy 1X2", () => {
    const results = new Map([
      [1, { homeScore: 2, awayScore: 1 }],
      [2, { homeScore: 1, awayScore: 1 }],
    ]);
    const pts = calcSubmissionPoints(
      [
        { matchId: 1, prediction: "1" },
        { matchId: 2, prediction: "X" },
      ],
      results
    );
    expect(pts).toBe(6);
  });

  it("calcSubmissionPoints: spread grading via matchMarkets", () => {
    const results = new Map([[10, { homeScore: 80, awayScore: 72 }]]);
    const mm = matchMarketsMapFromRows([{ id: 10, marketType: "SPREAD", homeSpread: -15, awaySpread: 15 }]);
    const pts = calcSubmissionPoints([{ matchId: 10, prediction: "AWAY_SPREAD" }], results, mm);
    expect(pts).toBe(3);
  });

  it("legacy REGULAR_WINNER row still maps to 1X2 for scoring", () => {
    const mm = matchMarketsMapFromRows([{ id: 3, marketType: "REGULAR_WINNER", homeSpread: null, awaySpread: null }]);
    const results = new Map([[3, { homeScore: 1, awayScore: 0 }]]);
    const pts = calcSubmissionPoints([{ matchId: 3, prediction: "1" }], results, mm);
    expect(pts).toBe(3);
  });
});
