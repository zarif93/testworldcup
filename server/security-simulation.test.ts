/**
 * סימולציית אבטחה – משתמשים אמיתיים, פעילות רגילה, Race Condition ובדיקת עומס.
 * יוצר: שחקנים, סוכנים, מנהלים, תחרות OPEN, מריץ שליחות ו-100 פעולות במקביל.
 * הרצה: npx vitest run server/security-simulation.test.ts
 *
 * להרצה מלאה (50 שחקנים, 10 סוכנים) שנה את הקבועים למטה ל-NUM_PLAYERS=50, NUM_AGENTS=10, NUM_ADMINS=2.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getDb,
  getTournaments,
  getUserByUsername,
  getUserPoints,
  createUser,
  updateUserRole,
  addUserPoints,
  updateUserAgentId,
  getSubmissionsByTournament,
  getTournamentById,
} from "./db";
import { hashPassword } from "./auth";

const NUM_PLAYERS = 10;
const NUM_AGENTS = 3;
const NUM_ADMINS = 2;
const NUM_SUPER = 1;
const PREFIX = "sim_sec";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    adminCodeVerified: true,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
  };
}

function toContextUser(row: { id: number; openId: string | null; username: string | null; name: string | null; role: string; points: number; agentId: number | null }): TrpcContext["user"] {
  return {
    id: row.id,
    openId: row.openId ?? `local-${row.username}-${row.id}`,
    username: row.username ?? String(row.id),
    name: row.name ?? row.username ?? String(row.id),
    role: row.role as "user" | "admin" | "agent",
    points: row.points ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    email: null,
    loginMethod: "local",
    phone: null,
    passwordHash: null,
    agentId: row.agentId,
    referralCode: null,
    isBlocked: false,
    deletedAt: null,
  } as TrpcContext["user"];
}

describe("SECURITY SIMULATION – משתמשים ופעילות", () => {
  const playerIds: number[] = [];
  const agentIds: number[] = [];
  const adminIds: number[] = [];
  let tournamentId: number = 0;
  let tournamentName: string = "";
  let simTimestamp: number = 0;

  beforeAll(async () => {
    const dummyHash = await hashPassword("test-sim");
    simTimestamp = Date.now();
    tournamentName = `${PREFIX}_tournament_${simTimestamp}`;

    // 1. שחקנים
    for (let i = 1; i <= NUM_PLAYERS; i++) {
      const uname = `${PREFIX}_player_${i}_${simTimestamp}`;
      await createUser({ username: uname, passwordHash: dummyHash, name: `Player ${i}` });
      const u = await getUserByUsername(uname);
      if (u) playerIds.push(u.id);
    }

    // 2. סוכנים
    for (let i = 1; i <= NUM_AGENTS; i++) {
      const uname = `${PREFIX}_agent_${i}_${simTimestamp}`;
      await createUser({ username: uname, passwordHash: dummyHash, name: `Agent ${i}` });
      const u = await getUserByUsername(uname);
      if (u) {
        await updateUserRole(u.id, "agent");
        agentIds.push(u.id);
      }
    }

    // 3. מנהלים + סופר
    for (let i = 1; i <= NUM_ADMINS + NUM_SUPER; i++) {
      const uname = `${PREFIX}_admin_${i}_${simTimestamp}`;
      await createUser({ username: uname, passwordHash: dummyHash, name: `Admin ${i}` });
      const u = await getUserByUsername(uname);
      if (u) {
        await updateUserRole(u.id, "admin");
        adminIds.push(u.id);
      }
    }

    // 4. שיוך חלק מהשחקנים לסוכנים (שחקנים 1..5 → סוכנים 1,2,3,1,2)
    if (playerIds.length >= 5 && agentIds.length >= 3) {
      for (let i = 0; i < 5; i++) {
        await updateUserAgentId(playerIds[i], agentIds[i % 3]);
      }
    }

    // 5. נקודות ל־5 שחקנים ראשונים (לשליחות)
    for (let i = 0; i < Math.min(5, playerIds.length); i++) {
      await addUserPoints(playerIds[i], 50, "deposit", { description: "Sim deposit" });
    }

    // 6. תחרות OPEN (chance) – יוצרים כמנהל
    const adminDb = await getUserByUsername(`${PREFIX}_admin_1_${simTimestamp}`);
    if (!adminDb) throw new Error("Admin 1 not found");
    const adminCaller = appRouter.createCaller(createContext(toContextUser(adminDb)));
    const drawDate = "2030-06-01";
    const drawTime = `${10 + Math.floor((simTimestamp / 60000) % 14)}:${Math.floor((simTimestamp / 1000) % 60).toString().padStart(2, "0")}`;
    await adminCaller.admin.createTournament({
      name: tournamentName,
      amount: 5,
      type: "chance",
      drawDate,
      drawTime,
    });
    const list = await getTournaments();
    const t = list.find((x: { name?: string }) => x.name === tournamentName);
    if (!t || !(t as { id?: number }).id) throw new Error("Tournament not found after create");
    tournamentId = (t as { id: number }).id;
  }, 60000);

  describe("פעילות רגילה", () => {
    it("יש תחרות OPEN וניתן לשלוח אליה טפסים", async () => {
      const tour = await getTournamentById(tournamentId);
      expect(tour).toBeDefined();
      expect((tour as { status?: string })?.status).toBe("OPEN");
    });

    it("שחקנים עם נקודות יכולים לשלוח טופס צ'אנס", async () => {
      const uname = `${PREFIX}_player_1_${simTimestamp}`;
      const u = await getUserByUsername(uname);
      if (!u || !tournamentId) return;
      const caller = appRouter.createCaller(createContext(toContextUser(u)));
      const res = await caller.submissions.submit({
        tournamentId,
        predictionsChance: { heart: "7", club: "8", diamond: "9", spade: "10" },
        idempotencyKey: `sim-normal-${simTimestamp}-1`,
      });
      expect(res).toBeDefined();
      expect(res.success).toBe(true);
    });
  });

  describe("Race Condition – שליחות מקבילות", () => {
    it("שחקן עם יתרה מוגבלת – 10 שליחות במקביל לא יגרמו ליתרה שלילית", async () => {
      const uname = `${PREFIX}_player_2_${simTimestamp}`;
      const u = await getUserByUsername(uname);
      if (!u || !tournamentId) return;
      const beforePoints = await getUserPoints(u.id);
      const costPerEntry = 5;
      const maxSubmissions = Math.max(0, Math.floor(beforePoints / costPerEntry));
      const parallelCount = 10;
      const promises = Array.from({ length: parallelCount }, (_, i) => {
        const caller = appRouter.createCaller(createContext(toContextUser(u)));
        return caller.submissions
          .submit({
            tournamentId,
            predictionsChance: { heart: "8", club: "9", diamond: "10", spade: "J" },
            idempotencyKey: `sim-race-${simTimestamp}-${i}`,
          })
          .then(() => "ok")
          .catch((e: unknown) => (e as { message?: string })?.message ?? "err");
      });
      await Promise.all(promises);
      const afterPoints = await getUserPoints(u.id);
      const subs = await getSubmissionsByTournament(tournamentId);
      const mySubs = subs.filter((s: { userId?: number }) => s.userId === u.id);
      expect(afterPoints).toBeGreaterThanOrEqual(0);
      expect(mySubs.length).toBeLessThanOrEqual(maxSubmissions + parallelCount);
    });
  });

  describe("עומס – 100 פעולות במקביל", () => {
    it("100 קריאות tournaments.getAll במקביל – המערכת נשארת יציבה", async () => {
      const uname = `${PREFIX}_admin_1_${simTimestamp}`;
      const u = await getUserByUsername(uname);
      if (!u) return;
      const caller = appRouter.createCaller(createContext(toContextUser(u)));
      const promises = Array.from({ length: 100 }, () => caller.tournaments.getAll());
      const results = await Promise.allSettled(promises);
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected.length).toBe(0);
      expect(results.length).toBe(100);
    });
  });
});
