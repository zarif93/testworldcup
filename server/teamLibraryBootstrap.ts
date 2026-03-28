/**
 * Idempotent bootstrap: if team_library_categories is empty, insert canonical defaults.
 * Called from SQLite init only; does not touch existing rows.
 */
import type BetterSqlite3 from "better-sqlite3";
import {
  TEAM_LIBRARY_DEFAULT_CATEGORIES,
  TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT,
} from "@shared/teamLibraryDefaultCategories";

export type TeamLibraryBootstrapResult = {
  /** True only when the table was empty and defaults were inserted */
  inserted: boolean;
  /** Row count after the operation */
  count: number;
};

/**
 * If `team_library_categories` has zero rows, insert `TEAM_LIBRARY_DEFAULT_CATEGORIES`.
 * Safe to call on every startup; no-op when count > 0.
 */
export function bootstrapTeamLibraryCategoriesIfEmpty(sqlite: BetterSqlite3.Database): TeamLibraryBootstrapResult {
  const row = sqlite.prepare("SELECT COUNT(*) AS c FROM team_library_categories").get() as { c: number };
  if (row.c > 0) {
    return { inserted: false, count: row.c };
  }
  const now = Date.now();
  const ins = sqlite.prepare(
    "INSERT INTO team_library_categories (name, slug, displayOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)"
  );
  for (const cat of TEAM_LIBRARY_DEFAULT_CATEGORIES) {
    ins.run(cat.name, cat.slug, cat.displayOrder, now, now);
  }
  const after = sqlite.prepare("SELECT COUNT(*) AS c FROM team_library_categories").get() as { c: number };
  if (after.c !== TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT) {
    console.warn(
      "[DB] Team library bootstrap: expected",
      TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT,
      "categories, got",
      after.c
    );
  } else {
    console.log("[DB] Team library: seeded default categories (" + TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT + " rows)");
  }
  return { inserted: true, count: after.c };
}
