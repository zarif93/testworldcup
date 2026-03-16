/**
 * Unit tests for lotto scoring logic. No DB; pure function.
 * Proves: scoring is correct and deterministic; 0+strong=1, 0+no strong=0.
 */

import { describe, expect, it } from "vitest";
import { scoreLottoBySchema } from "./scoreLottoBySchema";
import type { LottoScoringConfig } from "../schema/competitionScoringConfig";
import type { LottoScoringContext } from "./types";

const defaultConfig: LottoScoringConfig = {
  mode: "lotto_match",
  pointsPerMatchingNumber: 1,
  pointsForStrongHit: 1,
};

function draw(nums: number[], strong: number): LottoScoringContext["draw"] {
  return {
    num1: nums[0],
    num2: nums[1],
    num3: nums[2],
    num4: nums[3],
    num5: nums[4],
    num6: nums[5],
    strongNumber: strong,
  };
}

describe("scoreLottoBySchema", () => {
  it("0 regular + strong hit = 1 point", () => {
    const ctx: LottoScoringContext = {
      type: "lotto",
      draw: draw([1, 2, 3, 4, 5, 6], 7),
      predictions: { numbers: [11, 12, 13, 14, 15, 16], strongNumber: 7 },
    };
    const result = scoreLottoBySchema(defaultConfig, ctx);
    expect(result.totalPoints).toBe(1);
    expect(result.strongHit).toBe(true);
    expect(result.breakdown?.regularMatches).toBe(0);
    expect(result.breakdown?.strongHit).toBe(1);
  });

  it("0 regular + no strong = 0 points", () => {
    const ctx: LottoScoringContext = {
      type: "lotto",
      draw: draw([1, 2, 3, 4, 5, 6], 1),
      predictions: { numbers: [11, 12, 13, 14, 15, 16], strongNumber: 7 },
    };
    const result = scoreLottoBySchema(defaultConfig, ctx);
    expect(result.totalPoints).toBe(0);
    expect(result.strongHit).toBe(false);
    expect(result.breakdown?.regularMatches).toBe(0);
    expect(result.breakdown?.strongHit).toBe(0);
  });

  it("5 regular + no strong = 5 points", () => {
    const ctx: LottoScoringContext = {
      type: "lotto",
      draw: draw([1, 2, 3, 4, 5, 8], 1),
      predictions: { numbers: [1, 2, 3, 4, 5, 6], strongNumber: 7 },
    };
    const result = scoreLottoBySchema(defaultConfig, ctx);
    expect(result.totalPoints).toBe(5);
    expect(result.strongHit).toBe(false);
  });

  it("4 regular + strong = 5 points", () => {
    const ctx: LottoScoringContext = {
      type: "lotto",
      draw: draw([1, 2, 3, 4, 9, 10], 7),
      predictions: { numbers: [1, 2, 3, 4, 5, 6], strongNumber: 7 },
    };
    const result = scoreLottoBySchema(defaultConfig, ctx);
    expect(result.totalPoints).toBe(5);
    expect(result.strongHit).toBe(true);
  });

  it("6 regular + strong = 7 points", () => {
    const ctx: LottoScoringContext = {
      type: "lotto",
      draw: draw([1, 2, 3, 4, 5, 6], 7),
      predictions: { numbers: [1, 2, 3, 4, 5, 6], strongNumber: 7 },
    };
    const result = scoreLottoBySchema(defaultConfig, ctx);
    expect(result.totalPoints).toBe(7);
    expect(result.strongHit).toBe(true);
  });

  it("is deterministic: same input always same output", () => {
    const ctx: LottoScoringContext = {
      type: "lotto",
      draw: draw([1, 2, 3, 4, 5, 6], 7),
      predictions: { numbers: [11, 12, 13, 14, 15, 16], strongNumber: 7 },
    };
    const a = scoreLottoBySchema(defaultConfig, ctx);
    const b = scoreLottoBySchema(defaultConfig, ctx);
    expect(a.totalPoints).toBe(b.totalPoints);
    expect(a.strongHit).toBe(b.strongHit);
  });

  it("custom pointsPerMatchingNumber and pointsForStrongHit", () => {
    const config: LottoScoringConfig = {
      mode: "lotto_match",
      pointsPerMatchingNumber: 2,
      pointsForStrongHit: 3,
    };
    const ctx: LottoScoringContext = {
      type: "lotto",
      draw: draw([1, 2, 3, 4, 5, 6], 7),
      predictions: { numbers: [11, 12, 13, 14, 15, 16], strongNumber: 7 },
    };
    const result = scoreLottoBySchema(config, ctx);
    expect(result.totalPoints).toBe(3); // 0*2 + 3
    expect(result.breakdown?.strongHit).toBe(3);
  });
});
