/**
 * Canonical migration: create team library tables (football_custom only).
 * Run before first use of team library. Idempotent (CREATE TABLE IF NOT EXISTS).
 * Usage: pnpm run migrate:team-library
 */
import { join } from "path";
import { existsSync } from "fs";

const dbPath = join(process.cwd(), "data", "worldcup.db");

const CREATE_CATEGORIES = `
CREATE TABLE IF NOT EXISTS team_library_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  displayOrder INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER,
  updatedAt INTEGER
)`;

const CREATE_TEAMS = `
CREATE TABLE IF NOT EXISTS team_library_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoryId INTEGER NOT NULL REFERENCES team_library_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalizedName TEXT NOT NULL,
  displayOrder INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER
)`;

async function main() {
  if (!existsSync(dbPath)) {
    console.error("Database not found:", dbPath);
    process.exit(1);
  }
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath);
  db.exec(CREATE_CATEGORIES);
  db.exec(CREATE_TEAMS);
  db.close();
  console.log("Team library migration complete (team_library_categories, team_library_teams).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
