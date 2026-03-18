import { COOKIE_NAME, ADMIN_VERIFIED_COOKIE, SUPER_ADMIN_USERNAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { logger, logError } from "./_core/logger";
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
  createPaymentTransaction,
  getPaymentBySubmissionId,
  updatePaymentTransactionStatus,
  getPaymentTransactions,
  getPaymentTransactionById,
  getPaymentReportSummary,
  getPaymentTransactionDetail,
  updateSubmissionPoints,
  updateSubmissionContent,
  getTournaments,
  getActiveTournaments,
  getTournamentById,
  getTournamentDeletedAtMap,
  getTournamentByDrawCode,
  getTournamentByDrawDateAndTime,
  isChanceDrawClosed,
  drawDateAndTimeToTimestamp,
  getCompetitionTypes,
  getCompetitionTypeById,
  getCompetitionTypeByCode,
  getMatches,
  getMatchById,
  updateMatchResult,
  updateMatchDetails,
  setTournamentLocked,
  createTournament,
  deleteTournament,
  updateTournamentCommission,
  isTournamentCompleted,
  refundTournamentParticipants,
  repairUnrefundedCancelledCompetitions,
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
  insertFinancialRecord,
  getFinancialRecordById,
  getFinancialSummary,
  deleteAllFinancialRecords,
  getTournamentPublicStats,
  getMyCompetitionSummary,
  getRecommendedTournamentForUser,
  getPendingSubmissionsCount,
  getSiteSettings,
  setSiteSetting,
  setSiteSettingsBatch,
  getPublicSiteSettings,
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
  updateUserProfile,
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
  getCustomFootballMatches,
  addCustomFootballMatch,
  updateCustomFootballMatchResult,
  updateCustomFootballMatch,
  deleteCustomFootballMatch,
  recalcCustomFootballPoints,
  getCustomFootballLeaderboard,
  getCustomFootballMatchById,
  listTeamLibraryCategories,
  getTeamLibraryCategoryById,
  listTeamLibraryTeams,
  createTeamLibraryTeam,
  updateTeamLibraryTeam,
  deleteTeamLibraryTeam,
  getTeamLibraryTeamById,
  searchTeamLibraryTeamsGlobal,
  getTournamentSettlementWinners,
  getTournamentSettlementPreview,
  getNearWinMessage,
  getRivalStatus,
  getPositionDrama,
  getLossAversionMessage,
  getSocialProofSummary,
  getParticipationStreak,
  getOrCreateVirtualUser,
  insertAutoSubmission,
  deductUserPoints,
  addUserPoints,
  getPointsLogsForAdmin,
  getUserPoints,
  validateTournamentEntry,
  getEntryCostBreakdown,
  USE_SQLITE,
  executeParticipationWithLock,
  insertLedgerTransaction,
  deleteAllPointsLogsHistory,
  distributePrizesForTournament,
  getSettlementComparison,
  getAutomationJobsForTournament,
  listNotifications,
  getNotificationById,
  markNotificationRead,
  getNotificationUnreadCountForRecipient,
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
  fullResetForSuperAdmin,
  hideTournamentFromHomepage,
  restoreTournamentToHomepage,
  getLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  softDeleteLeague,
  getActiveBanners,
  getActiveAnnouncements,
  listContentPages,
  getContentPageBySlug,
  getPublicPageWithSections,
  getPublishedCmsSlugs,
  getContentPageById,
  createContentPage,
  updateContentPage,
  deleteContentPage,
  listContentSections,
  getActiveHomepageSections,
  getContentSectionById,
  createContentSection,
  updateContentSection,
  deleteContentSection,
  listSiteBanners,
  getSiteBannerById,
  createSiteBanner,
  updateSiteBanner,
  deleteSiteBanner,
  listSiteAnnouncements,
  getSiteAnnouncementById,
  createSiteAnnouncement,
  updateSiteAnnouncement,
  deleteSiteAnnouncement,
  listMediaAssets,
  deleteMediaAsset,
  updateMediaAsset,
  listSiteBackgroundImages,
  getActiveSiteBackground,
  setActiveSiteBackground,
  deactivateSiteBackground,
  deleteSiteBackgroundImage,
  listJackpotBackgroundImages,
  getActiveJackpotBackground,
  setActiveJackpotBackground,
  deleteJackpotBackgroundImage,
  duplicateJackpotBackgroundImage,
  reorderJackpotBackgroundImages,
  getJackpotConversionStats,
} from "./db";
import {
  commissionReportToCsv,
  settlementPlayerReportToCsv,
  settlementAgentReportToCsv,
  settlementGlobalReportToCsv,
  settlementFreerollReportToCsv,
  pointsLogsToCsv,
} from "./csvExport";
import { getLegacyTypeFromCompetitionType } from "./competitionTypeUtils";
import { resolveTournamentSchemas, resolveTournamentFormSchema, validateEntryAgainstFormSchema } from "./schema";
import { resolveScoring, getLegacyScoreForContext } from "./scoring/resolveScoring";
import { scoreBySchema } from "./scoring/schemaScoringEngine";
import { resolveTournamentScoringConfig } from "./schema/resolveTournamentSchemas";
import { TRPCError } from "@trpc/server";
import { requirePermission, requireAnyPermission, getEffectivePermissions } from "./rbac";
import * as analyticsDashboard from "./analytics/dashboard";
import { trackTournamentJoin, trackLeaderboardView, trackJackpotCtaClick, trackJackpotHeroView } from "./analytics/events";
import { recordDevice } from "./lib/antiCheat";
import {
  getUserRoles,
  getAllRoles,
  getAllPermissions,
  getRolePermissions,
  assignRoleToUser,
  removeRoleFromUser,
  getCompetitionItemSetsByTournament,
  getCompetitionItemsBySetId,
  createCompetitionItemSet,
  updateCompetitionItemSet,
  deleteCompetitionItemSet,
  createCompetitionItem,
  updateCompetitionItem,
  deleteCompetitionItem,
  reorderCompetitionItems,
  listCompetitionTemplates,
  getCompetitionTemplateById,
  createCompetitionTemplate,
  updateCompetitionTemplate,
  deleteCompetitionTemplate,
  duplicateCompetitionTemplate,
  getTournamentTemplateCategories,
  getTournamentTemplates,
  getTournamentTemplateById,
  createTournamentFromTemplate,
} from "./db";
import { resolveTournamentItems, validateOptionSchema, validateResultSchema, validateMetadataJson } from "./competitionItems";
import { getPlayerSettlementReport, getAgentSettlementReport, getGlobalSettlementReport, getFreerollSettlementReport } from "./finance";

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

/** Phase 12: Rate limits – submissions and leaderboard from _core/rateLimits. */
import { checkSubmissionRateLimit, checkLeaderboardRateLimit } from "./_core/rateLimits";
import { assertTeamLibraryScope } from "./teamLibraryScope";

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

/** Reusable strict schemas for admin/finance/export – prevent injection and unsafe defaults */
const safe = {
  id: z.number().int().positive(),
  idOptional: z.number().int().positive().optional(),
  tournamentId: z.number().int().positive(),
  userId: z.number().int().positive(),
  agentId: z.number().int().positive(),
  limit: (max: number) => z.number().int().min(1).max(max).optional(),
  offset: z.number().int().min(0).optional(),
  /** YYYY-MM-DD only; rejects malformed dates */
  dateFromTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.number().int().min(0).optional(),
};

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

/** RBAC permission middleware; cast to satisfy tRPC MiddlewareResult (internal marker). Runtime unchanged. */
type PermissionMiddleware = Parameters<typeof adminProcedure.use>[0];
const usePermission = (code: string) => requirePermission(code) as PermissionMiddleware;

/** Phase 11: Public CMS read – active banners, announcements, page by slug */
const cmsPublicRouter = router({
  getActiveBanners: publicProcedure
    .input(z.object({ key: z.string().optional() }).optional())
    .query(({ input }) => {
      const key = (typeof input?.key === "string" ? input.key.trim() : undefined) || undefined;
      const result = getActiveBanners(key);
      result.then((banners) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[cms.getActiveBanners] key=%s banners=%d keys=%s", key ?? "(all)", banners.length, banners.map((b) => b.key).join(", "));
        }
      });
      return result;
    }),
  getActiveAnnouncements: publicProcedure.query(() => getActiveAnnouncements()),
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ input }) => getContentPageBySlug(input.slug)),
  getPublicPageWithSections: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ input }) => getPublicPageWithSections(input.slug)),
  /** Active global blocks for homepage (pageId null), optionally by key. Respects isActive and metadataJson startsAt/endsAt. */
  getActiveHomepageSections: publicProcedure
    .input(z.object({ key: z.string().optional() }).optional())
    .query(({ input }) => getActiveHomepageSections(input?.key?.trim() || undefined)),
  /** Slugs that exist and are published (for footer/nav). Default: about, contact, faq, terms, privacy. */
  getPublishedCmsSlugs: publicProcedure
    .input(z.object({ slugs: z.array(z.string()).max(20).optional() }).optional())
    .query(({ input }) => getPublishedCmsSlugs(input?.slugs ?? ["about", "contact", "faq", "terms", "privacy"])),
});

/** Phase 12: Public site settings – global config for frontend (contact, CTA, brand, etc.) */
const settingsPublicRouter = router({
  getPublic: publicProcedure.query(() => getPublicSiteSettings()),
  /** Public Jackpot banner: current balance, next draw, ticket step (no auth required). */
  getJackpotBanner: publicProcedure.query(async () => {
    const { getJackpotSettings } = await import("./jackpot");
    return getJackpotSettings();
  }),
  /** Public last jackpot winners for homepage (no auth). */
  getJackpotLastDraws: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(10).optional() }).optional())
    .query(async ({ input }) => {
      const { getJackpotLastDrawsPublic } = await import("./jackpot");
      return getJackpotLastDrawsPublic(input?.limit ?? 5);
    }),
  /** Active site background image URL for homepage/layout (fallback to null if none). */
  getActiveBackground: publicProcedure.query(async () => getActiveSiteBackground()),
  /** Track Jackpot CTA click (conversion vs background). */
  trackJackpotCtaClick: publicProcedure
    .input(z.object({ backgroundId: z.number().optional() }).optional())
    .mutation(({ input }) => {
      trackJackpotCtaClick({ backgroundId: input?.backgroundId });
      return {};
    }),
  /** Track Jackpot hero view (hero entered viewport – for conversion dashboard). */
  trackJackpotHeroView: publicProcedure
    .input(z.object({ backgroundId: z.number().optional() }).optional())
    .mutation(({ input }) => {
      trackJackpotHeroView({ backgroundId: input?.backgroundId });
      return {};
    }),
  /** Active Jackpot hero background + overlay settings (for JackpotHero only). */
  getActiveJackpotBackground: publicProcedure.query(async () => {
    const active = await getActiveJackpotBackground();
    const settings = await getSiteSettings();
    return {
      active,
      overlayOpacity: Math.min(100, Math.max(0, parseFloat(settings.jackpot_bg_overlay_opacity) || 70)),
      vignetteStrength: Math.min(100, Math.max(0, parseFloat(settings.jackpot_bg_vignette_strength) || 80)),
      fxIntensity: Math.min(100, Math.max(0, parseFloat(settings.jackpot_bg_fx_intensity) || 80)),
      glowStrength: Math.min(100, Math.max(0, parseFloat(settings.jackpot_bg_glow_strength) || 80)),
      intensity: Math.min(100, Math.max(0, parseInt(settings.jackpot_intensity ?? "70", 10) || 70)),
    };
  }),
});

export const appRouter = router({
  system: systemRouter,
  cms: cmsPublicRouter,
  settings: settingsPublicRouter,

  /** Phase 22: User/agent notifications – list mine, mark read, unread count. RBAC: only user/agent see their own. */
  notifications: router({
    listMine: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const role = (ctx.user as { role?: string }).role;
        const recipientType = role === "agent" ? "agent" : "user";
        return listNotifications({
          recipientType,
          recipientId: ctx.user.id,
          limit: input?.limit ?? 50,
          offset: input?.offset ?? 0,
        });
      }),
    getMyUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const role = (ctx.user as { role?: string }).role;
      const recipientType = role === "agent" ? "agent" : "user";
      return getNotificationUnreadCountForRecipient(recipientType, ctx.user.id);
    }),
    getMineById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const n = await getNotificationById(input.id);
        if (!n) return null;
        const role = (ctx.user as { role?: string }).role;
        const recipientType = role === "agent" ? "agent" : "user";
        if (n.recipientType !== recipientType || n.recipientId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "אין גישה להתראה זו" });
        }
        return n;
      }),
    markMineRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const n = await getNotificationById(input.id);
        if (!n) return { success: false };
        const role = (ctx.user as { role?: string }).role;
        const recipientType = role === "agent" ? "agent" : "user";
        if (n.recipientType !== recipientType || n.recipientId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "אין גישה להתראה זו" });
        }
        const ok = await markNotificationRead(input.id);
        return { success: ok };
      }),
  }),

  auth: router({
    me: publicProcedure.query(async (opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      const username = (u as { username?: string }).username;
      const isSuperAdmin = !!(u.role === "admin" && username && ENV.superAdminUsernames.includes(username));
      const permissions = await getEffectivePermissions(u);
      return { ...u, isSuperAdmin, permissions };
    }),
    /** היסטוריית תנועות נקודות של המשתמש המחובר – אופציונלי טווח תאריכים */
    getPointsHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).optional(), from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getPointsHistory(ctx.user.id, { limit: input?.limit ?? 100, from: input?.from, to: input?.to });
      }),
    /** בדיקה אם שם משתמש פנוי – להצגה בטופס הרשמה. Rate limited to reduce enumeration. */
    checkUsername: publicProcedure
      .input(z.object({ username: z.string().min(1).max(64) }))
      .query(async ({ input, ctx }) => {
        const { checkUsernameCheckRateLimit } = await import("./_core/rateLimits");
        if (!checkUsernameCheckRateLimit(ctx.req)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי בדיקות. נסה שוב בעוד דקה." });
        }
        const existing = await getUserByUsername(input.username.trim());
        return { available: !existing };
      }),
    register: publicProcedure
      .input(z.object({
          username: z.string().min(3, "שם משתמש לפחות 3 תווים").max(64, "שם משתמש עד 64 תווים"),
        phone: z.string().min(9).max(20),
          password: z.string().min(6, "סיסמה לפחות 6 תווים"),
        name: z.string().min(1, "שם מלא חובה").max(200, "שם מלא עד 200 תווים"),
        referralCode: z.string().max(64).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { checkRegistrationRateLimit } = await import("./_core/rateLimits");
        if (!checkRegistrationRateLimit(ctx.req)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי הרשמות מדף זה. נסה שוב בעוד דקה." });
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
      .input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { checkLoginRateLimit, recordFailedLogin } = await import("./_core/loginRateLimit");
        if (!checkLoginRateLimit(ctx.req)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי ניסיונות התחברות כושלים. נסה שוב בעוד דקה." });
        }
        try {
          const result = await loginUser(input);
          ctx.res.cookie(COOKIE_NAME, result.token, {
            ...getSessionCookieOptions(ctx.req),
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
          const ip = getReqIp(ctx.req);
          const userAgent = (ctx.req?.headers && (ctx.req.headers["user-agent"] as string)) ?? undefined;
          recordDevice({ userId: result.user.id, ip, userAgent }).catch(() => {});
          return result;
        } catch (err) {
          recordFailedLogin(ctx.req);
          const { securityAudit } = await import("./_core/logger");
          securityAudit("failed_login", { ip: getReqIp(ctx.req), username: input.username.trim() });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "שם משתמש או סיסמה שגויים." });
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const opts = { ...getSessionCookieOptions(ctx.req), maxAge: -1 };
      ctx.res.clearCookie(COOKIE_NAME, opts);
      ctx.res.clearCookie(ADMIN_VERIFIED_COOKIE, opts);
      return { success: true };
    }),
  }),

  /** Phase 34 Step 3: Streak System + Phase 36: First participation status. */
  user: router({
    getParticipationStreak: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getParticipationStreak(ctx.user.id);
    }),
    /** Phase 36/37: First participation + retention (approved count for re-engagement copy). */
    getFirstParticipationStatus: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const subs = await getSubmissionsByUserId(ctx.user.id);
      const approved = subs.filter((s) => (s as { status?: string }).status === "approved");
      return { hasApprovedSubmission: approved.length > 0, approvedCount: approved.length };
    }),
    /** Phase 4: My competition summary for "האזור שלי" – active count, best rank, points, closing soon, top 10. */
    getMyCompetitionSummary: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getMyCompetitionSummary(ctx.user.id);
    }),
    /** Jackpot progress widget: approved play in current cycle, ticket count, amount until next ticket, countdown to draw. */
    getJackpotProgress: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { getJackpotProgress: getProgress } = await import("./jackpot");
      return getProgress(ctx.user.id);
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
    /** Phase 38: Smart recommendation for logged-in user (OPEN, not joined). */
    getRecommendedTournamentForUser: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getRecommendedTournamentForUser(ctx.user.id);
    }),
    getById: publicProcedure.input(z.object({ id: z.coerce.number() })).query(async ({ input }) => {
      const t = await getTournamentById(input.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      const rules = (t as { rulesJson?: unknown }).rulesJson;
      const rulesObj = rules != null && typeof rules === "object" && !Array.isArray(rules) ? (rules as Record<string, unknown>) : {};
      let bannerUrl: string | null = typeof rulesObj.bannerUrl === "string" ? rulesObj.bannerUrl : null;
      if (!bannerUrl && typeof rulesObj.cmsBannerKey === "string" && rulesObj.cmsBannerKey.trim()) {
        try {
          const banners = await getActiveBanners(rulesObj.cmsBannerKey.trim());
          const banner = banners.find((b) => b.key === rulesObj.cmsBannerKey) ?? banners[0];
          if (banner?.imageUrl) bannerUrl = banner.imageUrl;
        } catch {
          // non-fatal: leave bannerUrl null
        }
      }
      return { ...t, bannerUrl };
    }),
    /** Entry cost breakdown: base entry + Jackpot contribution (for registration UI). */
    getEntryCostBreakdown: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ input }) => {
        const t = await getTournamentById(input.tournamentId);
        if (!t) throw new TRPCError({ code: "NOT_FOUND" });
        const entryFeeBase = Number((t as { entryCostPoints?: number }).entryCostPoints ?? (t as { amount?: number }).amount ?? 0);
        return getEntryCostBreakdown(entryFeeBase);
      }),
    /** Phase 3: Resolved form schema for prediction page (dynamic vs legacy form decision). */
    getResolvedFormSchema: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ input }) => {
        const t = await getTournamentById(input.tournamentId);
        if (!t) throw new TRPCError({ code: "NOT_FOUND" });
        const { schema, warnings } = await resolveTournamentFormSchema(t as Parameters<typeof resolveTournamentFormSchema>[0]);
        const legacyType = (() => {
          if (schema.kind === "football_match_predictions") return schema.matchSource === "custom" ? "football_custom" : "football";
          if (schema.kind === "lotto") return "lotto";
          if (schema.kind === "chance") return "chance";
          return "custom";
        })();
        return { formSchema: schema, legacyType, warnings };
      }),
    getCustomFootballMatches: publicProcedure.input(z.object({ tournamentId: z.number() })).query(async ({ input }) => {
      const t = await getTournamentById(input.tournamentId);
      if (!t || (t as { type?: string }).type !== "football_custom") return [];
      return getCustomFootballMatches(input.tournamentId);
    }),
    /** Phase 34 Step 5: Loss Aversion / FOMO – only when joinable and user has not participated. */
    getLossAversionMessage: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getLossAversionMessage(ctx.user.id, input.tournamentId);
      }),
    /** Phase 34 Step 6: Social Proof – public aggregate stats, optional tournamentId. */
    getSocialProofSummary: publicProcedure
      .input(z.object({ tournamentId: z.number().optional() }).optional())
      .query(async ({ input }) => getSocialProofSummary(input?.tournamentId)),
  }),

  /** Phase 2A: competition types (list / get by id or code). Read-only. */
  competitionTypes: router({
    list: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        try {
          return await getCompetitionTypes({ activeOnly: input?.activeOnly });
        } catch (e) {
          logger.warn("competitionTypes.list failed", { error: String(e) });
          return [];
        }
      }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const ct = await getCompetitionTypeById(input.id);
      if (!ct) throw new TRPCError({ code: "NOT_FOUND", message: "Competition type not found" });
      return ct;
    }),
    getByCode: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
      const ct = await getCompetitionTypeByCode(input.code);
      if (!ct) throw new TRPCError({ code: "NOT_FOUND", message: "Competition type not found" });
      return ct;
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
    /** Phase 3: Schema-based validation before submit (for dynamic form path). */
    validateEntrySchema: protectedProcedure
      .input(z.object({ tournamentId: z.number(), payload: z.unknown() }))
      .query(async ({ input }) => {
        const t = await getTournamentById(input.tournamentId);
        if (!t) throw new TRPCError({ code: "NOT_FOUND" });
        const row = t as { competitionTypeId?: number | null; type?: string | null };
        const { schema } = await resolveTournamentFormSchema(row);
        return validateEntryAgainstFormSchema(schema, input.payload);
      }),
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
        idempotencyKey: z.string().max(128).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (input.idempotencyKey) {
          const cached = getIdempotencyResult(input.idempotencyKey);
          if (cached) return cached;
        }
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND" });
        const tournamentStatus = (tournament as { status?: string }).status;
        const tournamentType = (tournament as { type?: string }).type;
        if (tournamentStatus !== "OPEN") {
          const msg = tournamentType === "lotto" ? "ההגרלה נסגרה ולא ניתן לשלוח טפסים" : "התחרות לא פתוחה לשליחת טפסים";
          throw new TRPCError({ code: "BAD_REQUEST", message: msg });
        }
        const closesAt = (tournament as { closesAt?: Date | null }).closesAt;
        if (closesAt != null && (closesAt instanceof Date ? closesAt.getTime() : Number(closesAt)) <= Date.now()) {
          const msg = tournamentType === "lotto" ? "ההגרלה נסגרה ולא ניתן לשלוח טפסים" : "מועד הסגירה עבר – לא ניתן לשלוח טופס";
          throw new TRPCError({ code: "BAD_REQUEST", message: msg });
        }
        if (tournament.isLocked) throw new TRPCError({ code: "BAD_REQUEST", message: "הטורניר נעול – לא ניתן לשלוח או לערוך ניחושים" });
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (!checkSubmissionRateLimit(ctx.user.id)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי שליחות בדקה – נסה שוב בעוד רגע" });
        }
        const hasUnlimitedPoints = !!((user as { unlimitedPoints?: boolean | number }).unlimitedPoints || user.role === "admin");

        const INSUFFICIENT_POINTS_MESSAGE = "אין לך מספיק נקודות להשתתפות בתחרות זו";
        const validation = await validateTournamentEntry(ctx.user.id, tournament, hasUnlimitedPoints);
        if (!validation.allowed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: INSUFFICIENT_POINTS_MESSAGE });
        }
        const cost = validation.cost;
        const entryFee = validation.entryFee;
        const jackpotContribution = validation.jackpotContribution;
        const hasEnoughPoints = validation.allowed;
        const submissionStatus = hasEnoughPoints ? "approved" as const : "pending" as const;
        const paymentStatus = hasEnoughPoints ? "completed" as const : "pending" as const;
        // כשסוכן שולח טופס – העמלה משויכת אליו (agentId = user.id). כששחקן שולח – לסוכן שלו.
        const agentId: number | null =
          user.role === "agent"
            ? ctx.user.id
            : ((user as { agentId?: number })?.agentId ?? null);
        let participationCommissionOpts: { commissionAgent: number; commissionSite: number; agentId: number | null } | undefined;
        if (hasEnoughPoints && !hasUnlimitedPoints && entryFee > 0) {
          const { getCommissionBasisPoints, getAgentShareBasisPoints } = await import("./finance");
          const bps = getCommissionBasisPoints(tournament as { commissionPercentBasisPoints?: number | null; houseFeeRate?: number | null });
          const commissionTotal = Math.floor((entryFee * bps) / 10_000);
          if (agentId) {
            const agentShareBps = await getAgentShareBasisPoints(agentId);
            const commissionAgent = Math.floor((commissionTotal * agentShareBps) / 10_000);
            participationCommissionOpts = { commissionAgent, commissionSite: commissionTotal - commissionAgent, agentId };
          } else {
            participationCommissionOpts = { commissionAgent: 0, commissionSite: commissionTotal, agentId: null };
          }
        }
        const runDeduction = async () => {
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
            return deductUserPoints(ctx.user!.id, cost, "participation", {
              referenceId: input.tournamentId,
              description: `השתתפות בתחרות: ${(tournament as { name?: string }).name ?? input.tournamentId}`,
              ...participationCommissionOpts,
            });
          }
          return true;
        };
        const useTransactionalParticipation = cost > 0;
        const runParticipationWithLock = async (predictions: unknown, strongHit?: boolean | null) => {
          if (!useTransactionalParticipation) {
            const ok = await runDeduction();
            if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: INSUFFICIENT_POINTS_MESSAGE });
            const newSubId = await insertSubmission({
              userId: ctx.user!.id,
              username: ctx.user!.username || ctx.user!.name || "משתמש",
              tournamentId: input.tournamentId,
              agentId: agentId ?? null,
              predictions: predictions as never,
              status: submissionStatus,
              paymentStatus,
              strongHit: strongHit ?? undefined,
            });
            if (submissionStatus === "approved" && newSubId > 0 && entryFee >= 0) {
              const { recordEntryFeeFinancialEvent } = await import("./finance/recordFinancialEvents");
              await recordEntryFeeFinancialEvent({
                submissionId: newSubId,
                tournamentId: input.tournamentId,
                userId: ctx.user!.id,
                agentId: agentId ?? null,
                amountPoints: entryFee,
                payloadJson: participationCommissionOpts && entryFee > 0
                  ? { commissionAmount: participationCommissionOpts.commissionAgent + participationCommissionOpts.commissionSite, agentCommissionAmount: participationCommissionOpts.commissionAgent }
                  : undefined,
              });
            }
            return { newSubId, balanceAfter: await getUserPoints(ctx.user!.id) };
          }
          const result = await executeParticipationWithLock({
            userId: ctx.user!.id,
            username: ctx.user!.username || ctx.user!.name || "משתמש",
            tournamentId: input.tournamentId,
            cost,
            entryFee,
            jackpotContribution,
            skipWalletDeduction: hasUnlimitedPoints,
            agentId: agentId ?? null,
            predictions,
            status: submissionStatus,
            paymentStatus,
            description: `השתתפות בתחרות: ${(tournament as { name?: string }).name ?? input.tournamentId}`,
            referenceId: input.tournamentId,
            commissionAgent: participationCommissionOpts?.commissionAgent,
            commissionSite: participationCommissionOpts?.commissionSite,
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
            metaJson: participationCommissionOpts ? { description: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}`, commissionAgent: participationCommissionOpts.commissionAgent, commissionSite: participationCommissionOpts.commissionSite } : undefined,
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
          if (paymentStatus === "pending" && newSubId) {
            await createPaymentTransaction({ userId: ctx.user!.id, tournamentId: input.tournamentId, submissionId: newSubId, type: "entry_fee", amount: cost, status: "pending", provider: "manual" });
          }
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: participationCommissionOpts?.commissionSite ?? 0,
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          const subId = typeof newSubId === "number" && newSubId > 0 ? newSubId : null;
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0 && agentId && participationCommissionOpts && subId != null && !(await hasCommissionForSubmission(subId))) {
            await recordAgentCommission({ agentId, submissionId: subId, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
          }
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
            emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
          if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
          if (newSubId) trackTournamentJoin(ctx.user!.id, input.tournamentId, { entryCost: cost });
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
          if (paymentStatus === "pending" && newSubId) {
            await createPaymentTransaction({ userId: ctx.user!.id, tournamentId: input.tournamentId, submissionId: newSubId, type: "entry_fee", amount: cost, status: "pending", provider: "manual" });
          }
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: participationCommissionOpts?.commissionSite ?? 0,
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          const subIdLotto = typeof newSubId === "number" && newSubId > 0 ? newSubId : null;
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0 && agentId && participationCommissionOpts && subIdLotto != null && !(await hasCommissionForSubmission(subIdLotto))) {
            await recordAgentCommission({ agentId, submissionId: subIdLotto, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
          }
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
            emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
          if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
          if (newSubId) trackTournamentJoin(ctx.user!.id, input.tournamentId, { entryCost: cost });
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
          if (paymentStatus === "pending" && newSubId) {
            await createPaymentTransaction({ userId: ctx.user!.id, tournamentId: input.tournamentId, submissionId: newSubId, type: "entry_fee", amount: cost, status: "pending", provider: "manual" });
          }
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
            await insertTransparencyLog({
              competitionId: input.tournamentId,
              competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
              userId: ctx.user.id,
              username: ctx.user.username || ctx.user.name || "משתמש",
              agentId: agentId ?? null,
              type: "Deposit",
              amount: cost,
              siteProfit: participationCommissionOpts?.commissionSite ?? 0,
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
          const subIdCustom = typeof newSubId === "number" && newSubId > 0 ? newSubId : null;
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0 && agentId && participationCommissionOpts && subIdCustom != null && !(await hasCommissionForSubmission(subIdCustom))) {
            await recordAgentCommission({ agentId, submissionId: subIdCustom, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
          }
          if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
            emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
          }
          const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
          if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
          if (newSubId) trackTournamentJoin(ctx.user!.id, input.tournamentId, { entryCost: cost });
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
        if (paymentStatus === "pending" && newSubId) {
          await createPaymentTransaction({ userId: ctx.user!.id, tournamentId: input.tournamentId, submissionId: newSubId, type: "entry_fee", amount: cost, status: "pending", provider: "manual" });
        }
        if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
          await insertTransparencyLog({
            competitionId: input.tournamentId,
            competitionName: (tournament as { name?: string }).name ?? String(input.tournamentId),
            userId: ctx.user.id,
            username: ctx.user.username || ctx.user.name || "משתמש",
            agentId: (user as { agentId?: number })?.agentId ?? null,
            type: "Deposit",
            amount: cost,
siteProfit: participationCommissionOpts?.commissionSite ?? 0,
              agentProfit: participationCommissionOpts?.commissionAgent ?? 0,
              transactionDate: new Date(),
              competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
            });
          }
        const subIdDefault = typeof newSubId === "number" && newSubId > 0 ? newSubId : null;
        if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0 && agentId && participationCommissionOpts && subIdDefault != null && !(await hasCommissionForSubmission(subIdDefault))) {
          await recordAgentCommission({ agentId, submissionId: subIdDefault, userId: ctx.user.id, entryAmount: cost, commissionAmount: participationCommissionOpts.commissionAgent });
        }
        if (hasEnoughPoints && !hasUnlimitedPoints && cost > 0) {
          emitPointsUpdate([{ userId: ctx.user!.id, balance: balanceAfter, actionType: "participation", amount: -cost, performedByUsername: (ctx.user as { username?: string }).username ?? null, note: `השתתפות: ${(tournament as { name?: string }).name ?? input.tournamentId}` }]);
        }
        const result = { success: true, pendingApproval: !hasEnoughPoints, balanceAfter };
        if (input.idempotencyKey) setIdempotencyResult(input.idempotencyKey, result);
        if (newSubId) trackTournamentJoin(ctx.user!.id, input.tournamentId, { entryCost: cost });
        return result;
        } catch (e) {
          if (e instanceof Error && e.message === "FREEROLL_SUBMISSION_LIMIT") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "בתחרות FreeRoll ניתן לשלוח עד 2 טפסים בלבד" });
          }
          logError("submission.create", e, { userId: ctx.user?.id, tournamentId: input.tournamentId });
          throw e;
        }
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
        const tTypeEdit = (tournament as { type?: string }).type;
        const closesAtEdit = (tournament as { closesAt?: Date | null }).closesAt;
        const lottoClosed = tTypeEdit === "lotto" && (
          status !== "OPEN" ||
          (closesAtEdit != null && (closesAtEdit instanceof Date ? closesAtEdit.getTime() : Number(closesAtEdit)) <= Date.now())
        );
        if (status !== "OPEN") {
          throw new TRPCError({ code: "BAD_REQUEST", message: lottoClosed ? "ההגרלה נסגרה ולא ניתן לערוך טפסים" : "אי אפשר לערוך אחרי סגירת התחרות" });
        }
        if (closesAtEdit != null && (closesAtEdit instanceof Date ? closesAtEdit.getTime() : Number(closesAtEdit)) <= Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: lottoClosed ? "ההגרלה נסגרה ולא ניתן לערוך טפסים" : "מועד הסגירה עבר – לא ניתן לערוך" });
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
          diffJson,
          { ip: getAuditIp(ctx), userAgent: (ctx.req?.headers && (ctx.req.headers["user-agent"] as string)) ?? undefined }
        );
        return { success: true, noCharge: true };
      }),

    /** כל הטפסים – מנהל מקבל הכל; משתמש מחובר מקבל רק את שלו. אורח לא מקבל כלום. כולל tournamentRemoved לתצוגת תחרות הוסרה. */
    getAll: publicProcedure.query(async ({ ctx }) => {
      const raw = ctx.user?.role === "admin" ? await getAllSubmissions() : ctx.user ? await getSubmissionsByUserId(ctx.user.id) : [];
      if (raw.length === 0) return [];
      const tournamentIds = [...new Set(raw.map((s) => (s as { tournamentId: number }).tournamentId))] as number[];
      const deletedMap = await getTournamentDeletedAtMap(tournamentIds);
      return raw.map((s) => ({ ...s, tournamentRemoved: deletedMap.get((s as { tournamentId: number }).tournamentId) ?? false }));
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
      const tournamentId = (s as { tournamentId: number }).tournamentId;
      const deletedMap = await getTournamentDeletedAtMap([tournamentId]);
      return { ...s, tournamentRemoved: deletedMap.get(tournamentId) ?? false };
    }),
    getByTournament: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getSubmissionsByTournament(input.tournamentId)),
    getChanceLeaderboard: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input, ctx }) => {
        if (!checkLeaderboardRateLimit(ctx)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי בקשות דירוג – נסה שוב בעוד רגע" });
        }
        trackLeaderboardView(ctx.user?.id ?? null, input.tournamentId);
        return getChanceLeaderboard(input.tournamentId);
      }),
    getLottoLeaderboard: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input, ctx }) => {
        if (!checkLeaderboardRateLimit(ctx)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "יותר מדי בקשות דירוג – נסה שוב בעוד רגע" });
        }
        trackLeaderboardView(ctx.user?.id ?? null, input.tournamentId);
        return getLottoLeaderboard(input.tournamentId);
      }),
    getCustomFootballLeaderboard: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getCustomFootballLeaderboard(input.tournamentId)),
    getTournamentSettlementWinners: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getTournamentSettlementWinners(input.tournamentId)),
    getTournamentSettlementPreview: publicProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getTournamentSettlementPreview(input.tournamentId)),
    getMine: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const raw = await getSubmissionsByUserId(ctx.user.id);
      if (raw.length === 0) return [];
      const tournamentIds = [...new Set(raw.map((s) => (s as { tournamentId: number }).tournamentId))] as number[];
      const deletedMap = await getTournamentDeletedAtMap(tournamentIds);
      return raw.map((s) => ({ ...s, tournamentRemoved: deletedMap.get((s as { tournamentId: number }).tournamentId) ?? false }));
    }),
    /** הכניסות שלי לתחרות מסוימת (להצגת "הכניסות שלי" ויכולת לשלוח כניסה נוספת) */
    getMyEntriesForTournament: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getSubmissionsByUserAndTournament(ctx.user.id, input.tournamentId);
      }),
  }),

  /** Phase 34: Near Win Engine + Rival System (cache 30s). */
  leaderboard: router({
    getNearWinMessage: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getNearWinMessage(ctx.user.id, input.tournamentId);
      }),
    getRivalStatus: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getRivalStatus(ctx.user.id, input.tournamentId);
      }),
    getPositionDrama: protectedProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getPositionDrama(ctx.user.id, input.tournamentId);
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
    getAllSubmissions: adminProcedure.query(async () => {
      const raw = await getAllSubmissions();
      if (raw.length === 0) return [];
      const tournamentIds = [...new Set(raw.map((s) => (s as { tournamentId: number }).tournamentId))] as number[];
      const deletedMap = await getTournamentDeletedAtMap(tournamentIds);
      return raw.map((s) => ({ ...s, tournamentRemoved: deletedMap.get((s as { tournamentId: number }).tournamentId) ?? false }));
    }),
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
      .input(z.object({ id: safe.id }))
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
        from: safe.dateFromTo,
        to: safe.dateFromTo,
        competitionId: safe.idOptional,
        userId: safe.idOptional,
        agentId: safe.idOptional,
        type: z.enum(["Deposit", "Prize", "Commission", "Refund", "Bonus", "Adjustment"]).optional(),
        search: z.string().max(200).optional(),
        sortBy: z.enum(["amount", "transactionDate"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        limit: safe.limit(2000),
        offset: safe.offset,
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
    // ---------- Phase 21: Analytics / BI Dashboard (read-only) ----------
    getDashboardOverview: adminProcedure.use(usePermission("reports.view")).query(() => analyticsDashboard.getDashboardOverview()),
    getCompetitionAnalytics: adminProcedure.use(usePermission("reports.view")).query(() => analyticsDashboard.getCompetitionAnalytics()),
    getRevenueAnalytics: adminProcedure
      .use(usePermission("finance.view"))
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(({ input }) => analyticsDashboard.getRevenueAnalytics({ from: input?.from, to: input?.to })),
    getTemplateAnalytics: adminProcedure.use(usePermission("reports.view")).query(() => analyticsDashboard.getTemplateAnalytics()),
    getAgentAnalytics: adminProcedure.use(usePermission("reports.view")).query(() => analyticsDashboard.getAgentAnalytics()),
    getAutomationAnalytics: adminProcedure.use(usePermission("reports.view")).query(() => analyticsDashboard.getAutomationAnalytics()),
    getNotificationAnalytics: adminProcedure.use(usePermission("reports.view")).query(() => analyticsDashboard.getNotificationAnalytics()),
    /** Phase 27: Read-only system status for ops/support (env, db, uploads, automation failures, unread notifications, app version). */
    getSystemStatus: adminProcedure.use(usePermission("reports.view")).query(() => analyticsDashboard.getSystemStatus()),
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
    depositPoints: adminProcedure.use(usePermission("users.manage"))
      .input(z.object({ userId: safe.userId, amount: z.number().int().min(1).max(1_000_000) }))
      .mutation(async ({ input, ctx }) => {
        const u = await getUserById(input.userId);
        const targetHasUnlimitedPoints = !!((u as { unlimitedPoints?: boolean | number })?.unlimitedPoints || (u as { role?: string })?.role === "admin");
        if (targetHasUnlimitedPoints) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "למנהל עם גישה בלתי מוגבלת אין ארנק נקודות מספרי" });
        }
        await addUserPoints(input.userId, input.amount, "deposit", { performedBy: ctx.user!.id, description: "הפקדה על ידי מנהל" });
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
    withdrawPoints: adminProcedure.use(usePermission("users.manage"))
      .input(z.object({ userId: safe.userId, amount: z.number().int().min(1).max(1_000_000) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserById(input.userId);
        const targetHasUnlimitedPoints = !!((user as { unlimitedPoints?: boolean | number })?.unlimitedPoints || (user as { role?: string })?.role === "admin");
        if (targetHasUnlimitedPoints) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "למנהל עם גישה בלתי מוגבלת אין ארנק נקודות מספרי" });
        }
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
    /** כספים – רשימת שחקנים (לבחירת שחקן בדוח הסדר) */
    getPlayerFinanceList: adminProcedure
      .use(usePermission("finance.view"))
      .input(
        z
          .object({
            search: z.string().optional(),
            agentId: z.number().int().nullable().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
            limit: z.number().int().min(1).max(500).optional(),
            cursor: z.number().int().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const { getPlayerFinanceList } = await import("./finance");
        return getPlayerFinanceList({
          search: input?.search,
          agentId: input?.agentId ?? undefined,
          from: input?.from,
          to: input?.to,
          limit: input?.limit,
          cursor: input?.cursor,
        });
      }),
    /** (legacy PnL/export removed – use settlement reports) */
    /** ייצוא CSV – לוג תנועות נקודות (מנהל) עם פילטרים */
    exportPointsLogsCSV: adminProcedure
      .input(
        z.object({
          userId: safe.idOptional,
          tournamentId: safe.idOptional,
          agentId: safe.idOptional,
          actionType: z.string().max(50).optional(),
          limit: safe.limit(2000),
          from: safe.dateFromTo,
          to: safe.dateFromTo,
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
    distributePrizes: adminProcedure.use(usePermission("competitions.settle"))
      .input(z.object({ tournamentId: safe.tournamentId }))
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
        const { notifyLater } = await import("./notifications/createNotification");
        const { NOTIFICATION_TYPES } = await import("./notifications/types");
        notifyLater({
          type: NOTIFICATION_TYPES.TOURNAMENT_SETTLED,
          recipientType: "admin",
          title: "תחרות הוסדרה",
          body: `תחרות #${input.tournamentId} – חולקו פרסים ל־${result.winnerCount ?? 0} זוכים`,
          payload: { tournamentId: input.tournamentId, winnerCount: result.winnerCount ?? 0, prizePerWinner: result.prizePerWinner ?? 0 },
        });
        const tournament = await getTournamentById(input.tournamentId);
        const tournamentName = (tournament as { name?: string })?.name ?? `תחרות #${input.tournamentId}`;
        const prizePerWinner = result.prizePerWinner ?? 0;
        for (const userId of winnerIds) {
          notifyLater({
            type: NOTIFICATION_TYPES.TOURNAMENT_SETTLED,
            recipientType: "user",
            recipientId: userId,
            title: "זכית בתחרות!",
            body: `בתחרות "${tournamentName}" חולקו פרסים. זכית ב־${prizePerWinner} נקודות.`,
            payload: { tournamentId: input.tournamentId, tournamentName, userId, prizePerWinner, winnerCount: result.winnerCount },
          });
        }
        return result;
      }),
    approveSubmission: adminProcedure.use(usePermission("submissions.approve"))
      .input(z.object({ id: safe.id }))
      .mutation(async ({ input, ctx }) => {
        const sub = await getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "טופס לא נמצא" });
        if ((sub as { status?: string }).status === "approved") {
          return { success: true };
        }
        await updateSubmissionStatus(input.id, "approved", ctx.user!.id);
        await updateSubmissionPayment(input.id, "completed");
        const paymentBySub = await getPaymentBySubmissionId(input.id);
        if (paymentBySub) await updatePaymentTransactionStatus((paymentBySub as { id: number }).id, "paid", { performedBy: ctx.user!.id });
        const user = await getUserById(sub.userId);
        const tournament = await getTournamentById(sub.tournamentId);
        const effectiveAgentId =
          user?.role === "agent" ? user.id : (user as { agentId?: number | null })?.agentId ?? null;
        if (effectiveAgentId != null && tournament && !(await hasCommissionForSubmission(input.id))) {
          const { getCommissionBasisPoints, getAgentShareBasisPoints } = await import("./finance");
          const bps = getCommissionBasisPoints(tournament as { commissionPercentBasisPoints?: number | null; houseFeeRate?: number | null });
          const agentShareBps = await getAgentShareBasisPoints(effectiveAgentId);
          const commissionTotal = Math.floor((tournament.amount * bps) / 10_000);
          const commissionAmount = Math.floor((commissionTotal * agentShareBps) / 10_000);
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
        const { notifyLater } = await import("./notifications/createNotification");
        const { NOTIFICATION_TYPES } = await import("./notifications/types");
        notifyLater({
          type: NOTIFICATION_TYPES.SUBMISSION_APPROVED,
          recipientType: "admin",
          title: "טופס אושר",
          body: `טופס #${input.id} אושר – תחרות #${sub.tournamentId}`,
          payload: { submissionId: input.id, userId: sub.userId, tournamentId: sub.tournamentId },
        });
        const tournamentName = (tournament as { name?: string })?.name ?? `תחרות #${sub.tournamentId}`;
        notifyLater({
          type: NOTIFICATION_TYPES.SUBMISSION_APPROVED,
          recipientType: "user",
          recipientId: sub.userId,
          title: "הטופס אושר",
          body: `הטופס שלך בתחרות "${tournamentName}" אושר.`,
          payload: { submissionId: input.id, userId: sub.userId, tournamentId: sub.tournamentId, tournamentName },
        });
        const agentId = (sub as { agentId?: number | null }).agentId ?? null;
        if (agentId != null) {
          notifyLater({
            type: NOTIFICATION_TYPES.AGENT_NEW_PLAYER,
            recipientType: "agent",
            recipientId: agentId,
            title: "שחקן אושר בתחרות",
            body: `שחקן ${sub.username} אושר בתחרות "${tournamentName}".`,
            payload: { submissionId: input.id, userId: sub.userId, username: sub.username, tournamentId: sub.tournamentId, tournamentName, agentId },
          });
        }
        return { success: true };
      }),
    rejectSubmission: adminProcedure.use(usePermission("submissions.reject"))
      .input(z.object({ id: safe.id }))
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
        const { notifyLater } = await import("./notifications/createNotification");
        const { NOTIFICATION_TYPES } = await import("./notifications/types");
        notifyLater({
          type: NOTIFICATION_TYPES.SUBMISSION_REJECTED,
          recipientType: "admin",
          title: "טופס נדחה",
          body: `טופס #${input.id} נדחה – תחרות #${sub.tournamentId}`,
          payload: { submissionId: input.id, userId: sub.userId, tournamentId: sub.tournamentId },
        });
        const tournament = await getTournamentById(sub.tournamentId);
        const tournamentName = (tournament as { name?: string })?.name ?? `תחרות #${sub.tournamentId}`;
        notifyLater({
          type: NOTIFICATION_TYPES.SUBMISSION_REJECTED,
          recipientType: "user",
          recipientId: sub.userId,
          title: "הטופס נדחה",
          body: `הטופס שלך בתחרות "${tournamentName}" נדחה.`,
          payload: { submissionId: input.id, userId: sub.userId, tournamentId: sub.tournamentId, tournamentName },
        });
        return { success: true };
      }),
    markPayment: adminProcedure
      .input(z.object({ id: safe.id, status: z.enum(["pending", "completed", "failed"]) }))
      .mutation(async ({ input }) => {
        await updateSubmissionPayment(input.id, input.status);
        return { success: true };
      }),
    /** Phase 28/30: List payment transactions (admin). Filters: status, type, tournamentId, userId, provider. */
    listPaymentTransactions: adminProcedure.use(usePermission("submissions.view"))
      .input(z.object({
        status: z.string().max(50).optional(),
        type: z.string().max(50).optional(),
        tournamentId: safe.idOptional,
        userId: safe.idOptional,
        provider: z.string().max(50).optional(),
        limit: safe.limit(500),
        offset: safe.offset,
      }).optional())
      .query(async ({ input }) => getPaymentTransactions(input ?? undefined)),
    /** Phase 28: Get single payment transaction by id. */
    getPaymentTransaction: adminProcedure.use(usePermission("submissions.view"))
      .input(z.object({ id: safe.id }))
      .query(async ({ input }) => getPaymentTransactionById(input.id)),
    /** Phase 30: Payment report summary – counts and amounts by status, type, provider, accountingType. */
    getPaymentReportSummary: adminProcedure.use(usePermission("submissions.view"))
      .query(() => getPaymentReportSummary()),
    /** Phase 30: Payment transaction detail with linked submission, tournament, user. */
    getPaymentTransactionDetail: adminProcedure.use(usePermission("submissions.view"))
      .input(z.object({ id: safe.id }))
      .query(async ({ input }) => getPaymentTransactionDetail(input.id)),
    /** Phase 28: Update payment transaction status (paid/failed/refunded/cancelled); syncs submission.paymentStatus when paid/failed. */
    updatePaymentTransactionStatus: adminProcedure.use(usePermission("submissions.approve"))
      .input(z.object({
        id: safe.id,
        status: z.enum(["pending", "paid", "failed", "refunded", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const ok = await updatePaymentTransactionStatus(input.id, input.status, { performedBy: ctx.user!.id });
        if (ok) {
          logger.info("Payment transaction status updated", { paymentId: input.id, status: input.status, by: ctx.user!.id });
          if (input.status === "paid" || input.status === "refunded") {
            const payment = await getPaymentTransactionById(input.id);
            const subId = payment && (payment as { submissionId: number | null }).submissionId;
            const userId = payment && (payment as { userId: number }).userId;
            const tournamentId = payment && (payment as { tournamentId: number }).tournamentId;
            const tournament = tournamentId != null ? await getTournamentById(tournamentId) : null;
            const tournamentName = tournament ? (tournament as { name?: string }).name ?? `תחרות #${tournamentId}` : "";
            const { notifyLater } = await import("./notifications/createNotification");
            const { NOTIFICATION_TYPES } = await import("./notifications/types");
            if (input.status === "paid") {
              notifyLater({
                type: NOTIFICATION_TYPES.PAYMENT_MARKED_PAID,
                recipientType: "admin",
                title: "תשלום סומן כשולם",
                body: subId != null ? `תשלום #${input.id} (טופס #${subId}) סומן כשולם – ${tournamentName}` : `תשלום #${input.id} סומן כשולם`,
                payload: { paymentId: input.id, submissionId: subId, userId, tournamentId },
              });
              if (userId != null) {
                notifyLater({
                  type: NOTIFICATION_TYPES.PAYMENT_MARKED_PAID,
                  recipientType: "user",
                  recipientId: userId,
                  title: "התשלום אושר",
                  body: `התשלום עבור התחרות "${tournamentName}" אושר.`,
                  payload: { paymentId: input.id, submissionId: subId, tournamentId, tournamentName },
                });
              }
            } else {
              notifyLater({
                type: NOTIFICATION_TYPES.PAYMENT_REFUNDED,
                recipientType: "admin",
                title: "החזר בוצע",
                body: subId != null ? `תשלום #${input.id} (טופס #${subId}) סומן כהוחזר – ${tournamentName}` : `תשלום #${input.id} הוחזר`,
                payload: { paymentId: input.id, submissionId: subId, userId, tournamentId },
              });
              if (userId != null) {
                notifyLater({
                  type: NOTIFICATION_TYPES.PAYMENT_REFUNDED,
                  recipientType: "user",
                  recipientId: userId,
                  title: "החזר בוצע",
                  body: `בוצע החזר עבור התחרות "${tournamentName}".`,
                  payload: { paymentId: input.id, submissionId: subId, tournamentId, tournamentName },
                });
              }
            }
          }
        }
        return { success: ok };
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
        const tournamentCache = new Map<number, Awaited<ReturnType<typeof getTournamentById>>>();
        for (const s of subs) {
          const preds = s.predictions as unknown;
          if (!Array.isArray(preds) || !preds.every((p: unknown) => p && typeof (p as { matchId?: number }).matchId === "number")) continue;
          let t = tournamentCache.get(s.tournamentId);
          if (t === undefined) {
            t = await getTournamentById(s.tournamentId);
            tournamentCache.set(s.tournamentId, t);
          }
          const resolved = await resolveScoring(
            t ?? { type: "football", id: s.tournamentId },
            { type: "football", matchResults: results, predictions: preds as Array<{ matchId: number; prediction: "1" | "X" | "2" }> }
          );
          await updateSubmissionPoints(s.id, resolved.points);
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
    lockTournament: adminProcedure.use(usePermission("competitions.edit"))
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
    updateTournamentCommission: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({ tournamentId: z.number().int().positive(), commissionPercent: z.number().min(0).max(100) }))
      .mutation(async ({ input, ctx }) => {
        await updateTournamentCommission(input.tournamentId, input.commissionPercent);
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Update Tournament Commission",
          targetUserId: null,
          details: { tournamentId: input.tournamentId, commissionPercent: input.commissionPercent, ip: getAuditIp(ctx) },
        });
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
    createTournament: adminProcedure.use(usePermission("competitions.create"))
      .input(z.object({
        name: z.string().min(1),
        amount: z.number().int().min(0),
        description: z.string().optional(),
        type: z.enum(["football", "football_custom", "lotto", "chance", "custom"]).optional(),
        competitionTypeId: z.number().int().positive().optional(),
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
        visibility: z.enum(["VISIBLE", "HIDDEN"]).nullable().optional(),
        minParticipants: z.number().int().min(0).nullable().optional(),
        rulesJson: z.unknown().nullable().optional(),
        settledAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
        resultsFinalizedAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
        guaranteedPrizeAmount: z.number().int().min(0).nullable().optional(),
        /** Commission % (0–100). Decimal allowed. Omitted = 12.5%. */
        commissionPercent: z.number().min(0).max(100).nullable().optional(),
        /** תחרויות ספורט: מספר משחקים (1–30). יחד עם matches – יצירה בצעד אחד. */
        numberOfGames: z.number().int().min(1).max(30).nullable().optional(),
        /** תחרויות ספורט: רשימת משחקים (בית, אורח, תאריך, שעה; אופציונלי teamId מהספרייה). */
        matches: z.array(z.object({
          homeTeam: z.string().min(1),
          awayTeam: z.string().min(1),
          homeTeamId: z.number().int().positive().optional().nullable(),
          awayTeamId: z.number().int().positive().optional().nullable(),
          matchDate: z.string().optional().nullable(),
          matchTime: z.string().optional().nullable(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const legacyType = input.type ?? "football";
        if (input.competitionTypeId != null) {
          const ct = await getCompetitionTypeById(input.competitionTypeId);
          if (!ct) throw new TRPCError({ code: "BAD_REQUEST", message: "סוג תחרות לא נמצא" });
          const ctCode = (ct as { code?: string }).code ?? "";
          const derivedLegacy = getLegacyTypeFromCompetitionType(ctCode);
          if (!derivedLegacy || derivedLegacy !== legacyType) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "סוג התחרות שנבחר לא תואם לסוג שהוזן. בחר סוג תחרות תואם." });
          }
        }
        if (input.type === "lotto" && (!input.drawCode || !String(input.drawCode).trim())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "בתחרות לוטו חובה להזין מזהה תחרות (לעדכון תוצאות בהמשך)" });
        }
        if (input.type === "lotto") {
          if (!input.drawDate?.trim() || !input.drawTime?.trim()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "בתחרות לוטו חובה לבחור תאריך ושעת סגירת ההגרלה" });
          }
          const allowedLottoTimes = ["20:00", "22:30", "23:00", "23:30", "00:00"];
          const drawTimeTrim = input.drawTime.trim();
          if (!allowedLottoTimes.includes(drawTimeTrim)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "שעת סגירת הגרלת לוטו חייבת להיות אחת מהשעות: 20:00, 22:30, 23:00, 23:30, 00:00" });
          }
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
        if (input.prizeDistribution != null && typeof input.prizeDistribution === "object" && Object.keys(input.prizeDistribution).length > 0) {
          const pd = input.prizeDistribution as Record<string, number>;
          const keys = Object.keys(pd).filter((k) => /^[1-9]\d*$/.test(k)).map((k) => parseInt(k, 10)).sort((a, b) => a - b);
          const expectedKeys = keys.length > 0 ? Array.from({ length: keys.length }, (_, i) => i + 1) : [];
          if (keys.length === 0 || keys.some((k, i) => k !== expectedKeys[i])) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "חלוקת פרסים: המקומות חייבים להיות 1, 2, 3, ... ברצף לפי מספר הזוכים" });
          }
          const sum = keys.reduce((s, k) => s + (typeof pd[String(k)] === "number" && pd[String(k)] >= 0 ? pd[String(k)] : 0), 0);
          if (Math.abs(sum - 100) > 0.01) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `חלוקת פרסים: סך האחוזים חייב להיות 100% (נוכחי: ${sum}%)` });
          }
        }
        if (input.type === "football" || input.type === "football_custom") {
          const toTs = (v: string | number | Date | null | undefined): number | null => {
            if (v == null) return null;
            if (typeof v === "number") return Number.isNaN(v) ? null : v;
            if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
            try {
              const d = new Date(v as string);
              const t = Number.isNaN(d.getTime()) ? null : d.getTime();
              return t;
            } catch {
              return null;
            }
          };
          const opensAt = toTs(input.opensAt);
          const closesAt = toTs(input.closesAt);
          if (opensAt == null || closesAt == null) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "בתחרות מונדיאל/תחרויות ספורט חובה לבחור תאריך פתיחה, שעת פתיחה ושעת סגירה" });
          }
          if (closesAt <= opensAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "שעת הסגירה חייבת להיות אחרי שעת הפתיחה" });
          }
        }
        if (input.type === "football_custom" && input.matches != null && input.matches.length > 0) {
          const ng = input.numberOfGames;
          if (ng == null || !Number.isInteger(ng) || ng < 1 || ng > 30) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "מספר משחקים חייב להיות בין 1 ל־30" });
          }
          if (input.matches.length !== ng) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `נדרשים בדיוק ${ng} משחקים (הוזנו ${input.matches.length})` });
          }
          for (let i = 0; i < input.matches.length; i++) {
            const m = input.matches[i];
            if (!(m.homeTeam?.trim()) || !(m.awayTeam?.trim())) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `משחק ${i + 1}: חובה למלא קבוצה ביתית ואורחת` });
            }
            if (m.homeTeam.trim() === m.awayTeam.trim()) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `משחק ${i + 1}: קבוצה ביתית ואורחת לא יכולות להיות אותו שם` });
            }
            if (!(m.matchDate?.trim()) || !(m.matchTime?.trim())) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `משחק ${i + 1}: חובה למלא תאריך ושעה` });
            }
          }
        }
        const commissionPercentBasisPoints =
          input.commissionPercent != null && Number.isFinite(input.commissionPercent)
            ? Math.max(0, Math.min(10_000, Math.round(input.commissionPercent * 100)))
            : undefined;
        const tournamentId = await createTournament({
          name: input.name,
          amount: input.amount,
          description: input.description,
          type: input.type,
          competitionTypeId: input.competitionTypeId ?? undefined,
          startDate: input.startDate,
          endDate: input.endDate,
          startsAt: input.startsAt ?? undefined,
          endsAt: input.endsAt ?? undefined,
          opensAt: input.opensAt ?? undefined,
          closesAt: input.type === "lotto" && input.drawDate?.trim() && input.drawTime?.trim()
            ? drawDateAndTimeToTimestamp(input.drawDate.trim(), input.drawTime.trim())
            : input.closesAt ?? undefined,
          maxParticipants: input.maxParticipants ?? undefined,
          prizeDistribution: input.prizeDistribution ?? undefined,
          drawCode: input.drawCode?.trim() || undefined,
          drawDate: input.type === "chance" ? input.drawDate?.trim() : (input.type === "lotto" ? input.drawDate?.trim() : undefined),
          drawTime: input.type === "chance" ? input.drawTime?.trim() : (input.type === "lotto" ? input.drawTime?.trim() : undefined),
          customIdentifier: input.customIdentifier?.trim() || undefined,
          visibility: input.visibility ?? undefined,
          minParticipants: input.minParticipants ?? undefined,
          rulesJson: input.rulesJson ?? undefined,
          settledAt: input.settledAt ?? undefined,
          resultsFinalizedAt: input.resultsFinalizedAt ?? undefined,
          guaranteedPrizeAmount: input.guaranteedPrizeAmount ?? undefined,
          commissionPercentBasisPoints,
          numberOfGames: input.type === "football_custom" && input.numberOfGames != null && input.numberOfGames >= 1 && input.numberOfGames <= 30 ? input.numberOfGames : undefined,
          matches: input.type === "football_custom" && input.matches != null && input.matches.length > 0 ? input.matches : undefined,
        });
        const { notifyLater } = await import("./notifications/createNotification");
        const { NOTIFICATION_TYPES } = await import("./notifications/types");
        notifyLater({
          type: NOTIFICATION_TYPES.COMPETITION_CREATED,
          recipientType: "admin",
          title: "תחרות נוצרה",
          body: input.name ? `תחרות "${input.name}" נוצרה בהצלחה` : `תחרות #${tournamentId} נוצרה`,
          payload: { tournamentId, name: input.name, type: input.type },
        });
        return { success: true, id: tournamentId };
      }),
    /** Phase 20: Competition templates */
    listCompetitionTemplates: adminProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(({ input }) => listCompetitionTemplates({ activeOnly: input?.activeOnly })),
    getCompetitionTemplateById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const t = await getCompetitionTemplateById(input.id);
        if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return t;
      }),
    createCompetitionTemplate: adminProcedure.use(usePermission("competitions.create"))
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        competitionTypeId: z.number().int().positive().optional().nullable(),
        legacyType: z.enum(["football", "football_custom", "lotto", "chance"]).optional(),
        visibility: z.enum(["VISIBLE", "HIDDEN"]).optional().nullable(),
        defaultEntryFee: z.number().int().min(1),
        defaultMaxParticipants: z.number().int().min(1).optional().nullable(),
        formSchemaJson: z.unknown().optional(),
        scoringConfigJson: z.unknown().optional(),
        settlementConfigJson: z.unknown().optional(),
        rulesJson: z.unknown().optional(),
        itemTemplateJson: z.unknown().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createCompetitionTemplate({
          name: input.name,
          description: input.description ?? undefined,
          competitionTypeId: input.competitionTypeId ?? undefined,
          legacyType: input.legacyType ?? "football",
          visibility: input.visibility ?? undefined,
          defaultEntryFee: input.defaultEntryFee,
          defaultMaxParticipants: input.defaultMaxParticipants ?? undefined,
          formSchemaJson: input.formSchemaJson,
          scoringConfigJson: input.scoringConfigJson,
          settlementConfigJson: input.settlementConfigJson,
          rulesJson: input.rulesJson,
          itemTemplateJson: input.itemTemplateJson,
          isActive: input.isActive ?? true,
        });
        return { id };
      }),
    updateCompetitionTemplate: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        competitionTypeId: z.number().int().positive().optional().nullable(),
        legacyType: z.enum(["football", "football_custom", "lotto", "chance"]).optional(),
        visibility: z.enum(["VISIBLE", "HIDDEN"]).optional().nullable(),
        defaultEntryFee: z.number().int().min(1).optional(),
        defaultMaxParticipants: z.number().int().min(1).optional().nullable(),
        formSchemaJson: z.unknown().optional(),
        scoringConfigJson: z.unknown().optional(),
        settlementConfigJson: z.unknown().optional(),
        rulesJson: z.unknown().optional(),
        itemTemplateJson: z.unknown().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const ok = await updateCompetitionTemplate(id, data);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return { success: true };
      }),
    deleteCompetitionTemplate: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const ok = await deleteCompetitionTemplate(input.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return { success: true };
      }),
    duplicateCompetitionTemplate: adminProcedure.use(usePermission("competitions.create"))
      .input(z.object({ id: z.number(), newName: z.string().optional() }))
      .mutation(async ({ input }) => {
        const newId = await duplicateCompetitionTemplate(input.id, input.newName ?? "");
        if (newId == null) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return { id: newId };
      }),
    createTemplateFromBuilder: adminProcedure.use(usePermission("competitions.create"))
      .input(z.object({
        templateName: z.string().min(1),
        description: z.string().optional(),
        competitionTypeId: z.number().int().positive(),
        legacyType: z.enum(["football", "football_custom", "lotto", "chance"]),
        defaultEntryFee: z.number().int().min(1),
        defaultMaxParticipants: z.number().int().min(1).optional().nullable(),
        visibility: z.enum(["VISIBLE", "HIDDEN"]).optional(),
        rulesJson: z.unknown().optional(),
        minParticipants: z.number().int().min(0).optional(),
        prizeDistribution: z.record(z.string(), z.number()).optional().nullable(),
        itemSets: z.array(z.object({
          title: z.string(),
          itemType: z.string(),
          sourceType: z.enum(["universal", "legacy"]).optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const settlementConfigJson =
          input.minParticipants != null || input.prizeDistribution
            ? {
                minParticipants: input.minParticipants ?? 1,
                prizeDistribution: input.prizeDistribution ?? { "1": 100 },
                tieHandling: (input.rulesJson && typeof input.rulesJson === "object" && "tieHandling" in input.rulesJson
                  ? (input.rulesJson as { tieHandling?: string }).tieHandling
                  : "first_wins") as string,
              }
            : undefined;
        const id = await createCompetitionTemplate({
          name: input.templateName.trim(),
          description: input.description ?? undefined,
          competitionTypeId: input.competitionTypeId,
          legacyType: input.legacyType,
          visibility: input.visibility ?? "VISIBLE",
          defaultEntryFee: input.defaultEntryFee,
          defaultMaxParticipants: input.defaultMaxParticipants ?? undefined,
          formSchemaJson: (input.rulesJson && typeof input.rulesJson === "object" && "formSchemaOverride" in input.rulesJson)
            ? (input.rulesJson as { formSchemaOverride: unknown }).formSchemaOverride
            : undefined,
          scoringConfigJson: (input.rulesJson && typeof input.rulesJson === "object" && "scoringOverride" in input.rulesJson)
            ? (input.rulesJson as { scoringOverride: unknown }).scoringOverride
            : undefined,
          settlementConfigJson,
          rulesJson: input.rulesJson ?? undefined,
          itemTemplateJson: (input.itemSets?.length ? input.itemSets.map((s) => ({
            title: s.title,
            itemType: s.itemType || "custom",
            sourceType: s.sourceType ?? "universal",
          })) : undefined) ?? undefined,
          isActive: true,
        });
        return { id };
      }),
    createTemplateFromTournament: adminProcedure.use(usePermission("competitions.create"))
      .input(z.object({ tournamentId: z.number(), name: z.string().min(1).optional(), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
        const t = tournament as {
          competitionTypeId?: number | null;
          type?: string | null;
          amount?: number;
          maxParticipants?: number | null;
          visibility?: string | null;
          minParticipants?: number | null;
          prizeDistribution?: Record<string, number> | null;
          rulesJson?: unknown;
        };
        const sets = await getCompetitionItemSetsByTournament(input.tournamentId);
        const itemTemplateJson = Array.isArray(sets)
          ? sets.map((s: { title?: string; itemType?: string; sourceType?: string }) => ({
              title: s.title ?? "",
              itemType: s.itemType ?? "custom",
              sourceType: (s.sourceType === "legacy" ? "legacy" : "universal") as "universal" | "legacy",
            }))
          : [];
        const settlementConfigJson =
          t.minParticipants != null || t.prizeDistribution
            ? {
                minParticipants: t.minParticipants ?? 1,
                prizeDistribution: t.prizeDistribution ?? { "1": 100 },
                tieHandling: (t.rulesJson && typeof t.rulesJson === "object" && "tieHandling" in t.rulesJson
                  ? (t.rulesJson as { tieHandling?: string }).tieHandling
                  : undefined) ?? "first_wins",
              }
            : undefined;
        const name = input.name?.trim() || ((tournament as { name?: string }).name ?? "") + " (תבנית)";
        const id = await createCompetitionTemplate({
          name,
          description: input.description ?? null,
          competitionTypeId: t.competitionTypeId ?? undefined,
          legacyType: (t.type as "football" | "football_custom" | "lotto" | "chance") ?? "football",
          visibility: t.visibility ?? undefined,
          defaultEntryFee: t.amount ?? 10,
          defaultMaxParticipants: t.maxParticipants ?? undefined,
          formSchemaJson: (t.rulesJson && typeof t.rulesJson === "object" && "formSchemaOverride" in t.rulesJson)
            ? (t.rulesJson as { formSchemaOverride: unknown }).formSchemaOverride
            : undefined,
          scoringConfigJson: (t.rulesJson && typeof t.rulesJson === "object" && "scoringOverride" in t.rulesJson)
            ? (t.rulesJson as { scoringOverride: unknown }).scoringOverride
            : undefined,
          settlementConfigJson,
          rulesJson: t.rulesJson ?? undefined,
          itemTemplateJson: itemTemplateJson.length > 0 ? itemTemplateJson : undefined,
          isActive: true,
        });
        return { id };
      }),
    getTemplateAsBuilderPrefill: adminProcedure
      .input(z.object({ templateId: z.number() }))
      .query(async ({ input }) => {
        const t = await getCompetitionTemplateById(input.templateId);
        if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        const rules = t.rulesJson && typeof t.rulesJson === "object" ? (t.rulesJson as Record<string, unknown>) : {};
        const settlement = t.settlementConfigJson && typeof t.settlementConfigJson === "object"
          ? (t.settlementConfigJson as Record<string, unknown>)
          : {};
        const itemSets = Array.isArray(t.itemTemplateJson)
          ? (t.itemTemplateJson as Array<{ title?: string; itemType?: string; sourceType?: string }>).map((s, i) => ({
              id: `tpl-${i}-${s.title ?? ""}`,
              title: s.title ?? "",
              itemType: s.itemType ?? "custom",
              sourceType: (s.sourceType === "legacy" ? "legacy" : "universal") as "universal" | "legacy",
            }))
          : [];
        return {
          competitionTypeId: t.competitionTypeId,
          legacyType: t.legacyType as "football" | "football_custom" | "lotto" | "chance",
          basic: {
            name: "",
            amount: String(t.defaultEntryFee),
            description: "",
            maxParticipants: t.defaultMaxParticipants != null ? String(t.defaultMaxParticipants) : "",
            visibility: (t.visibility as "VISIBLE" | "HIDDEN") ?? "VISIBLE",
            startDate: "",
            endDate: "",
            customIdentifier: "",
            bannerUrl: (rules.bannerUrl as string) ?? "",
          },
          formSchemaStep: {
            formSchemaJsonOverride: rules.formSchemaOverride != null ? JSON.stringify(rules.formSchemaOverride, null, 2) : "",
          },
          scoringStep: {
            scoringJsonOverride: rules.scoringOverride != null ? JSON.stringify(rules.scoringOverride, null, 2) : "",
            pointsPerCorrect: typeof rules.pointsPerCorrect === "number" ? String(rules.pointsPerCorrect) : "",
          },
          settlementStep: {
            minParticipants: typeof settlement.minParticipants === "number" ? String(settlement.minParticipants) : "1",
            prizeMode: settlement.prizeDistribution && typeof settlement.prizeDistribution === "object" ? "top3" : "first",
            prize1: "50",
            prize2: "30",
            prize3: "20",
            tieHandling: (rules.tieHandling as string) ?? (settlement.tieHandling as string) ?? "first_wins",
          },
          itemsStep: { source: "universal" as const, sets: itemSets },
          cmsStep: {
            bannerKey: (rules.cmsBannerKey as string) ?? "",
            introSectionId: (rules.cmsIntroSectionId as number) != null ? String(rules.cmsIntroSectionId) : "",
            legalPageSlug: (rules.cmsLegalPageSlug as string) ?? "",
          },
          rulesJson: t.rulesJson,
          settlementConfigJson: t.settlementConfigJson,
        };
      }),
    /** New template system: category → template → create (tournament_templates table) */
    getTournamentTemplateCategories: adminProcedure
      .query(() => getTournamentTemplateCategories()),
    getTournamentTemplates: adminProcedure
      .input(z.object({ category: z.string().optional().nullable() }).optional())
      .query(({ input }) => getTournamentTemplates(input?.category)),
    getTournamentTemplateById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const t = await getTournamentTemplateById(input.id);
        if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return t;
      }),
    createTournamentFromTemplate: adminProcedure.use(usePermission("competitions.create"))
      .input(z.object({
        templateId: z.number(),
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        amount: z.number().int().min(0).optional().nullable(),
        /** Commission % (0–100). Overrides template default; omitted = 12.5%. */
        commissionPercent: z.number().min(0).max(100).optional().nullable(),
        opensAt: z.union([z.string(), z.number(), z.date()]).optional().nullable(),
        closesAt: z.union([z.string(), z.number(), z.date()]).optional().nullable(),
        drawDate: z.string().optional().nullable(),
        drawTime: z.string().optional().nullable(),
        drawCode: z.string().optional().nullable(),
        maxParticipants: z.number().int().min(1).optional().nullable(),
        visibility: z.enum(["VISIBLE", "HIDDEN"]).optional().nullable(),
        rulesJson: z.unknown().optional(),
      }))
      .mutation(async ({ input }) => {
        const template = await getTournamentTemplateById(input.templateId);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        const config = template.configJson as Record<string, unknown>;
        const tournamentType = (config.tournamentType as string) ?? "football";
        if (tournamentType === "lotto" && (!input.drawCode?.trim() || !input.drawDate?.trim() || !input.drawTime?.trim())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "לוטו דורש drawCode, drawDate, drawTime" });
        }
        if (tournamentType === "chance" && (!input.drawDate?.trim() || !input.drawTime?.trim())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "צ'אנס דורש drawDate, drawTime" });
        }
        if ((tournamentType === "football" || tournamentType === "football_custom") && (input.opensAt == null || input.closesAt == null)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "תחרויות ספורט/מונדיאל דורש opensAt ו-closesAt" });
        }
        if (input.commissionPercent != null && (input.commissionPercent < 0 || input.commissionPercent > 100)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "עמלת מנהל חייבת להיות בין 0 ל־100 (אחוז)" });
        }
        const tournamentId = await createTournamentFromTemplate(input.templateId, {
          name: input.name,
          description: input.description ?? undefined,
          amount: input.amount ?? undefined,
          commissionPercent: input.commissionPercent ?? undefined,
          opensAt: input.opensAt ?? undefined,
          closesAt: input.closesAt ?? undefined,
          drawDate: input.drawDate ?? undefined,
          drawTime: input.drawTime ?? undefined,
          drawCode: input.drawCode ?? undefined,
          maxParticipants: input.maxParticipants ?? undefined,
          visibility: input.visibility ?? undefined,
          rulesJson: input.rulesJson,
        });
        return { id: tournamentId };
      }),
    /** Phase 20: Create from competition_templates (wizard/legacy) */
    createTournamentFromCompetitionTemplate: adminProcedure.use(usePermission("competitions.create"))
      .input(z.object({
        templateId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        /** Commission % (0–100). Omitted = 12.5%. */
        commissionPercent: z.number().min(0).max(100).optional().nullable(),
        opensAt: z.union([z.string(), z.number(), z.date()]).optional(),
        closesAt: z.union([z.string(), z.number(), z.date()]).optional(),
        drawCode: z.string().optional(),
        drawDate: z.string().optional(),
        drawTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const template = await getCompetitionTemplateById(input.templateId);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        const legacyType = template.legacyType as "football" | "football_custom" | "lotto" | "chance";
        if (legacyType === "lotto" && (!input.drawCode?.trim() || !input.drawDate?.trim() || !input.drawTime?.trim())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "לוטו דורש drawCode, drawDate, drawTime" });
        }
        if (legacyType === "chance" && (!input.drawDate?.trim() || !input.drawTime?.trim())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "צ'אנס דורש drawDate, drawTime" });
        }
        if ((legacyType === "football" || legacyType === "football_custom") && (input.opensAt == null || input.closesAt == null)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "תחרויות ספורט/מונדיאל דורש opensAt ו-closesAt" });
        }
        if (input.commissionPercent != null && (input.commissionPercent < 0 || input.commissionPercent > 100)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "עמלת מנהל חייבת להיות בין 0 ל־100 (אחוז)" });
        }
        const settlement = template.settlementConfigJson && typeof template.settlementConfigJson === "object"
          ? (template.settlementConfigJson as Record<string, unknown>)
          : {};
        const commissionPercentBasisPoints =
          input.commissionPercent != null && Number.isFinite(input.commissionPercent)
            ? Math.max(0, Math.min(10_000, Math.round(input.commissionPercent * 100)))
            : undefined;
        const payload = {
          name: input.name.trim(),
          amount: template.defaultEntryFee,
          description: input.description ?? undefined,
          type: legacyType,
          competitionTypeId: template.competitionTypeId ?? undefined,
          maxParticipants: template.defaultMaxParticipants ?? undefined,
          visibility: (template.visibility as "VISIBLE" | "HIDDEN") ?? undefined,
          minParticipants: typeof settlement.minParticipants === "number" ? settlement.minParticipants : undefined,
          prizeDistribution: settlement.prizeDistribution && typeof settlement.prizeDistribution === "object"
            ? (settlement.prizeDistribution as Record<string, number>)
            : undefined,
          rulesJson: template.rulesJson ?? undefined,
          opensAt: input.opensAt ?? undefined,
          closesAt: input.closesAt ?? undefined,
          drawCode: input.drawCode?.trim() || undefined,
          drawDate: input.drawDate?.trim(),
          drawTime: input.drawTime?.trim(),
          commissionPercentBasisPoints,
        };
        if (legacyType === "lotto" && payload.drawDate && payload.drawTime) {
          (payload as Record<string, unknown>).closesAt = drawDateAndTimeToTimestamp(payload.drawDate, payload.drawTime);
        }
        const tournamentId = await createTournament(payload);
        const itemSets = Array.isArray(template.itemTemplateJson)
          ? (template.itemTemplateJson as Array<{ title?: string; itemType?: string; sourceType?: string }>)
          : [];
        for (const set of itemSets) {
          if (!set.title?.trim()) continue;
          await createCompetitionItemSet({
            tournamentId,
            title: set.title.trim(),
            itemType: set.itemType?.trim() || "custom",
            sourceType: set.sourceType === "legacy" ? "legacy" : "universal",
          });
        }
        return { id: tournamentId };
      }),
    deleteTournament: adminProcedure.use(usePermission("competitions.delete"))
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
    /** Repair: refund participants of competitions that were closed/cancelled without valid completion. Idempotent. */
    repairCancelledCompetitionsRefunds: adminProcedure.use(usePermission("competitions.delete"))
      .mutation(async ({ ctx }) => {
        const result = await repairUnrefundedCancelledCompetitions();
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Repair Cancelled Competitions Refunds",
          targetUserId: null,
          details: {
            processedTournamentIds: result.processedTournamentIds,
            totalRefundedCount: result.totalRefundedCount,
            totalRefundedAmount: result.totalRefundedAmount,
            details: result.details,
            ip: getAuditIp(ctx),
          },
        });
        logger.info("Admin ran repair cancelled competitions refunds", {
          by: ctx.user!.username ?? ctx.user!.id,
          tournaments: result.processedTournamentIds.length,
          totalRefundedCount: result.totalRefundedCount,
          totalRefundedAmount: result.totalRefundedAmount,
        });
        return result;
      }),
    /** Refund a single cancelled tournament (only if not validly completed). Idempotent. */
    refundCancelledTournament: adminProcedure.use(usePermission("competitions.delete"))
      .input(z.object({ tournamentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (await isTournamentCompleted(input.tournamentId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "תחרות זו הסתיימה או חולקו פרסים – לא ניתן להחזיר" });
        }
        const refund = await refundTournamentParticipants(input.tournamentId);
        if (refund.refundedCount > 0 && refund.totalRefunded > 0) {
          const tournament = await getTournamentById(input.tournamentId);
          const name = tournament ? (tournament as { name?: string }).name ?? String(input.tournamentId) : String(input.tournamentId);
          await insertFinancialRecord({
            competitionId: input.tournamentId,
            competitionName: name,
            recordType: "refund",
            type: tournament ? (tournament as { type?: string }).type ?? "football" : "football",
            totalCollected: refund.totalRefunded,
            siteFee: 0,
            totalPrizes: 0,
            netProfit: -refund.totalRefunded,
            participantsCount: refund.refundedCount,
            winnersCount: 0,
            closedAt: new Date(),
          });
        }
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Refund Cancelled Tournament",
          targetUserId: null,
          details: { tournamentId: input.tournamentId, refundedCount: refund.refundedCount, totalRefunded: refund.totalRefunded, ip: getAuditIp(ctx) },
        });
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
    /** Team library (football_custom / תחרויות ספורט only): scope guard enforced at backend */
    listTeamLibraryCategories: adminProcedure
      .input(z.object({ scope: z.literal("football_custom") }))
      .query(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return listTeamLibraryCategories();
      }),
    getTeamLibraryCategoryById: adminProcedure
      .input(z.object({ scope: z.literal("football_custom"), categoryId: z.number() }))
      .query(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return getTeamLibraryCategoryById(input.categoryId);
      }),
    listTeamLibraryTeams: adminProcedure
      .input(z.object({ scope: z.literal("football_custom"), categoryId: z.number(), search: z.string().optional() }))
      .query(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return listTeamLibraryTeams(input.categoryId, input.search);
      }),
    createTeamLibraryTeam: adminProcedure
      .input(z.object({ scope: z.literal("football_custom"), categoryId: z.number(), name: z.string().min(1), displayOrder: z.number().optional() }))
      .mutation(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return createTeamLibraryTeam({ categoryId: input.categoryId, name: input.name, displayOrder: input.displayOrder });
      }),
    updateTeamLibraryTeam: adminProcedure
      .input(z.object({ scope: z.literal("football_custom"), teamId: z.number(), name: z.string().min(1).optional(), displayOrder: z.number().optional(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return updateTeamLibraryTeam(input.teamId, { name: input.name, displayOrder: input.displayOrder, isActive: input.isActive });
      }),
    deleteTeamLibraryTeam: adminProcedure
      .input(z.object({ scope: z.literal("football_custom"), teamId: z.number() }))
      .mutation(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return deleteTeamLibraryTeam(input.teamId);
      }),
    getTeamLibraryTeamById: adminProcedure
      .input(z.object({ scope: z.literal("football_custom"), teamId: z.number() }))
      .query(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return getTeamLibraryTeamById(input.teamId);
      }),
    /** Team library global search for picker (football_custom only). Returns team id, name, categoryName. */
    searchTeamLibraryTeams: adminProcedure
      .input(z.object({ scope: z.literal("football_custom"), search: z.string() }))
      .query(({ input }) => {
        assertTeamLibraryScope(input.scope);
        return searchTeamLibraryTeamsGlobal(input.search);
      }),
    /** Phase 2C: Resolved form/scoring/settlement schemas for a tournament (admin debug). */
    getTournamentResolvedSchemas: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ input }) => {
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
        return resolveTournamentSchemas(tournament as Parameters<typeof resolveTournamentSchemas>[0]);
      }),
    /** Phase 5: Compare legacy vs schema settlement for a tournament (admin debug). */
    getSettlementComparison: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getSettlementComparison(input.tournamentId)),
    /** Phase 18: Next scheduled automation actions and recent job history for a tournament (read-only). */
    getTournamentScheduledActions: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(async ({ input }) => {
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
        const { getNextScheduledActions } = await import("./automation/getNextScheduledActions");
        const { getLifecyclePhase, getLifecyclePhaseLabel, getNextPossibleTransitions, getPendingLifecycleActions } = await import("./automation/lifecycleStateMachine");
        const nextScheduledActions = getNextScheduledActions(tournament as Parameters<typeof getNextScheduledActions>[0]);
        const recentJobs = await getAutomationJobsForTournament(input.tournamentId, 20);
        const tRow = tournament as { id: number; status?: string | null; type?: string | null; closesAt?: Date | number | null; resultsFinalizedAt?: Date | number | null; settledAt?: Date | number | null; dataCleanedAt?: Date | number | null; drawDate?: string | null; drawTime?: string | null };
        const phase = getLifecyclePhase(tRow);
        const lastJob = recentJobs[0] ?? null;
        const retryState = lastJob && (lastJob as { status?: string }).status === "failed"
          ? { retryCount: (lastJob as { retryCount?: number }).retryCount ?? 0, nextRetryAt: (lastJob as { nextRetryAt?: Date | null }).nextRetryAt }
          : null;
        return {
          nextScheduledActions,
          recentJobs,
          lifecyclePhase: phase,
          lifecyclePhaseLabel: getLifecyclePhaseLabel(phase),
          nextPossibleTransitions: getNextPossibleTransitions(phase),
          pendingLifecycleActions: getPendingLifecycleActions(tRow),
          retryState,
        };
      }),
    /** Phase 4: Compare legacy vs schema score for a submission (admin debug). */
    getScoreComparison: adminProcedure
      .input(z.object({ tournamentId: z.number(), submissionId: z.number() }))
      .query(async ({ input }) => {
        const tournament = await getTournamentById(input.tournamentId);
        if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
        const submission = await getSubmissionById(input.submissionId);
        if (!submission || submission.tournamentId !== input.tournamentId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found or wrong tournament" });
        }
        const t = tournament as { competitionTypeId?: number | null; type?: string | null; id: number };
        const tType = (tournament as { type?: string }).type ?? "football";
        const pred = submission.predictions as unknown;

        let legacyPoints: number;
        let legacyStrongHit: boolean | undefined;
        let schemaPoints: number | null = null;
        let schemaBreakdown: Record<string, unknown> | null = null;
        let schemaWarnings: string[] = [];
        let configMode: string | null = null;

        if (tType === "football" || tType === "football_custom") {
          const matches = tType === "football" ? await getMatches() : await getCustomFootballMatches(input.tournamentId);
          const results = new Map<number, { homeScore: number; awayScore: number }>();
          for (const m of matches) {
            const hm = m as { homeScore?: number | null; awayScore?: number | null };
            if (hm.homeScore != null && hm.awayScore != null) results.set(m.id, { homeScore: hm.homeScore, awayScore: hm.awayScore });
          }
          const preds = Array.isArray(pred) ? (pred as Array<{ matchId: number; prediction: "1" | "X" | "2" }>) : [];
          const ctx = { type: "football" as const, matchResults: results, predictions: preds };
          const legacy = getLegacyScoreForContext(ctx);
          legacyPoints = legacy.points;
          try {
            const { config } = await resolveTournamentScoringConfig(t);
            configMode = config.mode;
            if (config.mode === "match_result") {
              const res = scoreBySchema(config, ctx);
              schemaPoints = res.totalPoints;
              schemaBreakdown = res.breakdown ?? null;
              schemaWarnings = res.warnings ?? [];
            }
          } catch (e) {
            schemaWarnings.push("Schema scoring failed: " + String(e));
          }
        } else if (tType === "lotto") {
          const draw = await getLottoDrawResult(input.tournamentId);
          if (!draw || !pred || typeof pred !== "object" || !("numbers" in pred) || !("strongNumber" in pred)) {
            return {
              legacyPoints: 0,
              schemaPoints: null,
              match: true,
              message: "No draw result or invalid prediction",
              schemaBreakdown: null,
              schemaWarnings: ["Missing lotto draw or invalid submission"],
              configMode: null,
            };
          }
          const ctx = {
            type: "lotto" as const,
            draw: { num1: draw.num1, num2: draw.num2, num3: draw.num3, num4: draw.num4, num5: draw.num5, num6: draw.num6, strongNumber: draw.strongNumber },
            predictions: { numbers: (pred as { numbers: number[] }).numbers, strongNumber: (pred as { strongNumber: number }).strongNumber },
          };
          const legacy = getLegacyScoreForContext(ctx);
          legacyPoints = legacy.points;
          legacyStrongHit = legacy.strongHit;
          try {
            const { config } = await resolveTournamentScoringConfig(t);
            configMode = config.mode;
            if (config.mode === "lotto_match") {
              const res = scoreBySchema(config, ctx);
              schemaPoints = res.totalPoints;
              schemaBreakdown = res.breakdown ?? null;
              schemaWarnings = res.warnings ?? [];
            }
          } catch (e) {
            schemaWarnings.push("Schema scoring failed: " + String(e));
          }
        } else if (tType === "chance") {
          const draw = await getChanceDrawResult(input.tournamentId);
          if (!draw || !pred || typeof pred !== "object" || !("heart" in pred)) {
            return {
              legacyPoints: 0,
              schemaPoints: null,
              match: true,
              message: "No draw result or invalid prediction",
              schemaBreakdown: null,
              schemaWarnings: ["Missing chance draw or invalid submission"],
              configMode: null,
            };
          }
          const chancePred = pred as unknown as { heart?: string; club?: string; diamond?: string; spade?: string };
          const ctx = {
            type: "chance" as const,
            draw: { heartCard: draw.heartCard, clubCard: draw.clubCard, diamondCard: draw.diamondCard, spadeCard: draw.spadeCard },
            predictions: {
              heart: chancePred.heart ?? "",
              club: chancePred.club ?? "",
              diamond: chancePred.diamond ?? "",
              spade: chancePred.spade ?? "",
            },
          };
          const legacy = getLegacyScoreForContext(ctx);
          legacyPoints = legacy.points;
          try {
            const { config } = await resolveTournamentScoringConfig(t);
            configMode = config.mode;
            if (config.mode === "chance_suits") {
              const res = scoreBySchema(config, ctx);
              schemaPoints = res.totalPoints;
              schemaBreakdown = res.breakdown ?? null;
              schemaWarnings = res.warnings ?? [];
            }
          } catch (e) {
            schemaWarnings.push("Schema scoring failed: " + String(e));
          }
        } else {
          return {
            legacyPoints: submission.points ?? 0,
            schemaPoints: null,
            match: true,
            message: "Unsupported tournament type for comparison",
            schemaBreakdown: null,
            schemaWarnings: [],
            configMode: null,
          };
        }

        const storedPoints = submission.points ?? 0;
        const match = schemaPoints != null ? legacyPoints === schemaPoints : true;
        return {
          storedPoints,
          legacyPoints,
          schemaPoints,
          legacyStrongHit,
          match,
          schemaBreakdown,
          schemaWarnings,
          configMode,
        };
      }),
    addCustomFootballMatch: adminProcedure
      .input(z.object({
        tournamentId: z.number(),
        homeTeam: z.string().min(1),
        awayTeam: z.string().min(1),
        homeTeamId: z.number().int().positive().optional().nullable(),
        awayTeamId: z.number().int().positive().optional().nullable(),
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
        homeTeamId: z.number().int().positive().optional().nullable(),
        awayTeamId: z.number().int().positive().optional().nullable(),
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
    getSiteSettings: adminProcedure.use(usePermission("settings.manage")).query(() => getSiteSettings()),
    setSiteSetting: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ key: z.string().min(1), value: z.string() }))
      .mutation(async ({ input }) => {
        await setSiteSetting(input.key, input.value);
        return { success: true };
      }),
    setSiteSettingsBatch: adminProcedure.use(usePermission("settings.manage"))
      .input(z.record(z.string().min(1), z.string()))
      .mutation(async ({ input }) => {
        await setSiteSettingsBatch(input);
        return { success: true };
      }),

    listSiteBackgroundImages: adminProcedure.use(usePermission("settings.manage")).query(() => listSiteBackgroundImages()),
    setActiveSiteBackground: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await setActiveSiteBackground(input.id);
        return { success: true };
      }),
    deactivateSiteBackground: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deactivateSiteBackground(input.id);
        return { success: true };
      }),
    deleteSiteBackgroundImage: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSiteBackgroundImage(input.id);
        return { success: true };
      }),

    listJackpotBackgroundImages: adminProcedure.use(usePermission("settings.manage")).query(() => listJackpotBackgroundImages()),
    setActiveJackpotBackground: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await setActiveJackpotBackground(input.id);
        const ip = (ctx as { req?: { ip?: string; socket?: { remoteAddress?: string } } }).req?.ip ?? (ctx as { req?: { socket?: { remoteAddress?: string } } }).req?.socket?.remoteAddress ?? "";
        await insertAdminAuditLog({
          performedBy: ctx.user?.id ?? 0,
          action: "jackpot_bg_activate",
          details: { entityType: "jackpot_background", entityId: input.id, ip },
        });
        return { success: true };
      }),
    deleteJackpotBackgroundImage: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteJackpotBackgroundImage(input.id);
        const ip = (ctx as { req?: { ip?: string; socket?: { remoteAddress?: string } } }).req?.ip ?? (ctx as { req?: { socket?: { remoteAddress?: string } } }).req?.socket?.remoteAddress ?? "";
        await insertAdminAuditLog({
          performedBy: ctx.user?.id ?? 0,
          action: "jackpot_bg_delete",
          details: { entityType: "jackpot_background", entityId: input.id, ip },
        });
        return { success: true };
      }),
    duplicateJackpotBackgroundImage: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await duplicateJackpotBackgroundImage(input.id);
        const ip = (ctx as { req?: { ip?: string; socket?: { remoteAddress?: string } } }).req?.ip ?? (ctx as { req?: { socket?: { remoteAddress?: string } } }).req?.socket?.remoteAddress ?? "";
        await insertAdminAuditLog({
          performedBy: ctx.user?.id ?? 0,
          action: "jackpot_bg_duplicate",
          details: { entityType: "jackpot_background", entityId: result.id, sourceId: input.id, ip },
        });
        return result;
      }),
    reorderJackpotBackgroundImages: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ updates: z.array(z.object({ id: z.number(), displayOrder: z.number() })) }))
      .mutation(async ({ input }) => {
        await reorderJackpotBackgroundImages(input.updates);
        return { success: true };
      }),
    setJackpotBackgroundOverlay: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({
        overlayOpacity: z.number().min(0).max(100).optional(),
        vignetteStrength: z.number().min(0).max(100).optional(),
        fxIntensity: z.number().min(0).max(100).optional(),
        glowStrength: z.number().min(0).max(100).optional(),
        intensity: z.number().min(0).max(100).optional(),
        preset: z.enum(["aggressive", "luxury", "calm", "explosive"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const presets = {
          aggressive: { overlayOpacity: 75, vignetteStrength: 90, fxIntensity: 95, glowStrength: 85 },
          luxury: { overlayOpacity: 60, vignetteStrength: 85, fxIntensity: 40, glowStrength: 60 },
          calm: { overlayOpacity: 50, vignetteStrength: 60, fxIntensity: 30, glowStrength: 40 },
          explosive: { overlayOpacity: 65, vignetteStrength: 88, fxIntensity: 100, glowStrength: 95 },
        } as const;
        if (input.preset != null) {
          const p = presets[input.preset];
          await setSiteSetting("jackpot_bg_overlay_opacity", String(p.overlayOpacity));
          await setSiteSetting("jackpot_bg_vignette_strength", String(p.vignetteStrength));
          await setSiteSetting("jackpot_bg_fx_intensity", String(p.fxIntensity));
          await setSiteSetting("jackpot_bg_glow_strength", String(p.glowStrength));
          await setSiteSetting("jackpot_bg_preset", input.preset);
        }
        if (input.overlayOpacity !== undefined) await setSiteSetting("jackpot_bg_overlay_opacity", String(input.overlayOpacity));
        if (input.vignetteStrength !== undefined) await setSiteSetting("jackpot_bg_vignette_strength", String(input.vignetteStrength));
        if (input.fxIntensity !== undefined) await setSiteSetting("jackpot_bg_fx_intensity", String(input.fxIntensity));
        if (input.glowStrength !== undefined) await setSiteSetting("jackpot_bg_glow_strength", String(input.glowStrength));
        if (input.intensity !== undefined) await setSiteSetting("jackpot_intensity", String(input.intensity));
        return { success: true };
      }),
    getJackpotConversionStats: adminProcedure.use(usePermission("settings.manage")).query(async () => getJackpotConversionStats()),

    getJackpotSettings: adminProcedure.use(usePermission("settings.manage")).query(async () => {
      const { getJackpotSettings: getSettings } = await import("./jackpot");
      return getSettings();
    }),
    setJackpotSettings: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({
        enabled: z.boolean().optional(),
        contributionBasisPoints: z.number().int().min(0).max(10000).optional(),
        balancePoints: z.number().int().min(0).optional(),
        ticketStepIls: z.number().int().min(1).optional(),
        winnerPayoutPercent: z.number().int().min(0).max(100).optional(),
        nextDrawAt: z.union([z.string().datetime(), z.date(), z.null()]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { setJackpotSettings: setSettings } = await import("./jackpot");
        await setSettings({
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.contributionBasisPoints !== undefined && { contributionBasisPoints: input.contributionBasisPoints }),
          ...(input.balancePoints !== undefined && { balancePoints: input.balancePoints }),
          ...(input.ticketStepIls !== undefined && { ticketStepIls: input.ticketStepIls }),
          ...(input.winnerPayoutPercent !== undefined && { winnerPayoutPercent: input.winnerPayoutPercent }),
          ...(input.nextDrawAt !== undefined && { nextDrawAt: input.nextDrawAt }),
        });
        return { success: true };
      }),
    runJackpotDraw: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ drawTimestamp: z.union([z.string().datetime(), z.date()]).optional() }).optional())
      .mutation(async ({ input }) => {
        const { runJackpotDraw: runDraw } = await import("./jackpot");
        const drawTimestamp = input?.drawTimestamp != null ? (typeof input.drawTimestamp === "string" ? new Date(input.drawTimestamp) : input.drawTimestamp) : new Date();
        return runDraw(drawTimestamp, "manual");
      }),
    listJackpotDraws: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).optional() }).optional())
      .query(async ({ input }) => {
        const { listJackpotDraws: listDraws } = await import("./jackpot");
        return listDraws({ limit: input?.limit, offset: input?.offset });
      }),
    listJackpotDrawAudit: adminProcedure.use(usePermission("settings.manage"))
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).optional() }).optional())
      .query(async ({ input }) => {
        const { listJackpotDrawAudit: listAudit } = await import("./jackpot");
        return listAudit({ limit: input?.limit, offset: input?.offset });
      }),

    // Phase 11: CMS (cms.view / cms.edit)
    listContentPages: adminProcedure.use(usePermission("cms.view")).query(() => listContentPages()),
    getContentPageById: adminProcedure.use(usePermission("cms.view")).input(z.object({ id: z.number() })).query(({ input }) => getContentPageById(input.id)),
    createContentPage: adminProcedure.use(usePermission("cms.edit")).input(z.object({
      slug: z.string().min(1).max(200).regex(/^[a-z0-9\-]+$/, "כתובת הדף: רק אותיות אנגלית קטנות, מספרים ומקף"),
      title: z.string().min(1).max(500),
      status: z.enum(["draft", "published"]).optional(),
      shortDescription: z.string().nullable().optional(),
      body: z.string().nullable().optional(),
      coverImageUrl: z.string().nullable().optional(),
      seoTitle: z.string().nullable().optional(),
      seoDescription: z.string().nullable().optional(),
    })).mutation(async ({ input }) => ({ id: await createContentPage(input) })),
    updateContentPage: adminProcedure.use(usePermission("cms.edit")).input(z.object({
      id: z.number(),
      slug: z.string().min(1).max(200).regex(/^[a-z0-9\-]+$/).optional(),
      title: z.string().min(1).max(500).optional(),
      status: z.enum(["draft", "published"]).optional(),
      shortDescription: z.string().nullable().optional(),
      body: z.string().nullable().optional(),
      coverImageUrl: z.string().nullable().optional(),
      seoTitle: z.string().nullable().optional(),
      seoDescription: z.string().nullable().optional(),
    })).mutation(async ({ input }) => { await updateContentPage(input.id, input); return { success: true }; }),
    deleteContentPage: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteContentPage(input.id); return { success: true }; }),
    listContentSections: adminProcedure.use(usePermission("cms.view")).input(z.object({ pageId: z.number().nullable().optional() }).optional()).query(({ input }) => listContentSections(input?.pageId ?? null)),
    getContentSectionById: adminProcedure.use(usePermission("cms.view")).input(z.object({ id: z.number() })).query(({ input }) => getContentSectionById(input.id)),
    createContentSection: adminProcedure.use(usePermission("cms.edit")).input(z.object({ pageId: z.number().nullable().optional(), key: z.string().min(1), type: z.string().min(1), title: z.string().nullable().optional(), subtitle: z.string().nullable().optional(), body: z.string().nullable().optional(), imageUrl: z.string().nullable().optional(), buttonText: z.string().nullable().optional(), buttonUrl: z.string().nullable().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional(), metadataJson: z.object({ startsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(), endsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional() }).nullable().optional() })).mutation(async ({ input }) => {
      const { metadataJson, ...rest } = input;
      const meta = metadataJson && (metadataJson.startsAt != null || metadataJson.endsAt != null) ? { startsAt: metadataJson.startsAt ?? null, endsAt: metadataJson.endsAt ?? null } : undefined;
      return { id: await createContentSection({ ...rest, metadataJson: meta }) };
    }),
    updateContentSection: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number(), pageId: z.number().nullable().optional(), key: z.string().optional(), type: z.string().optional(), title: z.string().nullable().optional(), subtitle: z.string().nullable().optional(), body: z.string().nullable().optional(), imageUrl: z.string().nullable().optional(), buttonText: z.string().nullable().optional(), buttonUrl: z.string().nullable().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional(), metadataJson: z.object({ startsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(), endsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional() }).nullable().optional() })).mutation(async ({ input }) => { const { id, metadataJson, ...data } = input; const meta = metadataJson !== undefined ? (metadataJson && (metadataJson.startsAt != null || metadataJson.endsAt != null) ? { startsAt: metadataJson.startsAt ?? null, endsAt: metadataJson.endsAt ?? null } : null) : undefined; await updateContentSection(id, { ...data, ...(meta !== undefined && { metadataJson: meta }) }); return { success: true }; }),
    deleteContentSection: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteContentSection(input.id); return { success: true }; }),
    listSiteBanners: adminProcedure.use(usePermission("cms.view")).query(() => listSiteBanners()),
    getSiteBannerById: adminProcedure.use(usePermission("cms.view")).input(z.object({ id: z.number() })).query(({ input }) => getSiteBannerById(input.id)),
    createSiteBanner: adminProcedure.use(usePermission("cms.edit")).input(z.object({ key: z.string().min(1), title: z.string().nullable().optional(), subtitle: z.string().nullable().optional(), imageUrl: z.string().nullable().optional(), mobileImageUrl: z.string().nullable().optional(), buttonText: z.string().nullable().optional(), buttonUrl: z.string().nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().optional(), startsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(), endsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional() })).mutation(async ({ input }) => {
      const toDate = (v: string | number | Date | null | undefined): Date | null => v == null ? null : v instanceof Date ? v : typeof v === "number" ? new Date(v) : new Date(v);
      return { id: await createSiteBanner({ ...input, startsAt: toDate(input.startsAt), endsAt: toDate(input.endsAt) }) };
    }),
    updateSiteBanner: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number(), key: z.string().optional(), title: z.string().nullable().optional(), subtitle: z.string().nullable().optional(), imageUrl: z.string().nullable().optional(), mobileImageUrl: z.string().nullable().optional(), buttonText: z.string().nullable().optional(), buttonUrl: z.string().nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().optional(), startsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(), endsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional() })).mutation(async ({ input }) => {
      const toDate = (v: string | number | Date | null | undefined): Date | null => v == null ? null : v instanceof Date ? v : typeof v === "number" ? new Date(v) : new Date(v);
      const { id, ...rest } = input; await updateSiteBanner(id, { ...rest, startsAt: rest.startsAt !== undefined ? toDate(rest.startsAt) : undefined, endsAt: rest.endsAt !== undefined ? toDate(rest.endsAt) : undefined }); return { success: true };
    }),
    deleteSiteBanner: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteSiteBanner(input.id); return { success: true }; }),
    listSiteAnnouncements: adminProcedure.use(usePermission("cms.view")).query(() => listSiteAnnouncements()),
    getSiteAnnouncementById: adminProcedure.use(usePermission("cms.view")).input(z.object({ id: z.number() })).query(({ input }) => getSiteAnnouncementById(input.id)),
    createSiteAnnouncement: adminProcedure.use(usePermission("cms.edit")).input(z.object({ title: z.string().min(1), body: z.string().nullable().optional(), variant: z.enum(["info", "warning", "success", "neutral"]).optional(), isActive: z.boolean().optional(), startsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(), endsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional() })).mutation(async ({ input }) => {
      const toDate = (v: string | number | Date | null | undefined): Date | null => v == null ? null : v instanceof Date ? v : typeof v === "number" ? new Date(v) : new Date(v);
      return { id: await createSiteAnnouncement({ ...input, startsAt: toDate(input.startsAt), endsAt: toDate(input.endsAt) }) };
    }),
    updateSiteAnnouncement: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number(), title: z.string().optional(), body: z.string().nullable().optional(), variant: z.enum(["info", "warning", "success", "neutral"]).optional(), isActive: z.boolean().optional(), startsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(), endsAt: z.union([z.string(), z.number(), z.date()]).nullable().optional() })).mutation(async ({ input }) => {
      const toDate = (v: string | number | Date | null | undefined): Date | null => v == null ? null : v instanceof Date ? v : typeof v === "number" ? new Date(v) : new Date(v);
      const { id, ...rest } = input; await updateSiteAnnouncement(id, { ...rest, startsAt: rest.startsAt !== undefined ? toDate(rest.startsAt) : undefined, endsAt: rest.endsAt !== undefined ? toDate(rest.endsAt) : undefined }); return { success: true };
    }),
    deleteSiteAnnouncement: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteSiteAnnouncement(input.id); return { success: true }; }),

    listMediaAssets: adminProcedure.use(usePermission("cms.view")).input(z.object({ category: z.string().nullable().optional() }).optional()).query(({ input }) => listMediaAssets(input?.category ?? null)),
    deleteMediaAsset: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number() })).mutation(async ({ input }) => { await deleteMediaAsset(input.id); return { success: true }; }),
    updateMediaAsset: adminProcedure.use(usePermission("cms.edit")).input(z.object({ id: z.number(), altText: z.string().nullable().optional(), category: z.string().nullable().optional() })).mutation(async ({ input }) => { const { id, ...data } = input; await updateMediaAsset(id, data); return { success: true }; }),

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
                const resolved = await resolveScoring(
                  tournament,
                  { type: "football", matchResults: results, predictions: preds as Array<{ matchId: number; prediction: "1" | "X" | "2" }> }
                );
                await updateSubmissionPoints(s.id, resolved.points);
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
    /** Phase 19: Notifications center – list, get, mark read */
    listNotifications: adminProcedure
      .input(z.object({
        recipientType: z.enum(["admin", "user", "agent", "system"]).optional(),
        type: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      }).optional())
      .query(({ input }) => listNotifications({
        recipientType: input?.recipientType,
        type: input?.type,
        status: input?.status,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      })),
    getNotificationById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const n = await getNotificationById(input.id);
        if (!n) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
        return n;
      }),
    markNotificationRead: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const ok = await markNotificationRead(input.id);
        return { success: ok };
      }),
    // Phase 6 RBAC: roles & permissions (admin only; assign/remove require roles.manage)
    getRoles: adminProcedure.use(usePermission("roles.manage")).query(() => getAllRoles()),
    getPermissions: adminProcedure.use(usePermission("roles.manage")).query(() => getAllPermissions()),
    getUserRoles: adminProcedure
      .use(usePermission("roles.manage"))
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUserRoles(input.userId)),
    getRolePermissions: adminProcedure
      .use(usePermission("roles.manage"))
      .input(z.object({ roleId: z.number() }))
      .query(({ input }) => getRolePermissions(input.roleId)),
    /** Phase 7: Resolved competition items (legacy or universal) for a tournament – for admin/debug. */
    getResolvedTournamentItems: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => resolveTournamentItems(input.tournamentId)),
    /** Phase 7: List item sets stored in DB for a tournament (universal only). */
    getCompetitionItemSets: adminProcedure
      .input(z.object({ tournamentId: z.number() }))
      .query(({ input }) => getCompetitionItemSetsByTournament(input.tournamentId)),
    /** Phase 7: List items in a set (universal only). */
    getCompetitionItemsBySet: adminProcedure
      .input(z.object({ itemSetId: z.number() }))
      .query(({ input }) => getCompetitionItemsBySetId(input.itemSetId)),
    /** Phase 8: Create competition item set (universal DB). */
    createCompetitionItemSet: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({
        tournamentId: z.number(),
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        itemType: z.string().min(1),
        sourceType: z.enum(["legacy", "universal"]).optional(),
        stage: z.string().optional().nullable(),
        round: z.string().optional().nullable(),
        groupKey: z.string().optional().nullable(),
        sortOrder: z.number().optional(),
        metadataJson: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const meta = input.metadataJson != null && input.metadataJson.trim() !== "" ? validateMetadataJson(input.metadataJson) : { valid: true as const, data: null };
        if (!meta.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "metadataJson: " + meta.error });
        return createCompetitionItemSet({
          tournamentId: input.tournamentId,
          title: input.title,
          description: input.description ?? null,
          itemType: input.itemType,
          sourceType: input.sourceType ?? "universal",
          stage: input.stage ?? null,
          round: input.round ?? null,
          groupKey: input.groupKey ?? null,
          sortOrder: input.sortOrder ?? 0,
          metadataJson: meta.data,
        });
      }),
    /** Phase 8: Update competition item set. */
    updateCompetitionItemSet: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        itemType: z.string().min(1).optional(),
        stage: z.string().optional().nullable(),
        round: z.string().optional().nullable(),
        groupKey: z.string().optional().nullable(),
        sortOrder: z.number().optional(),
        metadataJson: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const meta = input.metadataJson !== undefined && input.metadataJson != null && input.metadataJson.trim() !== "" ? validateMetadataJson(input.metadataJson) : input.metadataJson === null || input.metadataJson === "" ? { valid: true as const, data: null } : undefined;
        if (meta && !meta.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "metadataJson: " + meta.error });
        await updateCompetitionItemSet({
          id: input.id,
          title: input.title,
          description: input.description,
          itemType: input.itemType,
          stage: input.stage,
          round: input.round,
          groupKey: input.groupKey,
          sortOrder: input.sortOrder,
          metadataJson: meta?.data,
        });
        return { success: true };
      }),
    /** Phase 8: Delete competition item set. */
    deleteCompetitionItemSet: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCompetitionItemSet(input.id);
        return { success: true };
      }),
    /** Phase 8: Create competition item. */
    createCompetitionItem: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({
        itemSetId: z.number(),
        externalKey: z.string().optional().nullable(),
        title: z.string().min(1),
        subtitle: z.string().optional().nullable(),
        itemKind: z.string().min(1),
        startsAt: z.union([z.number(), z.string()]).optional().nullable(),
        closesAt: z.union([z.number(), z.string()]).optional().nullable(),
        sortOrder: z.number().optional(),
        optionSchemaJson: z.string().optional().nullable(),
        resultSchemaJson: z.string().optional().nullable(),
        status: z.string().optional(),
        metadataJson: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const opt = input.optionSchemaJson != null && input.optionSchemaJson.trim() !== "" ? validateOptionSchema(input.optionSchemaJson) : { valid: true as const, data: null };
        const res = input.resultSchemaJson != null && input.resultSchemaJson.trim() !== "" ? validateResultSchema(input.resultSchemaJson) : { valid: true as const, data: null };
        const meta = input.metadataJson != null && input.metadataJson.trim() !== "" ? validateMetadataJson(input.metadataJson) : { valid: true as const, data: null };
        if (!opt.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "optionSchemaJson: " + opt.error });
        if (!res.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "resultSchemaJson: " + res.error });
        if (!meta.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "metadataJson: " + meta.error });
        const startsAt = input.startsAt != null ? (typeof input.startsAt === "string" ? new Date(input.startsAt).getTime() : input.startsAt) : null;
        const closesAt = input.closesAt != null ? (typeof input.closesAt === "string" ? new Date(input.closesAt).getTime() : input.closesAt) : null;
        return createCompetitionItem({
          itemSetId: input.itemSetId,
          externalKey: input.externalKey ?? null,
          title: input.title,
          subtitle: input.subtitle ?? null,
          itemKind: input.itemKind,
          startsAt: Number.isNaN(startsAt) ? null : startsAt,
          closesAt: Number.isNaN(closesAt) ? null : closesAt,
          sortOrder: input.sortOrder ?? 0,
          optionSchemaJson: opt.data,
          resultSchemaJson: res.data,
          status: input.status ?? "open",
          metadataJson: meta.data,
        });
      }),
    /** Phase 8: Update competition item. */
    updateCompetitionItem: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({
        id: z.number(),
        externalKey: z.string().optional().nullable(),
        title: z.string().min(1).optional(),
        subtitle: z.string().optional().nullable(),
        itemKind: z.string().min(1).optional(),
        startsAt: z.union([z.number(), z.string()]).optional().nullable(),
        closesAt: z.union([z.number(), z.string()]).optional().nullable(),
        sortOrder: z.number().optional(),
        optionSchemaJson: z.string().optional().nullable(),
        resultSchemaJson: z.string().optional().nullable(),
        status: z.string().optional(),
        metadataJson: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const opt = input.optionSchemaJson !== undefined ? (input.optionSchemaJson != null && input.optionSchemaJson.trim() !== "" ? validateOptionSchema(input.optionSchemaJson) : { valid: true as const, data: null }) : undefined;
        const res = input.resultSchemaJson !== undefined ? (input.resultSchemaJson != null && input.resultSchemaJson.trim() !== "" ? validateResultSchema(input.resultSchemaJson) : { valid: true as const, data: null }) : undefined;
        const meta = input.metadataJson !== undefined ? (input.metadataJson != null && input.metadataJson.trim() !== "" ? validateMetadataJson(input.metadataJson) : { valid: true as const, data: null }) : undefined;
        if (opt && !opt.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "optionSchemaJson: " + opt.error });
        if (res && !res.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "resultSchemaJson: " + res.error });
        if (meta && !meta.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "metadataJson: " + meta.error });
        const startsAt = input.startsAt !== undefined && input.startsAt != null ? (typeof input.startsAt === "string" ? new Date(input.startsAt).getTime() : input.startsAt) : undefined;
        const closesAt = input.closesAt !== undefined && input.closesAt != null ? (typeof input.closesAt === "string" ? new Date(input.closesAt).getTime() : input.closesAt) : undefined;
        await updateCompetitionItem({
          id: input.id,
          externalKey: input.externalKey,
          title: input.title,
          subtitle: input.subtitle,
          itemKind: input.itemKind,
          startsAt: startsAt !== undefined ? (Number.isNaN(startsAt) ? null : startsAt) : undefined,
          closesAt: closesAt !== undefined ? (Number.isNaN(closesAt) ? null : closesAt) : undefined,
          sortOrder: input.sortOrder,
          optionSchemaJson: opt?.data,
          resultSchemaJson: res?.data,
          status: input.status,
          metadataJson: meta?.data,
        });
        return { success: true };
      }),
    /** Phase 8: Delete competition item. */
    deleteCompetitionItem: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCompetitionItem(input.id);
        return { success: true };
      }),
    /** Phase 8: Reorder items in a set (sortOrder = index in array). */
    reorderCompetitionItems: adminProcedure.use(usePermission("competitions.edit"))
      .input(z.object({ itemSetId: z.number(), order: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await reorderCompetitionItems(input.itemSetId, input.order);
        return { success: true };
      }),
    assignRole: adminProcedure.use(usePermission("roles.manage"))
      .input(z.object({ userId: z.number().int().positive(), roleId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await assignRoleToUser(input.userId, input.roleId);
        const { securityAudit } = await import("./_core/logger");
        securityAudit("role_assign", { userId: ctx.user!.id, username: (ctx.user as { username?: string }).username, targetUserId: input.userId, roleId: input.roleId, ip: getAuditIp(ctx) });
        return { success: true };
      }),
    removeRole: adminProcedure.use(usePermission("roles.manage"))
      .input(z.object({ userId: z.number().int().positive(), roleId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await removeRoleFromUser(input.userId, input.roleId);
        const { securityAudit } = await import("./_core/logger");
        securityAudit("role_remove", { userId: ctx.user!.id, username: (ctx.user as { username?: string }).username, targetUserId: input.userId, roleId: input.roleId, ip: getAuditIp(ctx) });
        return { success: true };
      }),
    createAgent: adminProcedure.use(usePermission("agents.manage"))
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
    setUserBlocked: adminProcedure.use(usePermission("users.manage"))
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
    /** עדכון פרטי משתמש (שם, טלפון, שם משתמש, אימייל) – מנהל בלבד. */
    updateUserProfile: adminProcedure.use(usePermission("users.manage"))
      .input(z.object({
        userId: z.number().int(),
        name: z.union([z.string().max(200), z.literal(""), z.null()]).optional(),
        phone: z.union([z.string().max(24), z.literal(""), z.null()]).optional(),
        username: z.union([z.string().min(2).max(64), z.literal(""), z.null()]).optional(),
        email: z.union([z.string().email("כתובת אימייל לא תקינה").max(320), z.literal(""), z.null()]).optional(),
      })      .refine(
        (data) => {
          const p = data.phone;
          if (p === undefined || p === null || String(p).trim() === "") return true;
          const digits = String(p).replace(/\D/g, "");
          return digits.length >= 9 && digits.length <= 15;
        },
        { message: "טלפון חייב להכיל 9–15 ספרות", path: ["phone"] }
      ))
      .mutation(async ({ ctx, input }) => {
        const payload: { name?: string | null; phone?: string | null; username?: string | null; email?: string | null } = {};
        if (input.name !== undefined) payload.name = (input.name == null || input.name === "") ? null : String(input.name).trim() || null;
        if (input.phone !== undefined) payload.phone = (input.phone == null || input.phone === "") ? null : String(input.phone).trim() || null;
        if (input.username !== undefined) payload.username = (input.username == null || input.username === "") ? null : String(input.username).trim() || null;
        if (input.email !== undefined) payload.email = (input.email == null || input.email === "") ? null : String(input.email).trim() || null;
        await updateUserProfile(input.userId, payload);
        await insertAdminAuditLog({
          performedBy: ctx.user!.id,
          action: "Update User Profile",
          targetUserId: input.userId,
          details: { fields: Object.keys(payload), ip: getAuditIp(ctx) },
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
        const { getAgentCommissionsByAgentIdWithTournamentCommission } = await import("./db");
        const reports: Array<{
          agentId: number;
          username: string | null;
          referralCode: string | null;
          referredUsers: number;
          totalEntryAmount: number;
          totalCommission: number;
          totalSiteCommission: number;
          commissions: Array<{ submissionId: number; userId: number; entryAmount: number; commissionAmount: number; createdAt: Date | null }>;
        }> = [];
        for (const agent of agents) {
          if (!agent || agent.role !== "agent") continue;
          const referred = await getUsersByAgentId(agent.id);
          const commissions = await getAgentCommissionsByAgentIdExistingOnly(agent.id);
          const withBps = await getAgentCommissionsByAgentIdWithTournamentCommission(agent.id);
          const totalCommission = commissions.reduce((s, c) => s + c.commissionAmount, 0);
          const totalEntryAmount = commissions.reduce((s, c) => s + c.entryAmount, 0);
          const totalSiteCommission = withBps.reduce(
            (s, r) => s + (Math.floor((r.entryAmount * r.commissionPercentBasisPoints) / 10_000) - r.commissionAmount),
            0
          );
          reports.push({
            agentId: agent.id,
            username: agent.username,
            referralCode: agent.referralCode,
            referredUsers: referred.length,
            totalEntryAmount,
            totalCommission,
            totalSiteCommission,
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
    /** Settlement: דוח שחקן – Entry | Winnings | Commission | Result. Final signed result. */
    getPlayerSettlementReport: adminProcedure
      .use(usePermission("finance.view"))
      .input(z.object({ userId: z.number().int().positive(), from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ input }) => {
        return getPlayerSettlementReport(input.userId, { from: input.from, to: input.to });
      }),
    exportPlayerSettlementCSV: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const report = await getPlayerSettlementReport(input.userId, { from: input.from, to: input.to });
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "שחקן לא נמצא" });
        return { csv: settlementPlayerReportToCsv(report) };
      }),
    /** Settlement: דוח סוכן – Entries | Agent Commission | Result. Agent final balance vs site. */
    getAgentSettlementReport: adminProcedure
      .use(usePermission("finance.view"))
      .input(z.object({ agentId: z.number().int(), from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ input }) => {
        return getAgentSettlementReport(input.agentId, { from: input.from, to: input.to });
      }),
    exportAgentSettlementCSV: adminProcedure
      .input(z.object({ agentId: z.number().int(), from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const report = await getAgentSettlementReport(input.agentId, { from: input.from, to: input.to });
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "סוכן לא נמצא" });
        return { csv: settlementAgentReportToCsv(report) };
      }),
    /** Settlement: דוח גלובלי – Entries | Winnings | Site Commission | Result. Total site profit. */
    getGlobalSettlementReport: adminProcedure
      .use(usePermission("finance.view"))
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ input }) => {
        return getGlobalSettlementReport({ from: input.from, to: input.to });
      }),
    exportGlobalSettlementCSV: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const report = await getGlobalSettlementReport({ from: input.from, to: input.to });
        return { csv: settlementGlobalReportToCsv(report) };
      }),
    /** Settlement: דוח פרירול – Competition | Prize Paid | Site Expense. */
    getFreerollSettlementReport: adminProcedure
      .use(usePermission("finance.view"))
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ input }) => {
        return getFreerollSettlementReport({ from: input.from, to: input.to });
      }),
    exportFreerollSettlementCSV: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).strict())
      .query(async ({ ctx, input }) => {
        checkExportRateLimit(ctx);
        const report = await getFreerollSettlementReport({ from: input.from, to: input.to });
        return { csv: settlementFreerollReportToCsv(report) };
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
  }),
});

export type AppRouter = typeof appRouter;
