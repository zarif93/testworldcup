/**
 * Team library default categories: shared dataset, bootstrap idempotency (in-memory SQLite).
 * Run: npx vitest run server/team-library-bootstrap.test.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { bootstrapTeamLibraryCategoriesIfEmpty } from "./teamLibraryBootstrap";
import {
  TEAM_LIBRARY_DEFAULT_CATEGORIES,
  TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT,
} from "@shared/teamLibraryDefaultCategories";

const MIGRATION_SQL = join(import.meta.dirname, "../drizzle/migrations/sqlite-team-library.sql");

function openTeamLibrarySchemaMemory(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(MIGRATION_SQL, "utf8"));
  return db;
}

describe("team library default categories (shared module)", () => {
  it("canonical list matches expected size and stable slugs", () => {
    expect(TEAM_LIBRARY_DEFAULT_CATEGORIES.length).toBe(TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT);
    expect(TEAM_LIBRARY_DEFAULT_CATEGORIES.map((c) => c.slug).join(",")).toBe(
      "english,spanish,french,italian,german,ligat-haal,nba,israeli-basketball"
    );
  });

  it("seed script imports the same module as bootstrap (no duplicate arrays)", async () => {
    const seedUrl = join(import.meta.dirname, "../scripts/seed-team-library-categories.ts");
    const src = readFileSync(seedUrl, "utf8");
    expect(src).toContain('from "../shared/teamLibraryDefaultCategories"');
    expect(src).not.toMatch(/const CATEGORIES:\s*Array/);
  });
});

describe("bootstrapTeamLibraryCategoriesIfEmpty", () => {
  it("empty table inserts all defaults once", () => {
    const sqlite = openTeamLibrarySchemaMemory();
    const r1 = bootstrapTeamLibraryCategoriesIfEmpty(sqlite);
    expect(r1.inserted).toBe(true);
    expect(r1.count).toBe(TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT);

    const rows = sqlite
      .prepare(
        "SELECT name, slug, displayOrder, isActive FROM team_library_categories ORDER BY displayOrder ASC, id ASC"
      )
      .all() as Array<{ name: string; slug: string; displayOrder: number; isActive: number }>;
    expect(rows.length).toBe(TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT);
    for (let i = 0; i < TEAM_LIBRARY_DEFAULT_CATEGORIES.length; i++) {
      expect(rows[i].name).toBe(TEAM_LIBRARY_DEFAULT_CATEGORIES[i].name);
      expect(rows[i].slug).toBe(TEAM_LIBRARY_DEFAULT_CATEGORIES[i].slug);
      expect(rows[i].displayOrder).toBe(TEAM_LIBRARY_DEFAULT_CATEGORIES[i].displayOrder);
      expect(rows[i].isActive).toBe(1);
    }

    const r2 = bootstrapTeamLibraryCategoriesIfEmpty(sqlite);
    expect(r2.inserted).toBe(false);
    expect(r2.count).toBe(TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT);
    sqlite.close();
  });

  it("does not insert when any category row exists (custom only)", () => {
    const sqlite = openTeamLibrarySchemaMemory();
    const now = Date.now();
    sqlite
      .prepare(
        "INSERT INTO team_library_categories (name, slug, displayOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)"
      )
      .run("מותאם אישית", "custom-only", 5, now, now);

    const r = bootstrapTeamLibraryCategoriesIfEmpty(sqlite);
    expect(r.inserted).toBe(false);
    expect(r.count).toBe(1);

    const only = sqlite.prepare("SELECT slug FROM team_library_categories").get() as { slug: string };
    expect(only.slug).toBe("custom-only");
    sqlite.close();
  });
});
