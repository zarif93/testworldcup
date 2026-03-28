/**
 * Canonical default rows for team_library_categories (תחרויות ספורט / football_custom).
 * Used by: runtime SQLite bootstrap, scripts/seed-team-library-categories.ts
 * Do not duplicate this list elsewhere.
 */
export type TeamLibraryDefaultCategory = {
  name: string;
  slug: string;
  displayOrder: number;
};

export const TEAM_LIBRARY_DEFAULT_CATEGORIES: readonly TeamLibraryDefaultCategory[] = [
  { name: "אנגלית", slug: "english", displayOrder: 10 },
  { name: "ספרדית", slug: "spanish", displayOrder: 20 },
  { name: "צרפתית", slug: "french", displayOrder: 30 },
  { name: "איטלקית", slug: "italian", displayOrder: 40 },
  { name: "גרמנית", slug: "german", displayOrder: 50 },
  { name: "ליגת העל", slug: "ligat-haal", displayOrder: 60 },
  { name: "NBA", slug: "nba", displayOrder: 70 },
  { name: "כדורסל ישראלי", slug: "israeli-basketball", displayOrder: 80 },
] as const;

export const TEAM_LIBRARY_DEFAULT_CATEGORY_COUNT = TEAM_LIBRARY_DEFAULT_CATEGORIES.length;
