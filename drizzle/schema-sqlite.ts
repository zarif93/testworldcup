import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin", "agent"] }).default("user").notNull(),
  username: text("username").unique(),
  passwordHash: text("passwordHash"),
  phone: text("phone"),
  /** סוכן שהביא את המשתמש – רק למשתמשים שנרשמו דרך קוד הפניה של סוכן */
  agentId: integer("agentId"),
  /** קוד הפניה ייחודי – רק לסוכנים (role=agent) */
  referralCode: text("referralCode").unique(),
  /** נקודות למשתמש – משמשות להשתתפות בתחרויות */
  points: integer("points").default(0).notNull(),
  /** הרשאת עקיפת יתרה – למנהלים/סופר-מנהלים בלבד, בלי לאחסן יתרה מזויפת */
  unlimitedPoints: integer("unlimitedPoints", { mode: "boolean" }).default(false).notNull(),
  /** חסימה – משתמש חסום לא יכול להתחבר */
  isBlocked: integer("isBlocked", { mode: "boolean" }).default(false),
  /** מחיקה רכה – משתמש שנמחק לא מוצג ברשימות פעילות ולא יכול להתחבר; נתוני כספים נשמרים */
  deletedAt: integer("deletedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** ליגות – enable/disable, soft delete; תחרויות מקושרות ב־leagueId */
export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type League = typeof leagues.$inferSelect;
export type InsertLeague = typeof leagues.$inferInsert;

/** סוגי תחרויות – תבניות להגדרת תחרות דינמית (Phase 2A). קוד יציב: football, football_custom, lotto, chance */
export const competitionTypes = sqliteTable("competition_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  icon: text("icon"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  defaultEntryFee: integer("defaultEntryFee"),
  defaultHouseFeePercent: integer("defaultHouseFeePercent"),
  defaultAgentSharePercent: integer("defaultAgentSharePercent"),
  formSchemaJson: text("formSchemaJson", { mode: "json" }),
  scoringConfigJson: text("scoringConfigJson", { mode: "json" }),
  settlementConfigJson: text("settlementConfigJson", { mode: "json" }),
  uiConfigJson: text("uiConfigJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type CompetitionType = typeof competitionTypes.$inferSelect;
export type InsertCompetitionType = typeof competitionTypes.$inferInsert;

/** טורנירים / תחרויות */
export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** ליגה – אם מוגדר, התחרות מבוססת Pool (ליגה) */
  leagueId: integer("leagueId"),
  /** סוג תחרות מהטבלה competition_types (אופציונלי – תאימות לאחור) */
  competitionTypeId: integer("competitionTypeId"),
  amount: integer("amount").notNull(),
  name: text("name").notNull(),
  isLocked: integer("isLocked", { mode: "boolean" }).default(false),
  /** תיאור התחרות */
  description: text("description"),
  /** סוג: CHANCE | LOTTO | FOOTBALL | WORLDCUP (תאימות: football_custom -> FOOTBALL) */
  type: text("type").default("football"),
  /** מועד פתיחה – מתחתיו לא מקבלים שליחות */
  opensAt: integer("opensAt", { mode: "timestamp" }),
  /** מועד סגירה – אחריו status -> LOCKED אוטומטית */
  closesAt: integer("closesAt", { mode: "timestamp" }),
  /** עלות כניסה בנקודות (null = amount) */
  entryCostPoints: integer("entryCostPoints"),
  /** אחוז עמלת בית (12.5) – תאימות לאחור */
  houseFeeRate: integer("houseFeeRate").default(12.5),
  /** Platform commission in basis points (1250 = 12.50%). Used for all commission calculations. */
  commissionPercentBasisPoints: integer("commissionPercentBasisPoints").notNull().default(1250),
  /** אחוז מעמלת הבית שהסוכן מקבל (50) – legacy display */
  agentShareOfHouseFee: integer("agentShareOfHouseFee").default(50),
  /** חוקים ספציפיים לסוג (JSON) */
  rulesJson: text("rulesJson", { mode: "json" }),
  /** מנהל שיצר את התחרות */
  createdBy: integer("createdBy"),
  /** תאריך התחלה (YYYY-MM-DD) */
  startDate: text("startDate"),
  /** תאריך סיום (YYYY-MM-DD) */
  endDate: text("endDate"),
  /** מועד פתיחה/סיום ליגה – timestamp */
  startsAt: integer("startsAt", { mode: "timestamp" }),
  endsAt: integer("endsAt", { mode: "timestamp" }),
  settledAt: integer("settledAt", { mode: "timestamp" }),
  /** מינימום משתתפים – אם לא הושג, אין חלוקת פרסים */
  minParticipants: integer("minParticipants").default(1),
  /** מקסימום משתתפים (null = ללא הגבלה) */
  maxParticipants: integer("maxParticipants"),
  /** סכום ה-Pool שנאסף (נקודות); לעדכון בהצטרפות */
  totalPoolPoints: integer("totalPoolPoints").default(0),
  /** סכום העמלה (12.5%); מתעדכן בהתנחלות */
  totalCommissionPoints: integer("totalCommissionPoints").default(0),
  /** קרן פרסים (total_pool - commission); גם להצגה */
  totalPrizePoolPoints: integer("totalPrizePoolPoints").default(0),
  /** פרס מובטח (נקודות) – מוצג ומשמש גם אם אין מספיק משתתפים; עדיפות על פני חישוב קרן */
  guaranteedPrizeAmount: integer("guaranteedPrizeAmount"),
  /** חלוקת פרסים באחוזים: למשל {"1":100} או {"1":50,"2":30,"3":20} */
  prizeDistribution: text("prizeDistribution", { mode: "json" }),
  /** מזהה תחרות – להזנה בעדכון תוצאות (לוטו). ייחודי. צ'אנס מזוהה לפי draw_date + draw_time. */
  drawCode: text("drawCode").unique(),
  /** תאריך הגרלה – צ'אנס (YYYY-MM-DD) */
  drawDate: text("drawDate"),
  /** שעת הגרלה – צ'אנס (HH:MM), בין 09:00 ל־21:00 */
  drawTime: text("drawTime"),
  /** מועד סיום תוצאות והצגת דירוג – לאחריו תחרות עוברת לארכיון (ללא מחיקת נתונים) */
  resultsFinalizedAt: integer("resultsFinalizedAt", { mode: "timestamp" }),
  /** סטטוס: UPCOMING | OPEN | LOCKED | CLOSED | SETTLED | ARCHIVED */
  status: text("status").default("OPEN"),
  /** מועד נעילה (כשמנהל לוחץ נעול או אוטומטי לפי closesAt) */
  lockedAt: integer("lockedAt", { mode: "timestamp" }),
  /** מועד הסרה מדף ראשי = lockedAt + 5 דקות */
  removalScheduledAt: integer("removalScheduledAt", { mode: "timestamp" }),
  /** VISIBLE | HIDDEN – אחרי טיימר 5 דקות מוגדר ל-HIDDEN */
  visibility: text("visibility").default("VISIBLE"),
  /** הסתרה מדף ראשי בידי מנהל – לא מוצג למשתמשים רגילים; נשמר בהיסטוריה */
  hiddenFromHomepage: integer("hiddenFromHomepage", { mode: "boolean" }).default(false),
  hiddenAt: integer("hiddenAt", { mode: "timestamp" }),
  hiddenByAdminId: integer("hiddenByAdminId"),
  /** מזהה ייחודי אופציונלי – למניעת כפילויות כשמנהל מזין; ריק = מאפשר כמה תחרויות עם אותו סכום */
  customIdentifier: text("customIdentifier"),
  /** מועד מעבר לארכיון (ללא מחיקת נתונים – שמירה לצמיתות) */
  dataCleanedAt: integer("dataCleanedAt", { mode: "timestamp" }),
  /** מועד ארכוב התחרות – נתונים נשמרים, רק סטטוס משתנה */
  archivedAt: integer("archivedAt", { mode: "timestamp" }),
  /** מחיקה רכה – תחרות שמנהל "מחק" (לא מוצגת ברשימות; נתונים פיננסיים נשמרים) */
  deletedAt: integer("deletedAt", { mode: "timestamp" }),
  /** צילום כספי בעת סיום – נשמר לצמיתות לדוחות מנהל */
  financialParticipantCount: integer("financialParticipantCount"),
  financialTotalParticipation: integer("financialTotalParticipation"),
  financialFee: integer("financialFee"),
  financialPrizeDistributed: integer("financialPrizeDistributed"),
  financialWinnerCount: integer("financialWinnerCount"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = typeof tournaments.$inferInsert;

/** משחקי שלב הבתים */
export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchNumber: integer("matchNumber").notNull().unique(),
  homeTeam: text("homeTeam").notNull(),
  awayTeam: text("awayTeam").notNull(),
  groupName: text("groupName").notNull(),
  matchDate: text("matchDate").notNull(),
  matchTime: text("matchTime").notNull(),
  stadium: text("stadium").notNull(),
  city: text("city").notNull(),
  homeScore: integer("homeScore"),
  awayScore: integer("awayScore"),
  status: text("status", { enum: ["upcoming", "live", "finished"] }).default("upcoming").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/** טפסי ניחושים - משתמש שולח טופס לטורניר (מספר בלתי מוגבל של כניסות לאותה תחרות) */
export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** מספר כניסה בתחרות (1, 2, 3...) – לתצוגה ולניהול */
  submissionNumber: integer("submissionNumber"),
  userId: integer("userId").notNull(),
  username: text("username").notNull(),
  tournamentId: integer("tournamentId").notNull(),
  /** סוכן שהביא את השחקן (nullable) */
  agentId: integer("agentId"),
  /** תוכן הטופס (ניחושים) – alias ל-predictions בתאימות */
  predictions: text("predictions", { mode: "json" }).notNull(),
  points: integer("points").default(0).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  paymentStatus: text("paymentStatus", { enum: ["pending", "completed", "failed"] }).default("pending").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  /** מספר פעמים שהטופס נערך (ללא חיוב) */
  editedCount: integer("editedCount").default(0).notNull(),
  lastEditedAt: integer("lastEditedAt", { mode: "timestamp" }),
  approvedAt: integer("approvedAt", { mode: "timestamp" }),
  approvedBy: integer("approvedBy"),
  /** לוטו: האם פגע במספר החזק (0/1) */
  strongHit: integer("strongHit", { mode: "boolean" }),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

/** עמלות סוכנים – רשומה לכל טופס מאושר של שחקן שהביא סוכן */
export const agentCommissions = sqliteTable("agent_commissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agentId").notNull(),
  submissionId: integer("submissionId").notNull(),
  userId: integer("userId").notNull(),
  entryAmount: integer("entryAmount").notNull(),
  commissionAmount: integer("commissionAmount").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type AgentCommission = typeof agentCommissions.$inferSelect;
export type InsertAgentCommission = typeof agentCommissions.$inferInsert;

/** הגדרות אתר – טקסטים, צבעים, באנרים (מפתח-ערך) */
export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

/** לוג פעולות סופר מנהל – מי ביצע, מה הפעולה, למי */
export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  performedBy: integer("performedBy").notNull(),
  action: text("action").notNull(),
  targetUserId: integer("targetUserId"),
  details: text("details", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

/** תוצאות תחרות – גנרי (resultsJson). צ'אנס/לוטו משתמשים גם ב־chance_draw_results / lotto_draw_results */
export const results = sqliteTable("results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournamentId").notNull().unique(),
  resultsJson: text("resultsJson", { mode: "json" }).notNull(),
  updatedBy: integer("updatedBy"),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type Result = typeof results.$inferSelect;
export type InsertResult = typeof results.$inferInsert;

/** צילום התנחלות – לכל תחרות שנסגרה; נתונים פיננסיים לא נמחקים */
export const settlement = sqliteTable("settlement", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournamentId").notNull().unique(),
  settledAt: integer("settledAt", { mode: "timestamp" }).notNull(),
  totalEntries: integer("totalEntries").notNull(),
  totalPrizePool: integer("totalPrizePool").notNull(),
  winnersCount: integer("winnersCount").notNull(),
  payoutPerWinner: integer("payoutPerWinner").notNull(),
  siteFeePoints: integer("siteFeePoints").notNull(),
  agentFeePoints: integer("agentFeePoints").notNull(),
  netToWinners: integer("netToWinners").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type Settlement = typeof settlement.$inferSelect;
export type InsertSettlement = typeof settlement.$inferInsert;

/** Ledger – כל תנועת נקודות חייבת לעבור כאן (חשבונאות חובה) */
export const ledgerTransactions = sqliteTable("ledger_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  actorUserId: integer("actorUserId"),
  subjectUserId: integer("subjectUserId"),
  agentId: integer("agentId"),
  tournamentId: integer("tournamentId"),
  type: text("type", {
    enum: [
      "ENTRY_DEBIT", "REFUND", "PRIZE_CREDIT", "SITE_FEE", "AGENT_FEE", "ADMIN_ADJUST",
      "DEPOSIT", "WITHDRAW", "AGENT_TRANSFER", "PRIZE", "PARTICIPATION", "ADMIN_APPROVAL",
    ],
  }).notNull(),
  amountPoints: integer("amountPoints").notNull(),
  balanceAfter: integer("balanceAfter"),
  metaJson: text("metaJson", { mode: "json" }),
});
export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
export type InsertLedgerTransaction = typeof ledgerTransactions.$inferInsert;

/** Audit Log – שקיפות תפעולית (כל פעולה משמעותית) */
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  actorId: integer("actorId").notNull(),
  actorRole: text("actorRole").notNull(),
  action: text("action").notNull(),
  entityType: text("entityType"),
  entityId: integer("entityId"),
  diffJson: text("diffJson", { mode: "json" }),
  ip: text("ip"),
  userAgent: text("userAgent"),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/** תוצאות הגרלת צ'אנס – לפי מפעל הפיס. טורניר אחד = הגרלה אחת (עדכון מחליף). */
export const chanceDrawResults = sqliteTable("chance_draw_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournamentId").notNull().unique(),
  heartCard: text("heartCard").notNull(),
  clubCard: text("clubCard").notNull(),
  diamondCard: text("diamondCard").notNull(),
  spadeCard: text("spadeCard").notNull(),
  drawDate: text("drawDate").notNull(),
  locked: integer("locked", { mode: "boolean" }).default(false),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedBy: integer("updatedBy"),
});
export type ChanceDrawResult = typeof chanceDrawResults.$inferSelect;
export type InsertChanceDrawResult = typeof chanceDrawResults.$inferInsert;

/** תוצאות הגרלת לוטו – לפי מפעל הפיס. 6 מספרים (1–37) + מספר חזק (1–7). */
export const lottoDrawResults = sqliteTable("lotto_draw_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournamentId").notNull().unique(),
  num1: integer("num1").notNull(),
  num2: integer("num2").notNull(),
  num3: integer("num3").notNull(),
  num4: integer("num4").notNull(),
  num5: integer("num5").notNull(),
  num6: integer("num6").notNull(),
  strongNumber: integer("strongNumber").notNull(),
  drawDate: text("drawDate").notNull(),
  locked: integer("locked", { mode: "boolean" }).default(false),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedBy: integer("updatedBy"),
});
export type LottoDrawResult = typeof lottoDrawResults.$inferSelect;
export type InsertLottoDrawResult = typeof lottoDrawResults.$inferInsert;

/** גלובלי: קבוצות לפי ענף (כדורגל, טניס וכו') – לשימוש במשחקים ובטורנירים */
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sportType: text("sportType").notNull().default("football"),
  logo: text("logo"),
  country: text("country"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

/** גלובלי: שחקנים (אופציונלי – לענפים כמו טניס) */
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sportType: text("sportType").notNull().default("tennis"),
  country: text("country"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;

/** משחקים בתחרות כדורגל (מנהל מגדיר ידנית – לא מונדיאל). homeTeam/awayTeam תאימות לאחור כשחסר teamId */
export const customFootballMatches = sqliteTable("custom_football_matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournamentId").notNull(),
  homeTeamId: integer("homeTeamId"),
  awayTeamId: integer("awayTeamId"),
  homeTeam: text("homeTeam").notNull(),
  awayTeam: text("awayTeam").notNull(),
  matchDate: text("matchDate"),
  matchTime: text("matchTime"),
  homeScore: integer("homeScore"),
  awayScore: integer("awayScore"),
  displayOrder: integer("displayOrder").default(0),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type CustomFootballMatch = typeof customFootballMatches.$inferSelect;
export type InsertCustomFootballMatch = typeof customFootballMatches.$inferInsert;

/** יומן תנועות נקודות – הפקדה, משיכה, השתתפות, זכייה, אישור טופס */
export const pointTransactions = sqliteTable("point_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balanceAfter").notNull(),
  actionType: text("actionType", { enum: ["deposit", "withdraw", "participation", "prize", "admin_approval", "refund", "agent_transfer"] }).notNull(),
  performedBy: integer("performedBy"),
  referenceId: integer("referenceId"),
  description: text("description"),
  /** עמלה לסוכן (רק לדוחות – לא נכנס ליתרה) */
  commissionAgent: integer("commissionAgent"),
  /** עמלה לבית (רק לדוחות – לא נכנס ליתרה) */
  commissionSite: integer("commissionSite"),
  /** סוכן מקושר לשחקן – לדוחות */
  agentId: integer("agentId"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type InsertPointTransaction = typeof pointTransactions.$inferInsert;

/** יומן העברות נקודות: סוכן↔שחקן, מנהל→סוכן. כל שינוי יתרה רק דרך רשומה כאן. */
export const pointTransferLog = sqliteTable("point_transfer_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: integer("fromUserId"),
  toUserId: integer("toUserId").notNull(),
  amount: integer("amount").notNull(),
  type: text("type", { enum: ["DEPOSIT", "WITHDRAW", "TRANSFER", "ADMIN_ADJUSTMENT"] }).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  note: text("note"),
});
export type PointTransferLog = typeof pointTransferLog.$inferSelect;
export type InsertPointTransferLog = typeof pointTransferLog.$inferInsert;

/** Phase 28: Payment transactions – structured tracking for entry fees, payouts, refunds; supports manual and future gateway. */
export const paymentTransactions = sqliteTable("payment_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  tournamentId: integer("tournamentId").notNull(),
  submissionId: integer("submissionId"),
  type: text("type", {
    enum: ["entry_fee", "payout", "deposit", "withdrawal", "refund", "manual_adjustment"],
  }).notNull(),
  amount: integer("amount").notNull(),
  currencyCode: text("currencyCode").default("points"),
  status: text("status", {
    enum: ["pending", "paid", "failed", "refunded", "cancelled"],
  }).notNull().default("pending"),
  provider: text("provider").default("manual"),
  externalRef: text("externalRef"),
  notes: text("notes"),
  metadataJson: text("metadataJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  paidAt: integer("paidAt", { mode: "timestamp" }),
});
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;

/** Per-agent override for share of commission (basis points). Fallback: site default or 5000. */
export const agentCommissionConfig = sqliteTable("agent_commission_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agentId").notNull().unique(),
  /** Agent share of commission in basis points (5000 = 50%). Null = use default. */
  agentShareBasisPoints: integer("agentShareBasisPoints"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type AgentCommissionConfig = typeof agentCommissionConfig.$inferSelect;
export type InsertAgentCommissionConfig = typeof agentCommissionConfig.$inferInsert;

/** Global immutable financial ledger – every monetary action recorded as event. amountPoints always >= 0; eventType defines direction. */
export const financialEvents = sqliteTable("financial_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("eventType", {
    enum: ["ENTRY_FEE", "PRIZE_PAYOUT", "PLATFORM_COMMISSION", "AGENT_COMMISSION", "REFUND", "ADJUSTMENT"],
  }).notNull(),
  tournamentId: integer("tournamentId"),
  userId: integer("userId"),
  agentId: integer("agentId"),
  submissionId: integer("submissionId"),
  /** Always non-negative. ENTRY_FEE = collected; PRIZE_PAYOUT = paid out; COMMISSION = amount; REFUND/ADJUSTMENT = magnitude. */
  amountPoints: integer("amountPoints").notNull(),
  idempotencyKey: text("idempotencyKey"),
  payloadJson: text("payloadJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type FinancialEvent = typeof financialEvents.$inferSelect;
export type InsertFinancialEvent = typeof financialEvents.$inferInsert;

/** רשומות כספיות לצמיתות – הכנסות (חלוקת פרסים) או החזרים; לא נמחקות אוטומטית */
export const financialRecords = sqliteTable("financial_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitionId: integer("competitionId").notNull(),
  competitionName: text("competitionName").notNull(),
  /** סוג רשומה: income = תחרות שהסתיימה וחולקו פרסים, refund = החזר עקב ביטול תחרות */
  recordType: text("recordType").default("income"),
  type: text("type").default("football"),
  totalCollected: integer("totalCollected").notNull(),
  siteFee: integer("siteFee").notNull(),
  totalPrizes: integer("totalPrizes").notNull(),
  netProfit: integer("netProfit").notNull(),
  participantsCount: integer("participantsCount").notNull(),
  winnersCount: integer("winnersCount").notNull(),
  closedAt: integer("closedAt", { mode: "timestamp" }).notNull(),
  /** JSON: { participants: [{ userId, username, amountPaid, prizeWon }] } */
  participantSnapshot: text("participantSnapshot", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type FinancialRecord = typeof financialRecords.$inferSelect;
export type InsertFinancialRecord = typeof financialRecords.$inferInsert;

/** לוג שקיפות כספים – ארכיון קבוע של כל פעולה כספית; ללא מחיקה ב־cascade */
export const financialTransparencyLog = sqliteTable("financial_transparency_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitionId: integer("competitionId").notNull(),
  competitionName: text("competitionName").notNull(),
  userId: integer("userId").notNull(),
  username: text("username").notNull(),
  agentId: integer("agentId"),
  type: text("type", { enum: ["Deposit", "Prize", "Commission", "Refund", "Bonus", "Adjustment", "AgentPointTransfer"] }).notNull(),
  amount: integer("amount").notNull(),
  siteProfit: integer("siteProfit").default(0).notNull(),
  agentProfit: integer("agentProfit").default(0).notNull(),
  transactionDate: integer("transactionDate", { mode: "timestamp" }).notNull(),
  competitionStatusAtTime: text("competitionStatusAtTime"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdBy: integer("createdBy"),
});
export type FinancialTransparencyLog = typeof financialTransparencyLog.$inferSelect;
export type InsertFinancialTransparencyLog = typeof financialTransparencyLog.$inferInsert;

// ---------- Phase 6: RBAC ----------
export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: integer("isSystem", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export const permissions = sqliteTable("permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
});
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

export const rolePermissions = sqliteTable("role_permissions", {
  roleId: integer("roleId").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permissionId").notNull().references(() => permissions.id, { onDelete: "cascade" }),
});
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

export const userRoles = sqliteTable("user_roles", {
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("roleId").notNull().references(() => roles.id, { onDelete: "cascade" }),
});
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// ---------- Phase 7: Universal competition items / events ----------
export const competitionItemSets = sqliteTable("competition_item_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournamentId").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  itemType: text("itemType").notNull(),
  sourceType: text("sourceType", { enum: ["legacy", "universal"] }).default("universal").notNull(),
  stage: text("stage"),
  round: text("round"),
  groupKey: text("groupKey"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  metadataJson: text("metadataJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type CompetitionItemSet = typeof competitionItemSets.$inferSelect;
export type InsertCompetitionItemSet = typeof competitionItemSets.$inferInsert;

export const competitionItems = sqliteTable("competition_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemSetId: integer("itemSetId").notNull().references(() => competitionItemSets.id, { onDelete: "cascade" }),
  externalKey: text("externalKey"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  itemKind: text("itemKind").notNull(),
  startsAt: integer("startsAt", { mode: "timestamp" }),
  closesAt: integer("closesAt", { mode: "timestamp" }),
  sortOrder: integer("sortOrder").default(0).notNull(),
  optionSchemaJson: text("optionSchemaJson", { mode: "json" }),
  resultSchemaJson: text("resultSchemaJson", { mode: "json" }),
  status: text("status").default("open").notNull(),
  metadataJson: text("metadataJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type CompetitionItem = typeof competitionItems.$inferSelect;
export type InsertCompetitionItem = typeof competitionItems.$inferInsert;

// ---------- Phase 11: CMS / Banners / Page content ----------
export const contentPages = sqliteTable("content_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  status: text("status", { enum: ["draft", "published"] }).default("draft").notNull(),
  seoTitle: text("seoTitle"),
  seoDescription: text("seoDescription"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type ContentPage = typeof contentPages.$inferSelect;
export type InsertContentPage = typeof contentPages.$inferInsert;

export const contentSections = sqliteTable("content_sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageId: integer("pageId").references(() => contentPages.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  type: text("type").notNull(),
  title: text("title"),
  subtitle: text("subtitle"),
  body: text("body"),
  imageUrl: text("imageUrl"),
  buttonText: text("buttonText"),
  buttonUrl: text("buttonUrl"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  metadataJson: text("metadataJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type ContentSection = typeof contentSections.$inferSelect;
export type InsertContentSection = typeof contentSections.$inferInsert;

export const siteBanners = sqliteTable("site_banners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull(),
  title: text("title"),
  subtitle: text("subtitle"),
  imageUrl: text("imageUrl"),
  mobileImageUrl: text("mobileImageUrl"),
  buttonText: text("buttonText"),
  buttonUrl: text("buttonUrl"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  startsAt: integer("startsAt", { mode: "timestamp" }),
  endsAt: integer("endsAt", { mode: "timestamp" }),
  metadataJson: text("metadataJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type SiteBanner = typeof siteBanners.$inferSelect;
export type InsertSiteBanner = typeof siteBanners.$inferInsert;

export const siteAnnouncements = sqliteTable("site_announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body"),
  variant: text("variant", { enum: ["info", "warning", "success", "neutral"] }).default("info").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  startsAt: integer("startsAt", { mode: "timestamp" }),
  endsAt: integer("endsAt", { mode: "timestamp" }),
  metadataJson: text("metadataJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type SiteAnnouncement = typeof siteAnnouncements.$inferSelect;
export type InsertSiteAnnouncement = typeof siteAnnouncements.$inferInsert;

// ---------- Phase 15: Media assets ----------
export const mediaAssets = sqliteTable("media_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  originalName: text("originalName").notNull(),
  mimeType: text("mimeType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  url: text("url").notNull(),
  altText: text("altText"),
  category: text("category"),
  metadataJson: text("metadataJson", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

// ---------- Phase 18: Automation engine (job log) ----------
export const automationJobs = sqliteTable("automation_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobType: text("jobType").notNull(),
  entityType: text("entityType").notNull().default("tournament"),
  entityId: integer("entityId").notNull(),
  scheduledAt: integer("scheduledAt", { mode: "timestamp" }),
  executedAt: integer("executedAt", { mode: "timestamp" }),
  status: text("status").notNull(),
  payloadJson: text("payloadJson", { mode: "json" }),
  lastError: text("lastError"),
  /** Phase 23: retry support */
  retryCount: integer("retry_count").default(0).notNull(),
  nextRetryAt: integer("next_retry_at", { mode: "timestamp" }),
  maxRetries: integer("max_retries").default(3).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type AutomationJob = typeof automationJobs.$inferSelect;
export type InsertAutomationJob = typeof automationJobs.$inferInsert;

// ---------- Phase 19: Notifications center ----------
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipientType: text("recipientType").notNull(), // admin | user | agent | system
  recipientId: integer("recipientId"), // null for system/admin broadcast
  channel: text("channel").notNull().default("in_app"), // in_app | email | whatsapp | sms | internal
  type: text("type").notNull(),
  title: text("title"),
  body: text("body"),
  payloadJson: text("payloadJson", { mode: "json" }),
  status: text("status").notNull().default("created"), // created | sent | failed | read
  readAt: integer("readAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  sentAt: integer("sentAt", { mode: "timestamp" }),
  lastError: text("lastError"),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ---------- Phase 20: Reusable competition templates ----------
export const competitionTemplates = sqliteTable("competition_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  competitionTypeId: integer("competitionTypeId"),
  /** Legacy type: football | football_custom | lotto | chance */
  legacyType: text("legacyType").notNull().default("football"),
  visibility: text("visibility").default("VISIBLE"),
  defaultEntryFee: integer("defaultEntryFee").notNull(),
  defaultMaxParticipants: integer("defaultMaxParticipants"),
  formSchemaJson: text("formSchemaJson", { mode: "json" }),
  scoringConfigJson: text("scoringConfigJson", { mode: "json" }),
  settlementConfigJson: text("settlementConfigJson", { mode: "json" }),
  rulesJson: text("rulesJson", { mode: "json" }),
  /** Item sets to create when instantiating: [{ title, itemType, sourceType }] */
  itemTemplateJson: text("itemTemplateJson", { mode: "json" }),
  isSystem: integer("isSystem", { mode: "boolean" }).default(false).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type CompetitionTemplate = typeof competitionTemplates.$inferSelect;
export type InsertCompetitionTemplate = typeof competitionTemplates.$inferInsert;

// ---------- Tournament template categories (extensible sport/category list) ----------
export const tournamentTemplateCategories = sqliteTable("tournament_template_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  displayOrder: integer("displayOrder").default(0).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type TournamentTemplateCategory = typeof tournamentTemplateCategories.$inferSelect;
export type InsertTournamentTemplateCategory = typeof tournamentTemplateCategories.$inferInsert;

// ---------- Tournament templates (create-from-template flow) ----------
/** configJson: tournamentType, scoringModel, inputFormat, prizeModel, defaultEntryAmount, defaultParticipantRules, defaultDurations, lifecycleDefaults, uiHints, sportSpecific */
export const tournamentTemplates = sqliteTable("tournament_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  configJson: text("configJson", { mode: "json" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type TournamentTemplate = typeof tournamentTemplates.$inferSelect;
export type InsertTournamentTemplate = typeof tournamentTemplates.$inferInsert;
