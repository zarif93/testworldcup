/**
 * Check what prize data exists for tournament 914910.
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { eq, and } from "drizzle-orm";

const TOURNAMENT_ID = 914910;

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB");
    process.exit(1);
  }
  const { pointTransactions } = await import("../server/db").then((m) => m.getSchema());
  const ptRows = await db
    .select()
    .from(pointTransactions)
    .where(and(eq(pointTransactions.referenceId, TOURNAMENT_ID), eq(pointTransactions.actionType, "prize")));
  console.log("point_transactions (prize, referenceId=" + TOURNAMENT_ID + "):", ptRows.length);
  ptRows.slice(0, 5).forEach((r) => console.log(" ", r));

  const events = await import("../server/db").then((m) => m.getTournamentFinancialEvents(TOURNAMENT_ID));
  const prizeEvents = events.filter((e) => e.eventType === "prize_allocated");
  console.log("\ntournament_financial_events PRIZE_ALLOCATED:", prizeEvents.length);
  prizeEvents.slice(0, 3).forEach((e) => console.log(" ", e.payloadJson));

  const { getSubmissionsByTournament } = await import("../server/db");
  const subs = await getSubmissionsByTournament(TOURNAMENT_ID);
  const approved = subs.filter((s) => s.status === "approved");
  console.log("\nsubmissions approved:", approved.length);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
