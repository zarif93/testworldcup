import { COOKIE_NAME, ADMIN_VERIFIED_COOKIE } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { registerUser, loginUser } from "./auth";
import { hashPassword } from "./auth";
import {
  upsertSubmission,
  getAllSubmissions,
  getSubmissionById,
  getSubmissionsByTournament,
  getSubmissionsByUserId,
  updateSubmissionStatus,
  updateSubmissionPayment,
  updateSubmissionPoints,
  getTournaments,
  getTournamentById,
  getMatches,
  getMatchById,
  updateMatchResult,
  setTournamentLocked,
  createTournament,
  deleteTournament,
  getAllUsers,
  getFinancialTransparency,
  getTournamentPublicStats,
  getPendingSubmissionsCount,
  deleteSubmission,
  deleteUser,
  createAgent as dbCreateAgent,
  getAgents,
  getAgentCommissionsByAgentId,
  getAgentCommissionsByAgentIdExistingOnly,
  getUsersByAgentId,
  getUserByUsername,
  getUserById,
  recordAgentCommission,
  hasCommissionForSubmission,
  calcAgentCommission,
} from "./db";
import { calcSubmissionPoints } from "./services/scoringService";
import { TRPCError } from "@trpc/server";

const ADMIN_CODE_MSG = "גישה אסורה – אין הרשאות";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_CODE_MSG });
  if (ENV.adminSecret && !ctx.adminCodeVerified) {
    throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_CODE_MSG });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    /** בדיקה אם שם משתמש פנוי – להצגה בטופס הרשמה */
    checkUsername: publicProcedure
      .input(z.object({ username: z.string().min(1) }))
      .query(async ({ input }) => {
        const existing = await getUserByUsername(input.username.trim());
        return { available: !existing };
      }),
    register: publicProcedure
      .input(z.object({
        username: z.string().min(3),
        phone: z.string().min(9),
        password: z.string().min(6),
        name: z.string().min(1, "שם מלא חובה"),
        referralCode: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await registerUser({
          username: input.username,
          phone: input.phone,
          password: input.password,
          name: input.name,
          referralCode: input.referralCode,
        });
        ctx.res.cookie(COOKIE_NAME, result.token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return result;
      }),
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const result = await loginUser(input);
        ctx.res.cookie(COOKIE_NAME, result.token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return result;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true };
    }),
  }),

  tournaments: router({
    getAll: publicProcedure.query(() => getTournaments()),
    getPublicStats: publicProcedure.query(() => getTournamentPublicStats()),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const t = await getTournamentById(input.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      return t;
    }),
  }),

  matches: router({
    getAll: publicProcedure.query(() => getMatches()),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const m = await getMatchById(input.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      return m;
    }),
  }),

  submissions: router({
    submit: protectedProcedure
      .input(z.object({
        tournamentId: z.number(),
        predictions: z.array(z.object({
          matchId: z.number(),
          prediction: z.enum(["1", "X", "2"]),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const matches = await getMatches();
        if (input.predictions.length !== matches.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "יש למלא ניחוש לכל 72 המשחקים" });
        }
        const matchIds = new Set(matches.map((m) => m.id));
        for (const p of input.predictions) {
          if (!matchIds.has(p.matchId)) throw new TRPCError({ code: "BAD_REQUEST", message: "משחק לא תקין" });
        }
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
        if (tournament.isLocked) throw new TRPCError({ code: "BAD_REQUEST", message: "הטורניר נעול" });
        await upsertSubmission({
          userId: ctx.user.id,
          username: ctx.user.username || ctx.user.name || "משתמש",
          tournamentId: input.tournamentId,
          predictions: input.predictions,
        });
        return { success: true };
      }),

    getAll: publicProcedure.query(() => getAllSubmissions()),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const s = await getSubmissionById(input.id);
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      return s;
    }),
    getByTournament: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getSubmissionsByTournament(input.tournamentId)),
    getMine: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getSubmissionsByUserId(ctx.user.id);
    }),
  }),

  transparency: router({
    getSummary: publicProcedure.query(() => getFinancialTransparency()),
  }),

  admin: router({
    /** האם נדרש קוד מנהל והאם הוגדר (רק למשתמש admin) */
    getStatus: protectedProcedure.query(({ ctx }) => {
      if (ctx.user?.role !== "admin") {
        return { codeRequired: false, verified: false };
      }
      return {
        codeRequired: !!ENV.adminSecret,
        verified: ctx.adminCodeVerified,
      };
    }),
    /** אימות קוד מנהל – מגדיר cookie לגישה ל-admin */
    verifyCode: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(({ ctx, input }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_CODE_MSG });
        }
        if (!ENV.adminSecret) return { success: true };
        if (input.code !== ENV.adminSecret) {
          throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_CODE_MSG });
        }
        ctx.res.cookie(ADMIN_VERIFIED_COOKIE, "1", {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 24 * 60 * 60 * 1000,
        });
        return { success: true };
      }),
    getUsers: adminProcedure.query(() => getAllUsers()),
    getAllSubmissions: adminProcedure.query(() => getAllSubmissions()),
    /** מספר טפסים ממתינים – להתראה ולבאדג׳ */
    getPendingSubmissionsCount: adminProcedure.query(() => getPendingSubmissionsCount()),
    approveSubmission: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await updateSubmissionStatus(input.id, "approved", ctx.user!.id);
        await updateSubmissionPayment(input.id, "completed");
        const sub = await getSubmissionById(input.id);
        if (sub) {
          const user = await getUserById(sub.userId);
          const tournament = await getTournamentById(sub.tournamentId);
          if (user?.agentId && tournament && !(await hasCommissionForSubmission(input.id))) {
            const commissionAmount = calcAgentCommission(tournament.amount, ENV.agentCommissionPercentOfFee);
            await recordAgentCommission({
              agentId: user.agentId,
              submissionId: input.id,
              userId: sub.userId,
              entryAmount: tournament.amount,
              commissionAmount,
            });
          }
        }
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} approved submission #${input.id} (תשלום סומן – הקופה עודכנה)`);
        return { success: true };
      }),
    rejectSubmission: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await updateSubmissionStatus(input.id, "rejected");
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} rejected submission #${input.id}`);
        return { success: true };
      }),
    markPayment: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["pending", "completed", "failed"]) }))
      .mutation(async ({ input }) => {
        await updateSubmissionPayment(input.id, input.status);
        return { success: true };
      }),
    updateMatchResult: adminProcedure
      .input(z.object({ matchId: z.number(), homeScore: z.number(), awayScore: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await updateMatchResult(input.matchId, input.homeScore, input.awayScore);
        const matches = await getMatches();
        const results = new Map<number, { homeScore: number; awayScore: number }>();
        for (const m of matches) {
          if (m.homeScore != null && m.awayScore != null) results.set(m.id, { homeScore: m.homeScore, awayScore: m.awayScore });
        }
        const subs = await getAllSubmissions();
        for (const s of subs) {
          const preds = s.predictions as Array<{ matchId: number; prediction: "1" | "X" | "2" }>;
          const pts = calcSubmissionPoints(preds, results);
          await updateSubmissionPoints(s.id, pts);
        }
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} updated match #${input.matchId} result: ${input.homeScore}-${input.awayScore}`);
        return { success: true };
      }),
    lockTournament: adminProcedure
      .input(z.object({ tournamentId: z.number(), isLocked: z.boolean() }))
      .mutation(async ({ input }) => {
        await setTournamentLocked(input.tournamentId, input.isLocked);
        return { success: true };
      }),
    createTournament: adminProcedure
      .input(z.object({ name: z.string().min(1), amount: z.number().int().min(1) }))
      .mutation(async ({ input }) => {
        await createTournament({ name: input.name, amount: input.amount });
        return { success: true };
      }),
    deleteTournament: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteTournament(input.id);
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} deleted tournament #${input.id}`);
        return { success: true };
      }),
    deleteSubmission: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteSubmission(input.id);
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} deleted submission #${input.id}`);
        return { success: true };
      }),
    deleteUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteUser(input.id);
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} deleted user #${input.id}`);
        return { success: true };
      }),
    createAgent: adminProcedure
      .input(z.object({
        username: z.string().min(3),
        phone: z.string().min(9, "מספר טלפון חובה (לפחות 9 ספרות)"),
        password: z.string().min(6),
        name: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const passwordHash = await hashPassword(input.password);
        const agent = await dbCreateAgent({
          username: input.username,
          phone: input.phone,
          passwordHash,
          name: input.name,
        });
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} created agent ${agent.username} (id=${agent.id}, code=${agent.referralCode})`);
        return { agent: { id: agent.id, username: agent.username, phone: agent.phone, referralCode: agent.referralCode } };
      }),
    getAgents: adminProcedure.query(() => getAgents()),
    /** רשימת כל השחקנים הרשומים לאתר – שם, טלפון, סוכן אם נרשם דרך סוכן */
    getPlayers: adminProcedure.query(async () => {
      const users = await getAllUsers();
      const agents = await getAgents();
      const agentMap = new Map(agents.map((a) => [a.id, a]));
      const players = users
        .filter((u) => u.role === "user")
        .map((u) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          phone: u.phone,
          createdAt: u.createdAt,
          agentId: u.agentId ?? null,
          agentUsername: u.agentId ? (agentMap.get(u.agentId) as { username?: string | null } | undefined)?.username ?? null : null,
        }));
      return { players, totalUsers: users.length };
    }),
    getAgentReport: adminProcedure
      .input(z.object({ agentId: z.number().optional() }).optional().default({}))
      .query(async ({ input }) => {
        const agents = input?.agentId ? [await getUserById(input.agentId)].filter(Boolean) : await getAgents();
        const reports: Array<{
          agentId: number;
          username: string | null;
          referralCode: string | null;
          referredUsers: number;
          totalEntryAmount: number;
          totalCommission: number;
          commissions: Array<{ submissionId: number; userId: number; entryAmount: number; commissionAmount: number; createdAt: Date | null }>;
        }> = [];
        for (const agent of agents) {
          if (!agent || agent.role !== "agent") continue;
          const referred = await getUsersByAgentId(agent.id);
          const commissions = await getAgentCommissionsByAgentIdExistingOnly(agent.id);
          const totalCommission = commissions.reduce((s, c) => s + c.commissionAmount, 0);
          const totalEntryAmount = commissions.reduce((s, c) => s + c.entryAmount, 0);
          reports.push({
            agentId: agent.id,
            username: agent.username,
            referralCode: agent.referralCode,
            referredUsers: referred.length,
            totalEntryAmount,
            totalCommission,
            commissions: commissions.map((c) => ({
              submissionId: c.submissionId,
              userId: c.userId,
              entryAmount: c.entryAmount,
              commissionAmount: c.commissionAmount,
              createdAt: c.createdAt,
            })),
          });
        }
        return reports;
      }),
  }),

  agent: router({
    getMyReport: protectedProcedure.query(async ({ ctx }) => {
      if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
      const agentId = ctx.user!.id;
      const agent = await getUserById(agentId);
      const referred = await getUsersByAgentId(agentId);
      const commissions = await getAgentCommissionsByAgentIdExistingOnly(agentId);
      const totalCommission = commissions.reduce((s, c) => s + c.commissionAmount, 0);
      const totalEntryAmount = commissions.reduce((s, c) => s + c.entryAmount, 0);
      return {
        referralCode: agent?.referralCode ?? null,
        referredUsers: referred.length,
        referredList: referred.map((u) => ({ id: u.id, username: u.username, phone: u.phone, createdAt: u.createdAt })),
        totalEntryAmount,
        totalCommission,
        commissions: commissions.map((c) => ({
          submissionId: c.submissionId,
          userId: c.userId,
          entryAmount: c.entryAmount,
          commissionAmount: c.commissionAmount,
          createdAt: c.createdAt,
        })),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
