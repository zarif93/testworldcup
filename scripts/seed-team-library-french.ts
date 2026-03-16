/**
 * Seed team library: French league (צרפתית) teams.
 * Idempotent: skips teams that already exist (by categoryId + normalizedName).
 * Usage: pnpm run seed:team-library-french
 */
import { join } from "path";
import { existsSync } from "fs";

const dbPath = join(process.cwd(), "data", "worldcup.db");

const FRENCH_SLUG = "french";

const TEAMS: string[] = [
  "פריז סן-ז'רמן",
  "מארסיי",
  "ליון",
  "מונאקו",
  "ליל",
  "לאנס",
  "ברסט",
  "ניס",
  "ראן",
  "טולוז",
  "שטרסבורג",
  "לוריין",
  "נאנט",
  "אנז'ה",
  "לה האבר",
  "אוקזר",
  "מץ",
  "פאריס FC",
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
  ).get(FRENCH_SLUG) as { id: number } | undefined;
  if (!category) {
    console.error("Category צרפתית (slug: french) not found. Run: pnpm run seed:team-library");
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

  console.log("French (צרפתית) teams: inserted", inserted, ", skipped (already exist)", skipped);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
