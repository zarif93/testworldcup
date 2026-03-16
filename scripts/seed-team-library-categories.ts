/**
 * Seed team library categories (football_custom only).
 * Idempotent: only inserts when team_library_categories is empty.
 * Usage: pnpm exec tsx scripts/seed-team-library-categories.ts
 */
import { join } from "path";
import { existsSync } from "fs";

const dbPath = join(process.cwd(), "data", "worldcup.db");

const CATEGORIES: Array<[string, string, number]> = [
  ["אנגלית", "english", 10],
  ["ספרדית", "spanish", 20],
  ["צרפתית", "french", 30],
  ["איטלקית", "italian", 40],
  ["גרמנית", "german", 50],
  ["ליגת העל", "ligat-haal", 60],
  ["NBA", "nba", 70],
  ["כדורסל ישראלי", "israeli-basketball", 80],
];

async function main() {
  if (!existsSync(dbPath)) {
    console.error("Database not found:", dbPath);
    process.exit(1);
  }
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath);

  const tableExists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='team_library_categories'"
  ).get();
  if (!tableExists) {
    console.error("Table team_library_categories does not exist. Run: pnpm run migrate:team-library");
    db.close();
    process.exit(1);
  }

  const row = db.prepare("SELECT COUNT(*) AS c FROM team_library_categories").get() as { c: number };
  if (row.c > 0) {
    console.log("Team library categories already seeded (" + row.c + " rows). Skipping.");
    db.close();
    return;
  }

  const now = Date.now();
  const ins = db.prepare(
    "INSERT INTO team_library_categories (name, slug, displayOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)"
  );
  for (const [name, slug, order] of CATEGORIES) {
    ins.run(name, slug, order, now, now);
  }
  console.log("Seeded", CATEGORIES.length, "team library categories (football_custom).");
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
