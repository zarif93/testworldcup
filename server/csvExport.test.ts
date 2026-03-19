/**
 * Smoke test: CSV export helpers produce valid CSV.
 * Run: pnpm test -- server/csvExport.test.ts
 */
import { describe, expect, it } from "vitest";
import { settlementGlobalReportToCsv } from "./csvExport";

describe("csvExport", () => {
  it("settlementGlobalReportToCsv produces CSV with headers and rows", () => {
    const csv = settlementGlobalReportToCsv({
      rows: [],
      summary: { totalSiteProfit: 0, totalParticipations: 0, totalPrizesPaid: 0, totalCommission: 0 },
    });
    expect(csv).toContain("שחקן");
    expect(csv).toContain("סוכן");
    expect(typeof csv).toBe("string");
    expect(csv.length).toBeGreaterThan(0);
  });
});
