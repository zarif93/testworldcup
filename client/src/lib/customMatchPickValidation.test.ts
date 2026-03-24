import { describe, it, expect } from "vitest";
import {
  isValidPickForMatchRow,
  sanitizePickForMatchRow,
  validatePredictionsPayloadAgainstMatches,
} from "./customMatchPickValidation";

describe("customMatchPickValidation", () => {
  it("REGULAR_1X2 allows 1/X/2 and HOME/DRAW/AWAY", () => {
    expect(isValidPickForMatchRow({ marketType: "REGULAR_1X2" }, "1")).toBe(true);
    expect(isValidPickForMatchRow({ marketType: "REGULAR_1X2" }, "HOME_SPREAD")).toBe(false);
  });

  it("MONEYLINE allows only HOME/AWAY", () => {
    expect(isValidPickForMatchRow({ marketType: "MONEYLINE" }, "HOME")).toBe(true);
    expect(isValidPickForMatchRow({ marketType: "MONEYLINE" }, "DRAW")).toBe(false);
    expect(isValidPickForMatchRow({ marketType: "MONEYLINE" }, "1")).toBe(false);
  });

  it("SPREAD allows only spread sides", () => {
    expect(isValidPickForMatchRow({ marketType: "SPREAD" }, "HOME_SPREAD")).toBe(true);
    expect(isValidPickForMatchRow({ marketType: "SPREAD" }, "HOME")).toBe(false);
    expect(isValidPickForMatchRow({ marketType: "SPREAD" }, "1")).toBe(false);
  });

  it("sanitizePickForMatchRow coerces invalid picks to market default", () => {
    expect(sanitizePickForMatchRow({ marketType: "MONEYLINE" }, "DRAW")).toBe("HOME");
    expect(sanitizePickForMatchRow({ marketType: "SPREAD" }, "1")).toBe("HOME_SPREAD");
  });

  it("validatePredictionsPayloadAgainstMatches rejects bad combos", () => {
    const matches = [
      { id: 1, marketType: "MONEYLINE" },
      { id: 2, marketType: "SPREAD" },
    ];
    const bad = validatePredictionsPayloadAgainstMatches(matches, [
      { matchId: 1, prediction: "DRAW" },
      { matchId: 2, prediction: "HOME_SPREAD" },
    ]);
    expect(bad).not.toBeNull();
    const good = validatePredictionsPayloadAgainstMatches(matches, [
      { matchId: 1, prediction: "AWAY" },
      { matchId: 2, prediction: "HOME_SPREAD" },
    ]);
    expect(good).toBeNull();
  });
});
