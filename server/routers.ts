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
  insertSubmission,
  getAllSubmissions,
  getSubmissionById,
  getSubmissionsByTournament,
  getSubmissionsByUserId,
  getSubmissionByUserAndTournament,
  getSubmissionsByUserAndTournament,
  updateSubmissionStatus,
  updateSubmissionPayment,
  updateSubmissionPoints,
  updateSubmissionContent,
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
  updateUserAgentId,
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
  validateTournamentEntry,
  USE_SQLITE,
  executeParticipationWithLock,
  insertLedgerTransaction,
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
  getAdminPnLReportRows,
  getAgentPnLReportRows,
  fullResetForSuperAdmin,
  hideTournamentFromHomepage,
  restoreTournamentToHomepage,
  getLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  softDeleteLeague,
} from "./db";
import { pnLSummaryToCsv, agentPnLToCsv, playerPnLToCsv, commissionReportToCsv, pointsLogsToCsv, adminPnLReportToCsv, agentPnLReportToCsv } from "./csvExport";
import { calcSubmissionPoints } from "./services/scoringService";
import { TRPCError } from "@trpc/server";

type PublicTournamentType = "WORLD_CUP" | "FOOTBALL" | "CHANCE" | "LOTTO";

function normalizeTournamentType(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase();
}

function toPublicTournamentType(t: { type?: unknown }): PublicTournamentType {
  const tType = normalizeTournamentType(t.type);
  if (tType === "chance") return "CHANCE";
  if (tType === "lotto") return "LOTTO";
  if (tType === "football_custom") return "FOOTBALL";
  // default / legacy
  return "WORLD_CUP";
}

function tournamentMatchesPublicType(t: { type?: unknown }, want: PublicTournamentType): boolean {
  const tType = normalizeTournamentType(t.type);
  if (want === "CHANCE") return tType === "chance";
  if (want === "LOTTO") return tType === "lotto";
  if (want === "FOOTBALL") return tType === "football_custom";
  // WORLD_CUP includes default football + legacy tokens
  return tType === "" || tType === "football" || tType === "worldcup" || tType === "world_cup" || tType === "worl d cup";
}

const ADMIN_CODE_MSG = "גישה אסורה – אין הרשאות";

/** Rate limit: מקסימום 30 שליחות טפסים בדקה למשתמש (נגד ספאם/בוטים) */
const SUBMISSIONS_PER_MINUTE = 30;
const submissionTimestampsByUser = new Map<number, number[]>();
function checkSubmissionRateLimit(userId: number): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  let list = submissionTimestampsByUser.get(userId) ?? [];
  list = list.filter((t) => t > windowStart);
  if (list.length >= SUBMISSIONS_PER_MINUTE) return false;
  list.push(now);
  submissionTimestampsByUser.set(userId, list);
  return true;
}

/** Idempotency: מפתח תקף 30 שניות למניעת כפילות בלחיצה כפולה */
const idempotencyStore = new Map<string, { result: { success: boolean; pendingApproval: boolean }; at: number }>();
const IDEMPOTENCY_TTL_MS = 30 * 1000;
function getIdempotencyResult(key: string): { success: boolean; pendingApproval: boolean } | null {
  const entry = idempotencyStore.get(key);
  if (!entry || Date.now() - entry.at > IDEMPOTENCY_TTL_MS) return null;
  return entry.result;
}
function setIdempotencyResult(key: string, result: { success: boolean; pendingApproval: boolean }) {
  idempotencyStore.set(key, { result, at: Date.now() });
  if (idempotencyStore.size > 1000) {
    const now = Date.now();
    Array.from(idempotencyStore.entries()).forEach(([k, v]) => {
      if (now - v.at > IDEMPOTENCY_TTL_MS) idempotencyStore.delete(k);
    });
  }
}

/** Rate limit ל-exports (דוחות CSV): 15 בקשות לדקה למשתמש/IP. מעל – 429 */
const EXPORTS_PER_MINUTE = 15;
const exportTimestampsByKey = new Map<string, number[]>();

type ReqLike = {
  headers?: Record<string, unknown> | undefined;
  socket?: { remoteAddress?: string | undefined } | undefined;
};

function getReqHeader(req: ReqLike | undefined, name: string): string | undefined {
  const headers = req?.headers as Record<string, unknown> | undefined;
  if (!headers) return undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function getReqIp(req: ReqLike | undefined): string | undefined {
  const xff = getReqHeader(req, "x-forwarded-for");
  const ipFromXff = xff?.split(",")[0]?.trim();
  return ipFromXff || req?.socket?.remoteAddress || undefined;
}

function getExportRateLimitKey(ctx: { user?: { id?: number } | null; req?: ReqLike }): string {
  if (ctx.user?.id) return `u:${ctx.user.id}`;
  const ip = getReqIp(ctx.req) ?? "unknown";
  return `ip:${ip}`;
}
function checkExportRateLimit(ctx: { user?: { id?: number } | null; req?: ReqLike }): void {
  const key = getExportRateLimitKey(ctx);
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  let list = exportTimestampsByKey.get(key) ?? [];
  list = list.filter((t) => t > windowStart);
  if (list.length >= EXPORTS_PER_MINUTE) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי ייצואים בדקה – נסה שוב בעוד רגע" });
  }
  list.push(now);
  exportTimestampsByKey.set(key, list);
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_CODE_MSG });
  if (ENV.adminSecret && !ctx.adminCodeVerified) {
    throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_CODE_MSG });
  }
  return next({ ctx });
});

function getAuditIp(ctx: { req?: ReqLike }): string | undefined {
  return getReqIp(ctx.req);
}

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
    /** ייצוא דוח שחקן (CSV) – זמין למנהלים בלבד */
    exportMyPlayerReport: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        checkExportRateLimit(ctx);
        const data = await getPlayerPnL(ctx.user.id, { from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
        const { playerPnLToCsv } = await import("./csvExport");
        return { csv: playerPnLToCsv(data.transactions, data.profit, data.loss, data.net) };
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
          password: z.string().min(8, "סיסמה לפחות 8 תווים"),
        name: z.string().min(1, "שם מלא חובה"),
        referralCode: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { checkLoginRateLimit } = await import("./_core/loginRateLimit");
        if (!checkLoginRateLimit(ctx.req)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי ניסיונות. נסה שוב בעוד דקה." });
        }
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
        const { checkLoginRateLimit } = await import("./_core/loginRateLimit");
        if (!checkLoginRateLimit(ctx.req)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי ניסיונות התחברות. נסה שוב בעוד דקה." });
        }
        const result = await loginUser(input);
          ctx.res.cookie(COOKIE_NAME, result.token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 7 * 24 * 60 * 60 * 1000,
          });
          return result;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const opts = { ...getSessionCookieOptions(ctx.req), maxAge: -1 };
      ctx.res.clearCookie(COOKIE_NAME, opts);
      ctx.res.clearCookie(ADMIN_VERIFIED_COOKIE, opts);
      return { success: true };
    }),
  }),

  tournaments: router({
    getAll: publicProcedure.query(({ ctx }) =>
      ctx.user?.role === "admin" ? getTournaments() : getActiveTournaments()
    ),
    /** תחרויות מסוננות לפי סוג ציבורי (WORLD_CUP | FOOTBALL | CHANCE | LOTTO) */
    getByType: publicProcedure
      .input(z.object({ tournamentType: z.enum(["WORLD_CUP", "FOOTBALL", "CHANCE", "LOTTO"]) }))
      .query(async ({ ctx, input }) => {
        const all = ctx.user?.role === "admin" ? await getTournaments() : await getActiveTournaments();
        return all.filter((t) =>
          tournamentMatchesPublicType(t as { type?: unknown }, input.tournamentType as PublicTournamentType)
        );
      }),
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
        idempotencyKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (input.idempotencyKey) {
          const cached = getIdempotencyResult(input.idempotencyKey);
          if (cached) return cached;
        }
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
        const tournamentStatus = (tournament as { status?: string }).status;
        if (tournamentStatus !== "OPEN") throw new TRPCError({ code: "BAD_REQUEST", message: "התחרות לא פתוחה לשליחת טפסים" });
        const closesAt = (tournament as { closesAt?: Date | null }).closesAt;
        if (closesAt != null && (closesAt instanceof Date ? closesAt.getTime() : Number(closesAt)) <= Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "מועד הסגירה עבר – לא ניתן לשלוח טופס" });
        }
        if (tournament.isLocked) throw new TRPCError({ code: "BAD_REQUEST", message: "הטורניר נעול – לא ניתן לשלוח או לערוך ניחושים" });
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (!checkSubmissionRateLimit(ctx.user.id)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי שליחות בדקה – נסה שוב בעוד רגע" });
        }
        const isAdmin = user.role === "admin";

        const INSUFFICIENT_POINTS_MESSAGE = "אין לך מספיק נקודות להשתתפות בתחרות זו";
        const validation = await validateTournamentEntry(ctx.user.id, tournament, isAdmin);
        if (!validation.allowed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: INSUFFICIENT_POINTS_MESSAGE });
        }
        const cost = validation.cost;
        const hasEnoughPoints = validation.allowed;
        const submissionStatus = hasEnoughPoints ? "approved" as const : "pending" as const;
        const paymentStatus = hasEnoughPoints ? "completed" as const : "pending" as const;
        // כשסוכן שולח טופס – העמלה משויכת אליו (agentId = user.id). כששחקן שולח – לסוכן שלו.
        const agentId: number | null =
          user.role === "agent"
            ? ctx.user.id
            : ((user as { agentId?: number })?.agentId ?? null);
        const participationCommissionOpts =
          hasEnoughPoints && !isAdmin && cost > 0 && agentId
            ? (() => {
                const fee = Math.round(cost * (12.5 / 100));
                const commissionAgent = calcAgentCommission(cost, ENV.agentCommissionPercentOfFee);
                return { commissionAgent, commissionSite: fee - commissionAgent, agentId };
              })()
            : undefined;
        const runDeduction = async () => {
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            return deductUserPoints(ctx.user!.id, cost, "participation", {
              referenceId: input.tournamentId,
              description: `השתתפות בתחרות: ${(tournament as { name?: string }).name ?? input.tournamentId}`,
              ...participationCommissionOpts,
            });
          }
          return true;
        };
        const useTransactionalParticipation = hasEnoughPoints && !isAdmin && cost > 0 && !USE_SQLITE;
        const runParticipationWithLock = async (predictions: unknown, strongHit?: boolean | null) => {
          if (!useTransactionalParticipation) {
            const ok = await runDeduction();
            if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: INSUFFICIENT_POINTS_MESSAGE });
            return { newSubId: await insertSubmission({
              userId: ctx.user!.id,
              username: ctx.user!.username || ctx.user!.name || "משתמש",
              tournamentId: input.tournamentId,
              agentId: agentId ?? null,
              predictions: predictions as never,
              status: submissionStatus,
              paymentStatus,
              strongHit: strongHit ?? undefined,
            }), balanceAfter: await getUserPoints(ctx.user!.id) };
          }
          const result = await executeParticipationWithLock({
            userId: ctx.user!.id,
            username: ctx.user!.username || ctx.user!.name || "משתמש",
            tournamentId: input.tournamentId,
            cost,
            agentId: agentId ?? null,
            predictions,
            status: submissionStatus,
            paymentStatus,
            description: `השתתפות בתחרות: ${(tournament as { name?: string }).name ?? input.tournamentId}`,
            referenceId: input.tournamentId,
            commissionAgent: participationCommissionOpts?.commissionAgent,
            commissionSite: participationCommissionOpts ? Math.round(cost * 0.125) - (participationCommissionOpts.commissionAgent ?? 0) : undefined,
            strongHit: strongHit ?? undefined,
          });
          if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", message: INSUFFICIENT_POINTS_MESSAGE });
          await insertLedgerTransaction({
            actorUserId: null,
            subjectUserId: ctx.user!.id,
            agentId: agentId ?? null,
            tournamentId: input.tournamentId,
            type: "ENTRY_DEBIT",
            amountPoints: -cost,
            balanceAfter: result.balanceAfter,
            metaJson: participationCommissionOpts ? { description: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}`, commissionAgent: participationCommissionOpts.commissionAgent, commissionSite: Math.round(cost * 0.125) - (participationCommissionOpts.commissionAgent ?? 0) } : undefined,
          });
          return { newSubId: result.submissionId, balanceAfter: result.balanceAfter };
        };
    if (input.predictionsChance) {
          if ((tournament as { type?: string }).type !== "chance") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "תחרות זו אינה צ'אנס" });
          }
          if (isChanceDrawClosed((tournament as { drawDate?: string }).drawDate, (tournament as { drawTime?: string }).drawTime)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "ההרשמה להגרלה נסגרה" });
          }
          const { newSubId, balanceAfter } = await runParticipationWithLock(input.predictionsChance);
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: Math.round(cost * 0.125) - (participationCommissionOpts?.commissionAgent ?? 0),
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts && newSubId && !(await hasCommissionForSubmission(newSubId))) {
            await recordAgentCommission({ agentId, submissionId: newSubId, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
          if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
          return result;
        }

        if (input.predictionsLotto) {
          if ((tournament as { type?: string }).type !== "lotto") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "תחרות זו אינה לוטו" });
          }
          const lotto = input.predictionsLotto;
          if (!isLottoPredictionsValid(lotto)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "יש לבחור בדיוק 6 מספרים שונים (1–37) ומספר חזק אחד (1–7)" });
          }
          const { newSubId, balanceAfter } = await runParticipationWithLock({ numbers: lotto.numbers, strongNumber: lotto.strongNumber });
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: Math.round(cost * 0.125) - (participationCommissionOpts?.commissionAgent ?? 0),
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts && newSubId && !(await hasCommissionForSubmission(newSubId))) {
            await recordAgentCommission({ agentId, submissionId: newSubId, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
          if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
          return result;
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
          const { newSubId, balanceAfter } = await runParticipationWithLock(predictions);
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: Math.round(cost * 0.125) - (participationCommissionOpts?.commissionAgent ?? 0),
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts && newSubId && !(await hasCommissionForSubmission(newSubId))) {
            await recordAgentCommission({ agentId, submissionId: newSubId, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
          }
          if (hasEnoughPoints && !isAdmin && cost > 0) {
            emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
          if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
          return result;
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
        const { newSubId, balanceAfter } = await runParticipationWithLock(predictions);
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
        if (hasEnoughPoints && !isAdmin && cost > 0 && agentId && participationCommissionOpts && newSubId && !(await hasCommissionForSubmission(newSubId))) {
          await recordAgentCommission({ agentId, submissionId: newSubId, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
        }
        if (hasEnoughPoints && !isAdmin && cost > 0) {
          emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
        }
        const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
        if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
        return result;
      }),

    /** עריכת טופס קיים – ללא חיוב. רק בעל הטופס או מנהל. רק כשהתחרות OPEN ולא נעולה. */
    update: protectedProcedure
      .input(z.object({
        submissionId: z.number(),
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
      }).refine((data) => {
        const count = [data.predictions, data.predictionsChance, data.predictionsLotto].filter(Boolean).length;
        return count === 1;
      }, { message: "יש לשלוח בדיוק סוג אחד: predictions, predictionsChance או predictionsLotto" }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const submission = await getSubmissionById(input.submissionId);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "טופס לא נמצא" });
        const isOwner = (submission as { userId?: number }).userId === ctx.user!.id;
        const isAdmin = ctx.user!.role === "admin";
        if (!isOwner && !isAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "אין הרשאה לערוך טופס זה" });
        }
        const tournament = await getTournamentById(submission.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "תחרות לא נמצאה" });
        const status = (tournament as { status?: string }).status;
        if (status !== "OPEN") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "אי אפשר לערוך אחרי סגירת התחרות" });
        }
        if (tournament.isLocked) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "הטורניר נעול – לא ניתן לערוך ניחושים" });
        }
        const tType = (tournament as { type?: string }).type;
        let newPredictions: unknown;
        let diffJson: Record<string, unknown>;
        const oldPred = submission.predictions;
        if (input.predictionsChance) {
          if (tType !== "chance") throw new TRPCError({ code: "BAD_REQUEST", message: "תחרות זו אינה צ'אנס" });
          if (isChanceDrawClosed((tournament as { drawDate?: string }).drawDate, (tournament as { drawTime?: string }).drawTime)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "ההרשמה להגרלה נסגרה" });
          }
          newPredictions = input.predictionsChance;
          diffJson = { old: oldPred, new: newPredictions };
        } else if (input.predictionsLotto) {
          if (tType !== "lotto") throw new TRPCError({ code: "BAD_REQUEST", message: "תחרות זו אינה לוטו" });
          if (!isLottoPredictionsValid(input.predictionsLotto)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "יש לבחור בדיוק 6 מספרים שונים (1–37) ומספר חזק אחד (1–7)" });
          }
          newPredictions = input.predictionsLotto;
          diffJson = { old: oldPred, new: newPredictions };
        } else if (input.predictions && input.predictions.length > 0) {
          if (tType === "football_custom") {
            const customMatches = await getCustomFootballMatches(submission.tournamentId);
            if (customMatches.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "אין משחקים בתחרות זו" });
            if (input.predictions.length !== customMatches.length) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `יש למלא ניחוש לכל ${customMatches.length} המשחקים` });
            }
            const matchIds = new Set(customMatches.map((m) => m.id));
            for (const p of input.predictions) {
              if (!matchIds.has(Number(p.matchId))) throw new TRPCError({ code: "BAD_REQUEST", message: "משחק לא תקין" });
            }
          } else {
            const matches = await getMatches();
            if (input.predictions.length !== matches.length) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "יש למלא ניחוש לכל 72 המשחקים" });
            }
            const matchIds = new Set(matches.map((m) => m.id));
            for (const p of input.predictions) {
              if (!matchIds.has(Number(p.matchId))) throw new TRPCError({ code: "BAD_REQUEST", message: "משחק לא תקין" });
            }
          }
          newPredictions = input.predictions;
          diffJson = { old: oldPred, new: newPredictions };
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "יש למלא ניחושים או לבחור 4 קלפים (צ'אנס)" });
        }
        await updateSubmissionContent(
          input.submissionId,
          newPredictions,
          ctx.user!.id,
          ctx.user!.role ?? "user",
          diffJson
        );
        return { success: true, noCharge: true };
      }),

    /** כל הטפסים – מנהל מקבל הכל; משתמש מחובר מקבל רק את שלו. אורח לא מקבל כלום. */
    getAll: publicProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role === "admin") return getAllSubmissions();
      if (ctx.user) return getSubmissionsByUserId(ctx.user.id);
      return [];
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const s = await getSubmissionById(input.id);
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      const ownerId = (s as { userId?: number }).userId;
      const isOwner = ownerId === ctx.user!.id;
      const isAdmin = ctx.user!.role === "admin";
      if (!isOwner && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "אין הרשאה לצפות בטופס זה" });
      }
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
    /** הכניסות שלי לתחרות מסוימת (להצגת "הכניסות שלי" ויכולת לשלוח כניסה נוספת) */
    getMyEntriesForTournament: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getSubmissionsByUserAndTournament(ctx.user.id, input.tournamentId);
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
          details: { ip: getAuditIp(ctx) },
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
          details: { confirmPhrase: input.confirmPhrase, ip: getAuditIp(ctx) },
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
          details: { amount: input.amount, ip: getAuditIp(ctx) },
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
          details: { amount: input.amount, ip: getAuditIp(ctx) },
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
    /** דוח תנועות מלא למנהל – כולל עמלות/זכיות/הפקדות/משיכות/העברות, עם פילטרים */
    getPnLReport: adminProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        tournamentType: z.string().optional(),
        playerId: z.number().int().optional(),
        agentId: z.number().int().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      }).optional())
      .query(async ({ input }) => {
        return getAdminPnLReportRows({
          from: input?.from,
          to: input?.to,
          tournamentType: input?.tournamentType,
          playerId: input?.playerId,
          agentId: input?.agentId,
          limit: input?.limit ?? 2000,
        });
      }),
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
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const data = await getAdminPnLSummary({ from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
        return { csv: pnLSummaryToCsv(data) };
      }),
    /** ייצוא CSV – דוח תנועות מלא (מנהל) */
    exportPnLReportCSV: adminProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        tournamentType: z.string().optional(),
        playerId: z.number().int().optional(),
        agentId: z.number().int().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const rows = await getAdminPnLReportRows({
          from: input?.from,
          to: input?.to,
          tournamentType: input?.tournamentType,
          playerId: input?.playerId,
          agentId: input?.agentId,
          limit: input?.limit ?? 5000,
        });
        return {
          csv: adminPnLReportToCsv(
            rows.map((r) => ({
              id: r.id,
              createdAt: r.createdAt,
              actionType: r.actionType,
              playerName: r.playerName,
              agentName: r.agentName,
              tournamentType: r.tournamentType,
              participationAmount: r.participationAmount,
              prizeAmount: r.prizeAmount,
              siteCommission: r.siteCommission,
              agentCommission: r.agentCommission,
              pointsDelta: r.pointsDelta,
              balanceAfter: r.balanceAfter,
            }))
          ),
        };
      }),
    /** ייצוא CSV – דוח רווח/הפסד סוכן (מנהל) */
    exportAgentPnLCSV: adminProcedure
      .input(z.object({ agentId: z.number().int(), from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const data = await getAgentPnL(input.agentId, { from: input.from, to: input.to, tournamentType: input.tournamentType });
        return { csv: agentPnLToCsv(data.transactions, data.profit, data.loss, data.net) };
      }),
    /** ייצוא CSV – דוח רווח/הפסד שחקן (מנהל) */
    exportPlayerPnLCSV: adminProcedure
      .input(z.object({ userId: z.number().int(), from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
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
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
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
        for (const id of Array.from(userIds)) {
          const u = await getUserById(id);
          const name = (u as { username?: string })?.username ?? (u as { name?: string })?.name ?? `#${id}`;
          userMap.set(id, name);
        }
        for (const id of Array.from(agentIds)) {
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
        details: { ip: getAuditIp(ctx) },
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
          details: { tournamentId: input.tournamentId, winnerCount: result.winnerCount ?? 0, prizePerWinner: result.prizePerWinner ?? 0, ip: getAuditIp(ctx) },
        });
        return result;
      }),
    approveSubmission: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const sub = await getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "טופס לא נמצא" });
        if ((sub as { status?: string }).status === "approved") {
          return { success: true };
        }
        await updateSubmissionStatus(input.id, "approved", ctx.user!.id);
        await updateSubmissionPayment(input.id, "completed");
        const user = await getUserById(sub.userId);
        const tournament = await getTournamentById(sub.tournamentId);
        const effectiveAgentId =
          user?.role === "agent" ? user.id : (user as { agentId?: number | null })?.agentId ?? null;
        if (effectiveAgentId != null && tournament && !(await hasCommissionForSubmission(input.id))) {
          const commissionAmount = calcAgentCommission(tournament.amount, ENV.agentCommissionPercentOfFee);
          await recordAgentCommission({
            agentId: effectiveAgentId,
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
            agentId: effectiveAgentId,
            type: "Commission",
            amount: commissionAmount,
            siteProfit: 0,
            agentProfit: commissionAmount,
            transactionDate: new Date(),
            competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            createdBy: ctx.user!.id,
          });
        }
        logger.info("Approved submission", { submissionId: input.id, userId: sub.userId, tournamentId: sub.tournamentId });
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Approve Submission",
          targetUserId: sub.userId,
          details: { submissionId: input.id, tournamentId: sub.tournamentId, ip: getAuditIp(ctx) },
        });
        return { success: true };
      }),
    rejectSubmission: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const sub = await getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "טופס לא נמצא" });
        if ((sub as { status?: string }).status === "rejected") {
          return { success: true };
        }
        await updateSubmissionStatus(input.id, "rejected");
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Reject Submission",
          targetUserId: sub.userId,
          details: { submissionId: input.id, tournamentId: sub.tournamentId, ip: getAuditIp(ctx) },
        });
        logger.info("Rejected submission", { submissionId: input.id });
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
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Update Match Result",
          targetUserId: null,
          details: { matchId: input.matchId, homeScore: input.homeScore, awayScore: input.awayScore, ip: getAuditIp(ctx) },
        });
        logger.info("Updated match result", { matchId: input.matchId, homeScore: input.homeScore, awayScore: input.awayScore });
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
            details: { tournamentId: input.tournamentId, removalInMinutes: 5, ip: getAuditIp(ctx) },
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
    getLeagues: adminProcedure
      .input(z.object({ includeDisabled: z.boolean().optional() }).optional())
      .query(async ({ input }) => getLeagues({ includeDisabled: input?.includeDisabled })),
    createLeague: adminProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const id = await createLeague(input.name.trim(), ctx.user?.id);
        return { id: id ?? 0 };
      }),
    updateLeague: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), enabled: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await updateLeague(input.id, { name: input.name, enabled: input.enabled });
        return { success: true };
      }),
    softDeleteLeague: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await softDeleteLeague(input.id);
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
        startsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
        endsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
        opensAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
        closesAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
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
          startsAt: input.startsAt ?? undefined,
          endsAt: input.endsAt ?? undefined,
          opensAt: input.opensAt ?? undefined,
          closesAt: input.closesAt ?? undefined,
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
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Delete Tournament",
          targetUserId: null,
          details: { tournamentId: input.id, refundedCount: refund.refundedCount, totalRefunded: refund.totalRefunded, ip: getAuditIp(ctx) },
        });
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
        logger.info("Updated custom football match", { matchId: input.matchId });
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
        logger.info("Recalculated custom football points", { tournamentId: input.tournamentId });
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
        logger.info("Created auto submissions", { count: input.count, tournamentId: input.tournamentId });
          return {
          created: input.count,
          usernames,
          tournamentId: input.tournamentId,
          leaderboardPath: `/leaderboard?tournamentType=${toPublicTournamentType(tournament as { type?: unknown })}&tournamentId=${input.tournamentId}`,
        };
      }),
    deleteSubmission: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteSubmission(input.id);
        logger.info("Deleted submission", { submissionId: input.id });
        return { success: true };
      }),
    deleteAllSubmissions: adminProcedure
      .mutation(async ({ ctx }) => {
        const count = await deleteAllSubmissions();
        logger.info("Deleted all submissions", { deletedCount: count });
        return { success: true, deletedCount: count };
      }),
    deleteUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteUser(input.id);
        logger.info("Deleted user", { userId: input.id });
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
          details: { username: created.username, ip: getAuditIp(ctx) },
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
          details: { ip: getAuditIp(ctx) },
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
          details: { fields: Object.keys(updates), ip: getAuditIp(ctx) },
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
        logger.info("Created agent", { agentId: agent.id, username: agent.username, referralCode: agent.referralCode });
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
          details: { isBlocked: input.isBlocked, ip: getAuditIp(ctx) },
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
          details: { ip: getAuditIp(ctx) },
        });
        return { success: true };
      }),
    /** שיוך שחקן לסוכן או הסרת שיוך – רק מנהל. משפיע על עמלות ודוחות. */
    assignAgent: adminProcedure
      .input(z.object({
        playerId: z.number().int(),
        agentId: z.number().int().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const player = await getUserById(input.playerId);
        if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "שחקן לא נמצא" });
        if (player.role !== "user") throw new TRPCError({ code: "BAD_REQUEST", message: "ניתן לשייך רק שחקן (role=user)" });
        let agentUsername: string | null = null;
        if (input.agentId != null) {
          const agent = await getUserById(input.agentId);
          if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "סוכן לא נמצא" });
          if (agent.role !== "agent") throw new TRPCError({ code: "BAD_REQUEST", message: "המשתמש שנבחר אינו סוכן" });
          agentUsername = (agent as { username?: string | null }).username ?? null;
        }
        await updateUserAgentId(input.playerId, input.agentId);
        const playerUsername = (player as { username?: string | null }).username ?? null;
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: input.agentId != null ? "assign_agent" : "unassign_agent",
          targetUserId: input.playerId,
          details: {
            playerId: input.playerId,
            playerUsername,
            agentId: input.agentId,
            agentUsername,
            at: new Date().toISOString(),
            ip: getAuditIp(ctx),
          },
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
    /** ייצוא CSV – דוח עמלות (מוגבל למנהלים בלבד) */
    exportCommissionReportCSV: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
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
    /** ייצוא CSV – דוח רווח/הפסד סוכן (מוגבל למנהלים בלבד) */
    exportAgentPnLCSV: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), tournamentType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const data = await getAgentPnL(ctx.user!.id, { from: input?.from, to: input?.to, tournamentType: input?.tournamentType });
        return { csv: agentPnLToCsv(data.transactions, data.profit, data.loss, data.net) };
      }),
    /** דוח רווח והפסד משודרג (סוכן): עמלות + תנועות בארנק הסוכן, רק לשחקנים שלו */
    getPnLReport: protectedProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        tournamentType: z.string().optional(),
        playerId: z.number().int().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if ((ctx.user as { role?: string })?.role !== "agent") throw new TRPCError({ code: "FORBIDDEN", message: "גישה לסוכנים בלבד" });
        return getAgentPnLReportRows(ctx.user!.id, {
          from: input?.from,
          to: input?.to,
          tournamentType: input?.tournamentType,
          playerId: input?.playerId,
          limit: input?.limit ?? 2000,
        });
      }),
    /** ייצוא CSV – דוח רווח והפסד משודרג (מוגבל למנהלים בלבד) */
    exportPnLReportCSV: adminProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        tournamentType: z.string().optional(),
        playerId: z.number().int().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const rows = await getAgentPnLReportRows(ctx.user!.id, {
          from: input?.from,
          to: input?.to,
          tournamentType: input?.tournamentType,
          playerId: input?.playerId,
          limit: input?.limit ?? 5000,
        });
        return {
          csv: agentPnLReportToCsv(
            rows.map((r) => ({
              id: r.id,
              createdAt: r.createdAt,
              playerName: r.playerName,
              tournamentType: r.tournamentType,
              participationAmount: r.participationAmount,
              agentCommission: r.agentCommission,
              pointsDelta: r.pointsDelta,
              agentBalanceAfter: r.agentBalanceAfter,
            }))
          ),
        };
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
