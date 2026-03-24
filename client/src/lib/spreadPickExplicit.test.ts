/**
 * Regression: spread picks must be explicit — never infer HOME_SPREAD from missing state.
 * (Previously: UI showed HOME selected when unset; payload used "1" → sanitize → HOME_SPREAD.)
 */
import { describe, it, expect } from "vitest";
import { normalizeMarketKind } from "./marketDisplay";

function isPickCompleteForMatch(
  isFootballCustom: boolean,
  marketType: string | undefined,
  p: string | undefined
): boolean {
  if (p === undefined) return false;
  if (!isFootballCustom) return p === "1" || p === "X" || p === "2";
  const kind = normalizeMarketKind(marketType);
  if (kind === "SPREAD") return p === "HOME_SPREAD" || p === "AWAY_SPREAD";
  if (kind === "MONEYLINE") return p === "HOME" || p === "AWAY";
  return p === "1" || p === "X" || p === "2" || p === "HOME" || p === "DRAW" || p === "AWAY";
}

describe("spread explicit pick (matches DynamicPredictionForm allFilled)", () => {
  it("undefined is not complete for SPREAD", () => {
    expect(isPickCompleteForMatch(true, "SPREAD", undefined)).toBe(false);
  });
  it("HOME_SPREAD and AWAY_SPREAD are complete", () => {
    expect(isPickCompleteForMatch(true, "SPREAD", "HOME_SPREAD")).toBe(true);
    expect(isPickCompleteForMatch(true, "SPREAD", "AWAY_SPREAD")).toBe(true);
  });
});
