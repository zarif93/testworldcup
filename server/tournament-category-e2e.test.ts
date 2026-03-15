/**
 * Part 3: E2E verification per category/template family.
 * For each supported family: manual create cannot create broken data; template create produces valid data;
 * DB row valid, status valid, lifecycle start valid, admin list visible, public visibility correct.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getTournamentById,
  getActiveTournaments,
  getTournamentPublicStats,
  getTournaments,
  getTournamentTemplates,
  createTournamentFromTemplate,
  createTournament,
} from "./db";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    adminCodeVerified: true,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
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

describe("Tournament category E2E", () => {
  const ts = Date.now();
  let adminCaller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    adminCaller = appRouter.createCaller(createContext(adminUser));
  });

  async function assertValidTournament(id: number, expectedType: string, name: string) {
    const row = await getTournamentById(id);
    expect(row).toBeDefined();
    expect((row as { id: number }).id).toBe(id);
    expect((row as { status?: string }).status).toBe("OPEN");
    expect((row as { type?: string }).type).toBe(expectedType);
    expect((row as { name?: string }).name).toBe(name);
    expect((row as { deletedAt?: unknown }).deletedAt).toBeNull();
    const active = await getActiveTournaments();
    expect(active.map((t) => t.id)).toContain(id);
    const all = await getTournaments();
    expect(all.map((t) => t.id)).toContain(id);
    const publicStats = await getTournamentPublicStats(true);
    expect(publicStats.map((t) => t.id)).toContain(id);
  }

  it("football – manual create produces valid DB row, OPEN, visible in admin and public", async () => {
    const name = `E2E football ${ts}`;
    const result = await adminCaller.admin.createTournament({
      name,
      amount: 10,
      type: "football",
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 86400_000 * 2),
    });
    const id = result.id;
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "football", name);
  });

  it("basketball (custom) – createTournament with type basketball normalizes to custom, valid row", async () => {
    const name = `E2E basketball ${ts}`;
    const id = await createTournament({
      name,
      amount: 5,
      type: "basketball",
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 86400_000 * 2),
    });
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "custom", name);
  });

  it("tennis (custom) – createTournament with type tennis normalizes to custom, valid row", async () => {
    const name = `E2E tennis ${ts}`;
    const id = await createTournament({
      name,
      amount: 5,
      type: "tennis",
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 86400_000 * 2),
    });
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "custom", name);
  });

  it("lottery (lotto) – manual create with drawCode/drawDate/drawTime produces valid row", async () => {
    const name = `E2E lottery ${ts}`;
    const result = await adminCaller.admin.createTournament({
      name,
      amount: 10,
      type: "lotto",
      drawCode: `e2e_lottery_${ts}`,
      drawDate: "2035-06-15",
      drawTime: "23:00",
    });
    const id = result.id;
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "lotto", name);
    const row = await getTournamentById(id);
    expect((row as { drawDate?: string }).drawDate).toBe("2035-06-15");
    expect((row as { drawTime?: string }).drawTime).toBe("23:00");
  });

  it("chance – manual create with drawDate/drawTime produces valid row", async () => {
    const name = `E2E chance ${ts}`;
    const day = String(((ts >> 8) % 28) + 1).padStart(2, "0");
    const min = String(ts % 60).padStart(2, "0");
    const drawDate = `2035-07-${day}`;
    const drawTime = `18:${min}`;
    const result = await adminCaller.admin.createTournament({
      name,
      amount: 5,
      type: "chance",
      drawDate,
      drawTime,
    });
    const id = result.id;
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "chance", name);
    const row = await getTournamentById(id);
    expect((row as { drawDate?: string }).drawDate).toBe(drawDate);
    expect((row as { drawTime?: string }).drawTime).toBe(drawTime);
  });

  it("custom – manual create produces valid row", async () => {
    const name = `E2E custom ${ts}`;
    const result = await adminCaller.admin.createTournament({
      name,
      amount: 0,
      type: "custom",
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 86400_000 * 2),
    });
    const id = result.id;
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "custom", name);
  });

  it("manual create lotto without drawDate/drawTime is rejected with BAD_REQUEST", async () => {
    await expect(
      adminCaller.admin.createTournament({
        name: "Bad Lotto",
        amount: 10,
        type: "lotto",
        drawCode: `bad_${ts}`,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("template create (football) produces valid data when template exists", async () => {
    const templates = await getTournamentTemplates(null);
    const footballTemplate = templates.find(
      (t) => (t.configJson as Record<string, unknown>)?.tournamentType === "football"
    );
    if (!footballTemplate) return;
    const name = `E2E tpl football ${ts}`;
    const id = await createTournamentFromTemplate(footballTemplate.id, {
      name,
      amount: 8,
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 86400_000 * 2),
    });
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "football", name);
  });

  it("template create (lotto) produces valid data when template exists", async () => {
    const templates = await getTournamentTemplates(null);
    const lottoTemplate = templates.find(
      (t) => (t.configJson as Record<string, unknown>)?.tournamentType === "lotto"
    );
    if (!lottoTemplate) return;
    const name = `E2E tpl lotto ${ts}`;
    const id = await createTournamentFromTemplate(lottoTemplate.id, {
      name,
      amount: 10,
      drawCode: `e2e_tpl_${ts}`,
      drawDate: "2036-01-10",
      drawTime: "22:30",
    });
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "lotto", name);
  });

  it("template create (chance) produces valid data when template exists", async () => {
    const templates = await getTournamentTemplates(null);
    const chanceTemplate = templates.find(
      (t) => (t.configJson as Record<string, unknown>)?.tournamentType === "chance"
    );
    if (!chanceTemplate) return;
    const name = `E2E tpl chance ${ts}`;
    const day = String(((ts >> 10) % 28) + 1).padStart(2, "0");
    const min = String((ts >> 2) % 60).padStart(2, "0");
    const drawDate = `2036-08-${day}`;
    const drawTime = `20:${min}`;
    const id = await createTournamentFromTemplate(chanceTemplate.id, {
      name,
      amount: 5,
      drawDate,
      drawTime,
    });
    expect(id).toBeGreaterThan(0);
    await assertValidTournament(id, "chance", name);
  });
});
