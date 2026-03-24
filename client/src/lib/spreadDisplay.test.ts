import { describe, it, expect } from "vitest";
import { formatMatchPairingTitle, formatTeamWithSpread } from "./spreadDisplay";

describe("formatMatchPairingTitle / formatTeamWithSpread", () => {
  it("SPREAD: shows spreads next to names with vs", () => {
    expect(
      formatMatchPairingTitle(
        {
          homeTeam: "Ashdod",
          awayTeam: "Dvir",
          marketType: "SPREAD",
          homeSpread: -10,
          awaySpread: 10,
        },
        " vs "
      )
    ).toBe("Ashdod -10 vs Dvir +10");
  });

  it("SPREAD: decimals", () => {
    expect(
      formatMatchPairingTitle(
        {
          homeTeam: "Ashdod",
          awayTeam: "Dvir",
          marketType: "SPREAD",
          homeSpread: -4.5,
          awaySpread: 4.5,
        },
        " vs "
      )
    ).toBe("Ashdod -4.5 vs Dvir +4.5");
  });

  it("MONEYLINE: plain pairing", () => {
    expect(
      formatMatchPairingTitle(
        { homeTeam: "Ashdod", awayTeam: "Dvir", marketType: "MONEYLINE" },
        " vs "
      )
    ).toBe("Ashdod vs Dvir");
  });

  it("REGULAR_1X2: plain pairing", () => {
    expect(
      formatMatchPairingTitle(
        { homeTeam: "Ashdod", awayTeam: "Dvir", marketType: "REGULAR_1X2" },
        " vs "
      )
    ).toBe("Ashdod vs Dvir");
  });

  it("formatTeamWithSpread only for SPREAD", () => {
    expect(formatTeamWithSpread("A", -3, "SPREAD")).toBe("A -3");
    expect(formatTeamWithSpread("A", 3, "SPREAD")).toBe("A +3");
    expect(formatTeamWithSpread("A", 3, "MONEYLINE")).toBe("A");
  });
});
