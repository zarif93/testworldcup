/**
 * Run after seed. Prints EXPECTED vs ACTUAL for player settlement report and checks CSV.
 * Run: npx tsx scripts/run-settlement-report-verification.ts [playerId]
 * Default playerId = 999001 (seed test user).
 */

import { getDb } from "../server/db";
import { getPlayerSettlementReport } from "../server/finance/settlementReports";
import { settlementPlayerReportToCsv } from "../server/csvExport";

const DEFAULT_PLAYER_ID = 999001;

const EXPECTED = [
  { case: "CASE 1 – הפסד רגיל", entry: 500, winnings: 250, commission: 250, result: -250 },
  { case: "CASE 2 – הפסד קטן", entry: 500, winnings: 375, commission: 125, result: -125 },
  { case: "CASE 3 – רווח", entry: 500, winnings: 900, commission: 100, result: 400 },
  { case: "CASE 4 – שוויון", entry: 500, winnings: 500, commission: 100, result: 0 },
  { case: "CASE 5 – החזר", entry: 500, winnings: 0, commission: 0, result: 0 },
  { case: "CASE 6 – no participation", entry: 0, winnings: 300, commission: 0, result: 300 },
];
const EXPECTED_FINAL = -250 + -125 + 400 + 0 + 0 + 300; // 325

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available.");
    process.exit(1);
  }

  const playerId = parseInt(process.argv[2] ?? String(DEFAULT_PLAYER_ID), 10);
  if (Number.isNaN(playerId)) {
    console.error("Usage: npx tsx scripts/run-settlement-report-verification.ts [playerId]");
    process.exit(1);
  }

  const report = await getPlayerSettlementReport(playerId);
  if (!report) {
    console.error("Report not found for playerId", playerId, "- run seed first: npx tsx scripts/seed-settlement-report-test-data.ts");
    process.exit(1);
  }

  console.log("EXPECTED:");
  EXPECTED.forEach((e) => console.log(signed(e.result)));
  console.log("finalResult:", signed(EXPECTED_FINAL));
  console.log("");

  console.log("ACTUAL:");
  report.rows.forEach((r) => console.log(signed(r.result)));
  console.log("finalResult:", signed(report.summary.finalResult));
  console.log("");

  let ok = true;
  if (report.rows.length !== EXPECTED.length) {
    console.error("FAIL: row count", report.rows.length, "expected", EXPECTED.length);
    ok = false;
  }
  EXPECTED.forEach((e, i) => {
    const r = report.rows[i];
    if (!r) return;
    if (r.result !== e.result) {
      console.error("FAIL:", e.case, "result", r.result, "expected", e.result);
      ok = false;
    }
  });
  if (report.summary.finalResult !== EXPECTED_FINAL) {
    console.error("FAIL: finalResult", report.summary.finalResult, "expected", EXPECTED_FINAL);
    ok = false;
  }

  const sumFromRows = report.rows.reduce((s, r) => s + r.result, 0);
  if (sumFromRows !== report.summary.finalResult) {
    console.error("FAIL: sum(rows.result) =", sumFromRows, "!= finalResult", report.summary.finalResult);
    ok = false;
  }

  if (ok) console.log("All result values and finalResult match expected.");
  console.log("");

  // CSV export
  const csv = settlementPlayerReportToCsv({
    username: report.username,
    rows: report.rows,
    summary: { finalResult: report.summary.finalResult },
    from: report.from,
    to: report.to,
  });
  const csvOk =
    csv.includes("-250") &&
    csv.includes("-125") &&
    csv.includes("+400") &&
    (csv.includes("+0") || csv.includes(",0,")) &&
    csv.includes("+300") &&
    (csv.includes("+325") || csv.includes("325"));
  if (csvOk) {
    console.log("CSV export contains expected values.");
  } else {
    console.error("FAIL: CSV export missing expected values.");
    ok = false;
  }

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
