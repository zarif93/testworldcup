import { describe, it, expect } from "vitest";
import { spreadCoverSide, spreadUserOutcome, moneylineUserOutcome } from "./spreadOutcomeDisplay";

describe("spreadOutcomeDisplay", () => {
  it("spreadCoverSide matches grading (push and cover)", () => {
    expect(spreadCoverSide(80, 64, -8, 8)).toBe("PUSH");
    expect(spreadCoverSide(100, 70, -10, 10)).toBe("HOME_COVER");
    expect(spreadCoverSide(80, 78, -5, 5)).toBe("AWAY_COVER");
  });

  it("spreadUserOutcome: push is not win or loss", () => {
    expect(spreadUserOutcome("HOME_SPREAD", 80, 64, -8, 8)).toBe("push");
    expect(spreadUserOutcome("AWAY_SPREAD", 80, 64, -8, 8)).toBe("push");
  });

  it("spreadUserOutcome: win/loss vs cover", () => {
    expect(spreadUserOutcome("AWAY_SPREAD", 80, 72, -15, 15)).toBe("win");
    expect(spreadUserOutcome("HOME_SPREAD", 80, 72, -15, 15)).toBe("loss");
  });

  it("moneylineUserOutcome: tie is push", () => {
    expect(moneylineUserOutcome("HOME", 90, 90)).toBe("push");
    expect(moneylineUserOutcome("HOME", 91, 90)).toBe("win");
  });
});
