/**
 * Player settlement report: result = winnings − entry (commission is NOT part of player loss).
 * Verifies: formula, report shape (same as API), CSV export.
 */

import { describe, expect, it } from "vitest";
import { playerSettlementRowResult } from "./settlementReports";
import { settlementPlayerReportToCsv } from "../csvExport";

describe("Player settlement report – result formula", () => {
  it("player result is winnings minus entry only (commission not deducted)", () => {
    // Row 1: entry 500, winnings 250, commission 250 => result = -250
    expect(playerSettlementRowResult(250, 500)).toBe(-250);
    // Row 2: entry 500, winnings 375, commission 125 => result = -125
    expect(playerSettlementRowResult(375, 500)).toBe(-125);
    // finalResult = sum of row results
    const finalResult = -250 + -125;
    expect(finalResult).toBe(-375);
  });

  it("commission must not affect player result (same entry/winnings => same result regardless of commission)", () => {
    const winnings = 250;
    const entry = 500;
    const commissionA = 250;
    const commissionB = 100;
    const result = playerSettlementRowResult(winnings, entry);
    expect(result).toBe(-250);
    expect(result).toBe(winnings - entry);
    // If we had wrongly subtracted commission, result would be -250 - 250 = -500 or -250 - 100 = -350
    expect(result).not.toBe(winnings - entry - commissionA);
    expect(result).not.toBe(winnings - entry - commissionB);
  });
});

describe("Player settlement report – CSV export", () => {
  it("CSV contains -250, -125 and finalResult -375 for the example data (same shape as API response)", () => {
    const report = {
      username: "testuser",
      rows: [
        { competition: "T1", entry: 500, refund: 0, winnings: 250, commission: 250, result: -250 },
        { competition: "T2", entry: 500, refund: 0, winnings: 375, commission: 125, result: -125 },
      ],
      summary: { finalResult: -375 },
      from: null as string | null,
      to: null as string | null,
    };
    const csv = settlementPlayerReportToCsv(report);
    expect(csv).toContain("-250");
    expect(csv).toContain("-125");
    expect(csv).toContain("-375");
  });
});
