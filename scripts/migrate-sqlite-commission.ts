/**
 * Canonical migration: ensure tournaments.commissionPercentBasisPoints exists and backfill NULLs.
 * Idempotent. Run before app start if schema is outdated.
 * Usage: pnpm exec tsx scripts/migrate-sqlite-commission.ts  or  npm run migrate:sqlite
 */
import { join } from "path";
import { existsSync } from "fs";

const dbPath = join(process.cwd(), "data", "worldcup.db");

async function main() {
  if (!existsSync(dbPath)) {
    console.error("Database not found:", dbPath);
    process.exit(1);
  }
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath);
  const cols = db.prepare("PRAGMA table_info(tournaments)").all() as Array<{ name: string }>;
  const has = cols.some((c) => c.name === "commissionPercentBasisPoints");
  if (!has) {
    db.exec("ALTER TABLE tournaments ADD COLUMN commissionPercentBasisPoints INTEGER NOT NULL DEFAULT 1250");
    console.log("[migrate] Added tournaments.commissionPercentBasisPoints");
  }
  const result = db.prepare("UPDATE tournaments SET commissionPercentBasisPoints = 1250 WHERE commissionPercentBasisPoints IS NULL").run();
  if (result.changes > 0) {
    console.log("[migrate] Backfilled", result.changes, "rows with commissionPercentBasisPoints = 1250");
  }
  db.close();
  console.log("Migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
