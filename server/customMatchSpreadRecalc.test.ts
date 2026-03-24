/**
 * Spread (and non-spread) grading consistency when match results are replaced — mirrors
 * recalcCustomMatchPoints: fresh matchResults + matchMarkets → calcSubmissionPoints.
 */
import { describe, it, expect } from "vitest";
import { calcSubmissionPoints } from "./services/scoringService";
import { matchMarketsMapFromRows } from "./matchMarkets/marketGrading";
import { computeSpreadResult } from "./matchMarkets/spreadMath";
import { scoreMatchPredictionsBySchema } from "./scoring/scoreMatchPredictionsBySchema";

function row(
  id: number,
  marketType: string,
  homeSpread: number | null,
  awaySpread: number | null
) {
  return { id, marketType, homeSpread, awaySpread };
}

describe("custom match spread recalc scenarios (same paths as recalcCustomMatchPoints)", () => {
  it("SPREAD -10/+10: 80-72 → AWAY_COVER; correction 85-72 still AWAY_COVER for AWAY pick", () => {
    const mm = matchMarketsMapFromRows([row(1, "SPREAD", -10, 10)]);
    let results = new Map([[1, { homeScore: 80, awayScore: 72 }]]);
    expect(computeSpreadResult(80, 72, -10, 10).spreadResult).toBe("AWAY_COVER");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "AWAY_SPREAD" }], results, mm)).toBe(3);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME_SPREAD" }], results, mm)).toBe(0);
    results = new Map([[1, { homeScore: 85, awayScore: 72 }]]);
    expect(computeSpreadResult(85, 72, -10, 10).spreadResult).toBe("AWAY_COVER");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "AWAY_SPREAD" }], results, mm)).toBe(3);
  });

  it("SPREAD -5/+5: 80-72 AWAY_COVER; 90-72 flips to HOME_COVER for HOME pick", () => {
    const mm = matchMarketsMapFromRows([row(1, "SPREAD", -5, 5)]);
    let results = new Map([[1, { homeScore: 80, awayScore: 72 }]]);
    expect(computeSpreadResult(80, 72, -5, 5).spreadResult).toBe("AWAY_COVER");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME_SPREAD" }], results, mm)).toBe(0);
    results = new Map([[1, { homeScore: 90, awayScore: 72 }]]);
    expect(computeSpreadResult(90, 72, -5, 5).spreadResult).toBe("HOME_COVER");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME_SPREAD" }], results, mm)).toBe(3);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "AWAY_SPREAD" }], results, mm)).toBe(0);
  });

  it("SPREAD -8/+8: 80-64 PUSH; 81-64 HOME_COVER", () => {
    const mm = matchMarketsMapFromRows([row(1, "SPREAD", -8, 8)]);
    let results = new Map([[1, { homeScore: 80, awayScore: 64 }]]);
    expect(computeSpreadResult(80, 64, -8, 8).spreadResult).toBe("PUSH");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME_SPREAD" }], results, mm)).toBe(0);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "AWAY_SPREAD" }], results, mm)).toBe(0);
    results = new Map([[1, { homeScore: 81, awayScore: 64 }]]);
    expect(computeSpreadResult(81, 64, -8, 8).spreadResult).toBe("HOME_COVER");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME_SPREAD" }], results, mm)).toBe(3);
  });

  it("REGULAR_1X2: corrected score replaces prior grading (no spread)", () => {
    const mm = matchMarketsMapFromRows([row(1, "REGULAR_1X2", null, null)]);
    let results = new Map([[1, { homeScore: 1, awayScore: 0 }]]);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "1" }], results, mm)).toBe(3);
    results = new Map([[1, { homeScore: 0, awayScore: 1 }]]);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "1" }], results, mm)).toBe(0);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "2" }], results, mm)).toBe(3);
  });

  it("MONEYLINE: tie then decisive — unchanged moneyline rules", () => {
    const mm = matchMarketsMapFromRows([row(1, "MONEYLINE", null, null)]);
    let results = new Map([[1, { homeScore: 90, awayScore: 90 }]]);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME" }], results, mm)).toBe(0);
    results = new Map([[1, { homeScore: 91, awayScore: 90 }]]);
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME" }], results, mm)).toBe(3);
  });

  /** Regression: Map lookups must use numeric keys; string/bigint matchId used to miss → 0 points (wrong market). */
  it("SPREAD: string matchId still finds market + results (underdog covers)", () => {
    const mm = matchMarketsMapFromRows([row(42, "SPREAD", -10, 10)]);
    const results = new Map<number, { homeScore: number; awayScore: number }>([
      [42, { homeScore: 70, awayScore: 82 }],
    ]);
    expect(computeSpreadResult(70, 82, -10, 10).spreadResult).toBe("AWAY_COVER");
    const pts = calcSubmissionPoints(
      [{ matchId: "42" as unknown as number, prediction: "AWAY_SPREAD" }],
      results,
      mm
    );
    expect(pts).toBe(3);
  });

  it("SPREAD: bigint matchId still scores (same Map key as number)", () => {
    const mm = matchMarketsMapFromRows([row(7, "SPREAD", -5, 5)]);
    const results = new Map([[7, { homeScore: 90, awayScore: 72 }]]);
    expect(computeSpreadResult(90, 72, -5, 5).spreadResult).toBe("HOME_COVER");
    const pts = calcSubmissionPoints([{ matchId: BigInt(7) as unknown as number, prediction: "HOME_SPREAD" }], results, mm);
    expect(pts).toBe(3);
  });

  it("matchMarketsMapFromRows: string row id still maps markets for scoring", () => {
    const mm = matchMarketsMapFromRows([
      { id: "42" as unknown as number, marketType: "SPREAD", homeSpread: -10, awaySpread: 10 },
    ]);
    const results = new Map([[42, { homeScore: 70, awayScore: 82 }]]);
    expect(calcSubmissionPoints([{ matchId: 42, prediction: "AWAY_SPREAD" }], results, mm)).toBe(3);
  });

  it("SPREAD: score correction updates points (AWAY_COVER → HOME_COVER)", () => {
    const mm = matchMarketsMapFromRows([row(1, "SPREAD", -5, 5)]);
    let results = new Map([[1, { homeScore: 80, awayScore: 72 }]]);
    expect(computeSpreadResult(80, 72, -5, 5).spreadResult).toBe("AWAY_COVER");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME_SPREAD" }], results, mm)).toBe(0);
    results = new Map([[1, { homeScore: 90, awayScore: 72 }]]);
    expect(computeSpreadResult(90, 72, -5, 5).spreadResult).toBe("HOME_COVER");
    expect(calcSubmissionPoints([{ matchId: 1, prediction: "HOME_SPREAD" }], results, mm)).toBe(3);
  });

  /**
   * Live DB trace (worldcup.db): match id 36 — אדיר (home) -10 / דביר (away) +10, score 82–75
   * → AWAY_COVER. Submission with HOME_SPREAD → 0 pts; AWAY_SPREAD → 3 pts (grading was always correct).
   */
  it("live-shaped Ashdod/Dvir line: AWAY_COVER vs HOME_SPREAD loses, AWAY_SPREAD wins", () => {
    const mm = matchMarketsMapFromRows([row(36, "SPREAD", -10, 10)]);
    const results = new Map([[36, { homeScore: 82, awayScore: 75 }]]);
    expect(computeSpreadResult(82, 75, -10, 10).spreadResult).toBe("AWAY_COVER");
    expect(calcSubmissionPoints([{ matchId: 36, prediction: "HOME_SPREAD" }], results, mm)).toBe(0);
    expect(calcSubmissionPoints([{ matchId: 36, prediction: "AWAY_SPREAD" }], results, mm)).toBe(3);
  });

  it("schema engine: string matchId matches spread markets (same as legacy calc)", () => {
    const mm = matchMarketsMapFromRows([row(99, "SPREAD", -8, 8)]);
    const results = new Map([[99, { homeScore: 80, awayScore: 64 }]]);
    expect(computeSpreadResult(80, 64, -8, 8).spreadResult).toBe("PUSH");
    const ctx = {
      type: "football" as const,
      matchResults: results,
      predictions: [{ matchId: "99" as unknown as number, prediction: "HOME_SPREAD" }],
      matchMarkets: mm,
    };
    const r = scoreMatchPredictionsBySchema({ mode: "match_result", pointsPerCorrectResult: 3, outcomeType: "1X2" }, ctx);
    expect(r.totalPoints).toBe(0);
  });
});
