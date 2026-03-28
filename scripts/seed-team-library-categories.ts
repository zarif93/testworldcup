/**
 * Seed team library categories (football_custom only).
 * Idempotent: only inserts when team_library_categories is empty.
 * Dataset: shared/teamLibraryDefaultCategories.ts (same as runtime bootstrap).
 * Usage: pnpm exec tsx scripts/seed-team-library-categories.ts
 */
import { join } from "path";
import { existsSync } from "fs";
import { TEAM_LIBRARY_DEFAULT_CATEGORIES } from "../shared/teamLibraryDefaultCategories";

const dbPath = join(process.cwd(), "data", "worldcup.db");

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
  for (const cat of TEAM_LIBRARY_DEFAULT_CATEGORIES) {
    ins.run(cat.name, cat.slug, cat.displayOrder, now, now);
  }
  console.log("Seeded", TEAM_LIBRARY_DEFAULT_CATEGORIES.length, "team library categories (football_custom).");
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
