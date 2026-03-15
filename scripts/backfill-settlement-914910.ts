/**
 * One-off: backfill settlement financial record for tournament 914910 and verify.
 * Run: pnpm exec tsx scripts/backfill-settlement-914910.ts
 */
import "dotenv/config";
import { ensureSettlementFinancialRecord, getTournamentSettlementWinners } from "../server/db";

const TOURNAMENT_ID = 914910;

async function main() {
  console.log("1. ensureSettlementFinancialRecord(" + TOURNAMENT_ID + ")");
  const backfill = await ensureSettlementFinancialRecord(TOURNAMENT_ID);
  console.log("   result:", JSON.stringify(backfill));

  console.log("\n2. getTournamentSettlementWinners(" + TOURNAMENT_ID + ")");
  const winners = await getTournamentSettlementWinners(TOURNAMENT_ID);
  console.log("   result:", JSON.stringify(winners));
  if (winners.settled) {
    console.log("   winnersCount:", winners.winners.length);
    console.log("   totalPrizePool:", winners.totalPrizePool);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
