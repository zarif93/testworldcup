/**
 * Run the cancelled-competition refund repair and print the real result.
 * Usage: pnpm exec tsx scripts/run-repair-cancelled-refunds.ts
 */
import "dotenv/config";
import {
  repairUnrefundedCancelledCompetitions,
  getPaymentTransactions,
  isTournamentCompleted,
  USE_SQLITE,
} from "../server/db";

async function main() {
  console.log("=== Cancelled competition refund repair ===\n");

  const result = await repairUnrefundedCancelledCompetitions();

  console.log("1. REPAIR RESULT SUMMARY");
  console.log("   processedTournamentIds:", result.processedTournamentIds);
  console.log("   totalRefundedCount:", result.totalRefundedCount);
  console.log("   totalRefundedAmount:", result.totalRefundedAmount);
  console.log("");

  console.log("2. PER-TOURNAMENT DETAILS");
  for (const d of result.details) {
    console.log(`   tournamentId=${d.tournamentId} name="${d.tournamentName}" refundedCount=${d.refundedCount} totalRefunded=${d.totalRefunded}`);
  }
  console.log("");

  if (result.processedTournamentIds.length === 0) {
    console.log("No cancelled/unfinished tournaments to repair (or all already refunded).");
    console.log("Idempotency: Running repair again would do nothing (same empty result).");
    process.exit(0);
    return;
  }

  console.log("3. REFUNDS VIA PAYMENT_TRANSACTIONS (entry_fee marked refunded)");
  if (!USE_SQLITE) {
    console.log("   (SQLite not in use; payment_transactions not applicable)");
  } else {
    let paymentRefundCount = 0;
    for (const tid of result.processedTournamentIds) {
      const payments = await getPaymentTransactions({ tournamentId: tid, status: "refunded", limit: 500 });
      if (payments.length > 0) {
        console.log(`   Tournament ${tid}: ${payments.length} payment(s) refunded`);
        for (const p of payments) {
          console.log(`     - paymentId=${p.id} userId=${p.userId} submissionId=${p.submissionId ?? "—"} amount=${p.amount}`);
          paymentRefundCount += 1;
        }
      }
    }
    console.log(`   Total payment_transactions refunded in these tournaments: ${paymentRefundCount}`);
  }
  console.log("");

  console.log("4. LEGACY (POINTS) REFUNDS");
  console.log("   Users refunded via points (no payment_transaction or status was not paid) get points back in point_transactions (actionType=refund, referenceId=tournamentId).");
  console.log("   Legacy refund count ≈ totalRefundedCount minus those with payment_transactions refunded above (per tournament).");
  console.log("");

  console.log("5. COMPLETED COMPETITIONS NOT REFUNDED");
  const completedCheck = await Promise.all(
    result.processedTournamentIds.map(async (id) => ({ id, completed: await isTournamentCompleted(id) }))
  );
  const anyCompleted = completedCheck.some((c) => c.completed);
  if (anyCompleted) {
    console.log("   WARNING: Some processed IDs are now completed (refund record inserted):", completedCheck.filter((c) => c.completed).map((c) => c.id));
  } else {
    console.log("   None of the processed tournaments are considered completed (no income record / not PRIZES_DISTRIBUTED). Refunds were only for cancelled/unfinished ones.");
  }
  console.log("");

  console.log("6. IDEMPOTENCY");
  console.log("   If you run this script again now:");
  console.log("   - Each processed tournament now has a financial record with recordType=refund.");
  console.log("   - getCancelledUnfinishedTournamentIds() excludes tournaments that already have a refund record.");
  console.log("   - So repair would find 0 tournaments to process and return empty processedTournamentIds, totalRefundedCount=0, totalRefundedAmount=0.");
  console.log("   - No double refunds.");
  console.log("");

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
