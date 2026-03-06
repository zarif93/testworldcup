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
  /** נקודות למשתמש – משמשות להשתתפות בתחרויות; מנהל ללא הגבלה */
  points: integer("points").default(0).notNull(),
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

/** טורנירים / תחרויות */
export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** ליגה – אם מוגדר, התחרות מבוססת Pool (ליגה) */
  leagueId: integer("leagueId"),
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
  /** אחוז עמלת בית (12.5) */
  houseFeeRate: integer("houseFeeRate").default(12.5),
  /** אחוז מעמלת הבית שהסוכן מקבל (50) */
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

/** משחקים בתחרות כדורגל (מנהל מגדיר ידנית – לא מונדיאל) */
export const customFootballMatches = sqliteTable("custom_football_matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournamentId").notNull(),
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
