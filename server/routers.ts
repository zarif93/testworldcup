import { COOKIE_NAME, ADMIN_VERIFIED_COOKIE, SUPER_ADMIN_USERNAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";
import { systemRouter } from "./_core/systemRouter";
import { emitPointsUpdate } from "./_core/pointsSocket";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { registerUser, loginUser } from "./auth";
import { hashPassword, verifyPassword } from "./auth";
import {
  upsertSubmission,
  getAllSubmissions,
  getSubmissionById,
  getSubmissionsByTournament,
  getSubmissionsByUserId,
  getSubmissionByUserAndTournament,
  updateSubmissionStatus,
  updateSubmissionPayment,
  updateSubmissionPoints,
  getTournaments,
  getActiveTournaments,
  getTournamentById,
  getTournamentByDrawCode,
  getTournamentByDrawDateAndTime,
  isChanceDrawClosed,
  getMatches,
  getMatchById,
  updateMatchResult,
  updateMatchDetails,
  setTournamentLocked,
  createTournament,
  deleteTournament,
  getAllUsers,
  getAdmins,
  insertAdminAuditLog,
  getAdminAuditLogs,
  createAdminUserBySuperAdmin,
  deleteAdmin,
  updateAdmin,
  updateUserPassword,
  getFinancialTransparency,
  getAdminFinancialReport,
  getFinancialRecords,
  getFinancialRecordById,
  getFinancialSummary,
  deleteAllFinancialRecords,
  getTournamentPublicStats,
  getPendingSubmissionsCount,
  getSiteSettings,
  setSiteSetting,
  getChanceDrawResult,
  setChanceDrawResult,
  lockChanceDrawResult,
  getChanceLeaderboard,
  isChancePredictionsValid,
  getLottoDrawResult,
  setLottoDrawResult,
  lockLottoDrawResult,
  getLottoLeaderboard,
  isLottoPredictionsValid,
  deleteSubmission,
  deleteAllSubmissions,
  deleteUser,
  getUsersList,
  setUserBlocked,
  createAgent as dbCreateAgent,
  getAgents,
  getAgentCommissionsByAgentId,
  getAgentCommissionsByAgentIdExistingOnly,
  getAgentCommissionsByAgentIdWithDateRange,
  getUsersByAgentId,
  getUserByUsername,
  getUserById,
  recordAgentCommission,
  hasCommissionForSubmission,
  calcAgentCommission,
  getCustomFootballMatches,
  addCustomFootballMatch,
  updateCustomFootballMatchResult,
  updateCustomFootballMatch,
  deleteCustomFootballMatch,
  recalcCustomFootballPoints,
  getCustomFootballLeaderboard,
  getCustomFootballMatchById,
  getOrCreateVirtualUser,
  insertAutoSubmission,
  deductUserPoints,
  addUserPoints,
  getPointsLogsForAdmin,
  getUserPoints,
  deleteAllPointsLogsHistory,
  distributePrizesForTournament,
  getPointsHistory,
  insertTransparencyLog,
  getTransparencySummary,
  getTransparencyLog,
  deleteAllTransparencyLog,
  agentWithdrawFromPlayer,
  agentDepositToPlayer,
  getAgentWalletStats,
  getMyPlayersWithBalances,
  getAgentTransferLog,
  recordAdminDepositToAgent,
  getAgentBalanceSummary,
  getAdminBalanceSummary,
  getAgentsWithBalances,
  getPlayerPnL,
  getAgentPnL,
  getAgentPlayersPnL,
  getAdminPnLSummary,
  fullResetForSuperAdmin,
  hideTournamentFromHomepage,
  restoreTournamentToHomepage,
} from "./db";
import { pnLSummaryToCsv, agentPnLToCsv, playerPnLToCsv, commissionReportToCsv, pointsLogsToCsv } from "./csvExport";
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

/** רק סופר מנהל (Yoven!) – ליצירה/מחיקה/עריכת מנהלים */
const superAdminProcedure = adminProcedure.use(({ ctx, next }) => {
  const username = (ctx.user as { username?: string }).username;
  if (!username || !ENV.superAdminUsernames.includes(username)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "רק סופר מנהל יכול לבצע פעולה זו" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      const username = (u as { username?: string }).username;
      const isSuperAdmin = !!(u.role === "admin" && username && ENV.superAdminUsernames.includes(username));
      return { ...u, isSuperAdmin };
    }),
    /** היסטוריית תנועות נקודות של המשתמש המחובר – אופציונלי טווח תאריכים */
    getPointsHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).optional(), from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getPointsHistory(ctx.user.id, { limit: input?.limit ?? 100, from: input?.from, to: input?.to });
      }),
    /** דוח רווח והפסד למשתמש המחובר (שחקן) – טווח תאריכים */
    getPlayerPnL: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getPlayerPnL(ctx.user.id, { from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
      }),
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
    getAll: publicProcedure.query(({ ctx }) =>
      ctx.user?.role === "admin" ? getTournaments() : getActiveTournaments()
    ),
    getPublicStats: publicProcedure.query(({ ctx }) =>
      getTournamentPublicStats(true)
    ),
    getById: publicProcedure.input(z.object({ id: z.coerce.number() })).query(async ({ input }) => {
      const t = await getTournamentById(input.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      return t;
    }),
    getCustomFootballMatches: publicProcedure.input(z.object({ tournamentId: z.number() })).query(async ({ input }) => {
      const t = await getTournamentById(input.tournamentId);
      if (!t || (t as { type?: string }).type !== "football_custom") return [];
      return getCustomFootballMatches(input.tournamentId);
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
          matchId: z.coerce.number(),
          prediction: z.enum(["1", "X", "2"]),
        })).optional(),
        predictionsChance: z.object({
          heart: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
          club: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
          diamond: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
          spade: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
        }).optional(),
        predictionsLotto: z.object({
          numbers: z.array(z.number().int().min(1).max(37)).length(6).refine((n) => new Set(n).size === 6, "6 מספרים ייחודיים 1–37"),
          strongNumber: z.number().int().min(1).max(7),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
        const tournamentStatus = (tournament as { status?: string }).status;
        if (tournamentStatus !== "OPEN") throw new TRPCError({ code: "BAD_REQUEST", message: "התחרות לא פתוחה לשליחת טפסים" });
        if (tournament.isLocked) throw new TRPCError({ code: "BAD_REQUEST", message: "הטורניר נעול – לא ניתן לשלוח או לערוך ניחושים" });
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const cost = tournament.amount;
        const isAdmin = user.role === "admin";
        const hasEnoughPoints = isAdmin || ((user.points ?? 0) >= cost);
        const submissionStatus = hasEnoughPoints ? "approved" as const : "pending" as const;
        const paymentStatus = hasEnoughPoints ? "completed" as const : "pending" as const;
        const agentId = (user as { agentId?: number })?.agentId;
        const participationCommissionOpts =
          hasEnoughPoints && !isAdmin && cost > 0 && agentId
            ? (() => {
                const fee = Math.round(cost * (12.5 / 100));
                const commissionAgent = calcAgentCommission(cost, ENV.agentCommissionPercentOfFee);
                return { commissionAgent, commissionSite: fee - commissionAgent, agentId };
              })()
            : undefined;
        const runDeduction = () => {
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            return deductUserPoints(ctx.user!.id, cost, "participation", {
              referenceId: input.tournamentId,
              description: `השתתפות בתחרות: ${(tournament as { name?: string }).name ?? input.tournamentId}`,
              ...participationCommissionOpts,
            });
          }
          return Promise.resolve(true);
        };

        const existing = await getSubmissionByUserAndTournament(ctx.user.id, input.tournamentId);
        const isNewOrPending = !existing || existing.status === "pending";
        const runDeductionIfNeeded = () => {
          if (hasEnoughPoints && !isAdmin && cost > 0 && isNewOrPending) {
            return deductUserPoints(ctx.user!.id, cost, "participation", {
              referenceId: input.tournamentId,
              description: `השתתפות בתחרות: ${(tournament as { name?: string }).name ?? input.tournamentId}`,
              ...participationCommissionOpts,
            });
          }
          return Promise.resolve(true);
        };
        // בתחרות מונדיאל (וכדורגל): כל עוד הטורניר פתוח – משתמש יכול לערוך את הטופס גם אחרי אישור מנהל. כשהטורניר נעול העריכה חסומה למעלה.
        // בצ'אנס/לוטו אין שינוי: עדיין מאפשרים שליחה/עדכון כל עוד הטורניר פתוח.

        if (input.predictionsChance) {
          if ((tournament as { type?: string }).type !== "chance") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "תחרות זו אינה צ'אנס" });
          }
          if (isChanceDrawClosed((tournament as { drawDate?: string }).drawDate, (tournament as { drawTime?: string }).drawTime)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "ההרשמה להגרלה נסגרה" });
          }
          const deducted = await runDeductionIfNeeded();
          if (!deducted) throw new TRPCError({ code: "BAD_REQUEST", message: "אין מספיק נקודות להשתתפות" });
          await upsertSubmission({
            userId: ctx.user.id,
            username: ctx.user.username || ctx.user.name || "משתמש",
            tournamentId: input.tournamentId,
            predictions: input.predictionsChance,
            status: submissionStatus,
            paymentStatus,
          });
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: (user as { agentId?: number })?.agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: Math.round(cost * 0.125) - (participationCommissionOpts?.commissionAgent ?? 0),
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts) {
            const sub = await getSubmissionByUserAndTournament(ctx.user.id, input.tournamentId);
            if (sub && !(await hasCommissionForSubmission(sub.id))) {
              await recordAgentCommission({ agentId, submissionId: sub.id, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
            }
          }
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            const balance = await getUserPoints(ctx.user!.id);
            emitPointsUpdate([{ userId: ctx.user!.id, balance, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          return { success: true, pendingApproval: !hasEnoughPoints };
        }

        if (input.predictionsLotto) {
          if ((tournament as { type?: string }).type !== "lotto") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "תחרות זו אינה לוטו" });
          }
          const lotto = input.predictionsLotto;
          if (!isLottoPredictionsValid(lotto)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "יש לבחור בדיוק 6 מספרים שונים (1–37) ומספר חזק אחד (1–7)" });
          }
          const deducted = await runDeductionIfNeeded();
          if (!deducted) throw new TRPCError({ code: "BAD_REQUEST", message: "אין מספיק נקודות להשתתפות" });
          await upsertSubmission({
            userId: ctx.user.id,
            username: ctx.user.username || ctx.user.name || "משתמש",
            tournamentId: input.tournamentId,
            predictions: { numbers: lotto.numbers, strongNumber: lotto.strongNumber },
            status: submissionStatus,
            paymentStatus,
          });
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: (user as { agentId?: number })?.agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: Math.round(cost * 0.125) - (participationCommissionOpts?.commissionAgent ?? 0),
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts) {
            const sub = await getSubmissionByUserAndTournament(ctx.user.id, input.tournamentId);
            if (sub && !(await hasCommissionForSubmission(sub.id))) {
              await recordAgentCommission({ agentId, submissionId: sub.id, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
            }
          }
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            const balance = await getUserPoints(ctx.user!.id);
            emitPointsUpdate([{ userId: ctx.user!.id, balance, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          return { success: true, pendingApproval: !hasEnoughPoints };
        }

        const predictions = input.predictions;
        if (!predictions || predictions.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "יש למלא ניחושים או לבחור 4 קלפים (צ'אנס)" });
        }
        const tType = (tournament as { type?: string }).type;
        if (tType === "football_custom") {
          const customMatches = await getCustomFootballMatches(input.tournamentId);
          if (customMatches.length === 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "אין משחקים בתחרות זו" });
          }
          if (predictions.length !== customMatches.length) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `יש למלא ניחוש לכל ${customMatches.length} המשחקים` });
          }
          const matchIds = new Set(customMatches.map((m) => m.id));
          for (const p of predictions) {
            const mid = Number(p.matchId);
            if (!matchIds.has(mid)) throw new TRPCError({ code: "BAD_REQUEST", message: "משחק לא תקין" });
          }
          const deducted = await runDeductionIfNeeded();
          if (!deducted) throw new TRPCError({ code: "BAD_REQUEST", message: "אין מספיק נקודות להשתתפות" });
          await upsertSubmission({
            userId: ctx.user.id,
            username: ctx.user.username || ctx.user.name || "משתמש",
            tournamentId: input.tournamentId,
            predictions,
            status: submissionStatus,
            paymentStatus,
          });
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: (user as { agentId?: number })?.agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: Math.round(cost * 0.125) - (participationCommissionOpts?.commissionAgent ?? 0),
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts) {
            const sub = await getSubmissionByUserAndTournament(ctx.user.id, input.tournamentId);
            if (sub && !(await hasCommissionForSubmission(sub.id))) {
              await recordAgentCommission({ agentId, submissionId: sub.id, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
            }
          }
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            const balance = await getUserPoints(ctx.user!.id);
            emitPointsUpdate([{ userId: ctx.user!.id, balance, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          return { success: true, pendingApproval: !hasEnoughPoints };
        }
        const matches = await getMatches();
        if (predictions.length !== matches.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "יש למלא ניחוש לכל 72 המשחקים" });
        }
        const matchIds = new Set(matches.map((m) => m.id));
        for (const p of predictions) {
          const mid = Number(p.matchId);
          if (!matchIds.has(mid)) throw new TRPCError({ code: "BAD_REQUEST", message: "משחק לא תקין" });
        }
        const deducted = await runDeductionIfNeeded();
        if (!deducted) throw new TRPCError({ code: "BAD_REQUEST", message: "אין מספיק נקודות להשתתפות" });
        await upsertSubmission({
          userId: ctx.user.id,
          username: ctx.user.username || ctx.user.name || "משתמש",
          tournamentId: input.tournamentId,
          predictions,
          status: submissionStatus,
          paymentStatus,
        });
        if (hasEnoughPoints && !isAdmin && cost > 0) {
          await insertTransparencyLog({
            competitionId: input.tournamentId,
            competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
            userId: ctx.user.id,
            username: ctx.user.username || ctx.user.name || "משתמש",
            agentId: (user as { agentId?: number })?.agentId ?? null,
            type: "Deposit",
            amount: cost,
            siteProfit: Math.round(cost * 0.125) - (participationCommissionOpts?.commissionAgent ?? 0),
            agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
            transactionDate: new Date(),
            competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
          });
        }
        if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts) {
          const sub = await getSubmissionByUserAndTournament(ctx.user.id, input.tournamentId);
          if (sub && !(await hasCommissionForSubmission(sub.id))) {
            await recordAgentCommission({ agentId, submissionId: sub.id, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
          }
        }
        if (hasEnoughPoints && !isAdmin && cost > 0) {
          const balance = await getUserPoints(ctx.user!.id);
          emitPointsUpdate([{ userId: ctx.user!.id, balance, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
        }
        return { success: true, pendingApproval: !hasEnoughPoints };
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
    getChanceLeaderboard: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getChanceLeaderboard(input.tournamentId)),
    getLottoLeaderboard: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getLottoLeaderboard(input.tournamentId)),
    getCustomFootballLeaderboard: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getCustomFootballLeaderboard(input.tournamentId)),
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
    getFinancialReport: adminProcedure.query(() => getAdminFinancialReport()),
    /** Data – רשומות כספיות לצמיתות (לפי טווח תאריכים) */
    getDataFinancialRecords: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const from = input?.from ? new Date(input.from + "T00:00:00.000Z") : undefined;
        const to = input?.to ? new Date(input.to + "T23:59:59.999Z") : undefined;
        return getFinancialRecords({ from, to });
      }),
    getDataFinancialRecordDetail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getFinancialRecordById(input.id)),
    /** סיכום כספי: הכנסות, החזרים, רווח נקי – מאותו דאטה לצמיתות */
    getDataFinancialSummary: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const from = input?.from ? new Date(input.from + "T00:00:00.000Z") : undefined;
        const to = input?.to ? new Date(input.to + "T23:59:59.999Z") : undefined;
        return getFinancialSummary({ from, to });
      }),
    /** מחיקת כל היסטוריה פיננסית – רק סופר מנהל (Yoven!), עם אימות סיסמה. מתועד בלוג. */
    deleteFinancialHistory: superAdminProcedure
      .input(z.object({ password: z.string().min(1, "נא להזין סיסמה") }))
      .mutation(async ({ ctx, input }) => {
        const u = await getUserById(ctx.user!.id);
        if (!u?.passwordHash) throw new TRPCError({ code: "FORBIDDEN", message: "אין סיסמה למשתמש זה" });
        const valid = await verifyPassword(input.password, u.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "סיסמה שגויה" });
        await deleteAllFinancialRecords();
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Delete Financial History",
          targetUserId: null,
          details: null,
        });
        return { success: true };
      }),
    /** שקיפות כספים – סיכום לוג ארכיון */
    getTransparencySummary: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const from = input?.from ? new Date(input.from + "T00:00:00.000Z") : undefined;
        const to = input?.to ? new Date(input.to + "T23:59:59.999Z") : undefined;
        return getTransparencySummary({ from, to });
      }),
    /** שקיפות כספים – פירוט עם סינון */
    getTransparencyLog: adminProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        competitionId: z.number().optional(),
        userId: z.number().optional(),
        agentId: z.number().optional(),
        type: z.enum(["Deposit", "Prize", "Commission", "Refund", "Bonus", "Adjustment"]).optional(),
        search: z.string().optional(),
        sortBy: z.enum(["amount", "transactionDate"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        limit: z.number().int().min(1).max(2000).optional(),
        offset: z.number().int().min(0).optional(),
      }).optional())
      .query(async ({ input }) => {
        const from = input?.from ? new Date(input.from + "T00:00:00.000Z") : undefined;
        const to = input?.to ? new Date(input.to + "T23:59:59.999Z") : undefined;
        return getTransparencyLog({
          from,
          to,
          competitionId: input?.competitionId,
          userId: input?.userId,
          agentId: input?.agentId,
          type: input?.type,
          search: input?.search,
          sortBy: input?.sortBy,
          sortOrder: input?.sortOrder,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),
    /** מחיקת כל לוג שקיפות כספים – רק סופר מנהל: סיסמה + הקלדת DELETE FOREVER. מתועד בלוג. */
    deleteTransparencyHistory: superAdminProcedure
      .input(z.object({
        password: z.string().min(1, "נא להזין סיסמה"),
        confirmPhrase: z.string().refine((v) => v === "DELETE FOREVER", { message: "יש להקליד DELETE FOREVER לאישור" }),
      }))
      .mutation(async ({ ctx, input }) => {
        const u = await getUserById(ctx.user!.id);
        if (!u?.passwordHash) throw new TRPCError({ code: "FORBIDDEN", message: "אין סיסמה למשתמש זה" });
        const valid = await verifyPassword(input.password, u.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "סיסמה שגויה" });
        await deleteAllTransparencyLog();
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Delete Transparency Log (Full History)",
          targetUserId: null,
          details: { confirmPhrase: input.confirmPhrase },
        });
        return { success: true };
      }),
    /** ניקוי מלא של האתר – מוחק כל משתמשים (חוץ מסופר מנהל), תחרויות, טפסים, נקודות, דוחות. רק סופר מנהל. דורש סיסמה + הקלדת אימות. */
    fullReset: superAdminProcedure
      .input(z.object({
        password: z.string().min(1, "נא להזין סיסמה"),
        confirmPhrase: z.string().min(1, "יש להקליד את צמד המילים לאישור"),
      }))
      .mutation(async ({ ctx, input }) => {
        const CONFIRM_PHRASE = "ניקוי מלא";
        if (input.confirmPhrase !== CONFIRM_PHRASE) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `יש להקליד בדיוק: ${CONFIRM_PHRASE}` });
        }
        const u = await getUserById(ctx.user!.id);
        if (!u?.passwordHash) throw new TRPCError({ code: "FORBIDDEN", message: "אין סיסמה למשתמש זה" });
        const valid = await verifyPassword(input.password, u.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "סיסמה שגויה" });
        const result = await fullResetForSuperAdmin();
        logger.info("Full reset executed", { by: (ctx.user as { username?: string })?.username ?? ctx.user!.id, keptAdminUsernames: result.keptAdminUsernames, deletedUsers: result.deletedUsers });
        return { success: true, keptAdminUsernames: result.keptAdminUsernames, deletedUsers: result.deletedUsers };
      }),
    depositPoints: adminProcedure
      .input(z.object({ userId: z.number(), amount: z.number().int().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await addUserPoints(input.userId, input.amount, "deposit", { performedBy: ctx.user!.id, description: "הפקדה על ידי מנהל" });
        const u = await getUserById(input.userId);
        if ((u as { role?: string })?.role === "agent") {
          await recordAdminDepositToAgent(input.userId, input.amount, ctx.user!.id);
        }
        await insertTransparencyLog({
          competitionId: 0,
          competitionName: "מנהל – הפקדה",
          userId: input.userId,
          username: (u as { username?: string })?.username ?? `#${input.userId}`,
          type: "Bonus",
          amount: input.amount,
          siteProfit: 0,
          agentProfit: 0,
          transactionDate: new Date(),
          createdBy: ctx.user!.id,
        });
        const balance = await getUserPoints(input.userId);
        const performedByUser = await getUserById(ctx.user!.id);
        emitPointsUpdate([{ userId: input.userId, balance, actionType: "deposit", amount: input.amount, performedByUsername: (performedByUser as { username?: string })?.username ?? null, note: "הפקדה על ידי מנהל" }]);
        logger.info("Admin deposit points", { targetUserId: input.userId, amount: input.amount, by: (ctx.user as { username?: string })?.username ?? ctx.user!.id });
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Deposit Points",
          targetUserId: input.userId,
          details: { amount: input.amount },
        });
        return { success: true };
      }),
    withdrawPoints: adminProcedure
      .input(z.object({ userId: z.number(), amount: z.number().int().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserById(input.userId);
        const current = user?.points ?? 0;
        if (current < input.amount) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "יתרת הנקודות נמוכה מהסכום למשיכה" });
        }
        await deductUserPoints(input.userId, input.amount, "withdraw", { performedBy: ctx.user!.id, description: "משיכה על ידי מנהל" });
        await insertTransparencyLog({
          competitionId: 0,
          competitionName: "מנהל – משיכה",
          userId: input.userId,
          username: (user as { username?: string })?.username ?? `#${input.userId}`,
          type: "Adjustment",
          amount: -input.amount,
          siteProfit: 0,
          agentProfit: 0,
          transactionDate: new Date(),
          createdBy: ctx.user!.id,
        });
        const balance = await getUserPoints(input.userId);
        const performedByUser = await getUserById(ctx.user!.id);
        emitPointsUpdate([{ userId: input.userId, balance, actionType: "withdraw", amount: -input.amount, performedByUsername: (performedByUser as { username?: string })?.username ?? null, note: "משיכה על ידי מנהל" }]);
        logger.info("Admin withdraw points", { targetUserId: input.userId, amount: input.amount, by: (ctx.user as { username?: string })?.username ?? ctx.user!.id });
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Withdraw Points",
          targetUserId: input.userId,
          details: { amount: input.amount },
        });
        return { success: true };
      }),
    getPointsLogs: adminProcedure
      .input(
        z
          .object({
            userId: z.number().optional(),
            tournamentId: z.number().optional(),
            agentId: z.number().optional(),
            actionType: z.string().optional(),
            limit: z.number().int().min(1).max(500).optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .default({})
      )
      .query(async ({ input }) =>
        getPointsLogsForAdmin({
          userId: input.userId,
          tournamentId: input.tournamentId,
          agentId: input.agentId,
          actionType: input.actionType,
          limit: input.limit,
          from: input.from,
          to: input.to,
        })
      ),
    getBalanceSummary: adminProcedure.query(() => getAdminBalanceSummary()),
    getAgentsWithBalances: adminProcedure.query(() => getAgentsWithBalances()),
    /** דוח רווח והפסד – סיכום כל השחקנים והסוכנים עם טווח תאריכים */
    getPnLSummary: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(({ input }) => getAdminPnLSummary({ from: input?.from, to: input?.to, tournamentType: input?.tournamentType })),
    /** דוח רווח והפסד לשחקן מסוים (מנהל) */
    getPlayerPnL: adminProcedure
      .input(z.object({ userId: z.number().int(), from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }))
      .query(({ input }) => getPlayerPnL(input.userId, { from: input.from, to: input.to, tournamentType: input.tournamentType })),
    /** דוח רווח והפסד לסוכן מסוים (מנהל) */
    getAgentPnL: adminProcedure
      .input(z.object({ agentId: z.number().int(), from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }))
      .query(({ input }) => getAgentPnL(input.agentId, { from: input.from, to: input.to, tournamentType: input.tournamentType })),
    /** ייצוא CSV – סיכום רווח/הפסד (מנהל) */
    exportPnLSummaryCSV: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const data = await getAdminPnLSummary({ from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
        return { csv: pnLSummaryToCsv(data) };
      }),
    /** ייצוא CSV – דוח רווח/הפסד סוכן (מנהל) */
    exportAgentPnLCSV: adminProcedure
      .input(z.object({ agentId: z.number().int(), from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }))
      .query(async ({ input }) => {
        const data = await getAgentPnL(input.agentId, { from: input.from, to: input.to, tournamentType: input.tournamentType });
        return { csv: agentPnLToCsv(data.transactions, data.profit, data.loss, data.net) };
      }),
    /** ייצוא CSV – דוח רווח/הפסד שחקן (מנהל) */
    exportPlayerPnLCSV: adminProcedure
      .input(z.object({ userId: z.number().int(), from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }))
      .query(async ({ input }) => {
        const data = await getPlayerPnL(input.userId, { from: input.from, to: input.to, tournamentType: input.tournamentType });
        return { csv: playerPnLToCsv(data.transactions, data.profit, data.loss, data.net) };
      }),
    /** ייצוא CSV – לוג תנועות נקודות (מנהל) עם פילטרים */
    exportPointsLogsCSV: adminProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          tournamentId: z.number().optional(),
          agentId: z.number().optional(),
          actionType: z.string().optional(),
          limit: z.number().int().min(1).max(2000).optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const rows = await getPointsLogsForAdmin({
          userId: input.userId,
          tournamentId: input.tournamentId,
          agentId: input.agentId,
          actionType: input.actionType,
          limit: input.limit ?? 2000,
          from: input.from,
          to: input.to,
        });
        const userIds = new Set<number>();
        const agentIds = new Set<number>();
        for (const r of rows) {
          userIds.add(r.userId);
          if (r.agentId != null) agentIds.add(r.agentId);
        }
        const userMap = new Map<number, string>();
        const agentMap = new Map<number, string>();
        for (const id of userIds) {
          const u = await getUserById(id);
          const name = (u as { username?: string })?.username ?? (u as { name?: string })?.name ?? `#${id}`;
          userMap.set(id, name);
        }
        for (const id of agentIds) {
          if (userMap.has(id)) {
            agentMap.set(id, userMap.get(id)!);
          } else {
            const u = await getUserById(id);
            agentMap.set(id, (u as { username?: string })?.username ?? (u as { name?: string })?.name ?? `#${id}`);
          }
        }
        const csv = pointsLogsToCsv(
          rows,
          (userId) => userMap.get(userId) ?? `#${userId}`,
          (agentId) => agentMap.get(agentId) ?? `#${agentId}`
        );
        return { csv };
      }),
    deletePointsLogsHistory: superAdminProcedure.mutation(async ({ ctx }) => {
      await deleteAllPointsLogsHistory();
      await insertAdminAuditLog({
        performedBy: ctx.user!.id,
        action: "Delete Points Logs History",
        targetUserId: null,
        details: null,
      });
      return { success: true };
    }),
    distributePrizes: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await distributePrizesForTournament(input.tournamentId);
        const winnerIds = result.winnerIds ?? [];
        if (winnerIds.length > 0 && result.prizePerWinner > 0) {
          const performedByUser = await getUserById(ctx.user!.id);
          const payloads = await Promise.all(
            winnerIds.map(async (userId) => ({
              userId,
              balance: await getUserPoints(userId),
              actionType: "prize" as const,
              amount: result.prizePerWinner,
              performedByUsername: (performedByUser as { username?: string })?.username ?? null,
              note: "זכייה בתחרות",
            }))
          );
          emitPointsUpdate(payloads);
        }
        logger.info("Prizes distributed", {
          tournamentId: input.tournamentId,
          by: (ctx.user as { username?: string })?.username ?? ctx.user!.id,
          winnerCount: result.winnerCount ?? 0,
          prizePerWinner: result.prizePerWinner ?? 0,
        });
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Distribute Prizes",
          targetUserId: null,
          details: { tournamentId: input.tournamentId, winnerCount: result.winnerCount ?? 0, prizePerWinner: result.prizePerWinner ?? 0 },
        });
        return result;
      }),
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
            await insertTransparencyLog({
              competitionId: sub.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(sub.tournamentId),
              userId: sub.userId,
              username: sub.username ?? `#${sub.userId}`,
              agentId: user.agentId,
              type: "Commission",
              amount: commissionAmount,
              siteProfit: 0,
              agentProfit: commissionAmount,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
              createdBy: ctx.user!.id,
            });
          }
        }
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} approved submission #${input.id} (תשלום סומן – הקופה עודכנה)`);
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Approve Submission",
          targetUserId: sub?.userId ?? null,
          details: { submissionId: input.id, tournamentId: sub?.tournamentId ?? null },
        });
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
          const preds = s.predictions as unknown;
          if (!Array.isArray(preds) || !preds.every((p: unknown) => p && typeof (p as { matchId?: number }).matchId === "number")) continue;
          const pts = calcSubmissionPoints(preds as Array<{ matchId: number; prediction: "1" | "X" | "2" }>, results);
          await updateSubmissionPoints(s.id, pts);
        }
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} updated match #${input.matchId} result: ${input.homeScore}-${input.awayScore}`);
        return { success: true };
      }),
    updateMatch: adminProcedure
      .input(z.object({
        matchId: z.number(),
        homeTeam: z.string().min(1).optional(),
        awayTeam: z.string().min(1).optional(),
        groupName: z.string().optional(),
        matchDate: z.string().optional(),
        matchTime: z.string().optional(),
        stadium: z.string().optional(),
        city: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { matchId, ...data } = input;
        await updateMatchDetails(matchId, data);
        return { success: true };
      }),
    lockTournament: adminProcedure
      .input(z.object({ tournamentId: z.number(), isLocked: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await setTournamentLocked(input.tournamentId, input.isLocked);
        if (input.isLocked) {
          await insertAdminAuditLog({
            performedBy: ctx.user!.id,
            action: "Lock Tournament",
            targetUserId: null,
            details: { tournamentId: input.tournamentId, removalInMinutes: 5 },
          });
        }
        return { success: true };
      }),
    hideTournamentFromHomepage: adminProcedure
      .input(z.object({ id: z.coerce.number() }))
      .mutation(async ({ input, ctx }) => {
        const ip = (ctx.req as { headers?: { "x-forwarded-for"?: string }; socket?: { remoteAddress?: string } })?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
          ?? (ctx.req as { socket?: { remoteAddress?: string } })?.socket?.remoteAddress ?? undefined;
        const result = await hideTournamentFromHomepage(input.id, ctx.user!.id, { ip });
        if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        return { success: true };
      }),
    restoreTournamentToHomepage: adminProcedure
      .input(z.object({ id: z.coerce.number() }))
      .mutation(async ({ input, ctx }) => {
        const ip = (ctx.req as { headers?: { "x-forwarded-for"?: string }; socket?: { remoteAddress?: string } })?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
          ?? (ctx.req as { socket?: { remoteAddress?: string } })?.socket?.remoteAddress ?? undefined;
        const result = await restoreTournamentToHomepage(input.id, ctx.user!.id, { ip });
        if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        return { success: true };
      }),
    createTournament: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        amount: z.number().int().min(1),
        description: z.string().optional(),
        type: z.enum(["football", "football_custom", "lotto", "chance", "custom"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        maxParticipants: z.number().int().min(1).nullable().optional(),
        prizeDistribution: z.record(z.string(), z.number()).nullable().optional(),
        drawCode: z.string().optional(),
        drawDate: z.string().optional(),
        drawTime: z.string().optional(),
        customIdentifier: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.type === "lotto" && (!input.drawCode || !String(input.drawCode).trim())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "בתחרות לוטו חובה להזין מזהה תחרות (לעדכון תוצאות בהמשך)" });
        }
        if (input.type === "chance") {
          if (!input.drawDate?.trim() || !input.drawTime?.trim()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "בתחרות צ'אנס חובה לבחור תאריך ושעת הגרלה" });
          }
          const existing = await getTournamentByDrawDateAndTime(input.drawDate.trim(), input.drawTime.trim());
          if (existing) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "כבר קיימת תחרות צ'אנס באותו תאריך ובאותה שעה. בחר שעה או תאריך אחר." });
          }
        }
        await createTournament({
          name: input.name,
          amount: input.amount,
          description: input.description,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          maxParticipants: input.maxParticipants ?? undefined,
          prizeDistribution: input.prizeDistribution ?? undefined,
          drawCode: input.drawCode?.trim() || undefined,
          drawDate: input.type === "chance" ? input.drawDate?.trim() : undefined,
          drawTime: input.type === "chance" ? input.drawTime?.trim() : undefined,
          customIdentifier: input.customIdentifier?.trim() || undefined,
        });
        return { success: true };
      }),
    deleteTournament: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const refund = await deleteTournament(input.id);
        logger.info("Admin deleted tournament", { tournamentId: input.id, by: ctx.user!.username ?? ctx.user!.id, refundedCount: refund.refundedCount, totalRefunded: refund.totalRefunded });
        if (refund.refundedUserIds?.length && refund.amountPerUser) {
          const performedByUser = await getUserById(ctx.user!.id);
          const payloads = await Promise.all(
            refund.refundedUserIds.map(async (userId) => ({
              userId,
              balance: await getUserPoints(userId),
              actionType: "refund" as const,
              amount: refund.amountPerUser ?? 0,
              performedByUsername: (performedByUser as { username?: string })?.username ?? null,
              note: "החזר בשל ביטול תחרות",
            }))
          );
          emitPointsUpdate(payloads);
        }
        return { success: true, ...refund };
      }),
    getCustomFootballMatches: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getCustomFootballMatches(input.tournamentId)),
    addCustomFootballMatch: adminProcedure
      .input(z.object({
        tournamentId: z.number(),
        homeTeam: z.string().min(1),
        awayTeam: z.string().min(1),
        matchDate: z.string().optional(),
        matchTime: z.string().optional(),
        displayOrder: z.number().optional(),
      }))
      .mutation(({ input }) => addCustomFootballMatch(input)),
    updateCustomFootballMatchResult: adminProcedure
      .input(z.object({ matchId: z.number(), homeScore: z.number(), awayScore: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const match = await getCustomFootballMatchById(input.matchId);
        if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "משחק לא נמצא" });
        await updateCustomFootballMatchResult(input.matchId, input.homeScore, input.awayScore);
        await recalcCustomFootballPoints(match.tournamentId);
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} updated custom football match #${input.matchId}`);
        return { success: true };
      }),
    updateCustomFootballMatch: adminProcedure
      .input(z.object({
        matchId: z.number(),
        homeTeam: z.string().min(1).optional(),
        awayTeam: z.string().min(1).optional(),
        matchDate: z.string().optional().nullable(),
        matchTime: z.string().optional().nullable(),
      }))
      .mutation(({ input }) => updateCustomFootballMatch(input.matchId, input)),
    deleteCustomFootballMatch: adminProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(({ input }) => deleteCustomFootballMatch(input.matchId)),
    recalcCustomFootballPoints: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await recalcCustomFootballPoints(input.tournamentId);
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} recalculated points for tournament #${input.tournamentId}`);
        return { success: true };
      }),
    getCustomFootballLeaderboard: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getCustomFootballLeaderboard(input.tournamentId)),
    getSiteSettings: adminProcedure.query(() => getSiteSettings()),
    setSiteSetting: adminProcedure
      .input(z.object({ key: z.string().min(1), value: z.string() }))
      .mutation(async ({ input }) => {
        await setSiteSetting(input.key, input.value);
        return { success: true };
      }),

    getChanceDrawResult: adminProcedure
      .input(z.object({ tournamentId: z.number().optional(), drawCode: z.string().optional() }).refine((d) => d.tournamentId != null || (d.drawCode != null && d.drawCode.trim() !== ""), { message: "נדרש מזהה תחרות או בחירת תחרות" }))
      .query(async ({ input }) => {
        let tid = input.tournamentId;
        if (tid == null && input.drawCode?.trim()) {
          const t = await getTournamentByDrawCode(input.drawCode.trim());
          if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "לא נמצאה תחרות עם מזהה זה" });
          tid = t.id;
        }
        if (tid == null) throw new TRPCError({ code: "BAD_REQUEST" });
        const result = await getChanceDrawResult(tid);
        return { ...result, tournamentId: tid };
      }),
    updateChanceResults: adminProcedure
      .input(z.object({
        tournamentId: z.number().optional(),
        drawCode: z.string().optional(),
        heartCard: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
        clubCard: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
        diamondCard: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
        spadeCard: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
        drawDate: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        let tid = input.tournamentId;
        if (tid == null && input.drawCode?.trim()) {
          const t = await getTournamentByDrawCode(input.drawCode.trim());
          if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "לא נמצאה תחרות עם מזהה זה" });
          tid = t.id;
        }
        if (tid == null) throw new TRPCError({ code: "BAD_REQUEST", message: "נדרש מזהה תחרות או בחירת תחרות" });
        await setChanceDrawResult(
          tid,
          {
            heartCard: input.heartCard,
            clubCard: input.clubCard,
            diamondCard: input.diamondCard,
            spadeCard: input.spadeCard,
            drawDate: input.drawDate,
          },
          ctx.user.id
        );
        return { success: true };
      }),
    lockChanceDraw: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .mutation(async ({ input }) => {
        await lockChanceDrawResult(input.tournamentId);
        return { success: true };
      }),
    getLottoDrawResult: adminProcedure
      .input(z.object({ tournamentId: z.number().optional(), drawCode: z.string().optional() }).refine((d) => d.tournamentId != null || (d.drawCode != null && d.drawCode.trim() !== ""), { message: "נדרש מזהה תחרות או בחירת תחרות" }))
      .query(async ({ input }) => {
        let tid = input.tournamentId;
        if (tid == null && input.drawCode?.trim()) {
          const t = await getTournamentByDrawCode(input.drawCode.trim());
          if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "לא נמצאה תחרות עם מזהה זה" });
          tid = t.id;
        }
        if (tid == null) throw new TRPCError({ code: "BAD_REQUEST" });
        const result = await getLottoDrawResult(tid);
        return { ...result, tournamentId: tid };
      }),
    updateLottoResults: adminProcedure
      .input(z.object({
        tournamentId: z.number().optional(),
        drawCode: z.string().optional(),
        num1: z.number().int().min(1).max(37),
        num2: z.number().int().min(1).max(37),
        num3: z.number().int().min(1).max(37),
        num4: z.number().int().min(1).max(37),
        num5: z.number().int().min(1).max(37),
        num6: z.number().int().min(1).max(37),
        strongNumber: z.number().int().min(1).max(7),
        drawDate: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        let tid = input.tournamentId;
        if (tid == null && input.drawCode?.trim()) {
          const t = await getTournamentByDrawCode(input.drawCode.trim());
          if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "לא נמצאה תחרות עם מזהה זה" });
          tid = t.id;
        }
        if (tid == null) throw new TRPCError({ code: "BAD_REQUEST", message: "נדרש מזהה תחרות או בחירת תחרות" });
        await setLottoDrawResult(
          tid,
          {
            num1: input.num1,
            num2: input.num2,
            num3: input.num3,
            num4: input.num4,
            num5: input.num5,
            num6: input.num6,
            strongNumber: input.strongNumber,
            drawDate: input.drawDate,
          },
          ctx.user.id
        );
        return { success: true };
      }),
    lockLottoDraw: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .mutation(async ({ input }) => {
        await lockLottoDrawResult(input.tournamentId);
        return { success: true };
      }),
    /** מילוי אוטומטי של ניחושים – רק למנהל. יוצר N טפסים עם שמות אמינים (כמו משתמשים אמיתיים). */
    createAutoSubmissions: adminProcedure
      .input(z.object({
        tournamentId: z.number(),
        count: z.number().int().min(1).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "טורניר לא נמצא" });
        const tType = (tournament as { type?: string }).type ?? "football";
        const virtualUserId = await getOrCreateVirtualUser();
        const usernames: string[] = [];
        const usedNames = new Set<string>();

        const FIRST_NAMES = ["Amit", "Noa", "Daniel", "Yael", "Omer", "Lior", "Shira", "Eitan", "Maya", "Roi", "Tamar", "Ido", "Neta", "Guy", "Roni", "Tal", "Bar", "Yuval", "Dana", "Ran", "Keren", "Eyal", "Michal", "Itay", "Adi", "Gal", "Or", "Shai", "Liran", "Hila"];
        const LAST_NAMES = ["Cohen", "Levi", "Shapiro", "Mizrahi", "Peretz", "Biton", "Dahan", "Avraham", "Friedman", "Golan", "Katz", "Weiss", "Azulay", "Ben David", "Gross", "Hasson", "Israeli", "Jaffe", "Klein", "Lavi", "Mor", "Nissan", "Oz", "Perez", "Rosen", "Sade", "Tal", "Vaknin", "Zohar", "Ashkenazi"];

        const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
        const shuffle = <T>(arr: T[]): T[] => {
          const out = [...arr];
          for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
          }
          return out;
        };

        function generateRealisticName(): string {
          const first = pick(FIRST_NAMES);
          const last = pick(LAST_NAMES);
          const addNumber = Math.random() < 0.25;
          let name: string;
          if (addNumber) {
            const num = Math.floor(Math.random() * 99) + 1;
            const lastInitial = last.charAt(0).toUpperCase();
            name = `${first}${lastInitial}${num}`;
          } else {
            name = `${first} ${last}`;
          }
          if (usedNames.has(name)) {
            const suffix = Math.floor(Math.random() * 900) + 100;
            name = `${name} ${suffix}`;
          }
          usedNames.add(name);
          return name;
        }

        const CHOICES = ["1", "X", "2"] as const;
        const CHANCE_CARDS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;

        for (let i = 0; i < input.count; i++) {
          const displayName = generateRealisticName();
          usernames.push(displayName);
          if (tType === "football") {
            const matches = await getMatches();
            const predictions = matches.map((m) => ({
              matchId: m.id,
              prediction: pick(CHOICES),
            }));
            await insertAutoSubmission({
              userId: virtualUserId,
              username: displayName,
              tournamentId: input.tournamentId,
              predictions,
            });
          } else if (tType === "football_custom") {
            const customMatches = await getCustomFootballMatches(input.tournamentId);
            if (customMatches.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "אין משחקים בתחרות זו" });
            const predictions = customMatches.map((m) => ({
              matchId: m.id,
              prediction: pick(CHOICES),
            }));
            await insertAutoSubmission({
              userId: virtualUserId,
              username: displayName,
              tournamentId: input.tournamentId,
              predictions,
            });
          } else if (tType === "chance") {
            const predictions = {
              heart: pick(CHANCE_CARDS),
              club: pick(CHANCE_CARDS),
              diamond: pick(CHANCE_CARDS),
              spade: pick(CHANCE_CARDS),
            };
            await insertAutoSubmission({
              userId: virtualUserId,
              username: displayName,
              tournamentId: input.tournamentId,
              predictions,
            });
          } else if (tType === "lotto") {
            const numbers = shuffle(Array.from({ length: 37 }, (_, i) => i + 1)).slice(0, 6).sort((a, b) => a - b);
            const strongNumber = Math.floor(Math.random() * 7) + 1;
            await insertAutoSubmission({
              userId: virtualUserId,
              username: displayName,
              tournamentId: input.tournamentId,
              predictions: { numbers, strongNumber },
            });
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "סוג טורניר לא נתמך למילוי אוטומטי" });
          }
        }
        if (tType === "football" || tType === "football_custom") {
          const matches = tType === "football" ? await getMatches() : await getCustomFootballMatches(input.tournamentId);
          const results = new Map<number, { homeScore: number; awayScore: number }>();
          for (const m of matches) {
            const hm = m as { homeScore?: number | null; awayScore?: number | null };
            if (hm.homeScore != null && hm.awayScore != null) results.set(m.id, { homeScore: hm.homeScore, awayScore: hm.awayScore });
          }
          if (results.size > 0) {
            const subs = await getSubmissionsByTournament(input.tournamentId);
            for (const s of subs) {
              const preds = s.predictions as unknown;
              if (Array.isArray(preds) && preds.every((p: unknown) => p && typeof (p as { matchId?: number }).matchId === "number")) {
                const pts = calcSubmissionPoints(preds as Array<{ matchId: number; prediction: "1" | "X" | "2" }>, results);
                await updateSubmissionPoints(s.id, pts);
              }
            }
          }
        }
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} created ${input.count} auto submissions for tournament #${input.tournamentId}`);
        return {
          created: input.count,
          usernames,
          tournamentId: input.tournamentId,
          leaderboardPath: "/leaderboard",
        };
      }),
    deleteSubmission: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteSubmission(input.id);
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} deleted submission #${input.id}`);
        return { success: true };
      }),
    deleteAllSubmissions: adminProcedure
      .mutation(async ({ ctx }) => {
        const count = await deleteAllSubmissions();
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} deleted all submissions (${count} forms)`);
        return { success: true, deletedCount: count };
      }),
    deleteUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteUser(input.id);
        console.log(`[Admin] ${ctx.user!.username ?? ctx.user!.id} deleted user #${input.id}`);
        return { success: true };
      }),
    getAdmins: superAdminProcedure.query(() => getAdmins()),
    createAdmin: superAdminProcedure
      .input(z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        name: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const passwordHash = await hashPassword(input.password);
        const created = await createAdminUserBySuperAdmin({
          username: input.username,
          passwordHash,
          name: input.name,
        });
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "יצירת מנהל נכשלה" });
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "create_admin",
          targetUserId: created.id,
          details: { username: created.username },
        });
        return { admin: { id: created.id, username: created.username } };
      }),
    deleteAdmin: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteAdmin(input.id, ctx.user!.id);
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "delete_admin",
          targetUserId: input.id,
        });
        return { success: true };
      }),
    updateAdmin: superAdminProcedure
      .input(z.object({
        id: z.number(),
        password: z.string().min(6).optional(),
        username: z.string().min(3).optional(),
        name: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const updates: { passwordHash?: string; username?: string; name?: string } = {};
        if (input.password != null) updates.passwordHash = await hashPassword(input.password);
        if (input.username != null) updates.username = input.username;
        if (input.name != null) updates.name = input.name;
        if (Object.keys(updates).length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "לא צוין שדה לעדכון" });
        await updateAdmin(input.id, updates);
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "update_admin",
          targetUserId: input.id,
          details: { fields: Object.keys(updates) },
        });
        return { success: true };
      }),
    getAdminAuditLogs: superAdminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(({ input }) => getAdminAuditLogs(input?.limit ?? 100)),
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
          points: (u as { points?: number }).points ?? 0,
          createdAt: u.createdAt,
          agentId: u.agentId ?? null,
          agentUsername: u.agentId ? (agentMap.get(u.agentId) as { username?: string | null } | undefined)?.username ?? null : null,
        }));
      return { players, totalUsers: users.length };
    }),
    /** רשימת כל המשתמשים (כולל סוכנים) לניהול – עם סינון לפי Role וסטטיסטיקות סוכן */
    getUsersList: adminProcedure
      .input(z.object({ role: z.enum(["user", "admin", "agent"]).optional(), includeDeleted: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return getUsersList({ role: input?.role, includeDeleted: input?.includeDeleted });
      }),
    /** חסימה / ביטול חסימה למשתמש – לא חל על מנהלים */
    setUserBlocked: adminProcedure
      .input(z.object({ userId: z.number(), isBlocked: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await setUserBlocked(input.userId, input.isBlocked);
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: input.isBlocked ? "Block User" : "Unblock User",
          targetUserId: input.userId,
          details: { isBlocked: input.isBlocked },
        });
        return { success: true };
      }),
    /** שינוי סיסמה למשתמש – רק מנהל. הסיסמה נשמרת מוצפנת; הפעולה מתועדת בלוג. */
    resetUserPassword: adminProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(6, "סיסמה לפחות 6 תווים") }))
      .mutation(async ({ ctx, input }) => {
        const passwordHash = await hashPassword(input.newPassword);
        await updateUserPassword(input.userId, passwordHash);
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Reset Password",
          targetUserId: input.userId,
          details: null,
        });
        return { success: true };
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
    getCommissionReport: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        return getAgentCommissionsByAgentIdWithDateRange(ctx.user!.id, { from: input?.from, to: input?.to, limit: input?.limit });
      }),
    /** ייצוא CSV – דוח עמלות (סוכן) */
    exportCommissionReportCSV: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        const { rows, totalCommission } = await getAgentCommissionsByAgentIdWithDateRange(ctx.user!.id, { from: input?.from, to: input?.to, limit: input?.limit ?? 500 });
        const typed = rows.map((r) => ({
          id: r.id,
          submissionId: r.submissionId,
          userId: r.userId,
          username: r.username ?? null,
          name: r.name ?? null,
          entryAmount: r.entryAmount,
          commissionAmount: r.commissionAmount,
          createdAt: r.createdAt ?? null,
          tournamentId: (r as { tournamentId?: number }).tournamentId,
          tournamentName: (r as { tournamentName?: string | null }).tournamentName ?? null,
        }));
        return { csv: commissionReportToCsv(typed, totalCommission) };
      }),
    /** ייצוא CSV – דוח רווח/הפסד סוכן (סוכן עצמו) */
    exportAgentPnLCSV: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        const data = await getAgentPnL(ctx.user!.id, { from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
        return { csv: agentPnLToCsv(data.transactions, data.profit, data.loss, data.net) };
      }),
    getWallet: protectedProcedure.query(async ({ ctx }) => {
      if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
      const agentId = ctx.user!.id;
      const [stats, players, balanceSummary] = await Promise.all([
        getAgentWalletStats(agentId),
        getMyPlayersWithBalances(agentId),
        getAgentBalanceSummary(agentId),
      ]);
      return { ...stats, players, totalPlayersBalance: balanceSummary.totalPlayersBalance };
    }),
    withdrawFromPlayer: protectedProcedure
      .input(z.object({ playerId: z.number(), amount: z.number().int().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        const result = await agentWithdrawFromPlayer(ctx.user!.id, input.playerId, input.amount, ctx.user!.id);
        if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", message: result.error ?? "משיכה נכשלה" });
        const [agentBalance, playerBalance] = await Promise.all([getUserPoints(ctx.user!.id), getUserPoints(input.playerId)]);
        const agentUsername = (ctx.user as { username?: string }).username ?? null;
        emitPointsUpdate([
          { userId: ctx.user!.id, balance: agentBalance, actionType: "withdraw", amount: input.amount, performedByUsername: agentUsername, note: "משיכה משחקן" },
          { userId: input.playerId, balance: playerBalance, actionType: "withdraw", amount: -input.amount, performedByUsername: agentUsername, note: "משיכה על ידי סוכן" },
        ]);
        return { success: true };
      }),
    depositToPlayer: protectedProcedure
      .input(z.object({ playerId: z.number(), amount: z.number().int().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        const result = await agentDepositToPlayer(ctx.user!.id, input.playerId, input.amount, ctx.user!.id);
        if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", message: result.error ?? "הפקדה נכשלה" });
        const [agentBalance, playerBalance] = await Promise.all([getUserPoints(ctx.user!.id), getUserPoints(input.playerId)]);
        const agentUsername = (ctx.user as { username?: string }).username ?? null;
        emitPointsUpdate([
          { userId: ctx.user!.id, balance: agentBalance, actionType: "deposit", amount: -input.amount, performedByUsername: agentUsername, note: "הפקדה לשחקן" },
          { userId: input.playerId, balance: playerBalance, actionType: "deposit", amount: input.amount, performedByUsername: agentUsername, note: "הפקדה מסוכן" },
        ]);
        return { success: true };
      }),
    getTransferLog: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        return getAgentTransferLog(ctx.user!.id, input?.limit ?? 50);
      }),
    getMyPointsHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).optional(), from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        return getPointsHistory(ctx.user!.id, { limit: input?.limit ?? 100, from: input?.from, to: input?.to });
      }),
    /** דוח רווח והפסד לסוכן המחובר – עמלות מול הפקדות לשחקנים */
    getAgentPnL: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        return getAgentPnL(ctx.user!.id, { from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
      }),
    /** דוח רווח והפסד לכל שחקן של הסוכן – לטבלה */
    getAgentPlayersPnL: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        return getAgentPlayersPnL(ctx.user!.id, { from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
      }),
    /** דוח מפורט רווח/הפסד לשחקן של הסוכן (רק שחקנים שלו) */
    getPlayerPnLDetail: protectedProcedure
      .input(z.object({ playerId: z.number().int(), from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        const player = await getUserById(input.playerId);
        if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "שחקן לא נמצא" });
        if ((player as { agentId?: number | null }).agentId !== ctx.user!.id) throw new TRPCError({ code: "FORBIDDEN", message: "השחקן לא משויך לסוכן זה" });
        return getPlayerPnL(input.playerId, { from: input.from, to: input.to, tournamentType: input.tournamentType });
      }),
  }),
});

export type AppRouter = typeof appRouter;
