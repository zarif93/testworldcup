/**
 * Seed team library: Spanish league (ספרדית) teams.
 * Idempotent: skips teams that already exist (by categoryId + normalizedName).
 * Usage: pnpm run seed:team-library-spanish
 */
import { join } from "path";
import { existsSync } from "fs";

const dbPath = join(process.cwd(), "data", "worldcup.db");

const SPANISH_SLUG = "spanish";

const TEAMS: string[] = [
  "ברצלונה",
  "ריאל מדריד",
  "אתלטיקו מדריד",
  "אתלטיק בילבאו",
  "ריאל סוסיאדד",
  "ויאריאל",
  "ריאל בטיס",
  "סלטה ויגו",
  "ג'ירונה",
  "ולנסיה",
  "סביליה",
  "חטאפה",
  "ראיו ואיקנו",
  "אוסאסונה",
  "מאיורקה",
  "אלאבס",
  "אספניול",
  "ריאל ויאדוליד",
  "לגאנס",
  "לאס פאלמאס",
];

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  if (!existsSync(dbPath)) {
    console.error("Database not found:", dbPath);
    process.exit(1);
  }
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath);

  const categoriesExist = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='team_library_categories'"
  ).get();
  const teamsExist = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='team_library_teams'"
  ).get();
  if (!categoriesExist || !teamsExist) {
    console.error("Team library tables missing. Run: pnpm run migrate:team-library");
    db.close();
    process.exit(1);
  }

  const category = db.prepare(
    "SELECT id FROM team_library_categories WHERE slug = ?"
  ).get(SPANISH_SLUG) as { id: number } | undefined;
  if (!category) {
    console.error("Category ספרדית (slug: spanish) not found. Run: pnpm run seed:team-library");
    db.close();
    process.exit(1);
  }
  const categoryId = category.id;

  const checkExists = db.prepare(
    "SELECT 1 FROM team_library_teams WHERE categoryId = ? AND normalizedName = ?"
  );
  const insert = db.prepare(
    "INSERT INTO team_library_teams (categoryId, name, normalizedName, displayOrder, isActive) VALUES (?, ?, ?, ?, 1)"
  );

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < TEAMS.length; i++) {
    const name = TEAMS[i].trim();
    const normalizedName = normalizeTeamName(name);
    const exists = checkExists.get(categoryId, normalizedName);
    if (exists) {
      skipped++;
      continue;
    }
    insert.run(categoryId, name, normalizedName, i + 1);
    inserted++;
  }

  console.log("Spanish (ספרדית) teams: inserted", inserted, ", skipped (already exist)", skipped);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
