-- Team library (football_custom / תחרויות ספורט only).
-- Canonical migration: run  pnpm run migrate:team-library  (creates tables).
-- Seed (optional, same data as runtime):  pnpm run seed:team-library
-- Runtime: empty table is filled once from shared/teamLibraryDefaultCategories.ts (SQLite init).

CREATE TABLE IF NOT EXISTS team_library_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  displayOrder INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS team_library_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoryId INTEGER NOT NULL REFERENCES team_library_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalizedName TEXT NOT NULL,
  displayOrder INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER
);
