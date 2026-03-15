/**
 * Forensic report: which DB the app uses and suspicious (closed/locked) competitions.
 * Usage: pnpm exec tsx scripts/forensic-cancelled-competitions.ts
 * Other env: DATABASE_URL=mysql://... tsx scripts/forensic-cancelled-competitions.ts
 */
import "dotenv/config";
import { getDb, getForensicCancelledCompetitionsReport } from "../server/db";

async function main() {
  await getDb();
  const report = await getForensicCancelledCompetitionsReport();

  console.log("=== 1. DATABASE / ENVIRONMENT ===\n");
  console.log("databaseInUse:", report.databaseInUse);
  if (report.sqlitePath) {
    console.log("sqlitePath:", report.sqlitePath);
    console.log("(App uses ./data/worldcup.db when DATABASE_URL is not set.)");
  } else {
    console.log("(MySQL: DATABASE_URL is set.)");
  }
  console.log("");

  console.log("=== 2. SUSPICIOUS COMPETITIONS (LOCKED/CLOSED/SETTLED/SETTLING/PRIZES_DISTRIBUTED/RESULTS_UPDATED/ARCHIVED) ===\n");
  if (report.tournaments.length === 0) {
    console.log("None found in this database.");
    console.log("(So either no tournaments are in closed/locked/settled/archived status, or the affected competitions are in another environment/DB.)");
    console.log("");
  } else {
    console.log("| tournamentId | name | status | participants | paidPayments | refundedPayments | hasIncome | hasRefund | prizeEvidence | excludedFromRepairReason |");
    console.log("|--------------|------|--------|--------------|--------------|------------------|-----------|-----------|---------------|---------------------------|");
  }
  for (const r of report.tournaments) {
    const name = (r.name || "").replace(/\|/g, " ").slice(0, 24);
    console.log(
      `| ${r.tournamentId} | ${name} | ${r.status} | ${r.participantCount} | ${r.paidPaymentCount} | ${r.refundedPaymentCount} | ${r.hasIncomeRecord} | ${r.hasRefundRecord} | ${r.hasPrizeEvidence} | ${r.excludedFromRepairReason.slice(0, 48)} |`
    );
  }
  console.log("");

  const withParticipants = report.tournaments.filter((t) => t.participantCount > 0);
  const withPaid = report.tournaments.filter((t) => t.paidPaymentCount > 0);
  const notRefunded = report.tournaments.filter((t) => t.paidPaymentCount > 0 && t.refundedPaymentCount === 0);
  const includedInRepair = report.tournaments.filter((t) => t.excludedFromRepairReason.startsWith("INCLUDED"));
  const suspiciousPattern = report.tournaments.filter(
    (t) =>
      t.participantCount > 0 &&
      (t.paidPaymentCount > 0 || t.hasIncomeRecord) &&
      !t.hasPrizeEvidence &&
      t.excludedFromRepairReason !== "INCLUDED (would be processed by repair)"
  );

  console.log("=== 3. SUMMARY ===\n");
  console.log("Total closed/locked tournaments in report:", report.tournaments.length);
  console.log("With at least one participant:", withParticipants.length);
  console.log("With at least one paid entry_fee payment:", withPaid.length);
  console.log("With paid but zero refunded (possible unrefunded):", notRefunded.length);
  console.log("Would be included in repair (LOCKED/CLOSED, not completed, no refund record):", includedInRepair.length);
  console.log("Suspicious (participants/payments, no prize evidence, but excluded from repair):", suspiciousPattern.length);
  if (suspiciousPattern.length > 0) {
    console.log("\nSuspicious tournament IDs:", suspiciousPattern.map((t) => t.tournamentId).join(", "));
  }
  console.log("\n=== 4. RUNNING REPAIR + FORENSIC IN ANOTHER ENVIRONMENT ===\n");
  console.log("To use a different DB (e.g. production):");
  console.log("  1. On the target machine or with the target .env loaded:");
  console.log("     MySQL: set DATABASE_URL=mysql://... then run both scripts.");
  console.log("     SQLite: leave DATABASE_URL unset; ensure ./data/worldcup.db is the DB you want (or run from the project that has it).");
  console.log("  2. Run forensic report:  npx tsx scripts/forensic-cancelled-competitions.ts");
  console.log("  3. Run repair:           npx tsx scripts/run-repair-cancelled-refunds.ts");
  console.log("  4. Run forensic again to verify: suspicious rows should show hasRefundRecord or excludedFromRepairReason = already has refund.");
  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
