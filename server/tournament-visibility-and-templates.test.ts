/**
 * E2E verification: tournament visibility fix and template create flow.
 * - New tournaments get status OPEN and appear in getActiveTournaments / getTournamentPublicStats.
 * - createTournamentFromTemplate creates with status OPEN and template config.
 * Run: npx vitest run server/tournament-visibility-and-templates.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  createTournament,
  getActiveTournaments,
  getTournamentPublicStats,
  getTournaments,
  getTournamentById,
  getTournamentTemplates,
  createTournamentFromTemplate,
  validateTemplateConfig,
} from "./db";

describe("Tournament visibility and templates", () => {
  let createdId: number;
  const testName = `e2e_vis_${Date.now()}`;

  it("createTournament sets status OPEN and tournament appears in active and public lists", async () => {
    createdId = await createTournament({
      name: testName,
      amount: 10,
      description: "E2E visibility test",
      type: "football",
      visibility: "VISIBLE",
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 86400_000 * 2),
    });

    const row = await getTournamentById(createdId);
    expect(row).toBeDefined();
    expect((row as { status?: string }).status).toBe("OPEN");
    expect((row as { name?: string }).name).toBe(testName);

    const active = await getActiveTournaments();
    const activeIds = active.map((t) => t.id);
    expect(activeIds).toContain(createdId);

    const publicStats = await getTournamentPublicStats(true);
    const publicIds = publicStats.map((t) => t.id);
    expect(publicIds).toContain(createdId);

    const all = await getTournaments();
    const allIds = all.map((t) => t.id);
    expect(allIds).toContain(createdId);
  });

  it("createTournamentFromTemplate creates with status OPEN when template exists", async () => {
    const templates = await getTournamentTemplates(null);
    if (templates.length === 0) {
      console.warn("No tournament templates seeded – skip template E2E");
      return;
    }

    const template = templates[0];
    const name = `e2e_tpl_${Date.now()}`;
    const opensAt = new Date(Date.now() + 3600_000);
    const closesAt = new Date(Date.now() + 86400_000 * 2);

    const config = template.configJson as Record<string, unknown>;
    const tournamentType = (config.tournamentType as string) ?? "football";
    const needsFootballDates = tournamentType === "football" || tournamentType === "football_custom";
    const needsLotto = tournamentType === "lotto";
    const needsChance = tournamentType === "chance";

    const overrides: Parameters<typeof createTournamentFromTemplate>[1] = {
      name,
      description: "E2E template test",
      amount: 5,
    };
    if (needsFootballDates) {
      overrides.opensAt = opensAt;
      overrides.closesAt = closesAt;
    }
    if (needsLotto) {
      overrides.drawCode = `e2e_${Date.now()}`;
      overrides.drawDate = new Date().toISOString().slice(0, 10);
      overrides.drawTime = "22:30";
    }
    if (needsChance) {
      overrides.drawDate = new Date().toISOString().slice(0, 10);
      overrides.drawTime = "20:00";
    }

    const id = await createTournamentFromTemplate(template.id, overrides);

    const row = await getTournamentById(id);
    expect(row).toBeDefined();
    expect((row as { status?: string }).status).toBe("OPEN");
    expect((row as { name?: string }).name).toBe(name);

    const active = await getActiveTournaments();
    expect(active.map((t) => t.id)).toContain(id);

    const publicStats = await getTournamentPublicStats(true);
    expect(publicStats.map((t) => t.id)).toContain(id);
  });

  describe("template config validation", () => {
    it("validateTemplateConfig rejects non-object config", () => {
      expect(validateTemplateConfig(null).valid).toBe(false);
      expect(validateTemplateConfig(undefined).valid).toBe(false);
      expect(validateTemplateConfig("string").valid).toBe(false);
      if (!validateTemplateConfig(null).valid) expect((validateTemplateConfig(null) as { error: string }).error).toContain("object");
    });

    it("validateTemplateConfig rejects invalid tournamentType", () => {
      const result = validateTemplateConfig({ tournamentType: "invalid_type" });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("tournamentType");
    });

    it("validateTemplateConfig rejects invalid lifecycle initialStatus", () => {
      const result = validateTemplateConfig({
        tournamentType: "football",
        lifecycleDefaults: { initialStatus: "INVALID" },
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("initialStatus");
    });

    it("validateTemplateConfig rejects invalid lotto drawTime", () => {
      const result = validateTemplateConfig({
        tournamentType: "lotto",
        defaultDurations: { drawTime: "99:99" },
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("drawTime");
    });

    it("validateTemplateConfig accepts valid football config", () => {
      const result = validateTemplateConfig({
        tournamentType: "football",
        defaultEntryAmount: 10,
        lifecycleDefaults: { initialStatus: "OPEN" },
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config.tournamentType).toBe("football");
        expect(result.config.defaultEntryAmount).toBe(10);
      }
    });

    it("validateTemplateConfig accepts valid lotto config with allowed drawTime", () => {
      const result = validateTemplateConfig({
        tournamentType: "lotto",
        defaultEntryAmount: 5,
        defaultDurations: { drawTime: "23:00" },
        lifecycleDefaults: { initialStatus: "OPEN" },
      });
      expect(result.valid).toBe(true);
    });
  });

  it("createTournamentFromTemplate with valid template produces correct tournament shape", async () => {
    const templates = await getTournamentTemplates("football");
    if (templates.length === 0) return;
    const template = templates[0];
    const name = `shape_${Date.now()}`;
    const id = await createTournamentFromTemplate(template.id, {
      name,
      amount: 25,
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 86400_000 * 2),
    });
    const row = await getTournamentById(id);
    expect(row).toBeDefined();
    expect((row as { status?: string }).status).toBe("OPEN");
    expect((row as { name?: string }).name).toBe(name);
    expect((row as { amount?: number }).amount).toBe(25);
    expect((row as { type?: string }).type).toBeDefined();
  });
});
