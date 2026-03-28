/**
 * Team library admin: category create, bulk teams, parse helper, auth.
 * Run: npx vitest run server/team-library-admin.test.ts
 */
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  USE_SQLITE,
  getDb,
  getSqlite,
  parseBulkTeamLines,
  createTeamLibraryCategory,
  bulkCreateTeamLibraryTeams,
  listTeamLibraryTeams,
} from "./db";

function createContext(user: TrpcContext["user"], adminVerified = true): TrpcContext {
  return {
    user,
    adminCodeVerified: adminVerified,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
  };
}

const adminUser = {
  id: 1,
  openId: "admin-open-id",
  username: "AdminUser",
  name: "Admin",
  role: "admin" as const,
  points: 1000,
  unlimitedPoints: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  email: null as string | null,
  loginMethod: "local" as const,
  phone: null as string | null,
  passwordHash: null as string | null,
  agentId: null as number | null,
  referralCode: null as string | null,
  isBlocked: false,
  deletedAt: null as Date | null,
};

describe("parseBulkTeamLines", () => {
  it("trims, ignores empty lines, dedupes batch with skippedDuplicateInBatch count", () => {
    const raw = "  אחת  \n\nב\nאחת\n  ב  \n";
    const r = parseBulkTeamLines(raw);
    expect(r.names).toEqual(["אחת", "ב"]);
    expect(r.skippedDuplicateInBatch).toBe(2);
    expect(r.invalidCount).toBe(0);
  });

  it("counts lines over max length as invalid", () => {
    const long = "x".repeat(201);
    const r = parseBulkTeamLines(`ok\n${long}`);
    expect(r.names).toEqual(["ok"]);
    expect(r.invalidCount).toBe(1);
  });
});

describe("team library admin tRPC", () => {
  beforeAll(async () => {
    if (!USE_SQLITE) return;
    await getDb();
  });

  it("non-admin cannot create category", async () => {
    const userCaller = appRouter.createCaller(
      createContext({
        id: 9001,
        openId: "u1",
        username: "regular",
        name: "R",
        role: "user",
        points: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        email: null,
        loginMethod: "local",
        phone: null,
        passwordHash: null,
        agentId: null,
        referralCode: null,
        isBlocked: false,
        deletedAt: null,
      } as TrpcContext["user"])
    );
    await expect(
      userCaller.admin.createTeamLibraryCategory({ scope: "football_custom", name: "X" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin creates category and duplicate name is CONFLICT", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const suffix = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const catName = `קטגוריית בדיקה ${suffix}`;

    const adminCaller = appRouter.createCaller(createContext(adminUser as TrpcContext["user"]));
    const created = await adminCaller.admin.createTeamLibraryCategory({ scope: "football_custom", name: catName });
    expect(created.id).toBeGreaterThan(0);

    await expect(
      adminCaller.admin.createTeamLibraryCategory({ scope: "football_custom", name: `  ${catName}  ` })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(createTeamLibraryCategory({ name: catName })).rejects.toThrow("TEAM_CATEGORY_NAME_DUPLICATE");
  });

  it("bulk add inserts, skips DB duplicates and batch duplicates", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const suffix = `bulk-${Date.now()}`;
    const { id: categoryId } = await createTeamLibraryCategory({ name: `בולק ${suffix}` });

    await createTeamLibraryTeamDirect(sqlite, categoryId, "קבוצה א");

    const text = "קבוצה א\nקבוצה ב\nקבוצה ב\n";
    const r = await bulkCreateTeamLibraryTeams(categoryId, text);
    expect(r.inserted).toBe(1);
    expect(r.skippedDuplicate).toBe(2);
    expect(r.invalid).toBe(0);

    const teams = await listTeamLibraryTeams(categoryId);
    const names = teams.map((t) => t.name).sort();
    expect(names).toContain("קבוצה א");
    expect(names).toContain("קבוצה ב");
  });
});

/** Direct SQLite insert for setup (same normalization as API). */
function createTeamLibraryTeamDirect(
  sqlite: NonNullable<Awaited<ReturnType<typeof getSqlite>>>,
  categoryId: number,
  name: string
) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  sqlite
    .prepare(
      `INSERT INTO team_library_teams (categoryId, name, normalizedName, displayOrder, isActive) VALUES (?, ?, ?, 0, 1)`
    )
    .run(categoryId, name.trim(), normalized);
}
