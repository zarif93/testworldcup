/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - db uses dynamic schema (SQLite/MySQL) so union types cause false errors at compile time; runtime uses SQLite when DATABASE_URL is not set.
import { eq, and, desc, asc, inArray, gte, lte, or, isNull, isNotNull, like, sql, notInArray, ne } from "drizzle-orm";
import { ENV } from "./_core/env";
import { WORLD_CUP_2026_MATCHES } from "@shared/matchesData";

const USE_SQLITE = !process.env.DATABASE_URL;
export { USE_SQLITE };

let _db: Awaited<ReturnType<typeof initSqlite>> | Awaited<ReturnType<typeof initMysql>> | null = null;
let _dbInitError: unknown = null;
let _sqlite: import("better-sqlite3").Database | null = null;
let _schema: (typeof import("../drizzle/schema-sqlite")) | (typeof import("../drizzle/schema")) | null = null;

export async function getSchema() {
  if (!_schema) {
    _schema = USE_SQLITE
      ? (await import("../drizzle/schema-sqlite"))
      : (await import("../drizzle/schema"));
  }
  return _schema;
}

/** Normalize a value to SQLite INTEGER timestamp (ms) or null. Use before insert/update for any integer timestamp column. */
function toTimestamp(value: string | number | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  try {
    const d = new Date(value as string);
    const t = Number.isNaN(d.getTime()) ? null : d.getTime();
    return t;
  } catch {
    return null;
  }
}

function isPrivilegedRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

function hasUnlimitedPointsAccess(user: { role?: string | null; unlimitedPoints?: boolean | number | null } | null | undefined): boolean {
  if (!user) return false;
  const unlimitedFlag = typeof user.unlimitedPoints === "boolean"
    ? user.unlimitedPoints
    : Number(user.unlimitedPoints ?? 0) === 1;
  return unlimitedFlag || isPrivilegedRole(user.role);
}

/** תאריך ושעת הגרלה (YYYY-MM-DD + HH:MM) ל-timestamp במילישניות – שעון ישראל +02:00. לשימוש בלוטו/צ'אנס. */
export function drawDateAndTimeToTimestamp(drawDate: string, drawTime: string): number {
  if (!drawDate?.trim() || !drawTime?.trim()) return 0;
  const s = drawDate.trim() + "T" + drawTime.trim() + ":00+02:00";
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

async function initSqlite() {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const { existsSync } = await import("fs");

  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
  const dbPath = join(dataDir, "worldcup.db");
  const busyTimeoutMs = typeof process.env.SQLITE_BUSY_TIMEOUT === "string" ? parseInt(process.env.SQLITE_BUSY_TIMEOUT, 10) : 15000;
  const sqlite = new Database(dbPath, { timeout: Number.isFinite(busyTimeoutMs) && busyTimeoutMs > 0 ? busyTimeoutMs : 15000 });
  sqlite.pragma("busy_timeout = " + (Number.isFinite(busyTimeoutMs) && busyTimeoutMs > 0 ? busyTimeoutMs : 15000));
  const { users, tournaments, matches, submissions, agentCommissions, agentCommissionConfig, siteSettings, chanceDrawResults, lottoDrawResults, teams, players, customFootballMatches, pointTransactions, pointTransferLog, adminAuditLog, financialRecords, financialTransparencyLog, financialEvents } = await import("../drizzle/schema-sqlite");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT, email TEXT, loginMethod TEXT, phone TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      username TEXT UNIQUE, passwordHash TEXT,
      agentId INTEGER, referralCode TEXT UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      unlimitedPoints INTEGER NOT NULL DEFAULT 0,
      isBlocked INTEGER DEFAULT 0,
      deletedAt INTEGER,
      createdAt INTEGER, updatedAt INTEGER, lastSignedIn INTEGER
    )
  `);
  const tableInfo = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const hasAgentId = tableInfo.some((c) => c.name === "agentId");
  const hasReferralCode = tableInfo.some((c) => c.name === "referralCode");
  if (!hasAgentId) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN agentId INTEGER`);
    console.log("[DB] Added column users.agentId");
  }
  if (!hasReferralCode) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN referralCode TEXT`);
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_referralCode_unique ON users(referralCode) WHERE referralCode IS NOT NULL`);
    console.log("[DB] Added column users.referralCode");
  }
  const hasPoints = tableInfo.some((c) => c.name === "points");
  if (!hasPoints) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0`);
    console.log("[DB] Added column users.points");
  }
  const hasUnlimitedPoints = tableInfo.some((c) => c.name === "unlimitedPoints");
  if (!hasUnlimitedPoints) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN unlimitedPoints INTEGER NOT NULL DEFAULT 0`);
    console.log("[DB] Added column users.unlimitedPoints");
  }
  const hasIsBlocked = tableInfo.some((c) => c.name === "isBlocked");
  if (!hasIsBlocked) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN isBlocked INTEGER DEFAULT 0`);
    console.log("[DB] Added column users.isBlocked");
  }
  const hasDeletedAt = tableInfo.some((c) => c.name === "deletedAt");
  if (!hasDeletedAt) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN deletedAt INTEGER`);
    console.log("[DB] Added column users.deletedAt");
  }
  const hasTokenVersion = tableInfo.some((c) => c.name === "tokenVersion");
  if (!hasTokenVersion) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN tokenVersion INTEGER NOT NULL DEFAULT 0`);
    console.log("[DB] Added column users.tokenVersion");
  }
  const now = Date.now();
  sqlite.prepare("UPDATE users SET unlimitedPoints = 1 WHERE role = 'admin' AND COALESCE(unlimitedPoints, 0) = 0").run();
  sqlite.prepare("UPDATE users SET unlimitedPoints = 0 WHERE role != 'admin' AND COALESCE(unlimitedPoints, 0) != 0").run();
  const normalizedAdmins = sqlite.prepare("UPDATE users SET points = 0, updatedAt = ? WHERE COALESCE(unlimitedPoints, 0) = 1 AND COALESCE(points, 0) != 0").run(now).changes;
  if (normalizedAdmins > 0) {
    console.log(`[DB] Normalized ${normalizedAdmins} unlimited admin balance(s) to 0`);
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      balanceAfter INTEGER NOT NULL,
      actionType TEXT NOT NULL,
      performedBy INTEGER,
      referenceId INTEGER,
      description TEXT,
      createdAt INTEGER
    )
  `);
  const ptInfo = sqlite.prepare("PRAGMA table_info(point_transactions)").all() as Array<{ name: string }>;
  if (!ptInfo.some((c) => c.name === "commissionAgent")) {
    sqlite.exec(`ALTER TABLE point_transactions ADD COLUMN commissionAgent INTEGER`);
    console.log("[DB] Added column point_transactions.commissionAgent");
  }
  if (!ptInfo.some((c) => c.name === "commissionSite")) {
    sqlite.exec(`ALTER TABLE point_transactions ADD COLUMN commissionSite INTEGER`);
    console.log("[DB] Added column point_transactions.commissionSite");
  }
  if (!ptInfo.some((c) => c.name === "agentId")) {
    sqlite.exec(`ALTER TABLE point_transactions ADD COLUMN agentId INTEGER`);
    console.log("[DB] Added column point_transactions.agentId");
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS point_transfer_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER,
      toUserId INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      createdBy INTEGER NOT NULL,
      createdAt INTEGER,
      note TEXT
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agentId INTEGER NOT NULL,
      submissionId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      entryAmount INTEGER NOT NULL,
      commissionAmount INTEGER NOT NULL,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL,
      name TEXT NOT NULL,
      isLocked INTEGER DEFAULT 0,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matchNumber INTEGER NOT NULL UNIQUE,
      homeTeam TEXT NOT NULL, awayTeam TEXT NOT NULL, groupName TEXT NOT NULL,
      matchDate TEXT NOT NULL, matchTime TEXT NOT NULL,
      stadium TEXT NOT NULL, city TEXT NOT NULL,
      homeScore INTEGER, awayScore INTEGER,
      status TEXT NOT NULL DEFAULT 'upcoming',
      createdAt INTEGER, updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL, username TEXT NOT NULL, tournamentId INTEGER NOT NULL,
      predictions TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      paymentStatus TEXT NOT NULL DEFAULT 'pending',
      createdAt INTEGER, updatedAt INTEGER, approvedAt INTEGER, approvedBy INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      performedBy INTEGER NOT NULL,
      action TEXT NOT NULL,
      targetUserId INTEGER,
      details TEXT,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chance_draw_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL UNIQUE,
      heartCard TEXT NOT NULL,
      clubCard TEXT NOT NULL,
      diamondCard TEXT NOT NULL,
      spadeCard TEXT NOT NULL,
      drawDate TEXT NOT NULL,
      locked INTEGER DEFAULT 0,
      updatedAt INTEGER,
      updatedBy INTEGER
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS lotto_draw_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL UNIQUE,
      num1 INTEGER NOT NULL,
      num2 INTEGER NOT NULL,
      num3 INTEGER NOT NULL,
      num4 INTEGER NOT NULL,
      num5 INTEGER NOT NULL,
      num6 INTEGER NOT NULL,
      strongNumber INTEGER NOT NULL,
      drawDate TEXT NOT NULL,
      locked INTEGER DEFAULT 0,
      updatedAt INTEGER,
      updatedBy INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sportType TEXT NOT NULL DEFAULT 'football',
      logo TEXT,
      country TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sportType TEXT NOT NULL DEFAULT 'tennis',
      country TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS custom_football_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL,
      homeTeamId INTEGER,
      awayTeamId INTEGER,
      homeTeam TEXT NOT NULL,
      awayTeam TEXT NOT NULL,
      matchDate TEXT,
      matchTime TEXT,
      homeScore INTEGER,
      awayScore INTEGER,
      displayOrder INTEGER DEFAULT 0,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  const cfmCols = sqlite.prepare("PRAGMA table_info(custom_football_matches)").all() as Array<{ name: string }>;
  if (!cfmCols.some((c) => c.name === "homeTeamId")) {
    sqlite.exec(`ALTER TABLE custom_football_matches ADD COLUMN homeTeamId INTEGER`);
    sqlite.exec(`ALTER TABLE custom_football_matches ADD COLUMN awayTeamId INTEGER`);
    console.log("[DB] Added columns custom_football_matches.homeTeamId, awayTeamId");
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitionId INTEGER NOT NULL,
      competitionName TEXT NOT NULL,
      type TEXT DEFAULT 'football',
      totalCollected INTEGER NOT NULL,
      siteFee INTEGER NOT NULL,
      totalPrizes INTEGER NOT NULL,
      netProfit INTEGER NOT NULL,
      participantsCount INTEGER NOT NULL,
      winnersCount INTEGER NOT NULL,
      closedAt INTEGER NOT NULL,
      participantSnapshot TEXT,
      createdAt INTEGER
    )
  `);
  const finCols = sqlite.prepare("PRAGMA table_info(financial_records)").all() as Array<{ name: string }>;
  if (!finCols.some((c) => c.name === "recordType")) {
    sqlite.exec(`ALTER TABLE financial_records ADD COLUMN recordType TEXT DEFAULT 'income'`);
    console.log("[DB] Added column financial_records.recordType");
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS financial_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventType TEXT NOT NULL CHECK(eventType IN ('ENTRY_FEE','PRIZE_PAYOUT','PLATFORM_COMMISSION','AGENT_COMMISSION','REFUND','ADJUSTMENT')),
      tournamentId INTEGER,
      userId INTEGER,
      agentId INTEGER,
      submissionId INTEGER,
      amountPoints INTEGER NOT NULL,
      idempotencyKey TEXT,
      payloadJson TEXT,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS financial_events_tournamentId ON financial_events(tournamentId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS financial_events_userId ON financial_events(userId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS financial_events_agentId ON financial_events(agentId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS financial_events_eventType ON financial_events(eventType)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS financial_events_createdAt ON financial_events(createdAt)`);
  sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS financial_events_idempotencyKey ON financial_events(idempotencyKey) WHERE idempotencyKey IS NOT NULL`);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_commission_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agentId INTEGER NOT NULL UNIQUE,
      agentShareBasisPoints INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  const tourColsAfter = sqlite.prepare("PRAGMA table_info(tournaments)").all() as Array<{ name: string }>;
  if (tourColsAfter.some((c) => c.name === "commissionPercentBasisPoints")) {
    sqlite.prepare("UPDATE tournaments SET commissionPercentBasisPoints = 1250 WHERE commissionPercentBasisPoints IS NULL").run();
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS financial_transparency_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitionId INTEGER NOT NULL,
      competitionName TEXT NOT NULL,
      userId INTEGER NOT NULL,
      username TEXT NOT NULL,
      agentId INTEGER,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      siteProfit INTEGER NOT NULL DEFAULT 0,
      agentProfit INTEGER NOT NULL DEFAULT 0,
      transactionDate INTEGER NOT NULL,
      competitionStatusAtTime TEXT,
      createdAt INTEGER,
      createdBy INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      tournamentId INTEGER NOT NULL,
      submissionId INTEGER,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currencyCode TEXT DEFAULT 'points',
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT DEFAULT 'manual',
      externalRef TEXT,
      notes TEXT,
      metadataJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      paidAt INTEGER
    )
  `);
  const subCols = sqlite.prepare("PRAGMA table_info(submissions)").all() as Array<{ name: string }>;
  if (!subCols.some((c) => c.name === "strongHit")) {
    sqlite.exec(`ALTER TABLE submissions ADD COLUMN strongHit INTEGER`);
    console.log("[DB] Added column submissions.strongHit");
  }
  if (!subCols.some((c) => c.name === "agentId")) {
    sqlite.exec(`ALTER TABLE submissions ADD COLUMN agentId INTEGER`);
    console.log("[DB] Added column submissions.agentId");
  }
  if (!subCols.some((c) => c.name === "submissionNumber")) {
    sqlite.exec(`ALTER TABLE submissions ADD COLUMN submissionNumber INTEGER`);
    console.log("[DB] Added column submissions.submissionNumber");
  }
  if (!subCols.some((c) => c.name === "editedCount")) {
    sqlite.exec(`ALTER TABLE submissions ADD COLUMN editedCount INTEGER DEFAULT 0`);
    console.log("[DB] Added column submissions.editedCount");
  }
  if (!subCols.some((c) => c.name === "lastEditedAt")) {
    sqlite.exec(`ALTER TABLE submissions ADD COLUMN lastEditedAt INTEGER`);
    console.log("[DB] Added column submissions.lastEditedAt");
  }

  const tourCols = sqlite.prepare("PRAGMA table_info(tournaments)").all() as Array<{ name: string }>;
  const tourColNames = new Set(tourCols.map((c) => c.name));
  const optionalCols: [string, string][] = [
    ["competitionTypeId", "INTEGER"],
    ["description", "TEXT"],
    ["type", "TEXT"],
    ["startDate", "TEXT"],
    ["endDate", "TEXT"],
    ["startsAt", "INTEGER"],
    ["endsAt", "INTEGER"],
    ["settledAt", "INTEGER"],
    ["maxParticipants", "INTEGER"],
    ["prizeDistribution", "TEXT"],
    ["drawCode", "TEXT"],
    ["drawDate", "TEXT"],
    ["drawTime", "TEXT"],
    ["resultsFinalizedAt", "INTEGER"],
    ["dataCleanedAt", "INTEGER"],
    ["archivedAt", "INTEGER"],
    ["deletedAt", "INTEGER"],
    ["financialParticipantCount", "INTEGER"],
    ["financialTotalParticipation", "INTEGER"],
    ["financialFee", "INTEGER"],
    ["financialPrizeDistributed", "INTEGER"],
    ["financialWinnerCount", "INTEGER"],
    ["status", "TEXT"],
    ["hiddenFromHomepage", "INTEGER"],
    ["hiddenAt", "INTEGER"],
    ["hiddenByAdminId", "INTEGER"],
    ["removalScheduledAt", "INTEGER"],
    ["visibility", "TEXT"],
    ["lockedAt", "INTEGER"],
    ["minParticipants", "INTEGER"],
    ["totalPoolPoints", "INTEGER"],
    ["totalCommissionPoints", "INTEGER"],
    ["totalPrizePoolPoints", "INTEGER"],
    ["guaranteedPrizeAmount", "INTEGER"],
    ["opensAt", "INTEGER"],
    ["closesAt", "INTEGER"],
    ["entryCostPoints", "INTEGER"],
    ["houseFeeRate", "INTEGER"],
    ["commissionPercent", "INTEGER"],
    ["commissionPercentBasisPoints", "INTEGER DEFAULT 1250"],
    ["agentShareOfHouseFee", "INTEGER"],
    ["rulesJson", "TEXT"],
    ["createdBy", "INTEGER"],
    ["leagueId", "INTEGER"],
    ["customIdentifier", "TEXT"],
  ];
  for (const [col, typ] of optionalCols) {
    if (!tourColNames.has(col)) {
      sqlite.exec(`ALTER TABLE tournaments ADD COLUMN ${col} ${typ}`);
      console.log("[DB] Added column tournaments." + col);
    }
  }
  // Repair: set status = OPEN only for tournaments that are clearly intended to be active (not deleted, not finalized).
  // Do not modify historical/finalized tournaments (settledAt/resultsFinalizedAt set).
  sqlite.prepare(
    `UPDATE tournaments SET status = 'OPEN' WHERE (status IS NULL OR status = '') AND deletedAt IS NULL AND settledAt IS NULL AND (resultsFinalizedAt IS NULL OR resultsFinalizedAt = 0)`
  ).run();
  try {
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS tournaments_drawCode_unique ON tournaments(drawCode) WHERE drawCode IS NOT NULL`);
  } catch (_) { /* index may already exist */ }
  try {
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS tournaments_chance_draw_datetime_unique ON tournaments(drawDate, drawTime) WHERE type = 'chance' AND drawDate IS NOT NULL AND drawTime IS NOT NULL`);
  } catch (_) { /* index may already exist */ }

  // הסרת ייחודיות (type, amount) – מאפשרים כמה תחרויות עם אותו סכום (למשל צ'אנס)
  try {
    sqlite.exec(`DROP INDEX IF EXISTS tournaments_type_amount_unique`);
    console.log("[DB] Dropped tournaments_type_amount_unique if present");
  } catch (_) { /* ignore */ }

  // מיגרציה: הסרת UNIQUE מ-amount (טבלאות ישנות עם amount UNIQUE)
  const tourTableSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tournaments'").get() as { sql: string } | undefined;
  if (tourTableSql?.sql && tourTableSql.sql.includes("amount INTEGER NOT NULL UNIQUE")) {
    sqlite.exec(`CREATE TABLE tournaments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL,
      name TEXT NOT NULL,
      isLocked INTEGER DEFAULT 0,
      createdAt INTEGER,
      description TEXT,
      type TEXT,
      startDate TEXT,
      endDate TEXT,
      maxParticipants INTEGER,
      prizeDistribution TEXT,
      drawCode TEXT
    )`);
    sqlite.exec(`INSERT INTO tournaments_new (id, amount, name, isLocked, createdAt, description, type, startDate, endDate, maxParticipants, prizeDistribution, drawCode)
      SELECT id, amount, name, isLocked, createdAt, description, COALESCE(type,'football'), startDate, endDate, maxParticipants, prizeDistribution, drawCode FROM tournaments`);
    sqlite.exec(`DROP TABLE tournaments`);
    sqlite.exec(`ALTER TABLE tournaments_new RENAME TO tournaments`);
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS tournaments_drawCode_unique ON tournaments(drawCode) WHERE drawCode IS NOT NULL`);
    console.log("[DB] Migrated tournaments: removed UNIQUE on amount");
  } else {
    // התקנה חדשה או טבלה בלי UNIQUE על amount – אין אינדקס ייחודי על (type, amount)
  }

  try {
    sqlite.exec(`CREATE INDEX IF NOT EXISTS submissions_tournamentId_idx ON submissions(tournamentId)`);
  } catch (_) { /* index may already exist */ }
  try {
    sqlite.exec(`CREATE INDEX IF NOT EXISTS point_transactions_reference_action_idx ON point_transactions(referenceId, actionType)`);
  } catch (_) { /* index may already exist */ }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      deletedAt INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  const leagueInfo = sqlite.prepare("PRAGMA table_info(leagues)").all() as Array<{ name: string }>;
  if (leagueInfo.length > 0 && !leagueInfo.some((c) => c.name === "enabled")) {
    sqlite.exec(`ALTER TABLE leagues ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`);
    console.log("[DB] Added column leagues.enabled");
  }
  if (leagueInfo.length > 0 && !leagueInfo.some((c) => c.name === "deletedAt")) {
    sqlite.exec(`ALTER TABLE leagues ADD COLUMN deletedAt INTEGER`);
    console.log("[DB] Added column leagues.deletedAt");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS competition_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      icon TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      defaultEntryFee INTEGER,
      defaultHouseFeePercent INTEGER,
      defaultAgentSharePercent INTEGER,
      formSchemaJson TEXT,
      scoringConfigJson TEXT,
      settlementConfigJson TEXT,
      uiConfigJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  const ctCount = sqlite.prepare("SELECT COUNT(*) as c FROM competition_types").get() as { c: number };
  if (ctCount.c === 0) {
    const now = Date.now();
    const seedRows: Array<{ code: string; name: string; description: string; category: string; sortOrder: number; defaultHouseFeePercent: number; defaultAgentSharePercent: number; formSchemaJson: string; scoringConfigJson: string; settlementConfigJson: string }> = [
      {
        code: "football",
        name: "מונדיאל / כדורגל",
        description: "ניחוש תוצאה לכל משחק (1 / X / 2). משחקים מקובעים (מונדיאל 2026).",
        category: "sports",
        sortOrder: 10,
        defaultHouseFeePercent: 12.5,
        defaultAgentSharePercent: 50,
        formSchemaJson: JSON.stringify({
          kind: "football_match_predictions",
          matchSource: "world_cup",
          outcomeType: "1X2",
          fieldsPerMatch: [{ type: "select", options: ["1", "X", "2"], key: "prediction" }],
        }),
        scoringConfigJson: JSON.stringify({
          pointsPerCorrectResult: 3,
          outcomeType: "1X2",
        }),
        settlementConfigJson: JSON.stringify({ minParticipants: 1, prizeDistributionDefault: { "1": 100 } }),
      },
      {
        code: "football_custom",
        name: "כדורגל מותאם",
        description: "ניחוש תוצאה (1/X/2) למשחקים שהמנהל מגדיר.",
        category: "sports",
        sortOrder: 20,
        defaultHouseFeePercent: 12.5,
        defaultAgentSharePercent: 50,
        formSchemaJson: JSON.stringify({
          kind: "football_match_predictions",
          matchSource: "custom",
          outcomeType: "1X2",
          fieldsPerMatch: [{ type: "select", options: ["1", "X", "2"], key: "prediction" }],
        }),
        scoringConfigJson: JSON.stringify({
          pointsPerCorrectResult: 3,
          outcomeType: "1X2",
        }),
        settlementConfigJson: JSON.stringify({ minParticipants: 1, prizeDistributionDefault: { "1": 100 } }),
      },
      {
        code: "lotto",
        name: "לוטו",
        description: "6 מספרים (1–37) + מספר חזק (1–7). מזוהה לפי drawCode.",
        category: "lottery",
        sortOrder: 30,
        defaultHouseFeePercent: 12.5,
        defaultAgentSharePercent: 50,
        formSchemaJson: JSON.stringify({
          kind: "lotto",
          regularCount: 6,
          regularMin: 1,
          regularMax: 37,
          strongMin: 1,
          strongMax: 7,
        }),
        scoringConfigJson: JSON.stringify({
          pointsPerMatchingNumber: 1,
          pointsForStrongHit: 1,
        }),
        settlementConfigJson: JSON.stringify({ minParticipants: 1, prizeDistributionDefault: { "1": 100 } }),
      },
      {
        code: "chance",
        name: "צ'אנס",
        description: "4 קלפים (לב, תלתן, יהלום, עלה) מערכה 7–A. מזוהה לפי drawDate + drawTime.",
        category: "cards",
        sortOrder: 40,
        defaultHouseFeePercent: 12.5,
        defaultAgentSharePercent: 50,
        formSchemaJson: JSON.stringify({
          kind: "chance",
          suits: ["heart", "club", "diamond", "spade"],
          cardValues: ["7", "8", "9", "10", "J", "Q", "K", "A"],
        }),
        scoringConfigJson: JSON.stringify({
          compareCardsPerSuit: true,
        }),
        settlementConfigJson: JSON.stringify({ minParticipants: 1, prizeDistributionDefault: { "1": 100 } }),
      },
    ];
    const ins = sqlite.prepare(`
      INSERT INTO competition_types (code, name, description, category, isActive, sortOrder, defaultHouseFeePercent, defaultAgentSharePercent, formSchemaJson, scoringConfigJson, settlementConfigJson, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of seedRows) {
      ins.run(
        r.code,
        r.name,
        r.description,
        r.category,
        r.sortOrder,
        r.defaultHouseFeePercent,
        r.defaultAgentSharePercent,
        r.formSchemaJson,
        r.scoringConfigJson,
        r.settlementConfigJson,
        now,
        now
      );
    }
    console.log("[DB] Seeded 4 competition types: football, football_custom, lotto, chance");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL UNIQUE,
      resultsJson TEXT NOT NULL,
      updatedBy INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settlement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL UNIQUE,
      settledAt INTEGER NOT NULL,
      totalEntries INTEGER NOT NULL,
      totalPrizePool INTEGER NOT NULL,
      winnersCount INTEGER NOT NULL,
      payoutPerWinner INTEGER NOT NULL,
      siteFeePoints INTEGER NOT NULL,
      agentFeePoints INTEGER NOT NULL,
      netToWinners INTEGER NOT NULL,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt INTEGER,
      actorUserId INTEGER,
      subjectUserId INTEGER,
      agentId INTEGER,
      tournamentId INTEGER,
      type TEXT NOT NULL,
      amountPoints INTEGER NOT NULL,
      balanceAfter INTEGER,
      metaJson TEXT
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt INTEGER,
      actorId INTEGER NOT NULL,
      actorRole TEXT NOT NULL,
      action TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      diffJson TEXT,
      ip TEXT,
      userAgent TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      isSystem INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      roleId INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permissionId INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roleId INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS competition_item_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      itemType TEXT NOT NULL,
      sourceType TEXT NOT NULL DEFAULT 'universal',
      stage TEXT,
      round TEXT,
      groupKey TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      metadataJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS competition_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemSetId INTEGER NOT NULL REFERENCES competition_item_sets(id) ON DELETE CASCADE,
      externalKey TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      itemKind TEXT NOT NULL,
      startsAt INTEGER,
      closesAt INTEGER,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      optionSchemaJson TEXT,
      resultSchemaJson TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      metadataJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS content_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      seoTitle TEXT,
      seoDescription TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS content_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pageId INTEGER REFERENCES content_pages(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      subtitle TEXT,
      body TEXT,
      imageUrl TEXT,
      buttonText TEXT,
      buttonUrl TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      metadataJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS site_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      title TEXT,
      subtitle TEXT,
      imageUrl TEXT,
      mobileImageUrl TEXT,
      buttonText TEXT,
      buttonUrl TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      startsAt INTEGER,
      endsAt INTEGER,
      metadataJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS site_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      variant TEXT NOT NULL DEFAULT 'info',
      isActive INTEGER NOT NULL DEFAULT 1,
      startsAt INTEGER,
      endsAt INTEGER,
      metadataJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      url TEXT NOT NULL,
      altText TEXT,
      category TEXT,
      metadataJson TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS automation_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobType TEXT NOT NULL,
      entityType TEXT NOT NULL DEFAULT 'tournament',
      entityId INTEGER NOT NULL,
      scheduledAt INTEGER,
      executedAt INTEGER,
      status TEXT NOT NULL,
      payloadJson TEXT,
      lastError TEXT,
      createdAt INTEGER
    )
  `);
  const ajInfo = sqlite.prepare("PRAGMA table_info(automation_jobs)").all() as Array<{ name: string }>;
  if (ajInfo.length > 0 && !ajInfo.some((c) => c.name === "retry_count")) {
    sqlite.exec(`ALTER TABLE automation_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`);
    console.log("[DB] Added column automation_jobs.retry_count");
  }
  if (ajInfo.length > 0 && !ajInfo.some((c) => c.name === "next_retry_at")) {
    sqlite.exec(`ALTER TABLE automation_jobs ADD COLUMN next_retry_at INTEGER`);
    console.log("[DB] Added column automation_jobs.next_retry_at");
  }
  if (ajInfo.length > 0 && !ajInfo.some((c) => c.name === "max_retries")) {
    sqlite.exec(`ALTER TABLE automation_jobs ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3`);
    console.log("[DB] Added column automation_jobs.max_retries");
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipientType TEXT NOT NULL,
      recipientId INTEGER,
      channel TEXT NOT NULL DEFAULT 'in_app',
      type TEXT NOT NULL,
      title TEXT,
      body TEXT,
      payloadJson TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      readAt INTEGER,
      createdAt INTEGER,
      sentAt INTEGER,
      lastError TEXT
    )
  `);
  /* Phase 11: Production foundations – anti-cheat, analytics */
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      deviceId TEXT,
      fingerprintHash TEXT,
      ip TEXT,
      userAgent TEXT,
      firstSeenAt INTEGER,
      lastSeenAt INTEGER
    )
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS user_devices_userId ON user_devices(userId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS user_devices_deviceId ON user_devices(deviceId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS user_devices_fingerprintHash ON user_devices(fingerprintHash)`);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS fraud_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      signalType TEXT NOT NULL,
      payloadJson TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      createdAt INTEGER
    )
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS fraud_signals_userId ON fraud_signals(userId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS fraud_signals_createdAt ON fraud_signals(createdAt)`);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventName TEXT NOT NULL,
      userId INTEGER,
      tournamentId INTEGER,
      payloadJson TEXT,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS analytics_events_eventName ON analytics_events(eventName)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS analytics_events_createdAt ON analytics_events(createdAt)`);
  /* Phase 12: Transaction engine + balance */
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS balance_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tournamentId INTEGER,
      submissionId INTEGER,
      idempotencyKey TEXT UNIQUE,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS balance_transactions_userId ON balance_transactions(userId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS balance_transactions_idempotencyKey ON balance_transactions(idempotencyKey)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS balance_transactions_tournamentId ON balance_transactions(tournamentId)`);
  try {
    sqlite.exec(`CREATE INDEX IF NOT EXISTS submissions_tournamentId_status ON submissions(tournamentId, status)`);
  } catch (_) { /* index may already exist */ }
  /* Phase 13: Financial audit trail */
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tournament_financial_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      payloadJson TEXT,
      createdAt INTEGER
    )
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tournament_financial_events_tournamentId ON tournament_financial_events(tournamentId)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS tournament_financial_events_eventType ON tournament_financial_events(eventType)`);
  /* Phase 14: Distributed locking for settlement and state transitions */
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tournament_locks (
      lockKey TEXT PRIMARY KEY,
      instanceId TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS competition_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      competitionTypeId INTEGER,
      legacyType TEXT NOT NULL DEFAULT 'football',
      visibility TEXT DEFAULT 'VISIBLE',
      defaultEntryFee INTEGER NOT NULL,
      defaultMaxParticipants INTEGER,
      formSchemaJson TEXT,
      scoringConfigJson TEXT,
      settlementConfigJson TEXT,
      rulesJson TEXT,
      itemTemplateJson TEXT,
      isSystem INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tournament_template_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      displayOrder INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tournament_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      configJson TEXT NOT NULL,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  const { leagues, competitionTypes, results, settlement, ledgerTransactions, auditLogs, roles, permissions, rolePermissions, userRoles, competitionItemSets, competitionItems, contentPages, contentSections, siteBanners, siteAnnouncements, mediaAssets, automationJobs, notifications, competitionTemplates, tournamentTemplateCategories, tournamentTemplates, paymentTransactions } = await import("../drizzle/schema-sqlite");
  const db = drizzle(sqlite, { schema: { users, tournaments, matches, submissions, agentCommissions, agentCommissionConfig, siteSettings, chanceDrawResults, lottoDrawResults, customFootballMatches, pointTransactions, pointTransferLog, adminAuditLog, financialRecords, financialTransparencyLog, financialEvents, leagues, competitionTypes, results, settlement, ledgerTransactions, auditLogs, roles, permissions, rolePermissions, userRoles, competitionItemSets, competitionItems, contentPages, contentSections, siteBanners, siteAnnouncements, mediaAssets, automationJobs, notifications, competitionTemplates, tournamentTemplateCategories, tournamentTemplates, paymentTransactions } });

  // עדכון רשימת המשחקים מהקבוע – idempotent: INSERT OR IGNORE so concurrent inits (e.g. tests) don't hit UNIQUE on matchNumber
  for (const m of WORLD_CUP_2026_MATCHES) {
    sqlite.prepare(`
      INSERT OR IGNORE INTO matches (matchNumber, homeTeam, awayTeam, groupName, matchDate, matchTime, stadium, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(m.matchNumber, m.homeTeam, m.awayTeam, m.group, m.date, m.time, m.stadium, m.city);
  }
  console.log("[DB] Synced 72 matches (World Cup 2026)");

  const tourCount = sqlite.prepare("SELECT COUNT(*) as c FROM tournaments").get() as { c: number };
  // לא מוסיפים טורנירים אוטומטית – האתר נשאר במצב שבו נסגר (אין seed בהפעלה)
  if (tourCount.c === 0) {
    console.log("[DB] No tournaments – add from admin panel");
  }

  // Seed tournament template categories and templates if empty (extensible; add more via admin later)
  const catCount = sqlite.prepare("SELECT COUNT(*) as c FROM tournament_template_categories").get() as { c: number };
  if (catCount.c === 0) {
    const categories: Array<[string, string, number]> = [
      ["football", "כדורגל", 10],
      ["basketball", "כדורסל", 20],
      ["tennis", "טניס", 30],
      ["baseball", "בייסבול", 40],
      ["american_football", "פוטבול אמריקאי", 50],
      ["hockey", "הוקי", 60],
      ["motorsports", "מוטורספורט", 70],
      ["esports", "איספורט", 80],
      ["lottery", "לוטו", 90],
      ["chance", "צ'אנס", 100],
      ["custom", "מותאם אישית", 110],
    ];
    for (const [code, name, order] of categories) {
      sqlite.prepare(
        "INSERT INTO tournament_template_categories (code, name, displayOrder, isActive) VALUES (?, ?, ?, 1)"
      ).run(code, name, order);
    }
    console.log("[DB] Seeded tournament template categories:", categories.length);
  } else {
    const categoryNamesHeb: Array<[string, string, string]> = [
      ["football", "Football", "כדורגל"],
      ["basketball", "Basketball", "כדורסל"],
      ["tennis", "Tennis", "טניס"],
      ["baseball", "Baseball", "בייסבול"],
      ["american_football", "American Football", "פוטבול אמריקאי"],
      ["hockey", "Hockey", "הוקי"],
      ["motorsports", "Motorsports", "מוטורספורט"],
      ["esports", "Esports", "איספורט"],
      ["lottery", "Lottery", "לוטו"],
      ["chance", "Chance", "צ'אנס"],
      ["custom", "Custom", "מותאם אישית"],
    ];
    const updCat = sqlite.prepare("UPDATE tournament_template_categories SET name = ? WHERE code = ? AND name = ?");
    for (const [code, oldName, newName] of categoryNamesHeb) updCat.run(newName, code, oldName);
  }
  const templateCount = sqlite.prepare("SELECT COUNT(*) as c FROM tournament_templates").get() as { c: number };
  if (templateCount.c === 0) {
    const now = Date.now();
    const templates: Array<{ name: string; category: string; description: string; config: object }> = [
      {
        name: "כדורגל בסיסי",
        category: "football",
        description: "תחרות כדורגל בסיסית – תוצאות משחקים, נקודות לכל תשובה נכונה.",
        config: {
          tournamentType: "football",
          scoringModel: "points_per_correct",
          inputFormat: "1X2",
          prizeModel: "pool_minus_fee",
          defaultEntryAmount: 10,
          defaultParticipantRules: { maxParticipants: null },
          defaultDurations: { defaultOpenHours: 48, defaultCloseHours: 2 },
          lifecycleDefaults: { initialStatus: "OPEN" },
          uiHints: { labelKey: "football_basic" },
        },
      },
      {
        name: "כדורסל בסיסי",
        category: "basketball",
        description: "תחרות כדורסל בסיסית – ניחוש מנצח או הפרש.",
        config: {
          tournamentType: "football_custom",
          scoringModel: "points_per_correct",
          inputFormat: "choose_one",
          prizeModel: "pool_minus_fee",
          defaultEntryAmount: 10,
          defaultParticipantRules: { maxParticipants: null },
          defaultDurations: { defaultOpenHours: 48, defaultCloseHours: 2 },
          lifecycleDefaults: { initialStatus: "OPEN" },
          uiHints: { labelKey: "basketball_basic" },
        },
      },
      {
        name: "טניס בסיסי",
        category: "tennis",
        description: "תחרות טניס בסיסית – ניחוש מנצחי משחק.",
        config: {
          tournamentType: "football_custom",
          scoringModel: "points_per_correct",
          inputFormat: "choose_one",
          prizeModel: "pool_minus_fee",
          defaultEntryAmount: 10,
          defaultParticipantRules: { maxParticipants: null },
          defaultDurations: { defaultOpenHours: 24, defaultCloseHours: 2 },
          lifecycleDefaults: { initialStatus: "OPEN" },
          uiHints: { labelKey: "tennis_basic" },
        },
      },
      {
        name: "לוטו בסיסי",
        category: "lottery",
        description: "לוטו בסיסי – בחירת מספרים, הגרלה בשעה קבועה.",
        config: {
          tournamentType: "lotto",
          scoringModel: "lotto_match",
          inputFormat: "numbers",
          prizeModel: "pool_minus_fee",
          defaultEntryAmount: 10,
          defaultParticipantRules: { maxParticipants: null },
          defaultDurations: { drawTime: "22:30" },
          lifecycleDefaults: { initialStatus: "OPEN" },
          uiHints: { labelKey: "lottery_basic" },
        },
      },
      {
        name: "צ'אנס בסיסי",
        category: "chance",
        description: "הגרלת צ'אנס – קלפים/לבבות, הגרלה בתאריך ובשעה.",
        config: {
          tournamentType: "chance",
          scoringModel: "chance_draw",
          inputFormat: "choose_one",
          prizeModel: "pool_minus_fee",
          defaultEntryAmount: 10,
          defaultParticipantRules: { maxParticipants: null },
          defaultDurations: { drawTime: "20:00" },
          lifecycleDefaults: { initialStatus: "OPEN" },
          uiHints: { labelKey: "chance_basic" },
        },
      },
      {
        name: "תבנית מותאמת בסיסית",
        category: "custom",
        description: "תחרות מותאמת – מבנה וחישוב ניקוד חופשיים.",
        config: {
          tournamentType: "custom",
          scoringModel: "manual",
          inputFormat: "choose_one",
          prizeModel: "pool_minus_fee",
          defaultEntryAmount: 10,
          defaultParticipantRules: { maxParticipants: null },
          defaultDurations: { defaultOpenHours: 72, defaultCloseHours: 2 },
          lifecycleDefaults: { initialStatus: "OPEN" },
          uiHints: { labelKey: "custom_basic" },
        },
      },
    ];
    for (const t of templates) {
      sqlite.prepare(
        "INSERT INTO tournament_templates (name, category, description, isActive, configJson, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?, ?)"
      ).run(t.name, t.category, t.description, JSON.stringify(t.config), now, now);
    }
    console.log("[DB] Seeded tournament templates:", templates.length);
  } else {
    const templateNamesHeb: Array<[string, string, string, string]> = [
      ["football", "Football basic", "כדורגל בסיסי", "תחרות כדורגל בסיסית – תוצאות משחקים, נקודות לכל תשובה נכונה."],
      ["basketball", "Basketball basic", "כדורסל בסיסי", "תחרות כדורסל בסיסית – ניחוש מנצח או הפרש."],
      ["tennis", "Tennis basic", "טניס בסיסי", "תחרות טניס בסיסית – ניחוש מנצחי משחק."],
      ["lottery", "Lottery basic", "לוטו בסיסי", "לוטו בסיסי – בחירת מספרים, הגרלה בשעה קבועה."],
      ["chance", "Chance basic", "צ'אנס בסיסי", "הגרלת צ'אנס – קלפים/לבבות, הגרלה בתאריך ובשעה."],
      ["custom", "Custom basic", "תבנית מותאמת בסיסית", "תחרות מותאמת – מבנה וחישוב ניקוד חופשיים."],
    ];
    const updTpl = sqlite.prepare("UPDATE tournament_templates SET name = ?, description = ? WHERE category = ? AND name = ?");
    for (const [category, oldName, newName, newDesc] of templateNamesHeb) updTpl.run(newName, newDesc, category, oldName);
  }

  // Phase 6: Seed RBAC roles and permissions if empty
  const rolesCount = sqlite.prepare("SELECT COUNT(*) as c FROM roles").get() as { c: number };
  if (rolesCount.c === 0) {
    const permRows: Array<{ code: string; name: string; category: string; description: string | null }> = [
      { code: "competitions.view", name: "View competitions", category: "competitions", description: null },
      { code: "competitions.create", name: "Create competition", category: "competitions", description: null },
      { code: "competitions.edit", name: "Edit competition", category: "competitions", description: null },
      { code: "competitions.delete", name: "Delete competition", category: "competitions", description: null },
      { code: "competitions.settle", name: "Settle / distribute prizes", category: "competitions", description: null },
      { code: "submissions.view", name: "View submissions", category: "submissions", description: null },
      { code: "submissions.approve", name: "Approve submission", category: "submissions", description: null },
      { code: "submissions.reject", name: "Reject submission", category: "submissions", description: null },
      { code: "users.view", name: "View users", category: "users", description: null },
      { code: "users.manage", name: "Manage users", category: "users", description: null },
      { code: "agents.view", name: "View agents", category: "agents", description: null },
      { code: "agents.manage", name: "Manage agents", category: "agents", description: null },
      { code: "finance.view", name: "View finance", category: "finance", description: null },
      { code: "finance.export", name: "Export finance", category: "finance", description: null },
      { code: "reports.view", name: "View reports", category: "reports", description: null },
      { code: "reports.export", name: "Export reports", category: "reports", description: null },
      { code: "cms.view", name: "View CMS", category: "cms", description: null },
      { code: "cms.edit", name: "Edit CMS", category: "cms", description: null },
      { code: "settings.manage", name: "Manage settings", category: "settings", description: null },
      { code: "roles.manage", name: "Manage roles", category: "roles", description: null },
    ];
    const insPerm = sqlite.prepare("INSERT INTO permissions (code, name, category, description) VALUES (?, ?, ?, ?)");
    for (const p of permRows) insPerm.run(p.code, p.name, p.category, p.description);
    const roleRows: Array<{ code: string; name: string; description: string | null; isSystem: number }> = [
      { code: "super_admin", name: "Super Admin", description: "Full access", isSystem: 1 },
      { code: "admin", name: "Admin", description: "Administrator", isSystem: 1 },
      { code: "finance_manager", name: "Finance Manager", description: "Finance and reports", isSystem: 1 },
      { code: "competition_manager", name: "Competition Manager", description: "Competitions and submissions", isSystem: 1 },
      { code: "support_agent", name: "Support Agent", description: "Submissions and users view", isSystem: 1 },
      { code: "content_manager", name: "Content Manager", description: "CMS", isSystem: 1 },
      { code: "agent_manager", name: "Agent Manager", description: "Agents and related", isSystem: 1 },
    ];
    const insRole = sqlite.prepare("INSERT INTO roles (code, name, description, isSystem, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)");
    const now = Date.now();
    for (const r of roleRows) insRole.run(r.code, r.name, r.description, r.isSystem, now, now);
    const permIds = sqlite.prepare("SELECT id, code FROM permissions").all() as Array<{ id: number; code: string }>;
    const permByCode = new Map(permIds.map((p) => [p.code, p.id]));
    const roleIds = sqlite.prepare("SELECT id, code FROM roles").all() as Array<{ id: number; code: string }>;
    const roleByCode = new Map(roleIds.map((r) => [r.code, r.id]));
    const insRp = sqlite.prepare("INSERT INTO role_permissions (roleId, permissionId) VALUES (?, ?)");
    const allPermIds = permIds.map((p) => p.id);
    const superAdminId = roleByCode.get("super_admin")!;
    for (const pid of allPermIds) insRp.run(superAdminId, pid);
    const adminId = roleByCode.get("admin")!;
    for (const pid of allPermIds) insRp.run(adminId, pid);
    const financeManagerId = roleByCode.get("finance_manager")!;
    for (const code of ["finance.view", "finance.export", "reports.view", "reports.export", "submissions.view", "users.view"]) {
      const pid = permByCode.get(code); if (pid) insRp.run(financeManagerId, pid);
    }
    const compManagerId = roleByCode.get("competition_manager")!;
    for (const code of ["competitions.view", "competitions.create", "competitions.edit", "competitions.settle", "submissions.view", "submissions.approve", "submissions.reject"]) {
      const pid = permByCode.get(code); if (pid) insRp.run(compManagerId, pid);
    }
    const supportId = roleByCode.get("support_agent")!;
    for (const code of ["submissions.view", "submissions.approve", "submissions.reject", "users.view"]) {
      const pid = permByCode.get(code); if (pid) insRp.run(supportId, pid);
    }
    const contentId = roleByCode.get("content_manager")!;
    for (const code of ["cms.view", "cms.edit"]) { const pid = permByCode.get(code); if (pid) insRp.run(contentId, pid); }
    const agentManagerId = roleByCode.get("agent_manager")!;
    for (const code of ["agents.view", "agents.manage", "users.view", "submissions.view"]) {
      const pid = permByCode.get(code); if (pid) insRp.run(agentManagerId, pid);
    }
    console.log("[DB] Phase 6 RBAC: seeded roles and permissions");
  }

  _sqlite = sqlite;
  return db;
}


async function initMysql() {
  const { drizzle } = await import("drizzle-orm/mysql2");
  const db = drizzle(process.env.DATABASE_URL!);
  // Ensure MySQL users table has columns expected by drizzle/schema.ts (e.g. stripeCustomerId).
  // Avoids "Failed query" / Unknown column when DB was created from an older migration.
  try {
    await db.execute(sql.raw("ALTER TABLE `users` ADD COLUMN `stripeCustomerId` VARCHAR(255) NULL"));
    console.log("[DB] MySQL: added column users.stripeCustomerId");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Duplicate column") || msg.includes("already exists")) {
      // Column already present, nothing to do
    } else {
      console.warn("[DB] MySQL users table alter skipped:", msg);
    }
  }
  return db;
}

export async function getDb() {
  if (_db) return _db;
  try {
    if (USE_SQLITE) {
      _db = await initSqlite();
      console.log("[Database] Using SQLite (./data/worldcup.db)");
    } else {
      _db = await initMysql();
      console.log("[Database] Using MySQL");
    }
  } catch (error) {
    _dbInitError = error;
    console.warn("[Database] Failed to connect:", error);
    _db = null;
  }
  return _db;
}

/** Returns the error that caused DB init to fail (if any). Use when getDb() returns null. */
export function getDbInitError(): unknown {
  return _dbInitError;
}

/** Phase 11: Raw SQLite instance for Phase 11 tables (user_devices, fraud_signals, analytics_events). Returns null if MySQL or not initialized. */
export async function getSqlite(): Promise<import("better-sqlite3").Database | null> {
  if (!USE_SQLITE) return null;
  await getDb();
  return _sqlite;
}

export async function upsertUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
}): Promise<void> {
  const { users } = await getSchema();
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;
  const values: Record<string, unknown> = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod", "lastSignedIn"]) {
    const v = (user as Record<string, unknown>)[field];
    if (v !== undefined) {
      values[field] = v ?? null;
      updateSet[field] = v ?? null;
    }
  }
  if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  try {
    if (USE_SQLITE) {
      await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
    } else {
      await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
    }
  } catch (e) {
    console.error("[Database] upsertUser:", e);
    throw e;
  }
}

export async function getUserByOpenId(openId: string) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}

export async function getUserByUsername(username: string) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const u = r[0];
  if (!u) return undefined;
  if ((u as { deletedAt?: Date | null }).deletedAt) return undefined;
  return u;
}

export async function getUserByEmail(email: string) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return r[0];
}

export async function getUserByPhone(phone: string) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return undefined;
  const list = await db.select().from(users);
  return list.find((u) => u.phone && u.phone.replace(/\D/g, "") === normalized);
}

export async function createUser(data: {
  username: string;
  passwordHash: string;
  name?: string;
  phone?: string;
  email?: string;
  agentId?: number;
}) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(users).values({
    username: data.username,
    email: data.email ?? null,
    phone: data.phone ?? null,
    passwordHash: data.passwordHash,
    name: data.name,
    openId: `local-${data.username}-${Date.now()}`,
    loginMethod: "local",
    role: "user",
    agentId: data.agentId ?? null,
    unlimitedPoints: false,
  });
}

/** עדכון תפקיד משתמש (למנהלים) */
export async function updateUserRole(userId: number, role: "user" | "admin" | "agent") {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const nextUnlimitedPoints = role === "admin";
  if (nextUnlimitedPoints) {
    await db.update(users).set({
      role,
      unlimitedPoints: true,
      points: 0,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
    return;
  }
  await db.update(users).set({
    role,
    unlimitedPoints: false,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}

/** עדכון סיסמת משתמש (רק מנהל – סיסמה מוצפנת) */
export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** יצירת משתמש מנהל (לשימוש בסקריפט חד-פעמי) */
export async function createAdminUser(data: {
  username: string;
  phone: string;
  passwordHash: string;
  name?: string;
}) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const openId = `local-admin-${data.username}-${Date.now()}`;
  await db.insert(users).values({
    username: data.username,
    phone: data.phone,
    passwordHash: data.passwordHash,
    name: data.name,
    openId,
    loginMethod: "local",
    role: "admin",
    unlimitedPoints: true,
    points: 0,
  });
}

export async function getUserById(id: number) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0];
}

export async function userHasUnlimitedPoints(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  return hasUnlimitedPointsAccess(user);
}

/** מחזיר את יתרת הנקודות של משתמש (0 אם לא קיים) */
export async function getUserPoints(userId: number): Promise<number> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ points: users.points }).from(users).where(eq(users.id, userId)).limit(1);
  const val = r[0]?.points;
  if (val == null) return 0;
  return Number(val);
}

/**
 * בדיקה מרכזית לכל סוגי התחרויות: האם למשתמש יש מספיק נקודות להשתתפות.
 * משתמש ב-DB בלבד (getUserPoints) – מקור אמת יחיד.
 * @returns { allowed, cost, currentBalance } – allowed=true רק אם מנהל / עלות 0 / יתרה >= עלות
 */
export async function validateTournamentEntry(
  userId: number,
  tournament: { amount?: number; entryCostPoints?: number | null },
  isAdmin: boolean
): Promise<{ allowed: boolean; cost: number; currentBalance: number }> {
  const cost = Number((tournament as { entryCostPoints?: number }).entryCostPoints ?? tournament.amount ?? 0);
  const hasUnlimitedPoints = isAdmin || await userHasUnlimitedPoints(userId);
  if (hasUnlimitedPoints || cost <= 0) {
    const currentBalance = cost <= 0 ? 0 : await getUserPoints(userId);
    return { allowed: true, cost, currentBalance };
  }
  const currentBalance = await getUserPoints(userId);
  return { allowed: currentBalance >= cost, cost, currentBalance };
}

export type PointActionType = "deposit" | "withdraw" | "participation" | "prize" | "admin_approval" | "refund" | "agent_transfer";

/** מוסיף נקודות למשתמש ורושם לוג. Only legitimate way to credit user.points – do not UPDATE users.points directly. */
export async function addUserPoints(
  userId: number,
  amount: number,
  actionType: PointActionType,
  opts?: { performedBy?: number; referenceId?: number; description?: string; agentId?: number }
): Promise<void> {
  if (amount <= 0) return;
  const targetUser = await getUserById(userId);
  if (hasUnlimitedPointsAccess(targetUser) && (actionType === "prize" || actionType === "refund")) {
    return;
  }
  const { users, pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const current = await getUserPoints(userId);
  const balanceAfter = current + amount;
  await db.update(users).set({ points: balanceAfter }).where(eq(users.id, userId));
  await db.insert(pointTransactions).values({
    userId,
    amount,
    balanceAfter,
    actionType,
    performedBy: opts?.performedBy ?? null,
    referenceId: opts?.referenceId ?? null,
    description: opts?.description ?? null,
  });
  const ledgerType: LedgerType = actionType === "prize" ? "PRIZE_CREDIT" : actionType === "deposit" ? "DEPOSIT" : actionType === "admin_approval" ? "ADMIN_ADJUST" : actionType === "refund" ? "REFUND" : actionType === "agent_transfer" ? "AGENT_TRANSFER" : "PRIZE_CREDIT";
  await insertLedgerTransaction({
    actorUserId: opts?.performedBy ?? null,
    subjectUserId: userId,
    agentId: opts?.agentId ?? null,
    tournamentId: opts?.referenceId ?? null,
    type: ledgerType,
    amountPoints: amount,
    balanceAfter,
    metaJson: opts?.description ? { description: opts.description } : undefined,
  });
}

/** מפחית נקודות (רק אם היתרה לא תהפוך לשלילית). מחזיר true אם בוצע, false אם לא מספיק. Only legitimate way to debit user.points – do not UPDATE users.points directly. */
export async function deductUserPoints(
  userId: number,
  amount: number,
  actionType: PointActionType,
  opts?: { performedBy?: number; referenceId?: number; description?: string; commissionAgent?: number; commissionSite?: number; agentId?: number }
): Promise<boolean> {
  if (amount <= 0) return true;
  const targetUser = await getUserById(userId);
  if (hasUnlimitedPointsAccess(targetUser) && actionType === "participation") {
    return true;
  }
  const current = await getUserPoints(userId);
  if (current < amount) return false;
  const { users, pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const balanceAfter = current - amount;
  await db.update(users).set({ points: balanceAfter }).where(eq(users.id, userId));
  await db.insert(pointTransactions).values({
    userId,
    amount: -amount,
    balanceAfter,
    actionType,
    performedBy: opts?.performedBy ?? null,
    referenceId: opts?.referenceId ?? null,
    description: opts?.description ?? null,
    commissionAgent: opts?.commissionAgent ?? null,
    commissionSite: opts?.commissionSite ?? null,
    agentId: opts?.agentId ?? null,
  });
  const ledgerType: LedgerType = actionType === "participation" ? "ENTRY_DEBIT" : actionType === "withdraw" ? "WITHDRAW" : actionType === "admin_approval" ? "ADMIN_ADJUST" : actionType === "refund" ? "REFUND" : actionType === "agent_transfer" ? "AGENT_TRANSFER" : "ENTRY_DEBIT";
  await insertLedgerTransaction({
    actorUserId: opts?.performedBy ?? null,
    subjectUserId: userId,
    agentId: opts?.agentId ?? null,
    tournamentId: opts?.referenceId ?? null,
    type: ledgerType,
    amountPoints: -amount,
    balanceAfter,
    metaJson: opts?.description || opts?.commissionAgent != null ? { description: opts?.description, commissionAgent: opts?.commissionAgent, commissionSite: opts?.commissionSite } : undefined,
  });
  return true;
}

/** Same shape as executeParticipationWithLock params for SQLite sync transaction. */
type ParticipationWithLockParams = {
  userId: number;
  username: string;
  tournamentId: number;
  cost: number;
  agentId: number | null;
  predictions: unknown;
  status: "approved" | "pending";
  paymentStatus: "completed" | "pending";
  description: string;
  referenceId: number;
  commissionAgent?: number;
  commissionSite?: number;
  strongHit?: boolean | null;
};

/**
 * SQLite-only: full participation (validate, deduct, submission, ENTRY_FEE, agent_commissions) in ONE sync transaction.
 * Safe under crash/retry/concurrency: idempotent by (userId, tournamentId) + ENTRY_FEE existence; no partial writes.
 */
function runParticipationAtomicSqlite(
  sqlite: import("better-sqlite3").Database,
  params: ParticipationWithLockParams
): { success: true; submissionId: number; balanceAfter: number } | { success: false } {
  const now = Date.now();
  const predictionsJson = typeof params.predictions === "string" ? params.predictions : JSON.stringify(params.predictions ?? {});
  const strongHitVal = params.strongHit != null ? (params.strongHit ? 1 : 0) : null;
  const commissionAgent = params.commissionAgent ?? 0;
  const commissionSite = params.commissionSite ?? 0;
  const payloadJson = params.cost > 0 ? JSON.stringify({ commissionAmount: commissionAgent + commissionSite, agentCommissionAmount: commissionAgent }) : null;

  const run = sqlite.transaction(() => {
    const tRow = sqlite.prepare("SELECT status, maxParticipants FROM tournaments WHERE id = ?").get(params.tournamentId) as { status?: string; maxParticipants?: number | null } | undefined;
    if (!tRow || tRow.status !== "OPEN") return { success: false as const };
    const maxParticipants = tRow.maxParticipants;
    if (maxParticipants != null && Number(maxParticipants) > 0) {
      const countRow = sqlite.prepare("SELECT COUNT(*) as c FROM submissions WHERE tournamentId = ?").get(params.tournamentId) as { c: number };
      if (countRow.c >= Number(maxParticipants)) return { success: false as const };
    }

    const existingSub = sqlite.prepare(
      "SELECT s.id FROM submissions s INNER JOIN financial_events f ON f.submissionId = s.id AND f.eventType = 'ENTRY_FEE' WHERE s.userId = ? AND s.tournamentId = ? ORDER BY s.id DESC LIMIT 1"
    ).get(params.userId, params.tournamentId) as { id: number } | undefined;
    if (existingSub) {
      const userRow = sqlite.prepare("SELECT points FROM users WHERE id = ?").get(params.userId) as { points: number } | undefined;
      return { success: true as const, submissionId: Number(existingSub.id), balanceAfter: Number(userRow?.points ?? 0) };
    }

    const userRow = sqlite.prepare("SELECT points FROM users WHERE id = ?").get(params.userId) as { points: number } | undefined;
    if (!userRow || Number(userRow.points ?? 0) < params.cost) return { success: false as const };
    const balanceAfter = Number(userRow.points ?? 0) - params.cost;

    sqlite.prepare("UPDATE users SET points = ?, updatedAt = ? WHERE id = ?").run(balanceAfter, now, params.userId);
    sqlite.prepare(`
      INSERT INTO point_transactions (userId, amount, balanceAfter, actionType, performedBy, referenceId, description, commissionAgent, commissionSite, agentId, createdAt)
      VALUES (?, ?, ?, 'participation', NULL, ?, ?, ?, ?, ?, ?)
    `).run(params.userId, -params.cost, balanceAfter, params.referenceId, params.description, commissionAgent || null, commissionSite || null, params.agentId, now);

    const countRow = sqlite.prepare("SELECT COUNT(*) as c FROM submissions WHERE tournamentId = ?").get(params.tournamentId) as { c: number };
    const nextNum = countRow.c + 1;
    sqlite.prepare(`
      INSERT INTO submissions (userId, username, tournamentId, agentId, submissionNumber, predictions, points, status, paymentStatus, strongHit)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(params.userId, params.username, params.tournamentId, params.agentId, nextNum, predictionsJson, params.status, params.paymentStatus, strongHitVal);

    const subRow = sqlite.prepare("SELECT id FROM submissions WHERE userId = ? AND tournamentId = ? ORDER BY id DESC LIMIT 1").get(params.userId, params.tournamentId) as { id: number } | undefined;
    const submissionId = subRow ? Number(subRow.id) : 0;
    if (submissionId <= 0) return { success: false as const };

    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, agentId, submissionId, idempotencyKey, payloadJson, createdAt)
      VALUES ('ENTRY_FEE', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(params.cost, params.tournamentId, params.userId, params.agentId, submissionId, `entry:${submissionId}`, payloadJson, now);

    if (params.agentId != null && commissionAgent > 0) {
      sqlite.prepare(`
        INSERT INTO agent_commissions (agentId, submissionId, userId, entryAmount, commissionAmount, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(params.agentId, submissionId, params.userId, params.cost, commissionAgent, now);
    }

    return { success: true as const, submissionId, balanceAfter };
  });
  try {
    return run() as { success: true; submissionId: number; balanceAfter: number } | { success: false };
  } catch {
    return { success: false };
  }
}

/** חיוב נקודות + יצירת submission + ENTRY_FEE event בטרנזקציה אחת. */
export async function executeParticipationWithLock(params: ParticipationWithLockParams): Promise<{ success: true; submissionId: number; balanceAfter: number } | { success: false }> {
  if (USE_SQLITE) {
    const sqlite = await getSqlite();
    if (sqlite) return runParticipationAtomicSqlite(sqlite, params);
  }

  const schema = await getSchema();
  const { users, pointTransactions, submissions, tournaments, financialEvents, agentCommissions } = schema;
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  try {
    const result = await db.transaction(async (tx) => {
      const [tRow] = await tx.select({ status: tournaments.status, maxParticipants: tournaments.maxParticipants }).from(tournaments).where(eq(tournaments.id, params.tournamentId)).limit(1);
      if (!tRow || (tRow as { status?: string }).status !== "OPEN") return { success: false as const };
      const maxParticipants = (tRow as { maxParticipants?: number | null }).maxParticipants;
      if (maxParticipants != null && Number(maxParticipants) > 0) {
        const countRows = await tx.select({ id: submissions.id }).from(submissions).where(eq(submissions.tournamentId, params.tournamentId));
        if (countRows.length >= Number(maxParticipants)) return { success: false as const };
      }

      const existingWithEntryFee = await tx.select({ id: submissions.id }).from(submissions).innerJoin(financialEvents, and(eq(financialEvents.submissionId, submissions.id), eq(financialEvents.eventType, "ENTRY_FEE"))).where(and(eq(submissions.userId, params.userId), eq(submissions.tournamentId, params.tournamentId))).orderBy(desc(submissions.id)).limit(1);
      if (existingWithEntryFee.length > 0) {
        const subId = (existingWithEntryFee[0] as { id: number }).id;
        const [u] = await tx.select({ points: users.points }).from(users).where(eq(users.id, params.userId)).limit(1);
        return { success: true as const, submissionId: Number(subId), balanceAfter: Number(u?.points ?? 0) };
      }

      const [row] = await tx.select({ points: users.points }).from(users).where(eq(users.id, params.userId)).limit(1);
      if (!row || Number(row.points ?? 0) < params.cost) return { success: false as const };
      const balanceAfter = Number(row.points ?? 0) - params.cost;
      await tx.update(users).set({ points: balanceAfter }).where(eq(users.id, params.userId));
      await tx.insert(pointTransactions).values({
        userId: params.userId,
        amount: -params.cost,
        balanceAfter,
        actionType: "participation",
        performedBy: null,
        referenceId: params.referenceId,
        description: params.description,
        commissionAgent: params.commissionAgent ?? null,
        commissionSite: params.commissionSite ?? null,
        agentId: params.agentId,
      });
      const countRows = await tx.select().from(submissions).where(eq(submissions.tournamentId, params.tournamentId));
      const nextNum = countRows.length + 1;
      await tx.insert(submissions).values({
        userId: params.userId,
        username: params.username,
        tournamentId: params.tournamentId,
        agentId: params.agentId,
        submissionNumber: nextNum,
        predictions: params.predictions as never,
        points: 0,
        status: params.status,
        paymentStatus: params.paymentStatus,
        strongHit: params.strongHit ?? null,
      });
      const created = await tx.select({ id: submissions.id }).from(submissions)
        .where(and(eq(submissions.userId, params.userId), eq(submissions.tournamentId, params.tournamentId)))
        .orderBy(desc(submissions.id))
        .limit(1);
      const submissionId = created[0]?.id ?? 0;
      if (submissionId > 0) {
        const commissionAmount = (params.commissionSite ?? 0) + (params.commissionAgent ?? 0);
        const agentCommissionAmount = params.commissionAgent ?? 0;
        await tx.insert(financialEvents).values({
          eventType: "ENTRY_FEE",
          amountPoints: params.cost,
          tournamentId: params.tournamentId,
          userId: params.userId,
          agentId: params.agentId,
          submissionId,
          idempotencyKey: `entry:${submissionId}`,
          payloadJson: { commissionAmount, agentCommissionAmount },
        });
        if (params.agentId != null && (params.commissionAgent ?? 0) > 0) {
          await tx.insert(agentCommissions).values({
            agentId: params.agentId,
            submissionId,
            userId: params.userId,
            entryAmount: params.cost,
            commissionAmount: params.commissionAgent,
          });
        }
      }
      return { success: true as const, submissionId, balanceAfter };
    });
    return result;
  } catch {
    return { success: false };
  }
}

/** Phase 11: Total winnings (prize) for a user – for payment/balance reporting. */
export async function getWinningsTotal(userId: number): Promise<number> {
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ amount: pointTransactions.amount })
    .from(pointTransactions)
    .where(and(eq(pointTransactions.userId, userId), eq(pointTransactions.actionType, "prize")));
  return rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

/** Phase 11: Total deposits (deposit + admin_approval) for a user – for balance reporting. */
export async function getDepositsTotal(userId: number): Promise<number> {
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ amount: pointTransactions.amount })
    .from(pointTransactions)
    .where(
      and(eq(pointTransactions.userId, userId), or(eq(pointTransactions.actionType, "deposit"), eq(pointTransactions.actionType, "admin_approval"))
    ));
  return rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

/** Total refunds (actionType refund) for a user – for walletNetFlow. */
export async function getRefundsTotal(userId: number): Promise<number> {
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ amount: pointTransactions.amount })
    .from(pointTransactions)
    .where(and(eq(pointTransactions.userId, userId), eq(pointTransactions.actionType, "refund")));
  return rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

/** Phase 12: Locked balance = sum of entry fees for user's approved/pending submissions in active tournaments (OPEN, LOCKED, RESULTS_UPDATED, SETTLING). */
export async function getLockedBalance(userId: number): Promise<number> {
  const { submissions, tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return 0;
  const activeStatuses = ["OPEN", "LOCKED", "RESULTS_UPDATED", "SETTLING"];
  const rows = await db
    .select({ amount: tournaments.amount })
    .from(submissions)
    .innerJoin(tournaments, eq(submissions.tournamentId, tournaments.id))
    .where(
      and(
        eq(submissions.userId, userId),
        inArray(submissions.status, ["approved", "pending"]),
        inArray(tournaments.status, activeStatuses),
        isNull(tournaments.deletedAt)
      )
    );
  return rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

/** היסטוריית תנועות נקודות למשתמש – אופציונלי עם טווח תאריכים */
export async function getPointsHistory(userId: number, opts?: { limit?: number; from?: string; to?: string }) {
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const limit = opts?.limit ?? 100;
  const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lte>> = [eq(pointTransactions.userId, userId)];
  if (opts?.from) conditions.push(gte(pointTransactions.createdAt, new Date(opts.from)));
  if (opts?.to) {
    const toEnd = new Date(opts.to);
    toEnd.setHours(23, 59, 59, 999);
    conditions.push(lte(pointTransactions.createdAt, toEnd));
  }
  const rows = await db
    .select()
    .from(pointTransactions)
    .where(and(...conditions))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);
  return rows;
}

/** סוכן מושך נקודות משחקן שלו → השחקן מפחית, הסוכן מקבל. טרנזקציה עם נעילה. */
export async function agentWithdrawFromPlayer(
  agentId: number,
  playerId: number,
  amount: number,
  createdBy: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: "סכום חייב להיות חיובי" };
  const player = await getUserById(playerId);
  if (!player) return { success: false, error: "שחקן לא נמצא" };
  if ((player as { agentId?: number | null }).agentId !== agentId) return { success: false, error: "השחקן לא משויך לסוכן זה" };
  const sqlite = USE_SQLITE ? _sqlite : null;
  if (!sqlite) return { success: false, error: "מערכת ארנק סוכן זמינה רק ב-SQLite" };
  try {
    sqlite.transaction(() => {
      const playerRow = sqlite.prepare("SELECT points FROM users WHERE id = ?").get(playerId) as { points: number } | undefined;
      const agentRow = sqlite.prepare("SELECT points FROM users WHERE id = ?").get(agentId) as { points: number } | undefined;
      if (!playerRow || !agentRow) throw new Error("משתמש לא נמצא");
      const playerPoints = Number(playerRow.points ?? 0);
      if (playerPoints < amount) throw new Error("לשחקן אין מספיק נקודות");
      const newPlayerPoints = playerPoints - amount;
      const newAgentPoints = Number(agentRow.points ?? 0) + amount;
      const now = Date.now();
      sqlite.prepare("UPDATE users SET points = ?, updatedAt = ? WHERE id = ?").run(newPlayerPoints, now, playerId);
      sqlite.prepare("UPDATE users SET points = ?, updatedAt = ? WHERE id = ?").run(newAgentPoints, now, agentId);
      sqlite.prepare("INSERT INTO point_transfer_log (fromUserId, toUserId, amount, type, createdBy, createdAt, note) VALUES (?, ?, ?, ?, ?, ?, ?)").run(playerId, agentId, amount, "WITHDRAW", createdBy, now, "משיכה מסוכן");
      sqlite.prepare("INSERT INTO point_transactions (userId, amount, balanceAfter, actionType, performedBy, referenceId, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(playerId, -amount, newPlayerPoints, "agent_transfer", createdBy, agentId, "משיכה לסוכן", now);
      sqlite.prepare("INSERT INTO point_transactions (userId, amount, balanceAfter, actionType, performedBy, referenceId, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(agentId, amount, newAgentPoints, "agent_transfer", createdBy, playerId, "משיכה משחקן", now);
    })();
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "שגיאה במשיכה" };
  }
  const playerName = (player as { username?: string }).username ?? `#${playerId}`;
  const agent = await getUserById(agentId);
  const agentName = (agent as { username?: string }).username ?? `#${agentId}`;
  await insertTransparencyLog({
    competitionId: 0,
    competitionName: "העברת נקודות סוכן",
    userId: playerId,
    username: playerName,
    agentId,
    type: "AgentPointTransfer",
    amount: -amount,
    siteProfit: 0,
    agentProfit: 0,
    transactionDate: new Date(),
    competitionStatusAtTime: "WITHDRAW",
    createdBy,
  });
  await insertTransparencyLog({
    competitionId: 0,
    competitionName: "העברת נקודות סוכן",
    userId: agentId,
    username: agentName,
    agentId,
    type: "AgentPointTransfer",
    amount,
    siteProfit: 0,
    agentProfit: 0,
    transactionDate: new Date(),
    competitionStatusAtTime: "WITHDRAW",
    createdBy,
  });
  return { success: true };
}

/** סוכן מפקיד נקודות לשחקן שלו → הסוכן מפחית, השחקן מקבל. טרנזקציה עם נעילה. */
export async function agentDepositToPlayer(
  agentId: number,
  playerId: number,
  amount: number,
  createdBy: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: "סכום חייב להיות חיובי" };
  const player = await getUserById(playerId);
  if (!player) return { success: false, error: "שחקן לא נמצא" };
  if ((player as { agentId?: number | null }).agentId !== agentId) return { success: false, error: "השחקן לא משויך לסוכן זה" };
  const sqlite = USE_SQLITE ? _sqlite : null;
  if (!sqlite) return { success: false, error: "מערכת ארנק סוכן זמינה רק ב-SQLite" };
  try {
    sqlite.transaction(() => {
      const agentRow = sqlite.prepare("SELECT points FROM users WHERE id = ?").get(agentId) as { points: number } | undefined;
      const playerRow = sqlite.prepare("SELECT points FROM users WHERE id = ?").get(playerId) as { points: number } | undefined;
      if (!agentRow || !playerRow) throw new Error("משתמש לא נמצא");
      const agentPoints = Number(agentRow.points ?? 0);
      if (agentPoints < amount) throw new Error("לסוכן אין מספיק נקודות");
      const newAgentPoints = agentPoints - amount;
      const newPlayerPoints = Number(playerRow.points ?? 0) + amount;
      const now = Date.now();
      sqlite.prepare("UPDATE users SET points = ?, updatedAt = ? WHERE id = ?").run(newAgentPoints, now, agentId);
      sqlite.prepare("UPDATE users SET points = ?, updatedAt = ? WHERE id = ?").run(newPlayerPoints, now, playerId);
      sqlite.prepare("INSERT INTO point_transfer_log (fromUserId, toUserId, amount, type, createdBy, createdAt, note) VALUES (?, ?, ?, ?, ?, ?, ?)").run(agentId, playerId, amount, "DEPOSIT", createdBy, now, "הפקדה לסוכן");
      sqlite.prepare("INSERT INTO point_transactions (userId, amount, balanceAfter, actionType, performedBy, referenceId, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(agentId, -amount, newAgentPoints, "agent_transfer", createdBy, playerId, "הפקדה לשחקן", now);
      sqlite.prepare("INSERT INTO point_transactions (userId, amount, balanceAfter, actionType, performedBy, referenceId, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(playerId, amount, newPlayerPoints, "agent_transfer", createdBy, agentId, "הפקדה מסוכן", now);
    })();
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "שגיאה בהפקדה" };
  }
  const playerName = (player as { username?: string }).username ?? `#${playerId}`;
  const agent = await getUserById(agentId);
  const agentName = (agent as { username?: string }).username ?? `#${agentId}`;
  await insertTransparencyLog({
    competitionId: 0,
    competitionName: "העברת נקודות סוכן",
    userId: agentId,
    username: agentName,
    agentId,
    type: "AgentPointTransfer",
    amount: -amount,
    siteProfit: 0,
    agentProfit: 0,
    transactionDate: new Date(),
    competitionStatusAtTime: "DEPOSIT",
    createdBy,
  });
  await insertTransparencyLog({
    competitionId: 0,
    competitionName: "העברת נקודות סוכן",
    userId: playerId,
    username: playerName,
    agentId,
    type: "AgentPointTransfer",
    amount,
    siteProfit: 0,
    agentProfit: 0,
    transactionDate: new Date(),
    competitionStatusAtTime: "DEPOSIT",
    createdBy,
  });
  return { success: true };
}

/** סטטיסטיקות ארנק לסוכן: יתרה, סך שהופקד לשחקנים, סך שנמשך משחקנים */
export async function getAgentWalletStats(agentId: number) {
  const db = await getDb();
  if (!db) return { balance: 0, totalDepositedToPlayers: 0, totalWithdrawnFromPlayers: 0 };
  const balance = await getUserPoints(agentId);
  const { pointTransferLog } = await getSchema();
  const rows = await db
    .select()
    .from(pointTransferLog)
    .where(or(eq(pointTransferLog.fromUserId, agentId), eq(pointTransferLog.toUserId, agentId)));
  let totalDepositedToPlayers = 0;
  let totalWithdrawnFromPlayers = 0;
  for (const r of rows) {
    const rec = r as { type?: string; amount?: number; fromUserId?: number; toUserId?: number };
    if (rec.type === "DEPOSIT" && rec.fromUserId === agentId) totalDepositedToPlayers += rec.amount ?? 0;
    if (rec.type === "WITHDRAW" && rec.toUserId === agentId) totalWithdrawnFromPlayers += rec.amount ?? 0;
  }
  return { balance, totalDepositedToPlayers, totalWithdrawnFromPlayers };
}

/** יומן העברות של סוכן (הוא ביצע או שחקנים שלו) */
export async function getAgentTransferLog(agentId: number, limit = 100) {
  const { pointTransferLog, users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(pointTransferLog)
    .where(or(eq(pointTransferLog.createdBy, agentId), eq(pointTransferLog.fromUserId, agentId), eq(pointTransferLog.toUserId, agentId)))
    .orderBy(desc(pointTransferLog.createdAt))
    .limit(limit);
  return rows;
}

/** שחקנים של סוכן עם יתרות – לדף ארנק סוכן */
export async function getMyPlayersWithBalances(agentId: number) {
  const list = await getUsersByAgentId(agentId);
  return list.map((u) => ({
    id: u.id,
    username: (u as { username?: string | null }).username ?? null,
    name: (u as { name?: string | null }).name ?? null,
    phone: (u as { phone?: string | null }).phone ?? null,
    points: (u as { points?: number }).points ?? 0,
  }));
}

/** רישום הפקדת מנהל לסוכן ביומן העברות (הנקודות כבר עודכנו ע"י addUserPoints) */
export async function recordAdminDepositToAgent(agentId: number, amount: number, performedBy: number) {
  const { pointTransferLog } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(pointTransferLog).values({
    fromUserId: null,
    toUserId: agentId,
    amount,
    type: "ADMIN_ADJUSTMENT",
    createdBy: performedBy,
    note: "הפקדה ממנהל",
  });
}

/** סכום יתרות כל השחקנים של סוכן – לדף סוכן */
export async function getAgentBalanceSummary(agentId: number): Promise<{ totalPlayersBalance: number }> {
  const players = await getMyPlayersWithBalances(agentId);
  const totalPlayersBalance = players.reduce((s, p) => s + (p.points ?? 0), 0);
  return { totalPlayersBalance };
}

/** סכום יתרות כל השחקנים (role=user) וכל הסוכנים (role=agent) – לדף מנהל */
export async function getAdminBalanceSummary(): Promise<{ totalPlayersBalance: number; totalAgentsBalance: number }> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return { totalPlayersBalance: 0, totalAgentsBalance: 0 };
  const all = await db.select({ id: users.id, role: users.role, points: users.points }).from(users);
  let totalPlayersBalance = 0;
  let totalAgentsBalance = 0;
  for (const u of all) {
    const role = (u as { role?: string }).role;
    const points = Number((u as { points?: number }).points ?? 0);
    if (role === "user") totalPlayersBalance += points;
    else if (role === "agent") totalAgentsBalance += points;
  }
  return { totalPlayersBalance, totalAgentsBalance };
}

/**
 * Excludes submissions from users with unlimited points (admin/super_admin or unlimitedPoints flag).
 * Use only for refund and points-accounting (e.g. who actually paid). For participant count,
 * prize pool, leaderboards, and public/admin stats use all approved submissions (no filter)
 * so super_admin participation is counted when they validly join.
 */
async function filterOutUnlimitedSubmissions<T extends { userId: number }>(submissionsList: T[]): Promise<T[]> {
  if (submissionsList.length === 0) return submissionsList;
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return submissionsList;
  const userIds = Array.from(new Set(submissionsList.map((sub) => sub.userId)));
  const userRows = await db
    .select({ id: users.id, role: users.role, unlimitedPoints: users.unlimitedPoints })
    .from(users)
    .where(inArray(users.id, userIds));
  const blockedIds = new Set(
    userRows
      .filter((user) => hasUnlimitedPointsAccess(user))
      .map((user) => user.id)
  );
  return submissionsList.filter((sub) => !blockedIds.has(sub.userId));
}


/** רשימת סוכנים עם יתרה וסכום יתרות השחקנים שלהם – למנהל */
export async function getAgentsWithBalances(): Promise<Array<{ id: number; username: string | null; name: string | null; points: number; totalPlayersBalance: number }>> {
  const agents = await getAgents();
  const result: Array<{ id: number; username: string | null; name: string | null; points: number; totalPlayersBalance: number }> = [];
  for (const a of agents) {
    const points = (a as { points?: number }).points ?? 0;
    const players = await getMyPlayersWithBalances(a.id);
    const totalPlayersBalance = players.reduce((s, p) => s + (p.points ?? 0), 0);
    result.push({
      id: a.id,
      username: (a as { username?: string | null }).username ?? null,
      name: (a as { name?: string | null }).name ?? null,
      points,
      totalPlayersBalance,
    });
  }
  return result;
}

/** לוג כל התנועות (למנהל) – אופציונלי לפי משתמש, תחרות, סוכן, סוג פעולה, טווח תאריכים */
export async function getPointsLogsForAdmin(opts?: {
  userId?: number;
  tournamentId?: number;
  agentId?: number;
  actionType?: string;
  limit?: number;
  from?: string;
  to?: string;
}) {
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const limit = opts?.limit ?? 200;
  if (opts?.tournamentId != null) {
    const conditions = [eq(pointTransactions.actionType, "prize"), eq(pointTransactions.referenceId, opts.tournamentId)];
    if (opts?.from) conditions.push(gte(pointTransactions.createdAt, new Date(opts.from)));
    if (opts?.to) {
      const toEnd = new Date(opts.to);
      toEnd.setHours(23, 59, 59, 999);
      conditions.push(lte(pointTransactions.createdAt, toEnd));
    }
    const rows = await db
      .select()
      .from(pointTransactions)
      .where(and(...conditions))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(limit);
    return rows;
  }
  const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lte>> = [];
  if (opts?.userId != null) conditions.push(eq(pointTransactions.userId, opts.userId));
  if (opts?.agentId != null) conditions.push(eq(pointTransactions.agentId, opts.agentId));
  if (opts?.actionType != null && opts.actionType !== "") conditions.push(eq(pointTransactions.actionType, opts.actionType));
  if (opts?.from) conditions.push(gte(pointTransactions.createdAt, new Date(opts.from)));
  if (opts?.to) {
    const toEnd = new Date(opts.to);
    toEnd.setHours(23, 59, 59, 999);
    conditions.push(lte(pointTransactions.createdAt, toEnd));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = whereClause
    ? await db.select().from(pointTransactions).where(whereClause).orderBy(desc(pointTransactions.createdAt)).limit(limit)
    : await db.select().from(pointTransactions).orderBy(desc(pointTransactions.createdAt)).limit(limit);
  return rows;
}

/** מחיקת כל היסטוריית תנועות הנקודות (למנהל בלבד) */
export async function deleteAllPointsLogsHistory(): Promise<void> {
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.delete(pointTransactions);
}

/** ניקוי מלא של האתר – מוחק את כל הנתונים ומשאיר רק סופר מנהל (Yoven! / Yoven).
 * 1. מחיקת משתמשים: כל השחקנים (user) וכל הסוכנים (agent) – נשארים רק מנהלים ששמם ב-SUPER_ADMIN_USERNAMES.
 * 2. מחיקת תחרויות: טורנירים, טפסים, תוצאות הגרלות (צ'אנס, לוטו, כדורגל מותאם), משחקי מונדיאל.
 * 3. מחיקת נקודות והיסטוריה: point_transactions, point_transfer_log, עמלות, דוחות כספיים, audit.
 * 4. איפוס דוחות: עמלות, מאזנים – הכל נמחק עם הטבלאות לעיל.
 * 5. סופר מנהל שנשאר מקבל points=0 והרשאת unlimitedPoints=1, deletedAt=NULL, isBlocked=0.
 * 6. אחרי המחיקה: משחקי מונדיאל (72) מסונכרנים מחדש כדי שהאתר יהיה מוכן לעבודה ללא הפעלה מחדש.
 * רק SQLite. */
export async function fullResetForSuperAdmin(): Promise<{ keptAdminUsernames: string[]; deletedUsers: number }> {
  if (!USE_SQLITE || !_sqlite) throw new Error("ניקוי מלא זמין רק במצב SQLite");
  const sqlite = _sqlite;
  const usernames = ENV.superAdminUsernames.map((u) => u.trim()).filter(Boolean);
  if (usernames.length === 0) throw new Error("לא הוגדר סופר מנהל – לא ניתן לבצע ניקוי מלא");

  const countUsersBefore = (sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;

  sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM agent_commissions").run();
    sqlite.prepare("DELETE FROM point_transactions").run();
    sqlite.prepare("DELETE FROM point_transfer_log").run();
    sqlite.prepare("DELETE FROM financial_transparency_log").run();
    sqlite.prepare("DELETE FROM financial_records").run();
    sqlite.prepare("DELETE FROM submissions").run();
    sqlite.prepare("DELETE FROM chance_draw_results").run();
    sqlite.prepare("DELETE FROM lotto_draw_results").run();
    sqlite.prepare("DELETE FROM custom_football_matches").run();
    sqlite.prepare("DELETE FROM tournaments").run();
    sqlite.prepare("DELETE FROM matches").run();
    sqlite.prepare("DELETE FROM admin_audit_log").run();

    const placeholders = usernames.map(() => "?").join(",");
    const kept = sqlite.prepare(
      `SELECT id, username FROM users WHERE role = 'admin' AND TRIM(COALESCE(username,'')) IN (${placeholders})`
    ).all(...usernames) as Array<{ id: number; username: string | null }>;
    const keptIds = kept.map((r) => r.id);

    if (keptIds.length > 0) {
      const delPlaceholders = keptIds.map(() => "?").join(",");
      sqlite.prepare(`DELETE FROM users WHERE id NOT IN (${delPlaceholders})`).run(...keptIds);
      const now = Date.now();
      for (const id of keptIds) {
        sqlite.prepare("UPDATE users SET points = 0, unlimitedPoints = 1, updatedAt = ?, deletedAt = NULL, isBlocked = 0, agentId = NULL WHERE id = ?").run(now, id);
      }
    } else {
      sqlite.prepare("DELETE FROM users").run();
    }
  })();

  // סנכרון מחדש של 72 משחקי מונדיאל – האתר מוכן לעבודה ללא הפעלה מחדש
  sqlite.prepare("DELETE FROM matches").run();
  for (const m of WORLD_CUP_2026_MATCHES) {
    sqlite.prepare(`
      INSERT INTO matches (matchNumber, homeTeam, awayTeam, groupName, matchDate, matchTime, stadium, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(m.matchNumber, m.homeTeam, m.awayTeam, m.group, m.date, m.time, m.stadium, m.city);
  }

  const countAfter = (sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  const keptAdminUsernames =
    countAfter > 0
      ? (sqlite.prepare("SELECT username FROM users").all() as Array<{ username: string | null }>).map((r) => (r.username ?? "").trim()).filter(Boolean)
      : [];
  const deletedUsers = countUsersBefore - countAfter;
  return { keptAdminUsernames, deletedUsers };
}

/** חלוקת פרסים לזוכים בתחרות – כל כניסה (submission) נספרת בנפרד; אם לאותו משתמש כמה כניסות זוכות הוא מקבל פרס לכל כניסה. נעילת SETTLING מונעת חלוקה כפולה. */
export async function distributePrizesForTournament(tournamentId: number): Promise<{ winnerCount: number; prizePerWinner: number; distributed: number; winnerIds: number[] }> {
  const { pointTransactions, tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error("תחרות לא נמצאה");
  const already = await db
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(and(eq(pointTransactions.actionType, "prize"), eq(pointTransactions.referenceId, tournamentId)))
    .limit(1);
  if (already.length > 0) throw new Error("פרסים כבר חולקו לתחרות זו");

  /** נעילה: רק תהליך אחד יכול לעבור – עדכון ל-SETTLING; השני יקבל 0 rows */
  const updated = await db
    .update(tournaments)
    .set({ status: "SETTLING" } as typeof tournaments.$inferInsert)
    .where(and(eq(tournaments.id, tournamentId), notInArray(tournaments.status, ["PRIZES_DISTRIBUTED", "ARCHIVED", "SETTLING"])))
    .returning({ id: tournaments.id });
  if (updated.length === 0) {
    const recheck = await db
      .select({ id: pointTransactions.id })
      .from(pointTransactions)
      .where(and(eq(pointTransactions.actionType, "prize"), eq(pointTransactions.referenceId, tournamentId)))
      .limit(1);
    if (recheck.length > 0) throw new Error("פרסים כבר חולקו לתחרות זו");
    throw new Error("תחרות כבר בתהליך חלוקת פרסים או שפרסים חולקו");
  }
  return doDistributePrizesBody(tournamentId, tournament);
}

/** גוף חלוקת פרסים – משמש גם recovery כשהתחרות כבר ב-SETTLING. לא מעדכן ל-SETTLING ולא בודק "כבר חולקו". */
async function doDistributePrizesBody(
  tournamentId: number,
  tournament: NonNullable<Awaited<ReturnType<typeof getTournamentById>>>
): Promise<{ winnerCount: number; prizePerWinner: number; distributed: number; winnerIds: number[] }> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const { resolveSettlement } = await import("./settlement/resolveSettlement");
  const settlementInput = subs.map((s) => ({
    id: s.id,
    userId: s.userId,
    username: s.username ?? null,
    points: s.points,
    strongHit: (s as { strongHit?: boolean }).strongHit,
  }));
  const tAmount = Number((tournament as { amount?: number }).amount ?? 0);
  const tGuaranteed = Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0;
  const resolved = await resolveSettlement(
    { ...tournament, id: tournamentId, amount: tAmount, guaranteedPrizeAmount: tGuaranteed > 0 ? tGuaranteed : null } as { id: number; amount: number; guaranteedPrizeAmount?: number | null; competitionTypeId?: number | null; type?: string | null },
    settlementInput
  );
  const winnerSubmissions = resolved.winnerSubmissions;
  const winnerCount = winnerSubmissions.length;
  const prizePerWinner = resolved.prizePerWinner;
  const distributed = resolved.distributed;
  const tournamentName = (tournament as { name?: string }).name ?? String(tournamentId);
  const winnerPrizeBySubId = new Map<number, number>(
    winnerSubmissions.map((s) => [s.id, (s as { prizeAmount?: number }).prizeAmount ?? prizePerWinner])
  );
  const winnerRankBySubId = new Map<number, number>(
    winnerSubmissions.map((s) => [s.id, (s as { rank?: number }).rank ?? 1])
  );
  const winnerSubIds = new Set(winnerSubmissions.map((s) => s.id));
  const tType = (tournament as { type?: string }).type ?? "football";
  const participantCountForEvent = subs.length;
  const prizePoolExpected = Math.round(participantCountForEvent * tAmount * 0.875);
  const prizePool = tGuaranteed > 0 ? tGuaranteed : prizePoolExpected;

  await insertTournamentFinancialEvent(tournamentId, TOURNAMENT_FINANCIAL_EVENT_TYPES.SETTLEMENT_STARTED, {
    participantCount: participantCountForEvent,
    prizePool,
    winnerCount,
    prizePerWinner,
  });

  /** Phase 14: Resumable payout – skip submissions already credited (recovery from mid-process crash). */
  const existingEvents = await getTournamentFinancialEvents(tournamentId);
  const alreadyPaidSubIds = new Set(
    existingEvents
      .filter((e) => e.eventType === TOURNAMENT_FINANCIAL_EVENT_TYPES.PRIZE_ALLOCATED && e.payloadJson != null && typeof e.payloadJson === "object" && "submissionId" in e.payloadJson)
      .map((e) => (e.payloadJson as { submissionId: number }).submissionId)
  );

  for (const sub of winnerSubmissions) {
    if (alreadyPaidSubIds.has(sub.id)) continue;
    const amount = winnerPrizeBySubId.get(sub.id) ?? prizePerWinner;
    if (amount > 0) {
      await addUserPoints(sub.userId, amount, "prize", {
        referenceId: tournamentId,
        description: `זכייה בתחרות: ${tournamentName}`,
      });
      await insertTransparencyLog({
        competitionId: tournamentId,
        competitionName: tournamentName,
        userId: sub.userId,
        username: sub.username ?? `#${sub.userId}`,
        type: "Prize",
        amount,
        siteProfit: 0,
        agentProfit: 0,
        transactionDate: new Date(),
        competitionStatusAtTime: "PRIZES_DISTRIBUTED",
      });
      await insertTournamentFinancialEvent(tournamentId, TOURNAMENT_FINANCIAL_EVENT_TYPES.PRIZE_ALLOCATED, {
        submissionId: sub.id,
        userId: sub.userId,
        amount,
      });
    }
  }
  const participantCount = subs.length;
  const totalParticipation = participantCount * tAmount;
  const { getCommissionBasisPoints } = await import("./finance");
  const commissionBasisPoints = getCommissionBasisPoints(tournament as { commissionPercentBasisPoints?: number | null; commissionPercent?: number | null; houseFeeRate?: number | null });
  const fee = Math.floor((totalParticipation * commissionBasisPoints) / 10_000);
  const isFreeroll = totalParticipation === 0 && distributed > 0;
  await setTournamentResultsFinalized(tournamentId, {
    participantCount,
    totalParticipation,
    fee,
    prizeDistributed: distributed,
    winnerCount,
  });
  const closedAt = new Date();
  await insertFinancialRecord({
    competitionId: tournamentId,
    competitionName: tournamentName,
    type: tType,
    totalCollected: totalParticipation,
    siteFee: fee,
    totalPrizes: distributed,
    netProfit: isFreeroll ? -distributed : fee,
    participantsCount: participantCount,
    winnersCount: winnerCount,
    closedAt,
    participantSnapshot: {
      participants: subs.map((s) => ({
        submissionId: s.id,
        userId: s.userId,
        username: s.username ?? `#${s.userId}`,
        amountPaid: tAmount,
        prizeWon: winnerPrizeBySubId.get(s.id) ?? 0,
        rank: winnerRankBySubId.get(s.id),
      })),
    },
  });
  await insertTournamentFinancialEvent(tournamentId, TOURNAMENT_FINANCIAL_EVENT_TYPES.SETTLEMENT_COMPLETED, {
    distributed,
    winnerCount,
    participantCount,
    totalParticipation,
    fee,
  });

  /** Settlement events + ARCHIVED update. SQLite (better-sqlite3) does not support async transaction callbacks, so we run events then status update separately; idempotency keys make retries safe. On drivers that support async transactions, one transaction wraps both. */
  const { recordSettlementFinancialEvents, recordSettlementFinancialEventsWithTx } = await import("./finance");
  const settlementParams = {
    tournamentId,
    tournamentName,
    commissionBasisPoints,
    totalPool: totalParticipation,
    platformCommission: fee,
    prizePerWinner,
    winnerSubmissions: winnerSubmissions.map((s) => ({ id: s.id, userId: s.userId })),
  };
  if (USE_SQLITE) {
    await recordSettlementFinancialEvents(settlementParams);
    await db.update(tournaments).set({
      status: "ARCHIVED",
      visibility: "HIDDEN",
      archivedAt: closedAt,
      dataCleanedAt: closedAt,
    } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
  } else {
    await db.transaction(async (tx) => {
      await recordSettlementFinancialEventsWithTx(tx, settlementParams);
      await tx.update(tournaments).set({
        status: "ARCHIVED",
        visibility: "HIDDEN",
        archivedAt: closedAt,
        dataCleanedAt: closedAt,
      } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
    });
  }

  return { winnerCount, prizePerWinner, distributed, winnerIds: winnerSubmissions.map((s) => s.userId) };
}

/** Phase 5: Admin settlement comparison — legacy vs schema result (no side effects). */
export async function getSettlementComparison(tournamentId: number): Promise<{
  legacy: { winnerCount: number; prizePerWinner: number; distributed: number; winnerSubmissionIds: number[]; prizePool: number };
  schema: { winnerCount: number; prizePerWinner: number; distributed: number; winnerSubmissionIds: number[]; prizePool: number; tieGroups: Array<{ rank: number; points: number; submissionIds: number[] }>; warnings: string[] } | null;
  match: boolean;
  message?: string;
}> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return {
      legacy: { winnerCount: 0, prizePerWinner: 0, distributed: 0, winnerSubmissionIds: [], prizePool: 0 },
      schema: null,
      match: true,
      message: "Tournament not found",
    };
  }
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const tType = (tournament as { type?: string }).type ?? "football";
  const entryAmount = Number((tournament as { amount?: number }).amount ?? 0);
  const guaranteedPrize = Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0;
  const submissionRows = subs.map((s) => ({
    id: s.id,
    userId: s.userId,
    username: s.username ?? null,
    points: s.points,
    strongHit: (s as { strongHit?: boolean }).strongHit,
  }));
  const { getLegacySettlementResult } = await import("./settlement/resolveSettlement");
  const legacyResult = getLegacySettlementResult(submissionRows, tType, entryAmount, guaranteedPrize > 0 ? guaranteedPrize : undefined);
  const legacyWinnerIds = legacyResult.winnerSubmissions.map((s) => s.id).sort((a, b) => a - b);
  let schemaResult: Awaited<ReturnType<typeof import("./settlement/settleTournamentBySchema").settleTournamentBySchema>> | null = null;
  try {
    const { resolveTournamentSettlementConfig } = await import("./schema/resolveTournamentSchemas");
    const { settleTournamentBySchema } = await import("./settlement/settleTournamentBySchema");
    const t = tournament as { competitionTypeId?: number | null; type?: string | null };
    const { config } = await resolveTournamentSettlementConfig(t);
    if (config.prizeMode !== "custom") {
      const scored = submissionRows.map((s) => ({ id: s.id, userId: s.userId, username: s.username, points: s.points, strongHit: s.strongHit }));
      schemaResult = settleTournamentBySchema(config, scored, {
        tournamentType: tType,
        entryAmount,
        guaranteedPrizeAmount: guaranteedPrize > 0 ? guaranteedPrize : undefined,
      });
    }
  } catch {
    /* schema path failed */
  }
  if (!schemaResult) {
    return {
      legacy: {
        winnerCount: legacyResult.winnerSubmissions.length,
        prizePerWinner: legacyResult.prizePerWinner,
        distributed: legacyResult.distributed,
        winnerSubmissionIds: legacyWinnerIds,
        prizePool: legacyResult.prizePool,
      },
      schema: null,
      match: true,
      message: "Schema settlement not available or failed",
    };
  }
  const schemaWinnerIds = schemaResult.winners.map((w) => w.submissionId).sort((a, b) => a - b);
  const sameWinnerCount = legacyWinnerIds.length === schemaWinnerIds.length;
  const sameWinnerSet =
    legacyWinnerIds.length === schemaWinnerIds.length &&
    legacyWinnerIds.every((id, i) => id === schemaWinnerIds[i]);
  const samePrize = legacyResult.prizePerWinner === schemaResult.prizePerWinner && legacyResult.distributed === schemaResult.totalPrizeDistributed;
  const match = sameWinnerSet && samePrize;
  return {
    legacy: {
      winnerCount: legacyResult.winnerSubmissions.length,
      prizePerWinner: legacyResult.prizePerWinner,
      distributed: legacyResult.distributed,
      winnerSubmissionIds: legacyWinnerIds,
      prizePool: legacyResult.prizePool,
    },
    schema: {
      winnerCount: schemaResult.winnerCount,
      prizePerWinner: schemaResult.prizePerWinner,
      distributed: schemaResult.totalPrizeDistributed,
      winnerSubmissionIds: schemaWinnerIds,
      prizePool: schemaResult.prizePoolTotal,
      tieGroups: schemaResult.tieGroups,
      warnings: schemaResult.warnings,
    },
    match,
  };
}

/** מחזיר תחרויות עם status=SETTLING (לצורך recovery). */
export async function getTournamentsWithStatusSettling(): Promise<{ id: number }[]> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.status, "SETTLING"));
  return rows;
}

/** Recovery מתחרויות תקועות ב-SETTLING: אם הפרסים כבר חולקו – מעדכן ל-PRIZES_DISTRIBUTED; אחרת מריץ חלוקה. אפשר לציין רק תחרויות מסוימות (למשל תקועות >5 דקות). */
export async function runRecoverSettlements(opts?: { onlyTournamentIds?: number[] }): Promise<{ recovered: number[]; errors: { tournamentId: number; error: string }[] }> {
  const { pointTransactions, tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return { recovered: [], errors: [] };
  let stuck = await getTournamentsWithStatusSettling();
  if (opts?.onlyTournamentIds?.length) {
    const set = new Set(opts.onlyTournamentIds);
    stuck = stuck.filter((r) => set.has(r.id));
  }
  const recovered: number[] = [];
  const errors: { tournamentId: number; error: string }[] = [];
  for (const { id: tournamentId } of stuck) {
    try {
      const prizeRows = await db
        .select({ id: pointTransactions.id })
        .from(pointTransactions)
        .where(and(eq(pointTransactions.actionType, "prize"), eq(pointTransactions.referenceId, tournamentId)))
        .limit(1);
      if (prizeRows.length > 0) {
        // Prizes already distributed but tournament stuck in SETTLING. Run full settlement body so
        // insertFinancialRecord is always written (getTournamentSettlementWinners can read it).
        // Payout loop will skip already-paid; financial record + ARCHIVED will be written.
        const tournament = await getTournamentById(tournamentId);
        if (tournament) {
          await doDistributePrizesBody(tournamentId, tournament);
          recovered.push(tournamentId);
        } else {
          const now = new Date();
          await db.update(tournaments).set({
            status: "ARCHIVED",
            visibility: "HIDDEN",
            archivedAt: now,
            dataCleanedAt: now,
          } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
          recovered.push(tournamentId);
        }
      } else {
        const tournament = await getTournamentById(tournamentId);
        if (tournament) {
          await doDistributePrizesBody(tournamentId, tournament);
          recovered.push(tournamentId);
        } else {
          errors.push({ tournamentId, error: "תחרות לא נמצאה" });
        }
      }
    } catch (e) {
      errors.push({ tournamentId, error: String(e) });
    }
  }
  return { recovered, errors };
}

/** בדיקת יושרה כספית: סכום כל תנועות הנקודות הטרנזקציוניות = יתרות המשתמשים בפועל.
 * מתעלם ממנהלים עם unlimitedPoints כדי לא לזהם את החשבונאות. */
export async function runFinancialIntegrityCheck(): Promise<{
  totalEntryPoints: number;
  totalPayouts: number;
  netTrackedTransactions: number;
  systemBalance: number;
  delta: number;
  ok: boolean;
}> {
  const { users, pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return { totalEntryPoints: 0, totalPayouts: 0, netTrackedTransactions: 0, systemBalance: 0, delta: 0, ok: true };
  const partRows = await db
    .select({ s: sql<number>`coalesce(sum(abs(${pointTransactions.amount})), 0)` })
    .from(pointTransactions)
    .innerJoin(users, eq(pointTransactions.userId, users.id))
    .where(and(eq(pointTransactions.actionType, "participation"), sql`coalesce(${users.unlimitedPoints}, 0) = 0`));
  const prizeRows = await db
    .select({ s: sql<number>`coalesce(sum(${pointTransactions.amount}), 0)` })
    .from(pointTransactions)
    .innerJoin(users, eq(pointTransactions.userId, users.id))
    .where(and(eq(pointTransactions.actionType, "prize"), sql`coalesce(${users.unlimitedPoints}, 0) = 0`));
  const transactionRows = await db
    .select({ s: sql<number>`coalesce(sum(${pointTransactions.amount}), 0)` })
    .from(pointTransactions)
    .innerJoin(users, eq(pointTransactions.userId, users.id))
    .where(sql`coalesce(${users.unlimitedPoints}, 0) = 0`);
  const balanceRows = await db
    .select({ s: sql<number>`coalesce(sum(case when coalesce(${users.unlimitedPoints}, 0) = 0 then ${users.points} else 0 end), 0)` })
    .from(users);
  const totalEntryPoints = Number(partRows[0]?.s ?? 0);
  const totalPayouts = Number(prizeRows[0]?.s ?? 0);
  const netTrackedTransactions = Number(transactionRows[0]?.s ?? 0);
  const systemBalance = Number(balanceRows[0]?.s ?? 0);
  const delta = netTrackedTransactions - systemBalance;
  const ok = Math.abs(delta) < 1;
  return { totalEntryPoints, totalPayouts, netTrackedTransactions, systemBalance, delta, ok };
}

const VIRTUAL_USER_OPENID = "system-virtual-auto-submissions";

/** משתמש מערכת אחד לכל טפסי הניחושים האוטומטיים – מחזיר את ה-id שלו */
export async function getOrCreateVirtualUser(): Promise<number> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const existing = await db.select().from(users).where(eq(users.openId, VIRTUAL_USER_OPENID)).limit(1);
  if (existing[0]) return existing[0].id;
  const uniq = `virtual_sys_${Date.now()}`;
  await db.insert(users).values({
    openId: VIRTUAL_USER_OPENID,
    username: uniq,
    name: "מערכת טפסים אוטומטיים",
    role: "user",
    loginMethod: "local",
  });
  const created = await db.select().from(users).where(eq(users.openId, VIRTUAL_USER_OPENID)).limit(1);
  if (!created[0]) throw new Error("Failed to create virtual user");
  return created[0].id;
}

/** הוספת טופס אוטומטי אחד (מנהל) – נשמר כאישור + תשלום הושלם, מופיע בדירוג */
export async function insertAutoSubmission(data: {
  userId: number;
  username: string;
  tournamentId: number;
  predictions: unknown;
  points?: number;
  strongHit?: boolean;
}) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(submissions).values({
    userId: data.userId,
    username: data.username,
    tournamentId: data.tournamentId,
    predictions: data.predictions as never,
    points: data.points ?? 0,
    status: "approved",
    paymentStatus: "completed",
    approvedAt: new Date(),
    strongHit: data.strongHit ?? false,
  });
}

export async function getAllUsers(opts?: { includeDeleted?: boolean }) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  if (opts?.includeDeleted)
    return db.select().from(users).orderBy(desc(users.createdAt));
  return db.select().from(users).where(isNull(users.deletedAt)).orderBy(desc(users.createdAt));
}

/** רשימת מנהלים (role=admin) – רק לסופר מנהל */
export async function getAdmins() {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "admin")).orderBy(desc(users.createdAt));
}

/** רישום פעולת סופר מנהל בלוג */
export async function insertAdminAuditLog(data: {
  performedBy: number;
  action: string;
  targetUserId?: number | null;
  details?: Record<string, unknown> | null;
}) {
  const { adminAuditLog } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(adminAuditLog).values({
    performedBy: data.performedBy,
    action: data.action,
    targetUserId: data.targetUserId ?? null,
    details: data.details as never ?? null,
  });
}

/** שליפת לוג פעולות סופר מנהל */
export async function getAdminAuditLogs(limit = 100) {
  const { adminAuditLog } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
}

export type LedgerType =
  | "ENTRY_DEBIT" | "REFUND" | "PRIZE_CREDIT" | "SITE_FEE" | "AGENT_FEE" | "ADMIN_ADJUST"
  | "DEPOSIT" | "WITHDRAW" | "AGENT_TRANSFER" | "PRIZE" | "PARTICIPATION" | "ADMIN_APPROVAL";

/** רישום תנועה ב-Ledger – כל נקודה שנכנסת/יוצאת חייבת לעבור כאן */
export async function insertLedgerTransaction(data: {
  actorUserId?: number | null;
  subjectUserId?: number | null;
  agentId?: number | null;
  tournamentId?: number | null;
  type: LedgerType;
  amountPoints: number;
  balanceAfter?: number | null;
  metaJson?: Record<string, unknown> | null;
}) {
  const { ledgerTransactions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(ledgerTransactions).values({
    actorUserId: data.actorUserId ?? null,
    subjectUserId: data.subjectUserId ?? null,
    agentId: data.agentId ?? null,
    tournamentId: data.tournamentId ?? null,
    type: data.type,
    amountPoints: data.amountPoints,
    balanceAfter: data.balanceAfter ?? null,
    metaJson: data.metaJson as never ?? null,
  });
}

/** רישום ב-Audit Log – שקיפות תפעולית */
export async function insertAuditLog(data: {
  actorId: number;
  actorRole: string;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  diffJson?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const { auditLogs } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(auditLogs).values({
    actorId: data.actorId,
    actorRole: data.actorRole,
    action: data.action,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    diffJson: data.diffJson as never ?? null,
    ip: data.ip ?? null,
    userAgent: data.userAgent ?? null,
  });
}

/** יצירת מנהל חדש – רק סופר מנהל. משתמש נכנס עם username + סיסמה. */
export async function createAdminUserBySuperAdmin(data: { username: string; passwordHash: string; name?: string }) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const existing = await db.select().from(users).where(eq(users.username, data.username)).limit(1);
  if (existing.length > 0) throw new Error("שם המשתמש כבר תפוס");
  const openId = `local-admin-${data.username}-${Date.now()}`;
  await db.insert(users).values({
    username: data.username,
    name: data.name ?? data.username,
    openId,
    loginMethod: "local",
    role: "admin",
    passwordHash: data.passwordHash,
    unlimitedPoints: true,
    points: 0,
  });
  const created = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return created[0] ?? null;
}

/** מחיקת מנהל – רק סופר מנהל. לא ניתן למחוק את עצמו. */
export async function deleteAdmin(adminId: number, performedBy: number) {
  if (adminId === performedBy) throw new Error("לא ניתן למחוק את עצמך");
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const target = await getUserById(adminId);
  if (!target) throw new Error("משתמש לא נמצא");
  if (target.role !== "admin") throw new Error("רק מנהל ניתן למחוק מכאן");
  await db.delete(users).where(eq(users.id, adminId));
}

/** עדכון סיסמה/שם למנהל – רק סופר מנהל */
export async function updateAdmin(adminId: number, data: { passwordHash?: string; username?: string; name?: string }) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const target = await getUserById(adminId);
  if (!target) throw new Error("משתמש לא נמצא");
  if (target.role !== "admin") throw new Error("רק מנהל ניתן לערוך");
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.passwordHash != null) update.passwordHash = data.passwordHash;
  if (data.username != null) update.username = data.username;
  if (data.name != null) update.name = data.name;
  await db.update(users).set(update as typeof users.$inferInsert).where(eq(users.id, adminId));
}

/** מחזיר סוכן לפי קוד הפניה (רק role=agent, לא מחוק ולא חסום) */
export async function getAgentByReferralCode(referralCode: string) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users)
    .where(and(eq(users.referralCode, referralCode), eq(users.role, "agent"), isNull(users.deletedAt)))
    .limit(1);
  const u = r[0];
  if (!u) return undefined;
  if ((u as { isBlocked?: boolean }).isBlocked) return undefined;
  return u;
}

/** יצירת סוכן חדש – רק למנהל. מחזיר המשתמש שנוצר כולל referralCode. */
export async function createAgent(data: {
  username: string;
  phone: string;
  passwordHash: string;
  name?: string;
}) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const openId = `local-agent-${data.username}-${Date.now()}`;
  await db.insert(users).values({
    username: data.username,
    phone: data.phone,
    passwordHash: data.passwordHash,
    name: data.name,
    openId,
    loginMethod: "local",
    role: "agent",
    referralCode: null,
    unlimitedPoints: false,
  });
  const created = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const agent = created[0];
  if (!agent) throw new Error("Failed to create agent");
  const code = `A${agent.id}`;
  await db.update(users).set({ referralCode: code, updatedAt: new Date() }).where(eq(users.id, agent.id));
  return { ...agent, referralCode: code } as typeof agent & { referralCode: string };
}

/** רשימת כל הסוכנים (לא מחוקים) */
export async function getAgents() {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users)
    .where(and(eq(users.role, "agent"), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt));
}

// ---------- Competition types (Phase 2A). SQLite only; when MySQL is used these return empty/null. ----------

/** רשימת סוגי תחרויות – ממוינת לפי sortOrder. רק ב-SQLite. */
export async function getCompetitionTypes(opts?: { activeOnly?: boolean }) {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const ct = (schema as { competitionTypes?: typeof import("../drizzle/schema-sqlite").competitionTypes }).competitionTypes;
  if (!ct) return [];
  const db = await getDb();
  if (!db) return [];
  const activeOnly = opts?.activeOnly !== false;
  const rows = activeOnly
    ? await db.select().from(ct).where(eq(ct.isActive, true)).orderBy(ct.sortOrder, ct.id)
    : await db.select().from(ct).orderBy(ct.sortOrder, ct.id);
  return rows;
}

/** סוג תחרות לפי id. רק ב-SQLite. */
export async function getCompetitionTypeById(id: number) {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const ct = (schema as { competitionTypes?: typeof import("../drizzle/schema-sqlite").competitionTypes }).competitionTypes;
  if (!ct) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ct).where(eq(ct.id, id)).limit(1);
  return rows[0] ?? null;
}

/** סוג תחרות לפי code (יציב). רק ב-SQLite. */
export async function getCompetitionTypeByCode(code: string) {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const ct = (schema as { competitionTypes?: typeof import("../drizzle/schema-sqlite").competitionTypes }).competitionTypes;
  if (!ct) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ct).where(eq(ct.code, code.trim())).limit(1);
  return rows[0] ?? null;
}

// ---------- Phase 6: RBAC (SQLite only; MySQL has no RBAC tables yet – legacy admin check used) ----------

export type RoleRow = { id: number; code: string; name: string };

/** Roles assigned to a user. Returns [] when not SQLite or RBAC tables missing. */
export async function getUserRoles(userId: number): Promise<RoleRow[]> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const r = (schema as { roles?: typeof import("../drizzle/schema-sqlite").roles }).roles;
  const ur = (schema as { userRoles?: typeof import("../drizzle/schema-sqlite").userRoles }).userRoles;
  if (!r || !ur) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: r.id, code: r.code, name: r.name })
    .from(ur)
    .innerJoin(r, eq(ur.roleId, r.id))
    .where(eq(ur.userId, userId));
  return rows;
}

/** Permission codes the user has via their roles. Returns [] when not SQLite or no RBAC. */
export async function getUserPermissions(userId: number): Promise<string[]> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const r = (schema as { roles?: unknown }).roles;
  const p = (schema as { permissions?: typeof import("../drizzle/schema-sqlite").permissions }).permissions;
  const rp = (schema as { rolePermissions?: typeof import("../drizzle/schema-sqlite").rolePermissions }).rolePermissions;
  const ur = (schema as { userRoles?: typeof import("../drizzle/schema-sqlite").userRoles }).userRoles;
  if (!r || !p || !rp || !ur) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ code: p.code })
    .from(ur)
    .innerJoin(rp, eq(ur.roleId, rp.roleId))
    .innerJoin(p, eq(rp.permissionId, p.id))
    .where(eq(ur.userId, userId));
  return rows.map((x) => x.code);
}

/** True if user has the given permission via roles. When not SQLite, returns false (caller uses legacy check). */
export async function userHasPermission(userId: number, permissionCode: string): Promise<boolean> {
  const codes = await getUserPermissions(userId);
  return codes.includes(permissionCode.trim());
}

/** True if user has the given role. When not SQLite, returns false. */
export async function userHasRole(userId: number, roleCode: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.code === roleCode.trim());
}

/** Assign a role to a user. Idempotent. SQLite only. */
export async function assignRoleToUser(userId: number, roleId: number): Promise<void> {
  if (!USE_SQLITE) return;
  const schema = await getSchema();
  const ur = (schema as { userRoles?: typeof import("../drizzle/schema-sqlite").userRoles }).userRoles;
  if (!ur) return;
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(ur).where(and(eq(ur.userId, userId), eq(ur.roleId, roleId))).limit(1);
  if (existing.length > 0) return;
  await db.insert(ur).values({ userId, roleId });
  await incrementUserTokenVersion(userId);
}

/** Remove a role from a user. SQLite only. */
export async function removeRoleFromUser(userId: number, roleId: number): Promise<void> {
  if (!USE_SQLITE) return;
  const schema = await getSchema();
  const ur = (schema as { userRoles?: typeof import("../drizzle/schema-sqlite").userRoles }).userRoles;
  if (!ur) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(ur).where(and(eq(ur.userId, userId), eq(ur.roleId, roleId)));
  await incrementUserTokenVersion(userId);
}

/** Get current token version for a user (for JWT invalidation after role/permission change). SQLite: from users.tokenVersion; else 0. */
export async function getUserTokenVersion(userId: number): Promise<number> {
  if (!USE_SQLITE || !_sqlite) return 0;
  const row = _sqlite.prepare("SELECT COALESCE(tokenVersion, 0) as v FROM users WHERE id = ?").get(userId) as { v: number } | undefined;
  return row ? Number(row.v) : 0;
}

/** Increment token version so existing JWTs for this user are rejected (e.g. after role assign/remove). SQLite only. */
export async function incrementUserTokenVersion(userId: number): Promise<void> {
  if (!USE_SQLITE || !_sqlite) return;
  _sqlite.prepare("UPDATE users SET tokenVersion = COALESCE(tokenVersion, 0) + 1 WHERE id = ?").run(userId);
}

/** All roles (for admin UI). SQLite only. */
export async function getAllRoles(): Promise<RoleRow[]> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const r = (schema as { roles?: typeof import("../drizzle/schema-sqlite").roles }).roles;
  if (!r) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: r.id, code: r.code, name: r.name }).from(r).orderBy(r.id);
  return rows;
}

/** All permissions (for admin UI). SQLite only. */
export async function getAllPermissions(): Promise<Array<{ id: number; code: string; name: string; category: string }>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const p = (schema as { permissions?: typeof import("../drizzle/schema-sqlite").permissions }).permissions;
  if (!p) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: p.id, code: p.code, name: p.name, category: p.category }).from(p).orderBy(p.category, p.code);
  return rows;
}

/** Permission codes for a role (for admin UI). SQLite only. */
export async function getRolePermissions(roleId: number): Promise<string[]> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const p = (schema as { permissions?: typeof import("../drizzle/schema-sqlite").permissions }).permissions;
  const rp = (schema as { rolePermissions?: typeof import("../drizzle/schema-sqlite").rolePermissions }).rolePermissions;
  if (!p || !rp) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ code: p.code }).from(rp).innerJoin(p, eq(rp.permissionId, p.id)).where(eq(rp.roleId, roleId));
  return rows.map((x) => x.code);
}

// ---------- Phase 7: Universal competition item sets/items (SQLite) ----------

export async function getCompetitionItemSetsByTournament(tournamentId: number) {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const sets = (schema as { competitionItemSets?: typeof import("../drizzle/schema-sqlite").competitionItemSets }).competitionItemSets;
  if (!sets) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sets).where(eq(sets.tournamentId, tournamentId)).orderBy(sets.sortOrder, sets.id);
}

export async function getCompetitionItemsBySetId(itemSetId: number) {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const items = (schema as { competitionItems?: typeof import("../drizzle/schema-sqlite").competitionItems }).competitionItems;
  if (!items) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(items).where(eq(items.itemSetId, itemSetId)).orderBy(items.sortOrder, items.id);
}

/** Phase 9: Tournament IDs by item source (SQLite only). universal = has DB item sets; legacy = no DB item sets. */
export async function getTournamentIdsByItemSource(
  sourceLabel: "legacy" | "universal"
): Promise<number[]> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const sets = (schema as { competitionItemSets?: typeof import("../drizzle/schema-sqlite").competitionItemSets }).competitionItemSets;
  const tourns = (schema as { tournaments?: typeof import("../drizzle/schema-sqlite").tournaments }).tournaments;
  if (!sets || !tourns) return [];
  const db = await getDb();
  if (!db) return [];
  if (sourceLabel === "universal") {
    const rows = await db.select({ tournamentId: sets.tournamentId }).from(sets);
    const ids = [...new Set(rows.map((r) => (r as { tournamentId: number }).tournamentId))];
    return ids;
  }
  const withSets = await db.select({ tournamentId: sets.tournamentId }).from(sets);
  const withSetIds = new Set(withSets.map((r) => (r as { tournamentId: number }).tournamentId));
  const allRows = await db.select({ id: tourns.id }).from(tourns);
  return allRows
    .map((r) => (r as { id: number }).id)
    .filter((id) => !withSetIds.has(id));
}

/** Phase 9: Resolve tournament IDs for report filters (tournamentType + sourceLabel). Empty array = no filter (all). */
export async function getReportFilterTournamentIds(opts?: {
  tournamentType?: string;
  sourceLabel?: "legacy" | "universal";
}): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const { tournaments } = await getSchema();
  let byType: number[] = [];
  if (opts?.tournamentType) {
    const list = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.type, opts.tournamentType));
    byType = list.map((r) => (r as { id: number }).id);
  }
  let bySource: number[] = [];
  if (opts?.sourceLabel) {
    bySource = await getTournamentIdsByItemSource(opts.sourceLabel);
  }
  if (byType.length > 0 && bySource.length > 0) {
    const set = new Set(bySource);
    return byType.filter((id) => set.has(id));
  }
  if (byType.length > 0) return byType;
  if (bySource.length > 0) return bySource;
  return [];
}

// ---------- Phase 8: CRUD for universal competition item sets/items (SQLite only) ----------

function assertSqliteForUniversalItems(): void {
  if (!USE_SQLITE) {
    throw new Error("Universal competition items (CRUD) are only supported with SQLite. MySQL support not implemented in this phase.");
  }
}

export type CreateCompetitionItemSetInput = {
  tournamentId: number;
  title: string;
  description?: string | null;
  itemType: string;
  sourceType?: "legacy" | "universal";
  stage?: string | null;
  round?: string | null;
  groupKey?: string | null;
  sortOrder?: number;
  metadataJson?: Record<string, unknown> | null;
};

export async function createCompetitionItemSet(data: CreateCompetitionItemSetInput) {
  assertSqliteForUniversalItems();
  const schema = await getSchema();
  const sets = (schema as { competitionItemSets?: typeof import("../drizzle/schema-sqlite").competitionItemSets }).competitionItemSets;
  if (!sets) throw new Error("competition_item_sets schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const [row] = await db.insert(sets).values({
    tournamentId: data.tournamentId,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    itemType: data.itemType.trim() || "custom",
    sourceType: data.sourceType ?? "universal",
    stage: data.stage?.trim() || null,
    round: data.round?.trim() || null,
    groupKey: data.groupKey?.trim() || null,
    sortOrder: data.sortOrder ?? 0,
    metadataJson: data.metadataJson ?? null,
  }).returning({ id: sets.id });
  const setId = row!.id as number;

  // Runtime connection: football_custom prediction form needs custom_football_matches.
  // When the builder creates an item set for a football_custom tournament, create a matching
  // custom_football_match so the prediction page shows a playable match row.
  const tournament = await getTournamentById(data.tournamentId);
  if (tournament && (tournament as { type?: string }).type === "football_custom") {
    const title = data.title.trim() || `משחק ${setId}`;
    const vsIndex = title.indexOf(" vs ");
    const homeTeam = vsIndex > 0 ? title.slice(0, vsIndex).trim() : title;
    const awayTeam = vsIndex > 0 ? title.slice(vsIndex + 4).trim() : "TBD";
    await addCustomFootballMatch({
      tournamentId: data.tournamentId,
      homeTeam: homeTeam || "TBD",
      awayTeam: awayTeam || "TBD",
      displayOrder: data.sortOrder ?? 0,
    });
  }

  return setId;
}

export type UpdateCompetitionItemSetInput = {
  id: number;
  title?: string;
  description?: string | null;
  itemType?: string;
  stage?: string | null;
  round?: string | null;
  groupKey?: string | null;
  sortOrder?: number;
  metadataJson?: Record<string, unknown> | null;
};

export async function updateCompetitionItemSet(data: UpdateCompetitionItemSetInput) {
  assertSqliteForUniversalItems();
  const schema = await getSchema();
  const sets = (schema as { competitionItemSets?: typeof import("../drizzle/schema-sqlite").competitionItemSets }).competitionItemSets;
  if (!sets) throw new Error("competition_item_sets schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) update.title = data.title.trim();
  if (data.description !== undefined) update.description = data.description?.trim() || null;
  if (data.itemType !== undefined) update.itemType = data.itemType.trim();
  if (data.stage !== undefined) update.stage = data.stage?.trim() || null;
  if (data.round !== undefined) update.round = data.round?.trim() || null;
  if (data.groupKey !== undefined) update.groupKey = data.groupKey?.trim() || null;
  if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder;
  if (data.metadataJson !== undefined) update.metadataJson = data.metadataJson;
  await db.update(sets).set(update as typeof sets.$inferInsert).where(eq(sets.id, data.id));
}

export async function deleteCompetitionItemSet(id: number) {
  assertSqliteForUniversalItems();
  const schema = await getSchema();
  const sets = (schema as { competitionItemSets?: typeof import("../drizzle/schema-sqlite").competitionItemSets }).competitionItemSets;
  if (!sets) throw new Error("competition_item_sets schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.delete(sets).where(eq(sets.id, id));
}

export type CreateCompetitionItemInput = {
  itemSetId: number;
  externalKey?: string | null;
  title: string;
  subtitle?: string | null;
  itemKind: string;
  startsAt?: number | Date | null;
  closesAt?: number | Date | null;
  sortOrder?: number;
  optionSchemaJson?: Record<string, unknown> | null;
  resultSchemaJson?: Record<string, unknown> | null;
  status?: string;
  metadataJson?: Record<string, unknown> | null;
};

export async function createCompetitionItem(data: CreateCompetitionItemInput) {
  assertSqliteForUniversalItems();
  const schema = await getSchema();
  const items = (schema as { competitionItems?: typeof import("../drizzle/schema-sqlite").competitionItems }).competitionItems;
  if (!items) throw new Error("competition_items schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const [row] = await db.insert(items).values({
    itemSetId: data.itemSetId,
    externalKey: data.externalKey?.trim() || null,
    title: data.title.trim(),
    subtitle: data.subtitle?.trim() || null,
    itemKind: data.itemKind.trim() || "custom",
    startsAt: data.startsAt != null ? toTimestamp(data.startsAt) : null,
    closesAt: data.closesAt != null ? toTimestamp(data.closesAt) : null,
    sortOrder: data.sortOrder ?? 0,
    optionSchemaJson: data.optionSchemaJson ?? null,
    resultSchemaJson: data.resultSchemaJson ?? null,
    status: (data.status ?? "open").trim() || "open",
    metadataJson: data.metadataJson ?? null,
  }).returning({ id: items.id });
  return row!.id as number;
}

export type UpdateCompetitionItemInput = {
  id: number;
  externalKey?: string | null;
  title?: string;
  subtitle?: string | null;
  itemKind?: string;
  startsAt?: number | Date | null;
  closesAt?: number | Date | null;
  sortOrder?: number;
  optionSchemaJson?: Record<string, unknown> | null;
  resultSchemaJson?: Record<string, unknown> | null;
  status?: string;
  metadataJson?: Record<string, unknown> | null;
};

export async function updateCompetitionItem(data: UpdateCompetitionItemInput) {
  assertSqliteForUniversalItems();
  const schema = await getSchema();
  const items = (schema as { competitionItems?: typeof import("../drizzle/schema-sqlite").competitionItems }).competitionItems;
  if (!items) throw new Error("competition_items schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.externalKey !== undefined) update.externalKey = data.externalKey?.trim() || null;
  if (data.title !== undefined) update.title = data.title.trim();
  if (data.subtitle !== undefined) update.subtitle = data.subtitle?.trim() || null;
  if (data.itemKind !== undefined) update.itemKind = data.itemKind.trim();
  if (data.startsAt !== undefined) update.startsAt = data.startsAt != null ? toTimestamp(data.startsAt) : null;
  if (data.closesAt !== undefined) update.closesAt = data.closesAt != null ? toTimestamp(data.closesAt) : null;
  if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder;
  if (data.optionSchemaJson !== undefined) update.optionSchemaJson = data.optionSchemaJson;
  if (data.resultSchemaJson !== undefined) update.resultSchemaJson = data.resultSchemaJson;
  if (data.status !== undefined) update.status = data.status.trim();
  if (data.metadataJson !== undefined) update.metadataJson = data.metadataJson;
  await db.update(items).set(update as typeof items.$inferInsert).where(eq(items.id, data.id));
}

export async function deleteCompetitionItem(id: number) {
  assertSqliteForUniversalItems();
  const schema = await getSchema();
  const items = (schema as { competitionItems?: typeof import("../drizzle/schema-sqlite").competitionItems }).competitionItems;
  if (!items) throw new Error("competition_items schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.delete(items).where(eq(items.id, id));
}

/** Bulk update sortOrder for items in a set. order: array of item ids in desired order (index = sortOrder). */
export async function reorderCompetitionItems(itemSetId: number, order: number[]) {
  assertSqliteForUniversalItems();
  const schema = await getSchema();
  const items = (schema as { competitionItems?: typeof import("../drizzle/schema-sqlite").competitionItems }).competitionItems;
  if (!items) throw new Error("competition_items schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  for (let i = 0; i < order.length; i++) {
    await db.update(items).set({ sortOrder: i, updatedAt: new Date() }).where(and(eq(items.itemSetId, itemSetId), eq(items.id, order[i])));
  }
}

/** עדכון שיוך שחקן לסוכן (מנהל בלבד). agentId = null להסרת שיוך. */
export async function updateUserAgentId(playerId: number, agentId: number | null): Promise<void> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(users).set({ agentId, updatedAt: new Date() }).where(eq(users.id, playerId));
}

/** רישום עמלה לסוכן כשטופס מאושר (raw SQL to avoid Date bind issue with better-sqlite3). */
export async function recordAgentCommission(data: {
  agentId: number;
  submissionId: number;
  userId: number;
  entryAmount: number;
  commissionAmount: number;
}) {
  const sqlite = await getSqlite();
  if (!sqlite) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const s = Number(data.submissionId);
  if (!Number.isFinite(s) || s < 1) return;
  const now = Date.now();
  const a = Number(data.agentId);
  const u = Number(data.userId);
  const e = Number(data.entryAmount);
  const c = Number(data.commissionAmount);
  sqlite.prepare(
    "INSERT INTO agent_commissions (agentId, submissionId, userId, entryAmount, commissionAmount, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(a, s, u, e, c, now);
}

/** בדיקה אם כבר נרשמה עמלה לטופס זה */
export async function hasCommissionForSubmission(submissionId: number) {
  const sqlite = await getSqlite();
  if (!sqlite) return false;
  const id = Number(submissionId);
  if (!Number.isFinite(id)) return false;
  const r = sqlite.prepare("SELECT 1 FROM agent_commissions WHERE submissionId = ? LIMIT 1").get(id);
  return r != null;
}

/** רשימת משתמשים שהביא סוכן (לא כולל מחוקים) */
export async function getUsersByAgentId(agentId: number) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(and(eq(users.agentId, agentId), isNull(users.deletedAt))).orderBy(desc(users.createdAt));
}

/** עמלות לפי סוכן – לכל הדוחות */
export async function getAgentCommissionsByAgentId(agentId: number) {
  const { agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentCommissions).where(eq(agentCommissions.agentId, agentId)).orderBy(desc(agentCommissions.createdAt));
}

/** עמלות לפי סוכן – רק עבור טפסים שעדיין קיימים (לא נמחקו) */
export async function getAgentCommissionsByAgentIdExistingOnly(agentId: number) {
  const { agentCommissions, submissions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: agentCommissions.id,
      agentId: agentCommissions.agentId,
      submissionId: agentCommissions.submissionId,
      userId: agentCommissions.userId,
      entryAmount: agentCommissions.entryAmount,
      commissionAmount: agentCommissions.commissionAmount,
      createdAt: agentCommissions.createdAt,
    })
    .from(agentCommissions)
    .innerJoin(submissions, eq(agentCommissions.submissionId, submissions.id))
    .where(eq(agentCommissions.agentId, agentId))
    .orderBy(desc(agentCommissions.createdAt));
}

/** עמלות סוכן עם פילטר תאריכים – לדוחות עם טווח. אופציונלי: סינון לפי סוג תחרות. מחזיר גם שם תחרות. */
export async function getAgentCommissionsByAgentIdWithDateRange(
  agentId: number,
  opts?: { from?: string; to?: string; limit?: number; tournamentType?: string }
) {
  const { agentCommissions, submissions, users, tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return { rows: [], totalCommission: 0 };
  const conditions = [eq(agentCommissions.agentId, agentId)];
  if (opts?.from) {
    const fromTs = new Date(opts.from).getTime();
    conditions.push(gte(agentCommissions.createdAt, new Date(fromTs)));
  }
  if (opts?.to) {
    const toEnd = new Date(opts.to);
    toEnd.setHours(23, 59, 59, 999);
    conditions.push(lte(agentCommissions.createdAt, toEnd));
  }
  if (opts?.tournamentType) {
    conditions.push(eq(tournaments.type, opts.tournamentType));
  }
  const rows = await db
    .select({
      id: agentCommissions.id,
      submissionId: agentCommissions.submissionId,
      userId: agentCommissions.userId,
      username: users.username,
      name: users.name,
      entryAmount: agentCommissions.entryAmount,
      commissionAmount: agentCommissions.commissionAmount,
      createdAt: agentCommissions.createdAt,
      tournamentId: submissions.tournamentId,
      tournamentName: tournaments.name,
    })
    .from(agentCommissions)
    .innerJoin(submissions, eq(agentCommissions.submissionId, submissions.id))
    .innerJoin(users, eq(agentCommissions.userId, users.id))
    .innerJoin(tournaments, eq(submissions.tournamentId, tournaments.id))
    .where(and(...conditions))
    .orderBy(desc(agentCommissions.createdAt))
    .limit(opts?.limit ?? 500);
  const totalCommission = rows.reduce((s, r) => s + (r.commissionAmount ?? 0), 0);
  return { rows, totalCommission };
}

/** חישוב סכום עמלה: אחוז מהעמלת האתר (12.5% מהתפוס). */
export function calcAgentCommission(entryAmount: number, agentPercentOfFee: number): number {
  const FEE = 12.5;
  const fee = entryAmount * (FEE / 100);
  return Math.round(fee * (agentPercentOfFee / 100));
}

export async function getTournaments() {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tournaments).where(isNull(tournaments.deletedAt));
}

/** ליגות – לא מחוקות (deletedAt) */
export async function getLeagues(opts?: { includeDisabled?: boolean }) {
  const { leagues } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(leagues.deletedAt)];
  if (!opts?.includeDisabled) conditions.push(eq(leagues.enabled, true));
  return db.select().from(leagues).where(and(...conditions)).orderBy(desc(leagues.id));
}

export async function getLeagueById(id: number) {
  const { leagues } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  return r[0];
}

export async function createLeague(name: string, createdBy?: number) {
  const { leagues } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(leagues).values({ name });
  const rows = await db.select({ id: leagues.id }).from(leagues).orderBy(desc(leagues.id)).limit(1);
  return rows[0]?.id;
}

export async function updateLeague(id: number, data: { name?: string; enabled?: boolean }) {
  const { leagues } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name != null) set.name = data.name;
  if (data.enabled != null) set.enabled = data.enabled;
  await db.update(leagues).set(set as typeof leagues.$inferInsert).where(eq(leagues.id, id));
}

/** מחיקה רכה של ליגה – audit מוקלט בנפרד */
export async function softDeleteLeague(id: number) {
  const { leagues } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leagues).set({ deletedAt: new Date() } as typeof leagues.$inferInsert).where(eq(leagues.id, id));
}

/** תחרויות לדף הראשי בלבד – visibility=VISIBLE, לא מוסתרות, לא מחוקות (deletedAt). מציג רק OPEN/LOCKED. */
export async function getActiveTournaments() {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tournaments).where(
    and(
      isNull(tournaments.deletedAt),
      sql`(COALESCE(visibility, 'VISIBLE') = 'VISIBLE')`,
      sql`(COALESCE(hiddenFromHomepage, 0) = 0)`,
      inArray(tournaments.status, ["OPEN", "LOCKED"])
    )
  ).orderBy(desc(tournaments.createdAt));
}

/** Returns tournament by id. Soft-deleted (deletedAt set) are treated as not found and return undefined. */
export async function getTournamentById(id: number) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt))).limit(1);
  return r[0];
}

/** Returns a map of tournamentId -> true if that tournament is soft-deleted (deletedAt set). Used to mark submission rows with tournamentRemoved. */
export async function getTournamentDeletedAtMap(tournamentIds: number[]): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>();
  if (tournamentIds.length === 0) return map;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return map;
  const rows = await db.select({ id: tournaments.id, deletedAt: tournaments.deletedAt }).from(tournaments).where(inArray(tournaments.id, tournamentIds));
  for (const r of rows) {
    const id = (r as { id: number }).id;
    const deletedAt = (r as { deletedAt: Date | null }).deletedAt;
    map.set(id, deletedAt != null);
  }
  return map;
}

/** For settlement reporting: status + deletedAt. CANCELLED or deleted = exclude from reports. */
export interface TournamentStatusRow {
  status: string;
  deletedAt: Date | null;
}

export async function getTournamentStatuses(tournamentIds: number[]): Promise<Map<number, TournamentStatusRow>> {
  const map = new Map<number, TournamentStatusRow>();
  if (tournamentIds.length === 0) return map;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return map;
  const rows = await db
    .select({ id: tournaments.id, status: tournaments.status, deletedAt: tournaments.deletedAt })
    .from(tournaments)
    .where(inArray(tournaments.id, tournamentIds));
  for (const r of rows) {
    const id = (r as { id: number }).id;
    const status = (r as { status?: string }).status ?? "";
    const deletedAt = (r as { deletedAt?: Date | null }).deletedAt ?? null;
    map.set(id, { status, deletedAt });
  }
  return map;
}

/** Tournament IDs with status SETTLED and not deleted. For settled-only financial reporting. */
export async function getSettledTournamentIds(): Promise<number[]> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(eq(tournaments.status, "SETTLED"), isNull(tournaments.deletedAt)));
  return rows.map((r) => (r as { id: number }).id);
}

/** Tournament id -> name for settlement reports. */
export async function getTournamentNames(tournamentIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (tournamentIds.length === 0) return map;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return map;
  const rows = await db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(inArray(tournaments.id, tournamentIds));
  for (const r of rows) {
    const id = (r as { id: number }).id;
    map.set(id, (r as { name?: string | null }).name ?? `#${id}`);
  }
  return map;
}

export async function hideTournamentFromHomepage(
  tournamentId: number,
  adminId: number,
  opts?: { tournamentName?: string; ip?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return { ok: false, error: "מערכת לא זמינה" };
  const row = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  const t = row[0];
  if (!t) return { ok: false, error: "תחרות לא נמצאה" };
  const name = (t as { name?: string }).name ?? String(tournamentId);
  const status = (t as { status?: string }).status;
  const allowed = ["OPEN", "LOCKED", "CLOSED", "SETTLED"].includes(status ?? "");
  if (!allowed) return { ok: false, error: "ניתן להסתיר רק תחרות בסטטוס OPEN, LOCKED, CLOSED או SETTLED" };
  const now = new Date();
  await db.update(tournaments).set({
    hiddenFromHomepage: true,
    hiddenAt: now,
    hiddenByAdminId: adminId,
  } as Record<string, unknown>).where(eq(tournaments.id, tournamentId));
  await insertAdminAuditLog({
    performedBy: adminId,
    action: "TOURNAMENT_HIDE",
    details: { tournamentId, tournamentName: name, ip: opts?.ip },
  });
  return { ok: true };
}

/** שחזור תחרות להצגה בדף הראשי. */
export async function restoreTournamentToHomepage(
  tournamentId: number,
  adminId: number,
  opts?: { tournamentName?: string; ip?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return { ok: false, error: "מערכת לא זמינה" };
  const row = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  const t = row[0];
  if (!t) return { ok: false, error: "תחרות לא נמצאה" };
  const name = (t as { name?: string }).name ?? String(tournamentId);
  await db.update(tournaments).set({
    hiddenFromHomepage: false,
    hiddenAt: null,
    hiddenByAdminId: null,
  } as Record<string, unknown>).where(eq(tournaments.id, tournamentId));
  await insertAdminAuditLog({
    performedBy: adminId,
    action: "TOURNAMENT_RESTORE",
    details: { tournamentId, tournamentName: name, ip: opts?.ip },
  });
  return { ok: true };
}

const DISPLAY_WINDOW_MS = 10 * 60 * 1000; // 10 דקות – אחריהן תחרות עוברת לארכיון (ללא מחיקה)

/** סימון תחרות כ"תוצאות סופיות הוצגו" – אחרי 10 דקות התחרות עוברת לארכיון (ללא מחיקת נתונים). */
export async function setTournamentResultsFinalized(
  tournamentId: number,
  snapshot?: { participantCount: number; totalParticipation: number; fee: number; prizeDistributed: number; winnerCount: number }
): Promise<void> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const update: Record<string, unknown> = { resultsFinalizedAt: new Date(), status: "RESULTS_UPDATED" };
  if (snapshot) {
    (update as Record<string, number>).financialParticipantCount = snapshot.participantCount;
    (update as Record<string, number>).financialTotalParticipation = snapshot.totalParticipation;
    (update as Record<string, number>).financialFee = snapshot.fee;
    (update as Record<string, number>).financialPrizeDistributed = snapshot.prizeDistributed;
    (update as Record<string, number>).financialWinnerCount = snapshot.winnerCount;
  }
  await db.update(tournaments).set(update as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
}

/** Phase 13: Set tournament status (for lifecycle state machine). Returns true if updated. */
export async function updateTournamentStatus(tournamentId: number, status: string): Promise<boolean> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .update(tournaments)
    .set({ status } as typeof tournaments.$inferInsert)
    .where(eq(tournaments.id, tournamentId))
    .returning({ id: tournaments.id });
  return result.length > 0;
}

/** שמירה לצמיתות – רשומה כספית בעת חלוקת פרסים או החזר. לא נמחקת אוטומטית. */
export type FinancialRecordParticipant = { submissionId?: number; userId: number; username: string; amountPaid: number; prizeWon: number; rank?: number };
export async function insertFinancialRecord(data: {
  competitionId: number;
  competitionName: string;
  recordType?: "income" | "refund";
  type?: string;
  totalCollected: number;
  siteFee: number;
  totalPrizes: number;
  netProfit: number;
  participantsCount: number;
  winnersCount: number;
  closedAt: Date;
  participantSnapshot?: { participants: FinancialRecordParticipant[] };
}): Promise<void> {
  const { financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(financialRecords).values({
    competitionId: data.competitionId,
    competitionName: data.competitionName,
    recordType: data.recordType ?? "income",
    type: data.type ?? "football",
    totalCollected: data.totalCollected,
    siteFee: data.siteFee,
    totalPrizes: data.totalPrizes,
    netProfit: data.netProfit,
    participantsCount: data.participantsCount,
    winnersCount: data.winnersCount,
    closedAt: data.closedAt,
    participantSnapshot: data.participantSnapshot as never,
  });
}

/**
 * Backfill: ensure a tournament-level financial record exists when prizes were distributed
 * but the record was never written (e.g. recovery path had only set ARCHIVED).
 * Uses PRIZE_ALLOCATED events to build participantSnapshot. Idempotent: no-op if record exists.
 */
export async function ensureSettlementFinancialRecord(tournamentId: number): Promise<
  { created: true } | { created: false; reason: string }
> {
  const { financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) return { created: false, reason: "db_unavailable" };
  const existing = await db
    .select({ id: financialRecords.id })
    .from(financialRecords)
    .where(eq(financialRecords.competitionId, tournamentId))
    .limit(1);
  if (existing.length > 0) return { created: false, reason: "record_already_exists" };
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { created: false, reason: "tournament_not_found" };
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const events = await getTournamentFinancialEvents(tournamentId);
  const prizeBySubId = new Map<number, number>();
  for (const e of events) {
    if (e.eventType !== TOURNAMENT_FINANCIAL_EVENT_TYPES.PRIZE_ALLOCATED || !e.payloadJson || typeof e.payloadJson !== "object") continue;
    const p = e.payloadJson as { submissionId?: number; amount?: number };
    const subId = p.submissionId;
    const amount = Number(p.amount ?? 0);
    if (subId != null && amount > 0) prizeBySubId.set(subId, (prizeBySubId.get(subId) ?? 0) + amount);
  }
  if (prizeBySubId.size === 0) {
    const { pointTransactions } = await getSchema();
    const prizeRows = await db
      .select({ userId: pointTransactions.userId, amount: pointTransactions.amount })
      .from(pointTransactions)
      .where(and(eq(pointTransactions.actionType, "prize"), eq(pointTransactions.referenceId, tournamentId)));
    const prizeByUserId = new Map<number, number>();
    for (const r of prizeRows) {
      const uid = r.userId ?? 0;
      const amt = Number(r.amount ?? 0);
      if (amt > 0) prizeByUserId.set(uid, (prizeByUserId.get(uid) ?? 0) + amt);
    }
    if (prizeByUserId.size > 0) {
      for (const s of subs) {
        const total = prizeByUserId.get(s.userId) ?? 0;
        if (total <= 0) continue;
        const best = subs.filter((x) => x.userId === s.userId).sort((a, b) => b.points - a.points)[0];
        if (best && best.id === s.id) prizeBySubId.set(s.id, total);
      }
    }
    if (prizeBySubId.size === 0) {
      const { resolveSettlement } = await import("./settlement/resolveSettlement");
      const tAmount = Number((tournament as { amount?: number }).amount ?? 0);
      const tGuaranteed = Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0;
      const settlementInput = subs.map((s) => ({
        id: s.id,
        userId: s.userId,
        username: s.username ?? null,
        points: s.points,
        strongHit: (s as { strongHit?: boolean }).strongHit,
      }));
      const resolved = await resolveSettlement(
        { ...tournament, id: tournamentId, amount: tAmount, guaranteedPrizeAmount: tGuaranteed > 0 ? tGuaranteed : null } as { id: number; amount: number; guaranteedPrizeAmount?: number | null; competitionTypeId?: number | null; type?: string | null },
        settlementInput
      );
      for (const w of resolved.winnerSubmissions) {
        const amt = (w as { prizeAmount?: number }).prizeAmount ?? resolved.prizePerWinner;
        if (amt > 0) prizeBySubId.set(w.id, (prizeBySubId.get(w.id) ?? 0) + amt);
      }
      const rankByWinner = new Map<number, number>();
      resolved.winnerSubmissions.forEach((w, i) => rankByWinner.set(w.id, (w as { rank?: number }).rank ?? i + 1));
      if (prizeBySubId.size > 0) {
        const totalPrizesResolved = resolved.distributed;
        const winnerCountResolved = resolved.winnerSubmissions.length;
        const tType = (tournament as { type?: string }).type ?? "football";
        const tournamentName = (tournament as { name?: string }).name ?? String(tournamentId);
        const subsWithPrize = subs.filter((s) => (prizeBySubId.get(s.id) ?? 0) > 0).sort((a, b) => b.points - a.points);
        const rankBySubIdResolved = new Map<number, number>();
        subsWithPrize.forEach((s, i) => rankBySubIdResolved.set(s.id, (rankByWinner.get(s.id) ?? i + 1)));
        const participantCount = subs.length;
        const totalParticipation = participantCount * tAmount;
        const isFreeroll = totalParticipation === 0 && totalPrizesResolved > 0;
        const closedAt = new Date();
        await insertFinancialRecord({
          competitionId: tournamentId,
          competitionName: tournamentName,
          recordType: "income",
          type: tType,
          totalCollected: totalParticipation,
          siteFee: 0,
          totalPrizes: totalPrizesResolved,
          netProfit: isFreeroll ? -totalPrizesResolved : 0,
          participantsCount: participantCount,
          winnersCount: winnerCountResolved,
          closedAt,
          participantSnapshot: {
            participants: subs.map((s) => ({
              submissionId: s.id,
              userId: s.userId,
              username: s.username ?? `#${s.userId}`,
              amountPaid: tAmount,
              prizeWon: prizeBySubId.get(s.id) ?? 0,
              rank: rankBySubIdResolved.get(s.id),
            })),
          },
        });
        return { created: true };
      }
      return { created: false, reason: "no_prize_events" };
    }
  }
  const totalPrizes = [...prizeBySubId.values()].reduce((a, b) => a + b, 0);
  const winnerCount = new Set(prizeBySubId.keys()).size;
  const tAmount = Number((tournament as { amount?: number }).amount ?? 0);
  const tType = (tournament as { type?: string }).type ?? "football";
  const tournamentName = (tournament as { name?: string }).name ?? String(tournamentId);
  const subsWithPrize = subs.filter((s) => (prizeBySubId.get(s.id) ?? 0) > 0).sort((a, b) => b.points - a.points);
  const rankBySubId = new Map<number, number>();
  subsWithPrize.forEach((s, i) => rankBySubId.set(s.id, i + 1));
  const participantCount = subs.length;
  const totalParticipation = participantCount * tAmount;
  const isFreeroll = totalParticipation === 0 && totalPrizes > 0;
  const fee = 0;
  const closedAt = new Date();
  await insertFinancialRecord({
    competitionId: tournamentId,
    competitionName: tournamentName,
    recordType: "income",
    type: tType,
    totalCollected: totalParticipation,
    siteFee: fee,
    totalPrizes,
    netProfit: isFreeroll ? -totalPrizes : fee,
    participantsCount: participantCount,
    winnersCount: winnerCount,
    closedAt,
    participantSnapshot: {
      participants: subs.map((s) => ({
        submissionId: s.id,
        userId: s.userId,
        username: s.username ?? `#${s.userId}`,
        amountPaid: tAmount,
        prizeWon: prizeBySubId.get(s.id) ?? 0,
        rank: rankBySubId.get(s.id),
      })),
    },
  });
  return { created: true };
}

export type FinancialRecordRow = {
  id: number;
  competitionId: number;
  competitionName: string;
  recordType: "income" | "refund" | string;
  type: string;
  totalCollected: number;
  siteFee: number;
  totalPrizes: number;
  netProfit: number;
  participantsCount: number;
  winnersCount: number;
  closedAt: Date | null;
  participantSnapshot: { participants: FinancialRecordParticipant[] } | null;
  createdAt: Date | null;
};

export async function getFinancialRecords(opts?: { from?: Date; to?: Date }): Promise<FinancialRecordRow[]> {
  const { financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.from != null) conditions.push(gte(financialRecords.closedAt, opts.from));
  if (opts?.to != null) conditions.push(lte(financialRecords.closedAt, opts.to));
  const q =
    conditions.length > 0
      ? db.select().from(financialRecords).where(and(...conditions)).orderBy(desc(financialRecords.closedAt))
      : db.select().from(financialRecords).orderBy(desc(financialRecords.closedAt));
  const rows = await q;
  return rows.map((r) => ({
    id: r.id,
    competitionId: r.competitionId,
    competitionName: r.competitionName,
    recordType: r.recordType ?? "income",
    type: r.type ?? "football",
    totalCollected: r.totalCollected,
    siteFee: r.siteFee,
    totalPrizes: r.totalPrizes,
    netProfit: r.netProfit,
    participantsCount: r.participantsCount,
    winnersCount: r.winnersCount,
    closedAt: r.closedAt,
    participantSnapshot: r.participantSnapshot as { participants: FinancialRecordParticipant[] } | null,
    createdAt: r.createdAt,
  }));
}

export async function getFinancialRecordById(id: number): Promise<FinancialRecordRow | null> {
  const { financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(financialRecords).where(eq(financialRecords.id, id)).limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    competitionId: r.competitionId,
    competitionName: r.competitionName,
    recordType: r.recordType ?? "income",
    type: r.type ?? "football",
    totalCollected: r.totalCollected,
    siteFee: r.siteFee,
    totalPrizes: r.totalPrizes,
    netProfit: r.netProfit,
    participantsCount: r.participantsCount,
    winnersCount: r.winnersCount,
    closedAt: r.closedAt,
    participantSnapshot: r.participantSnapshot as { participants: FinancialRecordParticipant[] } | null,
    createdAt: r.createdAt,
  };
}

/** Winners row for settlement-driven winners table (from financial record snapshot). */
export type SettlementWinnerRow = {
  rank: number;
  userId: number;
  username: string;
  points: number;
  prizeAmount: number;
  prizePercentage: number;
};

/**
 * Parse participantSnapshot from DB (may be object or JSON string).
 * Returns { participants: FinancialRecordParticipant[] }.
 */
function parseParticipantSnapshot(snapshot: unknown): { participants: FinancialRecordParticipant[] } {
  if (snapshot == null) return { participants: [] };
  let obj: { participants?: unknown } | null = null;
  if (typeof snapshot === "string") {
    try {
      obj = JSON.parse(snapshot) as { participants?: unknown };
    } catch {
      return { participants: [] };
    }
  } else if (typeof snapshot === "object" && snapshot !== null) {
    obj = snapshot as { participants?: unknown };
  }
  const raw = obj?.participants;
  const participants: FinancialRecordParticipant[] = Array.isArray(raw) ? raw : [];
  return { participants };
}

/**
 * Returns settlement winners for a tournament from the financial record (participantSnapshot).
 * Use for winners table UI – settlement-driven, not leaderboard recompute.
 * Uses the LATEST financial record for this competitionId that has at least one participant with prizeWon > 0
 * (any recordType, so FreeRoll and legacy records are detected). If snapshot is stored as JSON string, parses it.
 * If no such record, returns settled: false.
 */
export async function getTournamentSettlementWinners(tournamentId: number): Promise<
  | { settled: true; totalPrizePool: number; winners: SettlementWinnerRow[] }
  | { settled: false }
> {
  const { financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) {
    console.log("SETTLEMENT WINNERS DEBUG tournamentId=" + tournamentId + " db=null");
    return { settled: false };
  }
  // Fetch ALL financial records for this tournament, newest first (no recordType filter – settlement may be stored as income or legacy null)
  const rows = await db
    .select()
    .from(financialRecords)
    .where(eq(financialRecords.competitionId, tournamentId))
    .orderBy(desc(financialRecords.id));
  // Runtime debug: what we have for this tournament
  const debugRecords = rows.map((r) => {
    const parsed = parseParticipantSnapshot(r.participantSnapshot);
    const withPrize = parsed.participants.filter((p) => Number((p as { prizeWon?: number }).prizeWon) > 0);
    return {
      id: r.id,
      recordType: r.recordType ?? "(null)",
      competitionId: r.competitionId,
      totalPrizes: r.totalPrizes,
      participantsLength: parsed.participants.length,
      withPrizeWonGt0: withPrize.length,
    };
  });
  console.log("SETTLEMENT WINNERS DEBUG tournamentId=" + tournamentId + " records=" + JSON.stringify(debugRecords));
  // Use the first (latest) record that has at least one prize recipient
  let record: (typeof rows)[0] | undefined;
  let participants: FinancialRecordParticipant[] = [];
  let winnersOnly: FinancialRecordParticipant[] = [];
  for (const r of rows) {
    if (!r.participantSnapshot) continue;
    const parsed = parseParticipantSnapshot(r.participantSnapshot);
    const list = parsed.participants;
    const withPrize = list.filter((p) => Number((p as { prizeWon?: number }).prizeWon) > 0);
    if (withPrize.length > 0) {
      record = r;
      participants = list;
      winnersOnly = withPrize;
      break;
    }
  }
  if (!record || winnersOnly.length === 0) {
    const reason = rows.length === 0 ? "no_financial_record" : "no_record_with_prize_recipients";
    console.log("SETTLEMENT WINNERS DEBUG tournamentId=" + tournamentId + " settled=false reason=" + reason);
    return { settled: false };
  }
  const totalPrizes = Number(record.totalPrizes ?? 0) || 1;
  const bySubmissionId = new Map<number, number>();
  const subs = await getSubmissionsByTournament(tournamentId);
  for (const s of subs) bySubmissionId.set(s.id, s.points);
  const winners: SettlementWinnerRow[] = winnersOnly
    .sort((a, b) => (Number((a as { rank?: number }).rank) ?? 999) - (Number((b as { rank?: number }).rank) ?? 999))
    .map((p) => {
      const prizeWon = Number((p as { prizeWon?: number }).prizeWon) ?? 0;
      const rank = Number((p as { rank?: number }).rank) ?? 1;
      const submissionId = (p as { submissionId?: number }).submissionId;
      return {
        rank,
        userId: (p as { userId: number }).userId,
        username: (p as { username?: string }).username ?? `#${(p as { userId: number }).userId}`,
        points: submissionId != null ? bySubmissionId.get(submissionId) ?? 0 : 0,
        prizeAmount: prizeWon,
        prizePercentage: Math.round((prizeWon / totalPrizes) * 1000) / 10,
      };
    });
  // Runtime proof
  console.log("SETTLEMENT WINNERS PROOF tournamentId=" + tournamentId + " settled=true recordId=" + record.id + " recordType=" + (record.recordType ?? "null") + " totalPrizePool=" + totalPrizes + " winnersCount=" + winners.length + " snapshotParticipantsWithPrizeGt0=" + winnersOnly.length);
  console.log("SETTLEMENT WINNERS RETURNED JSON " + JSON.stringify({ settled: true, totalPrizePool: totalPrizes, winnerCount: winners.length, winners: winners.map((w) => ({ rank: w.rank, username: w.username, points: w.points, prizeAmount: w.prizeAmount, prizePercentage: w.prizePercentage })) }));
  return { settled: true, totalPrizePool: totalPrizes, winners };
}

/**
 * Pre-settlement winners preview for FreeRoll only. Same ranking/prize logic as settlement, read-only.
 * No payouts, no financial records. Returns preview: false for paid tournaments.
 */
export async function getTournamentSettlementPreview(tournamentId: number): Promise<
  | { preview: true; totalPrizePool: number; winners: SettlementWinnerRow[] }
  | { preview: false }
> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { preview: false };
  const tAmount = Number((tournament as { amount?: number }).amount ?? 0);
  if (tAmount !== 0) return { preview: false };
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  if (subs.length === 0) return { preview: false };
  const { resolveSettlement } = await import("./settlement/resolveSettlement");
  const tGuaranteed = Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0;
  const settlementInput = subs.map((s) => ({
    id: s.id,
    userId: s.userId,
    username: s.username ?? null,
    points: s.points,
    strongHit: (s as { strongHit?: boolean }).strongHit,
  }));
  const resolved = await resolveSettlement(
    { ...tournament, id: tournamentId, amount: tAmount, guaranteedPrizeAmount: tGuaranteed > 0 ? tGuaranteed : null } as { id: number; amount: number; guaranteedPrizeAmount?: number | null; competitionTypeId?: number | null; type?: string | null },
    settlementInput
  );
  const winnerSubmissions = resolved.winnerSubmissions;
  if (winnerSubmissions.length === 0) return { preview: false };
  const totalPrizes = resolved.distributed || 1;
  const winners: SettlementWinnerRow[] = winnerSubmissions.map((w) => {
    const prizeWon = (w as { prizeAmount?: number }).prizeAmount ?? resolved.prizePerWinner;
    const rank = (w as { rank?: number }).rank ?? 1;
    return {
      rank,
      userId: w.userId,
      username: w.username ?? `#${w.userId}`,
      points: w.points,
      prizeAmount: prizeWon,
      prizePercentage: Math.round((prizeWon / totalPrizes) * 1000) / 10,
    };
  });
  return { preview: true, totalPrizePool: totalPrizes, winners };
}

export type FinancialSummary = {
  totalIncome: number;
  totalRefunds: number;
  netProfit: number;
};

/** סיכום כספי: הכנסות מתחרויות שהסתיימו, החזרים, רווח נקי – מהדאטה הנשמרת לצמיתות */
export async function getFinancialSummary(opts?: { from?: Date; to?: Date }): Promise<FinancialSummary> {
  const rows = await getFinancialRecords(opts);
  let totalIncome = 0;
  let totalRefunds = 0;
  for (const r of rows) {
    const rt = r.recordType ?? "income";
    if (rt === "refund") totalRefunds += r.totalCollected;
    else totalIncome += r.totalCollected;
  }
  const netProfit = rows.reduce((acc, r) => acc + r.netProfit, 0);
  return { totalIncome, totalRefunds, netProfit };
}

/** מחיקת כל רשומות ההיסטוריה הכספית – רק לסופר מנהל, אחרי אימות סיסמה. לא נקרא במחיקת תחרות. */
export async function deleteAllFinancialRecords(): Promise<void> {
  const { financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.delete(financialRecords);
}

export type TransparencyLogType = "Deposit" | "Prize" | "Commission" | "Refund" | "Bonus" | "Adjustment" | "AgentPointTransfer";

/** רישום פעולה כספית בלוג שקיפות – לא נמחק ב־cascade; ארכיון לצמיתות */
export async function insertTransparencyLog(data: {
  competitionId: number;
  competitionName: string;
  userId: number;
  username: string;
  agentId?: number | null;
  type: TransparencyLogType;
  amount: number;
  siteProfit?: number;
  agentProfit?: number;
  transactionDate: Date;
  competitionStatusAtTime?: string | null;
  createdBy?: number | null;
}): Promise<void> {
  const { financialTransparencyLog } = await getSchema();
  const db = await getDb();
  if (!db) return;
  await db.insert(financialTransparencyLog).values({
    competitionId: data.competitionId,
    competitionName: data.competitionName,
    userId: data.userId,
    username: data.username,
    agentId: data.agentId ?? null,
    type: data.type,
    amount: data.amount,
    siteProfit: data.siteProfit ?? 0,
    agentProfit: data.agentProfit ?? 0,
    transactionDate: data.transactionDate,
    competitionStatusAtTime: data.competitionStatusAtTime ?? null,
    createdBy: data.createdBy ?? null,
  });
}

export type TransparencySummary = {
  totalIncome: number;
  totalPrizes: number;
  totalRefunds: number;
  netSiteProfit: number;
  totalAgentProfit: number;
  competitionsHeld: number;
  competitionsCancelled: number;
};

/** סיכום לוג שקיפות כספים */
export async function getTransparencySummary(opts?: { from?: Date; to?: Date }): Promise<TransparencySummary> {
  const rows = await getTransparencyLog({ ...opts, limit: 1_000_000 });
  let totalIncome = 0, totalPrizes = 0, totalRefunds = 0, netSiteProfit = 0, totalAgentProfit = 0;
  const heldIds = new Set<number>(), cancelledIds = new Set<number>();
  for (const r of rows) {
    if (r.type === "Deposit" || r.type === "Bonus") totalIncome += r.amount;
    else if (r.type === "Prize") { totalPrizes += r.amount; if (r.competitionId > 0) heldIds.add(r.competitionId); }
    else if (r.type === "Refund") { totalRefunds += r.amount; if (r.competitionId > 0) cancelledIds.add(r.competitionId); }
    netSiteProfit += r.siteProfit;
    totalAgentProfit += r.agentProfit;
  }
  return {
    totalIncome,
    totalPrizes,
    totalRefunds,
    netSiteProfit,
    totalAgentProfit,
    competitionsHeld: heldIds.size,
    competitionsCancelled: cancelledIds.size,
  };
}

export type TransparencyLogRow = {
  id: number;
  competitionId: number;
  competitionName: string;
  userId: number;
  username: string;
  agentId: number | null;
  type: string;
  amount: number;
  siteProfit: number;
  agentProfit: number;
  transactionDate: Date | null;
  competitionStatusAtTime: string | null;
  createdAt: Date | null;
  createdBy: number | null;
};

export type GetTransparencyLogOpts = {
  from?: Date;
  to?: Date;
  competitionId?: number;
  userId?: number;
  agentId?: number;
  type?: TransparencyLogType;
  search?: string;
  sortBy?: "amount" | "transactionDate";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

/** פירוט לוג שקיפות עם סינון ומיון */
export async function getTransparencyLog(opts: GetTransparencyLogOpts = {}): Promise<TransparencyLogRow[]> {
  const { financialTransparencyLog } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts.from != null) conditions.push(gte(financialTransparencyLog.transactionDate, opts.from));
  if (opts.to != null) conditions.push(lte(financialTransparencyLog.transactionDate, opts.to));
  if (opts.competitionId != null) conditions.push(eq(financialTransparencyLog.competitionId, opts.competitionId));
  if (opts.userId != null) conditions.push(eq(financialTransparencyLog.userId, opts.userId));
  if (opts.agentId != null) conditions.push(eq(financialTransparencyLog.agentId, opts.agentId));
  if (opts.type != null) conditions.push(eq(financialTransparencyLog.type, opts.type));
  if (opts.search != null && opts.search.trim() !== "") {
    const q = `%${opts.search.trim()}%`;
    conditions.push(or(
      like(financialTransparencyLog.competitionName, q),
      like(financialTransparencyLog.username, q)
    ) as ReturnType<typeof eq>);
  }
  const orderByCol = opts.sortBy === "amount"
    ? financialTransparencyLog.amount
    : financialTransparencyLog.transactionDate;
  const order = opts.sortOrder === "asc" ? orderByCol : desc(orderByCol);
  const limit = opts.limit ?? 500;
  const offset = opts.offset ?? 0;
  const q = conditions.length > 0
    ? db.select().from(financialTransparencyLog).where(and(...conditions)).orderBy(order).limit(limit).offset(offset)
    : db.select().from(financialTransparencyLog).orderBy(order).limit(limit).offset(offset);
  const rows = await q;
  return rows.map((r) => ({
    id: r.id,
    competitionId: r.competitionId,
    competitionName: r.competitionName,
    userId: r.userId,
    username: r.username,
    agentId: r.agentId,
    type: r.type,
    amount: r.amount,
    siteProfit: r.siteProfit,
    agentProfit: r.agentProfit,
    transactionDate: r.transactionDate,
    competitionStatusAtTime: r.competitionStatusAtTime,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
  }));
}

/** מחיקת כל לוג השקיפות – רק סופר מנהל, עם אימות כפול. מתועד בלוג. */
export async function deleteAllTransparencyLog(): Promise<void> {
  const { financialTransparencyLog } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.delete(financialTransparencyLog);
}

/** תחרויות שהגיע זמנן למעבר לארכיון (10 דקות אחרי הצגת תוצאות) – ללא מחיקה, רק עדכון סטטוס */
export async function getTournamentsToCleanup(): Promise<Array<{ id: number }>> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const all = await db.select({ id: tournaments.id, resultsFinalizedAt: tournaments.resultsFinalizedAt, dataCleanedAt: tournaments.dataCleanedAt }).from(tournaments).where(isNull(tournaments.deletedAt));
  const now = Date.now();
  return all
    .filter((t) => t.resultsFinalizedAt != null && t.dataCleanedAt == null)
    .filter((t) => {
      const finalizedMs = t.resultsFinalizedAt instanceof Date ? t.resultsFinalizedAt.getTime() : Number(t.resultsFinalizedAt);
      return finalizedMs + DISPLAY_WINDOW_MS <= now;
    })
    .map((t) => ({ id: t.id }));
}

/** ארכוב תחרות – מעדכן סטטוס ל-ARCHIVED, visibility=HIDDEN (לא מוצג בדף הראשי), archivedAt. אין מחיקה של נתונים, עמלות או רווחים. */
export async function cleanupTournamentData(tournamentId: number): Promise<void> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const now = new Date();
  await db.update(tournaments).set({
    status: "ARCHIVED",
    visibility: "HIDDEN",
    archivedAt: now,
    dataCleanedAt: now,
  } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
}

/** תחרויות שהגיע זמנן לסגירה אוטומטית (closesAt עבר) – עדיין OPEN */
export async function getTournamentsToAutoClose(): Promise<Array<{ id: number; type?: string }>> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const all = await db.select({ id: tournaments.id, type: tournaments.type, closesAt: tournaments.closesAt }).from(tournaments).where(
    and(eq(tournaments.status, "OPEN"), isNotNull(tournaments.closesAt), isNull(tournaments.deletedAt))
  );
  const now = Date.now();
  return all
    .filter((t) => t.closesAt != null && (t.closesAt instanceof Date ? t.closesAt.getTime() : Number(t.closesAt)) <= now)
    .map((t) => ({ id: t.id, type: (t as { type?: string }).type }));
}

/** Phase 19: OPEN tournaments with closesAt in (now, now+withinMs] for "closing soon" notifications. */
export async function getTournamentsClosingSoon(withinMs: number): Promise<Array<{ id: number; name?: string; closesAt: Date | number | null }>> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const all = await db.select({
    id: tournaments.id,
    name: tournaments.name,
    closesAt: tournaments.closesAt,
  }).from(tournaments).where(
    and(eq(tournaments.status, "OPEN"), isNotNull(tournaments.closesAt), isNull(tournaments.deletedAt))
  );
  const now = Date.now();
  const end = now + withinMs;
  return all
    .filter((t) => {
      const c = t.closesAt != null ? (t.closesAt instanceof Date ? t.closesAt.getTime() : Number(t.closesAt)) : 0;
      return c > now && c <= end;
    })
    .map((t) => ({ id: t.id, name: (t as { name?: string }).name, closesAt: t.closesAt }));
}

/** Phase 19: Whether a notification of this type for this tournament exists within the last withinMs. */
export async function hasRecentNotificationForTournament(tournamentId: number, type: string, withinMs: number): Promise<boolean> {
  if (!USE_SQLITE) return false;
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return false;
  const db = await getDb();
  if (!db) return false;
  const since = new Date(Date.now() - withinMs);
  const rows = await db.select({ id: tbl.id }).from(tbl)
    .where(and(eq(tbl.type, type), sql`json_extract(${tbl.payloadJson}, '$.tournamentId') = ${String(tournamentId)}`, gte(tbl.createdAt, since)))
    .limit(1);
  return rows.length > 0;
}

/** Phase 18: Tournaments that are due for settlement (settledAt <= now, status allows settlement). */
export async function getTournamentsToSettleNow(): Promise<Array<{ id: number; settledAt: Date | number | null }>> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const all = await db
    .select({ id: tournaments.id, settledAt: tournaments.settledAt })
    .from(tournaments)
    .where(
      and(
        inArray(tournaments.status, ["RESULTS_UPDATED", "LOCKED", "CLOSED"]),
        isNotNull(tournaments.settledAt),
        isNull(tournaments.deletedAt)
      )
    );
  const now = Date.now();
  return all
    .filter((t) => t.settledAt != null && (t.settledAt instanceof Date ? t.settledAt.getTime() : Number(t.settledAt)) <= now)
    .map((t) => ({ id: t.id, settledAt: t.settledAt }));
}

/** סגירה אוטומטית: לוטו → CLOSED, אחרת → LOCKED כשהזמן closesAt עבר */
export async function runAutoCloseTournaments(): Promise<number[]> {
  const list = await getTournamentsToAutoClose();
  if (list.length === 0) return [];
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const removalAt = new Date(now.getTime() + 5 * 60 * 1000);
  const ids: number[] = [];
  for (const { id, type } of list) {
    const status = type === "lotto" ? "CLOSED" : "LOCKED";
    await db.update(tournaments).set({
      status,
      lockedAt: now,
      removalScheduledAt: type === "lotto" ? null : removalAt,
    } as typeof tournaments.$inferInsert).where(eq(tournaments.id, id));
    ids.push(id);
  }
  return ids;
}

/** Phase 18: Close a single tournament when closesAt has passed. Idempotent. Returns true if updated. */
export async function runAutoCloseSingleTournament(tournamentId: number): Promise<boolean> {
  const list = await getTournamentsToAutoClose();
  const one = list.find((t) => t.id === tournamentId);
  if (!one) return false;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const status = one.type === "lotto" ? "CLOSED" : "LOCKED";
  const removalScheduledAt = one.type === "lotto" ? null : new Date(now.getTime() + 5 * 60 * 1000);
  await db.update(tournaments).set({
    status,
    lockedAt: now,
    removalScheduledAt,
  } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
  return true;
}

export async function getTournamentByDrawCode(drawCode: string) {
  if (!drawCode || !drawCode.trim()) return undefined;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(tournaments).where(eq(tournaments.drawCode, drawCode.trim())).limit(1);
  return r[0];
}

/** צ'אנס: מציאת תחרות לפי תאריך ושעת הגרלה */
export async function getTournamentByDrawDateAndTime(drawDate: string, drawTime: string) {
  if (!drawDate?.trim() || !drawTime?.trim()) return undefined;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const all = await db.select().from(tournaments).where(eq(tournaments.type, "chance"));
  return all.find((t) => (t as { drawDate?: string }).drawDate === drawDate.trim() && (t as { drawTime?: string }).drawTime === drawTime.trim());
}

/** האם תחרות צ'אנס נסגרה (שעת ההגרלה עברה) – לפי שעון ישראל +02:00 */
export function isChanceDrawClosed(drawDate: string | null | undefined, drawTime: string | null | undefined): boolean {
  if (!drawDate || !drawTime) return false;
  const closeAt = new Date(drawDate.trim() + "T" + drawTime.trim() + ":00+02:00").getTime();
  return Date.now() >= closeAt;
}

export async function getMatches() {
  const { matches } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(matches).orderBy(matches.matchNumber);
}

export async function getMatchById(id: number) {
  const { matches } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return r[0];
}

export async function updateMatchResult(id: number, homeScore: number, awayScore: number) {
  const { matches } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(matches).set({
    homeScore,
    awayScore,
    status: "finished",
    updatedAt: new Date(),
  }).where(eq(matches.id, id));
}

/** עדכון פרטי משחק (שמות קבוצות וכו') – למנהל */
export async function updateMatchDetails(
  id: number,
  data: {
    homeTeam?: string;
    awayTeam?: string;
    groupName?: string;
    matchDate?: string;
    matchTime?: string;
    stadium?: string;
    city?: string;
  }
) {
  const { matches } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.homeTeam != null) set.homeTeam = data.homeTeam;
  if (data.awayTeam != null) set.awayTeam = data.awayTeam;
  if (data.groupName != null) set.groupName = data.groupName;
  if (data.matchDate != null) set.matchDate = data.matchDate;
  if (data.matchTime != null) set.matchTime = data.matchTime;
  if (data.stadium != null) set.stadium = data.stadium;
  if (data.city != null) set.city = data.city;
  if (Object.keys(set).length <= 1) return;
  await db.update(matches).set(set).where(eq(matches.id, id));
}

export async function getSubmissionByUserAndTournament(userId: number, tournamentId: number) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.tournamentId, tournamentId)))
    .orderBy(desc(submissions.createdAt))
    .limit(1);
  return r[0];
}

/** כל הטפסים של משתמש בתחרות (להצגת "הכניסות שלי") */
export async function getSubmissionsByUserAndTournament(userId: number, tournamentId: number) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.tournamentId, tournamentId)))
    .orderBy(desc(submissions.createdAt));
}

export async function createSubmission(data: {
  userId: number;
  username: string;
  tournamentId: number;
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }>;
}) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(submissions).values({
    userId: data.userId,
    username: data.username,
    tournamentId: data.tournamentId,
    predictions: data.predictions as unknown as string,
    status: "pending",
    paymentStatus: "pending",
  });
}

/** כניסה חדשה בלבד – תמיד יוצר שורה חדשה. Phase 14: In same transaction enforces OPEN + maxParticipants (time boundary + capacity). */
/** Uses sync transaction (better-sqlite3 does not support async transaction callbacks). */
export async function insertSubmission(data: {
  userId: number;
  username: string;
  tournamentId: number;
  agentId?: number | null;
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }> | ChancePredictions | LottoPredictions;
  status?: "pending" | "approved" | "rejected";
  paymentStatus?: "pending" | "completed" | "failed";
  strongHit?: boolean;
}): Promise<number> {
  const sqlite = await getSqlite();
  if (!sqlite) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const status = data.status ?? "pending";
  const paymentStatus = data.paymentStatus ?? "pending";
  const predictionsJson = JSON.stringify(data.predictions);
  const strongHitVal = data.strongHit != null ? (data.strongHit ? 1 : 0) : null;

  const FREEROLL_SUBMISSION_LIMIT_MSG = "FREEROLL_SUBMISSION_LIMIT";
  const run = sqlite.transaction(() => {
    const tRow = sqlite.prepare("SELECT status, maxParticipants, amount FROM tournaments WHERE id = ?").get(data.tournamentId) as { status?: string; maxParticipants?: number | null; amount?: number | null } | undefined;
    if (!tRow || tRow.status !== "OPEN") return null as number | null;
    const amount = Number(tRow.amount ?? 0);
    if (amount === 0) {
      const userCountRow = sqlite.prepare(
        "SELECT COUNT(*) as c FROM submissions WHERE userId = ? AND tournamentId = ? AND status IN ('pending', 'approved')"
      ).get(data.userId, data.tournamentId) as { c: number };
      if (userCountRow.c >= 2) throw new Error(FREEROLL_SUBMISSION_LIMIT_MSG);
    }
    const maxParticipants = tRow.maxParticipants;
    if (maxParticipants != null && Number(maxParticipants) > 0) {
      const countRow = sqlite.prepare("SELECT COUNT(*) as c FROM submissions WHERE tournamentId = ?").get(data.tournamentId) as { c: number };
      if (countRow.c >= Number(maxParticipants)) return null as number | null;
    }
    const countRow = sqlite.prepare("SELECT COUNT(*) as c FROM submissions WHERE tournamentId = ?").get(data.tournamentId) as { c: number };
    const nextNum = countRow.c + 1;
    sqlite.prepare(`
      INSERT INTO submissions (userId, username, tournamentId, agentId, submissionNumber, predictions, points, status, paymentStatus, strongHit)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(data.userId, data.username, data.tournamentId, data.agentId ?? null, nextNum, predictionsJson, status, paymentStatus, strongHitVal);
    const row = sqlite.prepare("SELECT id FROM submissions WHERE userId = ? AND tournamentId = ? ORDER BY id DESC LIMIT 1").get(data.userId, data.tournamentId) as { id: number } | undefined;
    const id = row ? Number(row.id) : 0;
    return id > 0 ? id : null as number | null;
  });
  const result = run() as number | null;

  if (result === null) throw new Error("Tournament is not open for submissions or capacity reached");
  return result;
}

/** הוסף או עדכן טופס לפי (משתמש, טורניר) - מופיע מיד בדירוג */
export async function upsertSubmission(data: {
  userId: number;
  username: string;
  tournamentId: number;
  agentId?: number | null;
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }> | ChancePredictions | LottoPredictions;
  status?: "pending" | "approved" | "rejected";
  paymentStatus?: "pending" | "completed" | "failed";
}): Promise<number> {
  const existing = await getSubmissionByUserAndTournament(data.userId, data.tournamentId);
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const { submissions } = await getSchema();
  const status = data.status ?? "pending";
  const paymentStatus = data.paymentStatus ?? "pending";
  const row = {
    userId: data.userId,
    username: data.username,
    tournamentId: data.tournamentId,
    agentId: data.agentId ?? null,
    predictions: data.predictions,
    updatedAt: new Date(),
    status,
    paymentStatus,
  };
  if (existing) {
    await db.update(submissions).set({
      ...row,
      points: existing.points ?? 0,
      ...(isLottoPredictionsValid(data.predictions) ? { strongHit: false } : {}),
    }).where(eq(submissions.id, existing.id));
    return existing.id;
  }
  await db.insert(submissions).values({
    ...row,
    points: 0,
  });
  const created = await getSubmissionByUserAndTournament(data.userId, data.tournamentId);
  return created?.id ?? 0;
}

export async function getAllSubmissions() {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissions).orderBy(desc(submissions.createdAt));
}

/** מספר טפסים בסטטוס ממתין – להתראות למנהל */
export async function getPendingSubmissionsCount(): Promise<number> {
  const subs = await getAllSubmissions();
  return subs.filter((s) => s.status === "pending").length;
}

export async function getSubmissionsByTournament(tournamentId: number) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissions)
    .where(eq(submissions.tournamentId, tournamentId))
    .orderBy(desc(submissions.points), desc(submissions.updatedAt));
}

/** Phase 22: Unique participant user IDs for a tournament (for lifecycle notifications). */
export async function getParticipantUserIdsForTournament(tournamentId: number): Promise<number[]> {
  const subs = await getSubmissionsByTournament(tournamentId);
  const ids = new Set<number>();
  for (const s of subs) ids.add(s.userId);
  return Array.from(ids);
}

export async function getSubmissionsByUserId(userId: number) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissions).where(eq(submissions.userId, userId));
}

export async function getSubmissionById(id: number) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  return r[0];
}

export async function updateSubmissionStatus(
  id: number,
  status: "pending" | "approved" | "rejected",
  approvedBy?: number
) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "approved") {
    update.approvedAt = new Date();
    if (approvedBy) update.approvedBy = approvedBy;
  }
  await db.update(submissions).set(update).where(eq(submissions.id, id));
}

export async function updateSubmissionPayment(id: number, paymentStatus: "pending" | "completed" | "failed") {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(submissions).set({ paymentStatus, updatedAt: new Date() }).where(eq(submissions.id, id));
}

/** Phase 28: Create a payment transaction (SQLite only). */
export async function createPaymentTransaction(data: {
  userId: number;
  tournamentId: number;
  submissionId?: number | null;
  type: "entry_fee" | "payout" | "deposit" | "withdrawal" | "refund" | "manual_adjustment";
  amount: number;
  currencyCode?: string;
  status?: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  provider?: string;
  externalRef?: string | null;
  notes?: string | null;
  metadataJson?: unknown;
  paidAt?: Date | null;
}): Promise<number | null> {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const pt = (schema as { paymentTransactions?: typeof import("../drizzle/schema-sqlite").paymentTransactions }).paymentTransactions;
  if (!pt) return null;
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const row = {
    userId: data.userId,
    tournamentId: data.tournamentId,
    submissionId: data.submissionId ?? null,
    type: data.type,
    amount: data.amount,
    currencyCode: data.currencyCode ?? "points",
    status: data.status ?? "pending",
    provider: data.provider ?? "manual",
    externalRef: data.externalRef ?? null,
    notes: data.notes ?? null,
    metadataJson: data.metadataJson ?? null,
    createdAt: now,
    updatedAt: now,
    paidAt: data.paidAt ?? null,
  };
  const out = await db.insert(pt).values(row as never).returning({ id: pt.id });
  const id = out?.[0]?.id;
  return typeof id === "number" ? id : null;
}

/** Phase 28/30: List payment transactions with optional filters (SQLite only). */
export async function getPaymentTransactions(opts?: {
  status?: string;
  type?: string;
  tournamentId?: number;
  userId?: number;
  provider?: string;
  limit?: number;
  offset?: number;
}): Promise<Array<{ id: number; userId: number; tournamentId: number; submissionId: number | null; type: string; amount: number; currencyCode: string | null; status: string; provider: string | null; externalRef: string | null; notes: string | null; createdAt: Date | null; updatedAt: Date | null; paidAt: Date | null; metadataJson?: unknown }>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const pt = (schema as { paymentTransactions?: typeof import("../drizzle/schema-sqlite").paymentTransactions }).paymentTransactions;
  if (!pt) return [];
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts?.status) conditions.push(eq(pt.status, opts.status as "pending" | "paid" | "failed" | "refunded" | "cancelled"));
  if (opts?.type) conditions.push(eq(pt.type, opts.type as "entry_fee" | "payout" | "deposit" | "withdrawal" | "refund" | "manual_adjustment"));
  if (opts?.tournamentId != null) conditions.push(eq(pt.tournamentId, opts.tournamentId));
  if (opts?.userId != null) conditions.push(eq(pt.userId, opts.userId));
  if (opts?.provider) conditions.push(eq(pt.provider, opts.provider));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(opts?.limit ?? 100, 500);
  const offset = opts?.offset ?? 0;
  const rows = whereClause
    ? await db.select().from(pt).where(whereClause).orderBy(desc(pt.createdAt)).limit(limit).offset(offset)
    : await db.select().from(pt).orderBy(desc(pt.createdAt)).limit(limit).offset(offset);
  return rows.map((r) => ({
    id: (r as { id: number }).id,
    userId: (r as { userId: number }).userId,
    tournamentId: (r as { tournamentId: number }).tournamentId,
    submissionId: (r as { submissionId: number | null }).submissionId,
    type: (r as { type: string }).type,
    amount: (r as { amount: number }).amount,
    currencyCode: (r as { currencyCode: string | null }).currencyCode,
    status: (r as { status: string }).status,
    provider: (r as { provider: string | null }).provider,
    externalRef: (r as { externalRef: string | null }).externalRef,
    notes: (r as { notes: string | null }).notes,
    createdAt: (r as { createdAt: Date | null }).createdAt,
    updatedAt: (r as { updatedAt: Date | null }).updatedAt,
    paidAt: (r as { paidAt: Date | null }).paidAt,
    metadataJson: (r as { metadataJson?: unknown }).metadataJson,
  }));
}

/** Phase 28: Get a single payment transaction by id (SQLite only). */
export async function getPaymentTransactionById(id: number) {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const pt = (schema as { paymentTransactions?: typeof import("../drizzle/schema-sqlite").paymentTransactions }).paymentTransactions;
  if (!pt) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pt).where(eq(pt.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Phase 30: Read-only payment report summary – counts and amounts by status, type, provider, accountingType (SQLite only). */
export type PaymentReportSummary = {
  countByStatus: Record<string, number>;
  amountByStatus: Record<string, number>;
  countByType: Record<string, number>;
  amountByType: Record<string, number>;
  countByProvider: Record<string, number>;
  amountByProvider: Record<string, number>;
  countByAccountingType: Record<string, number>;
  amountByAccountingType: Record<string, number>;
  totalCount: number;
  totalAmount: number;
};

export async function getPaymentReportSummary(): Promise<PaymentReportSummary> {
  const empty: PaymentReportSummary = {
    countByStatus: {},
    amountByStatus: {},
    countByType: {},
    amountByType: {},
    countByProvider: {},
    amountByProvider: {},
    countByAccountingType: {},
    amountByAccountingType: {},
    totalCount: 0,
    totalAmount: 0,
  };
  if (!USE_SQLITE) return empty;
  const schema = await getSchema();
  const pt = (schema as { paymentTransactions?: typeof import("../drizzle/schema-sqlite").paymentTransactions }).paymentTransactions;
  if (!pt) return empty;
  const db = await getDb();
  if (!db) return empty;
  const rows = await db.select().from(pt);
  const countByStatus: Record<string, number> = {};
  const amountByStatus: Record<string, number> = {};
  const countByType: Record<string, number> = {};
  const amountByType: Record<string, number> = {};
  const countByProvider: Record<string, number> = {};
  const amountByProvider: Record<string, number> = {};
  const countByAccountingType: Record<string, number> = {};
  const amountByAccountingType: Record<string, number> = {};
  let totalAmount = 0;
  for (const r of rows) {
    const status = (r as { status: string }).status ?? "unknown";
    const type = (r as { type: string }).type ?? "unknown";
    const provider = (r as { provider: string | null }).provider ?? "manual";
    const amount = Number((r as { amount: number }).amount ?? 0);
    const meta = (r as { metadataJson?: unknown }).metadataJson as { accounting?: { accountingType?: string } } | null | undefined;
    const accountingType = meta?.accounting?.accountingType ?? "none";
    countByStatus[status] = (countByStatus[status] ?? 0) + 1;
    amountByStatus[status] = (amountByStatus[status] ?? 0) + amount;
    countByType[type] = (countByType[type] ?? 0) + 1;
    amountByType[type] = (amountByType[type] ?? 0) + amount;
    countByProvider[provider] = (countByProvider[provider] ?? 0) + 1;
    amountByProvider[provider] = (amountByProvider[provider] ?? 0) + amount;
    countByAccountingType[accountingType] = (countByAccountingType[accountingType] ?? 0) + 1;
    amountByAccountingType[accountingType] = (amountByAccountingType[accountingType] ?? 0) + amount;
    totalAmount += amount;
  }
  return {
    countByStatus,
    amountByStatus,
    countByType,
    amountByType,
    countByProvider,
    amountByProvider,
    countByAccountingType,
    amountByAccountingType,
    totalCount: rows.length,
    totalAmount,
  };
}

/** Phase 30: Payment transaction detail with linked submission, tournament, user for traceability (SQLite only). */
export async function getPaymentTransactionDetail(paymentId: number): Promise<{
  payment: unknown;
  submission: unknown;
  tournament: unknown;
  user: unknown;
} | null> {
  const payment = await getPaymentTransactionById(paymentId);
  if (!payment) return null;
  const submissionId = (payment as { submissionId: number | null }).submissionId;
  const tournamentId = (payment as { tournamentId: number }).tournamentId;
  const userId = (payment as { userId: number }).userId;
  const [submission, tournament, user] = await Promise.all([
    submissionId != null ? getSubmissionById(submissionId) : null,
    getTournamentById(tournamentId),
    getUserById(userId),
  ]);
  return { payment, submission, tournament, user };
}

/** Phase 28: Get payment transaction by submission id (SQLite only). */
export async function getPaymentBySubmissionId(submissionId: number) {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const pt = (schema as { paymentTransactions?: typeof import("../drizzle/schema-sqlite").paymentTransactions }).paymentTransactions;
  if (!pt) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pt).where(eq(pt.submissionId, submissionId)).orderBy(desc(pt.createdAt)).limit(1);
  return rows[0] ?? null;
}

/** Phase 29: Merge metadata onto a payment transaction (SQLite only). Used for accounting flags to prevent double-counting. */
export async function updatePaymentMetadata(
  paymentId: number,
  metadataPatch: Record<string, unknown>
): Promise<void> {
  if (!USE_SQLITE) return;
  const row = await getPaymentTransactionById(paymentId);
  if (!row) return;
  const pt = (await getSchema()) as { paymentTransactions?: typeof import("../drizzle/schema-sqlite").paymentTransactions };
  const table = pt.paymentTransactions;
  if (!table) return;
  const db = await getDb();
  if (!db) return;
  const current = (row as { metadataJson?: unknown }).metadataJson as Record<string, unknown> | null | undefined;
  let merged: Record<string, unknown>;
  if (current && typeof current === "object") {
    merged = { ...current };
    if (metadataPatch.accounting && typeof metadataPatch.accounting === "object" && merged.accounting && typeof merged.accounting === "object") {
      merged.accounting = { ...(merged.accounting as Record<string, unknown>), ...(metadataPatch.accounting as Record<string, unknown>) };
    } else if (metadataPatch.accounting !== undefined) {
      merged.accounting = metadataPatch.accounting;
    }
    for (const k of Object.keys(metadataPatch)) {
      if (k !== "accounting") merged[k] = metadataPatch[k];
    }
  } else {
    merged = { ...metadataPatch };
  }
  await db.update(table).set({ metadataJson: merged as never, updatedAt: new Date() }).where(eq(table.id, paymentId));
}

/** Phase 29: Apply accounting when entry_fee payment is marked paid. Idempotent (skips if metadata.accounting.accountedAt). */
async function applyPaymentAccountingWhenPaid(paymentId: number, performedBy?: number): Promise<void> {
  if (!USE_SQLITE) return;
  const payment = await getPaymentTransactionById(paymentId);
  if (!payment) return;
  const type = (payment as { type: string }).type;
  if (type !== "entry_fee") return;
  const meta = (payment as { metadataJson?: unknown }).metadataJson as { accounting?: { accountedAt?: string; accountingType?: string } } | null | undefined;
  if (meta?.accounting?.accountedAt) return;
  const submissionId = (payment as { submissionId: number | null }).submissionId;
  const userId = (payment as { userId: number }).userId;
  const tournamentId = (payment as { tournamentId: number }).tournamentId;
  const amount = (payment as { amount: number }).amount;
  const sub = submissionId != null ? await getSubmissionById(submissionId) : null;
  const user = await getUserById(userId);
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return;
  const tournamentName = (tournament as { name?: string }).name ?? String(tournamentId);
  const effectiveAgentId = user?.role === "agent" ? user.id : (user as { agentId?: number | null })?.agentId ?? null;
  const { getCommissionBasisPoints, getAgentShareBasisPoints } = await import("./finance");
  const bps = getCommissionBasisPoints(tournament as { commissionPercentBasisPoints?: number | null; houseFeeRate?: number | null });
  const commissionTotal = Math.floor((amount * bps) / 10_000);
  const commissionAmount = effectiveAgentId != null
    ? Math.floor((commissionTotal * (await getAgentShareBasisPoints(effectiveAgentId))) / 10_000)
    : 0;
  const feeSite = commissionTotal - commissionAmount;
  const participationOpts = effectiveAgentId != null
    ? { commissionAgent: commissionAmount, commissionSite: feeSite, agentId: effectiveAgentId }
    : undefined;
  const description = `השתתפות (אישור תשלום): ${tournamentName}`;
  const deducted = await deductUserPoints(userId, amount, "participation", {
    referenceId: tournamentId,
    description,
    ...participationOpts,
  });
  const now = new Date();
  const accountingType = deducted ? "points_deducted" : "external";
  if (deducted && submissionId != null && effectiveAgentId != null && !(await hasCommissionForSubmission(submissionId))) {
    await recordAgentCommission({
      agentId: effectiveAgentId,
      submissionId,
      userId,
      entryAmount: amount,
      commissionAmount,
    });
    await insertTransparencyLog({
      competitionId: tournamentId,
      competitionName: tournamentName,
      userId,
      username: (sub as { username?: string })?.username ?? `#${userId}`,
      agentId: effectiveAgentId,
      type: "Commission",
      amount: commissionAmount,
      siteProfit: 0,
      agentProfit: commissionAmount,
      transactionDate: now,
      competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
      createdBy: performedBy ?? null,
    });
  }
  await insertTransparencyLog({
    competitionId: tournamentId,
    competitionName: tournamentName,
    userId,
    username: (sub as { username?: string })?.username ?? `#${userId}`,
    agentId: effectiveAgentId ?? undefined,
    type: "Deposit",
    amount,
    siteProfit: feeSite,
    agentProfit: commissionAmount,
    transactionDate: now,
    competitionStatusAtTime: (tournament as { status?: string }).status ?? "OPEN",
    createdBy: performedBy ?? null,
  });
  await updatePaymentMetadata(paymentId, {
    accounting: {
      accountedAt: now.toISOString(),
      accountingType,
    },
  });
}

/** Phase 29: Apply accounting when payment is marked refunded. Idempotent (skips if metadata.accounting.refundedAt). */
async function applyRefundAccountingWhenRefunded(paymentId: number, performedBy?: number): Promise<void> {
  if (!USE_SQLITE) return;
  const payment = await getPaymentTransactionById(paymentId);
  if (!payment) return;
  const meta = (payment as { metadataJson?: unknown }).metadataJson as { accounting?: { refundedAt?: string; accountingType?: string } } | null | undefined;
  if (meta?.accounting?.refundedAt) return;
  const userId = (payment as { userId: number }).userId;
  const tournamentId = (payment as { tournamentId: number }).tournamentId;
  const amount = (payment as { amount: number }).amount;
  const sub = (payment as { submissionId: number | null }).submissionId != null ? await getSubmissionById((payment as { submissionId: number }).submissionId) : null;
  const tournament = await getTournamentById(tournamentId);
  const tournamentName = tournament ? (tournament as { name?: string }).name ?? String(tournamentId) : String(tournamentId);
  const accountingType = meta?.accounting?.accountingType ?? "external";
  if (accountingType === "points_deducted") {
    await addUserPoints(userId, amount, "refund", {
      referenceId: tournamentId,
      description: "החזר תשלום תחרות",
      performedBy: performedBy ?? undefined,
    });
  }
  await insertTransparencyLog({
    competitionId: tournamentId,
    competitionName: tournamentName,
    userId,
    username: (sub as { username?: string })?.username ?? `#${userId}`,
    type: "Refund",
    amount,
    siteProfit: 0,
    agentProfit: 0,
    transactionDate: new Date(),
    createdBy: performedBy ?? null,
  });
  const currentMeta = (payment as { metadataJson?: unknown }).metadataJson as Record<string, unknown> | null | undefined;
  const accounting = (currentMeta?.accounting && typeof currentMeta.accounting === "object")
    ? { ...(currentMeta.accounting as Record<string, unknown>), refundedAt: new Date().toISOString() }
    : { refundedAt: new Date().toISOString() };
  await updatePaymentMetadata(paymentId, { accounting });
}

/** Phase 28: Update payment transaction status; syncs submission.paymentStatus when status is paid/failed (SQLite only). Phase 29: runs accounting when paid/refunded. */
export async function updatePaymentTransactionStatus(
  id: number,
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled",
  options?: { paidAt?: Date; performedBy?: number }
): Promise<boolean> {
  if (!USE_SQLITE) return false;
  const schema = await getSchema();
  const pt = (schema as { paymentTransactions?: typeof import("../drizzle/schema-sqlite").paymentTransactions }).paymentTransactions;
  const { submissions } = schema as { submissions: typeof import("../drizzle/schema-sqlite").submissions };
  if (!pt) return false;
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const update: Record<string, unknown> = { status, updatedAt: now };
  if (status === "paid") update.paidAt = options?.paidAt ?? now;
  await db.update(pt).set(update as never).where(eq(pt.id, id));
  const row = await getPaymentTransactionById(id);
  const submissionId = row && (row as { submissionId: number | null }).submissionId;
  if (submissionId != null) {
    if (status === "paid") await updateSubmissionPayment(submissionId, "completed");
    else if (status === "failed") await updateSubmissionPayment(submissionId, "failed");
  }
  if (status === "paid") await applyPaymentAccountingWhenPaid(id, options?.performedBy);
  else if (status === "refunded") await applyRefundAccountingWhenRefunded(id, options?.performedBy);
  return true;
}

export async function updateSubmissionPoints(id: number, points: number) {
  const sub = await getSubmissionById(id);
  if (sub) {
    const tournamentId = (sub as { tournamentId: number }).tournamentId;
    if (await isTournamentResultsFinalized(tournamentId)) {
      throw new Error("Cannot update points: tournament results are finalized");
    }
  }
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(submissions).set({ points, updatedAt: new Date() }).where(eq(submissions.id, id));
}

export async function updateSubmissionLottoResult(id: number, points: number, strongHit: boolean) {
  const sub = await getSubmissionById(id);
  if (sub) {
    const tournamentId = (sub as { tournamentId: number }).tournamentId;
    if (await isTournamentResultsFinalized(tournamentId)) {
      throw new Error("Cannot update result: tournament results are finalized");
    }
  }
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(submissions).set({
    points,
    strongHit: strongHit ? true : false,
    updatedAt: new Date(),
  }).where(eq(submissions.id, id));
}

/** עדכון תוכן טופס קיים (עריכה – ללא חיוב). מעדכן predictions, updatedAt, editedCount, lastEditedAt ורושם SUBMISSION_EDITED ב-audit. */
export async function updateSubmissionContent(
  id: number,
  predictions: unknown,
  actorId: number,
  actorRole: string,
  diffJson?: Record<string, unknown> | null,
  options?: { ip?: string | null; userAgent?: string | null }
) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const row = await db.select({ editedCount: submissions.editedCount }).from(submissions).where(eq(submissions.id, id)).limit(1);
  const nextEditedCount = (row[0]?.editedCount ?? 0) + 1;
  const now = new Date();
  const predictionsStr = typeof predictions === "string" ? predictions : JSON.stringify(predictions);
  await db.update(submissions).set({
    predictions: predictionsStr as never,
    updatedAt: now,
    editedCount: nextEditedCount,
    lastEditedAt: now,
  }).where(eq(submissions.id, id));
  await insertAuditLog({
    actorId,
    actorRole,
    action: "SUBMISSION_EDITED",
    entityType: "submission",
    entityId: id,
    diffJson: diffJson ?? undefined,
    ip: options?.ip ?? undefined,
    userAgent: options?.userAgent ?? undefined,
  });
}

export async function deleteSubmission(id: number) {
  const { submissions, agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.delete(agentCommissions).where(eq(agentCommissions.submissionId, id));
  await db.delete(submissions).where(eq(submissions.id, id));
}

/** מחיקת כל הטפסים מהמערכת (היסטוריית טפסים) – למנהל. מוחק גם עמלות סוכנים. */
export async function deleteAllSubmissions(): Promise<number> {
  const { submissions, agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const all = await db.select({ id: submissions.id }).from(submissions);
  const ids = all.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(agentCommissions).where(inArray(agentCommissions.submissionId, ids));
    await db.delete(submissions).where(inArray(submissions.id, ids));
  }
  return ids.length;
}

/** מחיקת משתמש (שחקן או סוכן) – לא מנהלים. סוכן: מחיקה רכה (deletedAt), נתוני כספים ושחקנים נשמרים. שחקן: מחיקה קשה (מוחק טפסים ואז משתמש). */
export async function deleteUser(id: number) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const user = await getUserById(id);
  if (!user) throw new Error("User not found");
  if (user.role === "admin") throw new Error("Cannot delete admin");

  if (user.role === "agent") {
    await db.update(users).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
    return;
  }
  if (user.role === "user") {
    const subs = await getSubmissionsByUserId(id);
    for (const s of subs) await deleteSubmission(s.id);
  }
  await db.delete(users).where(eq(users.id, id));
}

/** חסימה / ביטול חסימה למשתמש – מנהל בלבד. משתמש חסום לא יכול להתחבר. */
export async function setUserBlocked(userId: number, isBlocked: boolean) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.role === "admin") throw new Error("Cannot block admin");
  await db.update(users).set({ isBlocked, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** רשימת משתמשים לניהול – כולל סוכנים, עם סינון לפי role וסטטיסטיקות סוכן. */
export async function getUsersList(opts?: { role?: "user" | "admin" | "agent"; includeDeleted?: boolean }) {
  const list = await getAllUsers({ includeDeleted: opts?.includeDeleted });
  let filtered = list;
  if (opts?.role) filtered = list.filter((u) => u.role === opts.role);
  const result: Array<{
    id: number;
    username: string | null;
    name: string | null;
    phone: string | null;
    role: string;
    points: number;
    createdAt: Date | null;
    agentId: number | null;
    referralCode: string | null;
    isBlocked: boolean;
    deletedAt: Date | null;
    referredCount?: number;
    totalCommission?: number;
    totalEntryAmount?: number;
  }> = [];
  for (const u of filtered) {
    const row = {
      id: u.id,
      username: (u as { username?: string | null }).username ?? null,
      name: (u as { name?: string | null }).name ?? null,
      phone: (u as { phone?: string | null }).phone ?? null,
      role: u.role,
      points: (u as { points?: number }).points ?? 0,
      createdAt: (u as { createdAt?: Date | null }).createdAt ?? null,
      agentId: (u as { agentId?: number | null }).agentId ?? null,
      referralCode: (u as { referralCode?: string | null }).referralCode ?? null,
      isBlocked: (u as { isBlocked?: boolean }).isBlocked ?? false,
      deletedAt: (u as { deletedAt?: Date | null }).deletedAt ?? null,
    };
    if (u.role === "agent") {
      const referred = await getUsersByAgentId(u.id);
      const commissions = await getAgentCommissionsByAgentIdExistingOnly(u.id);
      (row as typeof result[0]).referredCount = referred.length;
      (row as typeof result[0]).totalCommission = commissions.reduce((s, c) => s + c.commissionAmount, 0);
      (row as typeof result[0]).totalEntryAmount = commissions.reduce((s, c) => s + c.entryAmount, 0);
    }
    result.push(row as typeof result[0]);
  }
  return result;
}

export async function setTournamentLocked(tournamentId: number, isLocked: boolean) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const rows = await db.select({ status: tournaments.status, removalScheduledAt: tournaments.removalScheduledAt }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  const row = rows[0] as { status?: string; removalScheduledAt?: Date | null } | undefined;
  const status = row?.status;
  const removalScheduledAt = row?.removalScheduledAt ? new Date(row.removalScheduledAt).getTime() : null;

  if (isLocked) {
    if (status !== "OPEN" && status) throw new Error("ניתן לנעול רק תחרות במצב OPEN");
    const now = new Date();
    const removalAt = new Date(now.getTime() + 5 * 60 * 1000);
    await db.update(tournaments).set({
      isLocked: true,
      status: "LOCKED",
      lockedAt: now,
      removalScheduledAt: removalAt,
    } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
  } else {
    if (removalScheduledAt != null && Date.now() >= removalScheduledAt) throw new Error("לא ניתן לבטל נעילה לאחר שעברו 5 דקות");
    await db.update(tournaments).set({
      isLocked: false,
      status: "OPEN",
      lockedAt: null,
      removalScheduledAt: null,
    } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
  }
}

/** הסרת תחרויות נעולות שעברו 5 דקות – visibility=HIDDEN, status=CLOSED. מחזיר את מזההי התחרויות שעודכנו (rows affected). */
export async function runLockedTournamentsRemoval(): Promise<number[]> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const now = new Date(); // Server time – ensure server timezone is correct for production
  const list = await db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(
    and(eq(tournaments.status, "LOCKED"), lte(tournaments.removalScheduledAt, now))
  );
  const ids = list.map((r) => (r as { id: number }).id);
  for (const row of list) {
    const id = (row as { id: number }).id;
    const name = (row as { name?: string }).name ?? id;
    await db.update(tournaments).set({ visibility: "HIDDEN", status: "CLOSED" } as typeof tournaments.$inferInsert).where(eq(tournaments.id, id));
    await insertAdminAuditLog({
      performedBy: 0,
      action: "Auto-remove locked tournament from homepage",
      targetUserId: null,
      details: { tournamentId: id, tournamentName: name, removalScheduledAt: now.toISOString(), serverTime: now.toISOString() },
    });
  }
  return ids;
}

// ---------- Phase 18: Automation job log (SQLite only); Phase 23: retry fields ----------
export async function insertAutomationJob(data: {
  jobType: string;
  entityType?: string;
  entityId: number;
  scheduledAt?: Date | number | null;
  executedAt?: Date | number | null;
  status: string;
  payloadJson?: unknown;
  lastError?: string | null;
  retryCount?: number;
  nextRetryAt?: Date | number | null;
  maxRetries?: number;
}): Promise<void> {
  if (!USE_SQLITE) return;
  const schema = await getSchema();
  const jobs = (schema as { automationJobs?: typeof import("../drizzle/schema-sqlite").automationJobs }).automationJobs;
  if (!jobs) return;
  const db = await getDb();
  if (!db) return;
  const executedAt = data.executedAt != null ? (data.executedAt instanceof Date ? data.executedAt : new Date(data.executedAt)) : null;
  const scheduledAt = data.scheduledAt != null ? (data.scheduledAt instanceof Date ? data.scheduledAt : new Date(data.scheduledAt)) : null;
  const retryCount = data.retryCount ?? 0;
  const maxRetries = data.maxRetries ?? 3;
  let nextRetryAt: Date | null = data.nextRetryAt != null ? (data.nextRetryAt instanceof Date ? data.nextRetryAt : new Date(data.nextRetryAt)) : null;
  if (data.status === "failed" && retryCount < maxRetries && nextRetryAt == null) {
    const backoff = new Date();
    backoff.setMinutes(backoff.getMinutes() + 5);
    nextRetryAt = backoff;
  }
  const row: Record<string, unknown> = {
    jobType: data.jobType,
    entityType: data.entityType ?? "tournament",
    entityId: data.entityId,
    scheduledAt,
    executedAt,
    status: data.status,
    payloadJson: data.payloadJson ?? null,
    lastError: data.lastError ?? null,
    retryCount,
    nextRetryAt,
    maxRetries,
  };
  await db.insert(jobs).values(row as typeof jobs.$inferInsert);
}

export async function getAutomationJobsForTournament(tournamentId: number, limit = 20): Promise<Array<{
  id: number; jobType: string; status: string; executedAt: Date | null; lastError: string | null; createdAt: Date | null;
  retryCount?: number; nextRetryAt?: Date | null;
}>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const jobs = (schema as { automationJobs?: typeof import("../drizzle/schema-sqlite").automationJobs }).automationJobs;
  if (!jobs) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: jobs.id,
    jobType: jobs.jobType,
    status: jobs.status,
    executedAt: jobs.executedAt,
    lastError: jobs.lastError,
    createdAt: jobs.createdAt,
    retryCount: (jobs as { retryCount?: number }).retryCount ?? 0,
    nextRetryAt: (jobs as { nextRetryAt?: Date | null }).nextRetryAt,
  }).from(jobs).where(and(eq(jobs.entityType, "tournament"), eq(jobs.entityId, tournamentId))).orderBy(desc(jobs.id)).limit(limit);
  return rows as Array<{ id: number; jobType: string; status: string; executedAt: Date | null; lastError: string | null; createdAt: Date | null; retryCount?: number; nextRetryAt?: Date | null }>;
}

/** Phase 23: Last failed job per (entityType, entityId, jobType) that is due for retry (retry_count < max_retries, next_retry_at <= now). */
export async function getRetryableFailedJobs(): Promise<Array<{ jobType: string; entityType: string; entityId: number; retryCount: number }>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const jobs = (schema as { automationJobs?: typeof import("../drizzle/schema-sqlite").automationJobs }).automationJobs;
  if (!jobs) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: jobs.id,
    jobType: jobs.jobType,
    entityType: jobs.entityType,
    entityId: jobs.entityId,
    retryCount: (jobs as { retryCount?: number }).retryCount ?? 0,
    maxRetries: (jobs as { maxRetries?: number }).maxRetries ?? 3,
    nextRetryAt: (jobs as { nextRetryAt?: Date | null }).nextRetryAt,
  }).from(jobs).where(eq(jobs.status, "failed")).orderBy(desc(jobs.id));
  const now = Date.now();
  const seen = new Set<string>();
  const out: Array<{ jobType: string; entityType: string; entityId: number; retryCount: number }> = [];
  for (const r of rows) {
    const key = `${(r as { entityType?: string }).entityType ?? "tournament"}:${(r as { entityId?: number }).entityId}:${(r as { jobType?: string }).jobType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const retryCount = (r as { retryCount?: number }).retryCount ?? 0;
    const maxRetries = (r as { maxRetries?: number }).maxRetries ?? 3;
    const nextRetryAt = (r as { nextRetryAt?: Date | number | null }).nextRetryAt;
    if (retryCount >= maxRetries) continue;
    const nextMs = nextRetryAt == null ? 0 : nextRetryAt instanceof Date ? nextRetryAt.getTime() : Number(nextRetryAt);
    if (nextMs > now) continue;
    out.push({
      jobType: (r as { jobType?: string }).jobType ?? "",
      entityType: (r as { entityType?: string }).entityType ?? "tournament",
      entityId: (r as { entityId?: number }).entityId ?? 0,
      retryCount,
    });
  }
  return out;
}

/** Phase 21: Aggregate automation job counts by status (executed, skipped, failed). Read-only. */
export async function getAutomationJobCounts(): Promise<{ executed: number; skipped: number; failed: number }> {
  if (!USE_SQLITE) return { executed: 0, skipped: 0, failed: 0 };
  const schema = await getSchema();
  const jobs = (schema as { automationJobs?: typeof import("../drizzle/schema-sqlite").automationJobs }).automationJobs;
  if (!jobs) return { executed: 0, skipped: 0, failed: 0 };
  const db = await getDb();
  if (!db) return { executed: 0, skipped: 0, failed: 0 };
  const rows = await db.select({ status: jobs.status }).from(jobs);
  let executed = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const s = (r as { status: string }).status?.toLowerCase?.() ?? "";
    if (s === "executed") executed++;
    else if (s === "skipped") skipped++;
    else failed++;
  }
  return { executed, skipped, failed };
}

/** Phase 23: Failed jobs count since timestamp (for health trend). */
export async function getAutomationFailedCountSince(sinceMs: number): Promise<number> {
  if (!USE_SQLITE) return 0;
  const schema = await getSchema();
  const jobs = (schema as { automationJobs?: typeof import("../drizzle/schema-sqlite").automationJobs }).automationJobs;
  if (!jobs) return 0;
  const db = await getDb();
  if (!db) return 0;
  const since = new Date(sinceMs);
  const rows = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.status, "failed"), gte(jobs.createdAt, since)));
  return rows.length;
}

/** Phase 23: Total retry count (sum of retry_count for failed jobs). */
export async function getAutomationTotalRetryCount(): Promise<number> {
  if (!USE_SQLITE) return 0;
  const schema = await getSchema();
  const jobs = (schema as { automationJobs?: typeof import("../drizzle/schema-sqlite").automationJobs }).automationJobs;
  if (!jobs) return 0;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ retryCount: (jobs as { retryCount?: number }).retryCount }).from(jobs).where(eq(jobs.status, "failed"));
  return rows.reduce((s, r) => s + ((r as { retryCount?: number }).retryCount ?? 0), 0);
}

/** Phase 23: Tournaments stuck in SETTLING (for health). */
export async function getStuckSettlingTournamentIds(): Promise<number[]> {
  const stuck = await getTournamentsWithStatusSettling();
  return stuck.map((r) => r.id);
}

/** Phase 23: Count tournaments OPEN/LOCKED/CLOSED created more than longPendingDays ago (long-pending). */
export async function getLongPendingTournamentsCount(longPendingDays = 7): Promise<number> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return 0;
  const since = new Date();
  since.setDate(since.getDate() - longPendingDays);
  const rows = await db.select({ id: tournaments.id }).from(tournaments).where(
    and(
      inArray(tournaments.status, ["OPEN", "LOCKED", "CLOSED"]),
      lte(tournaments.createdAt, since)
    )
  );
  return rows.length;
}

/** Phase 21: Count notifications where status != 'read' (unread). Read-only. */
export async function getNotificationUnreadCount(): Promise<number> {
  if (!USE_SQLITE) return 0;
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return 0;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: tbl.id }).from(tbl).where(or(isNull(tbl.readAt), ne(tbl.status, "read")));
  return rows.length;
}

/** Phase 22: Unread count for a specific recipient (user/agent). */
export async function getNotificationUnreadCountForRecipient(recipientType: string, recipientId: number): Promise<number> {
  if (!USE_SQLITE) return 0;
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return 0;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: tbl.id }).from(tbl).where(
    and(
      eq(tbl.recipientType, recipientType),
      eq(tbl.recipientId, recipientId),
      or(isNull(tbl.readAt), ne(tbl.status, "read"))
    )
  );
  return rows.length;
}

// ---------- Phase 19: Notifications ----------
export async function insertNotification(data: {
  recipientType: string;
  recipientId?: number | null;
  channel?: string;
  type: string;
  title?: string | null;
  body?: string | null;
  payloadJson?: unknown;
  status?: string;
  lastError?: string | null;
}): Promise<number | null> {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return null;
  const db = await getDb();
  if (!db) return null;
  const row = await db.insert(tbl).values({
    recipientType: data.recipientType,
    recipientId: data.recipientId ?? null,
    channel: data.channel ?? "in_app",
    type: data.type,
    title: data.title ?? null,
    body: data.body ?? null,
    payloadJson: data.payloadJson ?? null,
    status: data.status ?? "created",
    lastError: data.lastError ?? null,
  }).returning({ id: tbl.id });
  return row[0]?.id ?? null;
}

export type ListNotificationsFilter = {
  recipientType?: string;
  recipientId?: number | null;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export async function listNotifications(filter: ListNotificationsFilter = {}): Promise<Array<{
  id: number;
  recipientType: string;
  recipientId: number | null;
  channel: string;
  type: string;
  title: string | null;
  body: string | null;
  payloadJson: unknown;
  status: string;
  readAt: Date | null;
  createdAt: Date | null;
  sentAt: Date | null;
  lastError: string | null;
}>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return [];
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filter.recipientType != null) conditions.push(eq(tbl.recipientType, filter.recipientType));
  if (filter.recipientId !== undefined && filter.recipientId !== null) conditions.push(eq(tbl.recipientId, filter.recipientId));
  if (filter.type != null) conditions.push(eq(tbl.type, filter.type));
  if (filter.status != null) conditions.push(eq(tbl.status, filter.status));
  const limit = Math.min(filter.limit ?? 50, 200);
  const offset = filter.offset ?? 0;
  let query = db.select().from(tbl).orderBy(desc(tbl.id)).limit(limit).offset(offset);
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query;
  return rows as Array<{
    id: number;
    recipientType: string;
    recipientId: number | null;
    channel: string;
    type: string;
    title: string | null;
    body: string | null;
    payloadJson: unknown;
    status: string;
    readAt: Date | null;
    createdAt: Date | null;
    sentAt: Date | null;
    lastError: string | null;
  }>;
}

export async function getNotificationById(id: number): Promise<{
  id: number;
  recipientType: string;
  recipientId: number | null;
  channel: string;
  type: string;
  title: string | null;
  body: string | null;
  payloadJson: unknown;
  status: string;
  readAt: Date | null;
  createdAt: Date | null;
  sentAt: Date | null;
  lastError: string | null;
} | null> {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(tbl).where(eq(tbl.id, id)).limit(1);
  const row = rows[0];
  return row ? (row as {
    id: number;
    recipientType: string;
    recipientId: number | null;
    channel: string;
    type: string;
    title: string | null;
    body: string | null;
    payloadJson: unknown;
    status: string;
    readAt: Date | null;
    createdAt: Date | null;
    sentAt: Date | null;
    lastError: string | null;
  }) : null;
}

export async function markNotificationRead(id: number): Promise<boolean> {
  if (!USE_SQLITE) return false;
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return false;
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(tbl).set({
    status: "read",
    readAt: new Date(),
  } as typeof tbl.$inferInsert).where(eq(tbl.id, id)).returning({ id: tbl.id });
  return result.length > 0;
}

// ---------- Phase 11: Production foundations ----------
export async function recordUserDevice(data: {
  userId: number;
  deviceId?: string | null;
  fingerprintHash?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const sqlite = await getSqlite();
  if (!sqlite) return;
  const now = Date.now();
  const hasId = (data.deviceId != null && data.deviceId !== "") || (data.fingerprintHash != null && data.fingerprintHash !== "");
  const existing = hasId
    ? sqlite.prepare(
        "SELECT id, lastSeenAt FROM user_devices WHERE userId = ? AND (deviceId = ? OR fingerprintHash = ?) LIMIT 1"
      ).get(data.userId, data.deviceId ?? null, data.fingerprintHash ?? null) as { id: number; lastSeenAt: number | null } | undefined
    : null;
  if (existing) {
    sqlite.prepare(
      "UPDATE user_devices SET ip = ?, userAgent = ?, lastSeenAt = ? WHERE id = ?"
    ).run(data.ip ?? null, data.userAgent ?? null, now, existing.id);
  } else {
    sqlite.prepare(
      "INSERT INTO user_devices (userId, deviceId, fingerprintHash, ip, userAgent, firstSeenAt, lastSeenAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(data.userId, data.deviceId ?? null, data.fingerprintHash ?? null, data.ip ?? null, data.userAgent ?? null, now, now);
  }
}
export async function getLinkedUserIdsByDevice(deviceIdOrFingerprint: string): Promise<number[]> {
  const sqlite = await getSqlite();
  if (!sqlite) return [];
  const rows = sqlite.prepare(
    "SELECT DISTINCT userId FROM user_devices WHERE deviceId = ? OR fingerprintHash = ?"
  ).all(deviceIdOrFingerprint, deviceIdOrFingerprint) as Array<{ userId: number }>;
  return [...new Set(rows.map((r) => r.userId))];
}

export async function recordFraudSignal(data: {
  userId?: number | null;
  signalType: string;
  payload?: Record<string, unknown> | null;
  severity?: "low" | "medium" | "high";
}): Promise<void> {
  const sqlite = await getSqlite();
  if (!sqlite) return;
  sqlite.prepare(
    "INSERT INTO fraud_signals (userId, signalType, payloadJson, severity, createdAt) VALUES (?, ?, ?, ?, ?)"
  ).run(
    data.userId ?? null,
    data.signalType,
    data.payload ? JSON.stringify(data.payload) : null,
    data.severity ?? "medium",
    Date.now()
  );
}

/** Phase 15: Fraud signals for a user (for abuse enforcement). */
export async function getFraudSignalsForUser(
  userId: number,
  opts?: { limit?: number; sinceMs?: number }
): Promise<Array<{ id: number; signalType: string; severity: string; createdAt: number | null }>> {
  const sqlite = await getSqlite();
  if (!sqlite) return [];
  const limit = opts?.limit ?? 100;
  const since = opts?.sinceMs != null ? Date.now() - opts.sinceMs : 0;
  const rows = sqlite.prepare(
    "SELECT id, signalType, severity, createdAt FROM fraud_signals WHERE userId = ? AND (? = 0 OR createdAt >= ?) ORDER BY id DESC LIMIT ?"
  ).all(userId, since, since, limit) as Array<{ id: number; signalType: string; severity: string; createdAt: number | null }>;
  return rows;
}

/** Phase 15: User IDs with at least one fraud signal in the window (for review queue). */
export async function getUsersWithFraudSignalsSince(sinceMs: number): Promise<number[]> {
  const sqlite = await getSqlite();
  if (!sqlite) return [];
  const since = Date.now() - sinceMs;
  const rows = sqlite.prepare(
    "SELECT DISTINCT userId FROM fraud_signals WHERE userId IS NOT NULL AND createdAt >= ?"
  ).all(since) as Array<{ userId: number }>;
  return rows.map((r) => r.userId);
}

export async function insertAnalyticsEvent(data: {
  eventName: string;
  userId?: number | null;
  tournamentId?: number | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  const sqlite = await getSqlite();
  if (!sqlite) return;
  sqlite.prepare(
    "INSERT INTO analytics_events (eventName, userId, tournamentId, payloadJson, createdAt) VALUES (?, ?, ?, ?, ?)"
  ).run(
    data.eventName,
    data.userId ?? null,
    data.tournamentId ?? null,
    data.payload ? JSON.stringify(data.payload) : null,
    Date.now()
  );
}

/** Phase 11: Notifications pending for delivery (email/sms/whatsapp). For cron/job to poll and send. */
export async function getPendingNotificationsForDelivery(limit = 50): Promise<Array<{
  id: number;
  recipientType: string;
  recipientId: number | null;
  channel: string;
  type: string;
  title: string | null;
  body: string | null;
  payloadJson: unknown;
}>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: tbl.id,
    recipientType: tbl.recipientType,
    recipientId: tbl.recipientId,
    channel: tbl.channel,
    type: tbl.type,
    title: tbl.title,
    body: tbl.body,
    payloadJson: tbl.payloadJson,
  }).from(tbl).where(
    and(eq(tbl.status, "created"), inArray(tbl.channel, ["email", "sms", "whatsapp"]))
  ).orderBy(asc(tbl.id)).limit(limit);
  return rows as Array<{
    id: number;
    recipientType: string;
    recipientId: number | null;
    channel: string;
    type: string;
    title: string | null;
    body: string | null;
    payloadJson: unknown;
  }>;
}

/** Phase 12: Mark notification as delivered or failed (for worker). */
export async function updateNotificationDeliveryStatus(
  id: number,
  status: "delivered" | "failed",
  opts?: { sentAt?: Date; lastError?: string }
): Promise<boolean> {
  if (!USE_SQLITE) return false;
  const schema = await getSchema();
  const tbl = (schema as { notifications?: typeof import("../drizzle/schema-sqlite").notifications }).notifications;
  if (!tbl) return false;
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(tbl).set({
    status,
    sentAt: opts?.sentAt ?? (status === "delivered" ? new Date() : undefined),
    lastError: opts?.lastError ?? null,
  } as typeof tbl.$inferInsert).where(eq(tbl.id, id)).returning({ id: tbl.id });
  return result.length > 0;
}

// ---------- Phase 12: Balance transaction engine ----------
export type BalanceTransactionType = "deposit" | "entry" | "win" | "refund";
export type BalanceTransactionStatus = "pending" | "completed" | "failed";

export async function insertBalanceTransaction(data: {
  userId: number;
  type: BalanceTransactionType;
  amount: number;
  status?: BalanceTransactionStatus;
  tournamentId?: number | null;
  submissionId?: number | null;
  idempotencyKey?: string | null;
}): Promise<number> {
  if (!USE_SQLITE) return 0;
  const sqlite = await getSqlite();
  if (!sqlite) return 0;
  const now = Date.now();
  const stmt = sqlite.prepare(
    "INSERT INTO balance_transactions (userId, type, amount, status, tournamentId, submissionId, idempotencyKey, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const result = stmt.run(
    data.userId,
    data.type,
    data.amount,
    data.status ?? "pending",
    data.tournamentId ?? null,
    data.submissionId ?? null,
    data.idempotencyKey ?? null,
    now
  );
  return (result as { lastInsertRowid: number }).lastInsertRowid;
}

export async function getTransactionByIdempotencyKey(idempotencyKey: string): Promise<{
  id: number;
  userId: number;
  type: string;
  amount: number;
  status: string;
  tournamentId: number | null;
  submissionId: number | null;
  createdAt: number | null;
} | null> {
  if (!USE_SQLITE) return null;
  const sqlite = await getSqlite();
  if (!sqlite) return null;
  const row = sqlite.prepare(
    "SELECT id, userId, type, amount, status, tournamentId, submissionId, createdAt FROM balance_transactions WHERE idempotencyKey = ? LIMIT 1"
  ).get(idempotencyKey) as { id: number; userId: number; type: string; amount: number; status: string; tournamentId: number | null; submissionId: number | null; createdAt: number | null } | undefined;
  return row ?? null;
}

// ---------- Phase 13: Tournament financial audit trail ----------
export const TOURNAMENT_FINANCIAL_EVENT_TYPES = {
  TOURNAMENT_OPENED: "tournament_opened",
  LOCKED: "tournament_locked",
  SETTLEMENT_STARTED: "settlement_started",
  PRIZE_ALLOCATED: "prize_allocated",
  REFUND_ISSUED: "refund_issued",
  SETTLEMENT_COMPLETED: "settlement_completed",
} as const;

export async function insertTournamentFinancialEvent(
  tournamentId: number,
  eventType: string,
  payload?: Record<string, unknown> | null
): Promise<void> {
  const sqlite = await getSqlite();
  if (!sqlite) return;
  sqlite.prepare(
    "INSERT INTO tournament_financial_events (tournamentId, eventType, payloadJson, createdAt) VALUES (?, ?, ?, ?)"
  ).run(tournamentId, eventType, payload ? JSON.stringify(payload) : null, Date.now());
}

export async function getTournamentFinancialEvents(tournamentId: number): Promise<Array<{ id: number; tournamentId: number; eventType: string; payloadJson: unknown; createdAt: number | null }>> {
  const sqlite = await getSqlite();
  if (!sqlite) return [];
  const rows = sqlite.prepare(
    "SELECT id, tournamentId, eventType, payloadJson, createdAt FROM tournament_financial_events WHERE tournamentId = ? ORDER BY id ASC"
  ).all(tournamentId) as Array<{ id: number; tournamentId: number; eventType: string; payloadJson: string | null; createdAt: number | null }>;
  return rows.map((r) => ({
    ...r,
    payloadJson: r.payloadJson != null ? JSON.parse(r.payloadJson) : null,
  }));
}

// ---------- Phase 14: Distributed locking ----------
const LOCK_DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Acquire a named lock (e.g. "settlement:123", "transition:123"). Returns true if acquired. TTL in ms; lock auto-expires. */
export async function acquireTournamentLock(lockKey: string, instanceId: string, ttlMs = LOCK_DEFAULT_TTL_MS): Promise<boolean> {
  const sqlite = await getSqlite();
  if (!sqlite) return false;
  const now = Date.now();
  const expiresAt = now + ttlMs;
  try {
    const existing = sqlite.prepare("SELECT expiresAt FROM tournament_locks WHERE lockKey = ?").get(lockKey) as { expiresAt: number } | undefined;
    if (existing) {
      if (existing.expiresAt > now) return false;
      sqlite.prepare("UPDATE tournament_locks SET instanceId = ?, expiresAt = ? WHERE lockKey = ?").run(instanceId, expiresAt, lockKey);
      return true;
    }
    sqlite.prepare("INSERT INTO tournament_locks (lockKey, instanceId, expiresAt) VALUES (?, ?, ?)").run(lockKey, instanceId, expiresAt);
    return true;
  } catch {
    return false;
  }
}

/** Release lock only if held by this instance. */
export async function releaseTournamentLock(lockKey: string, instanceId: string): Promise<void> {
  const sqlite = await getSqlite();
  if (!sqlite) return;
  sqlite.prepare("DELETE FROM tournament_locks WHERE lockKey = ? AND instanceId = ?").run(lockKey, instanceId);
}

/** Phase 13: True if tournament is settled/archived – no score or prize changes allowed; leaderboard is final. */
export async function isTournamentResultsFinalized(tournamentId: number): Promise<boolean> {
  const t = await getTournamentById(tournamentId);
  if (!t) return false;
  const status = (t as { status?: string }).status;
  return status === "PRIZES_DISTRIBUTED" || status === "ARCHIVED" || status === "SETTLED";
}

/** Phase 13: Prize pool integrity – verify total distributed does not exceed pool; return ok and delta. */
export async function verifyPrizePoolIntegrity(tournamentId: number): Promise<{
  ok: boolean;
  prizePoolExpected: number;
  totalDistributed: number;
  delta: number;
  participantCount: number;
}> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return { ok: true, prizePoolExpected: 0, totalDistributed: 0, delta: 0, participantCount: 0 };
  }
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const tAmount = Number((tournament as { amount?: number }).amount ?? 0);
  const tGuaranteed = Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0;
  const participantCount = subs.length;
  const prizePoolExpected = tGuaranteed > 0 ? tGuaranteed : Math.round(participantCount * tAmount * 0.875);
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return { ok: true, prizePoolExpected, totalDistributed: 0, delta: prizePoolExpected, participantCount };
  const rows = await db
    .select({ amount: pointTransactions.amount })
    .from(pointTransactions)
    .where(and(eq(pointTransactions.actionType, "prize"), eq(pointTransactions.referenceId, tournamentId)));
  const totalDistributed = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const delta = prizePoolExpected - totalDistributed;
  return {
    ok: totalDistributed <= prizePoolExpected,
    prizePoolExpected,
    totalDistributed,
    delta,
    participantCount,
  };
}

// ---------- Phase 20: Competition templates ----------
export type CompetitionTemplateRow = {
  id: number;
  name: string;
  description: string | null;
  competitionTypeId: number | null;
  legacyType: string;
  visibility: string | null;
  defaultEntryFee: number;
  defaultMaxParticipants: number | null;
  formSchemaJson: unknown;
  scoringConfigJson: unknown;
  settlementConfigJson: unknown;
  rulesJson: unknown;
  itemTemplateJson: unknown;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export async function listCompetitionTemplates(opts?: { activeOnly?: boolean }): Promise<CompetitionTemplateRow[]> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const tbl = (schema as { competitionTemplates?: typeof import("../drizzle/schema-sqlite").competitionTemplates }).competitionTemplates;
  if (!tbl) return [];
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(tbl).orderBy(desc(tbl.id));
  if (opts?.activeOnly) query = query.where(eq(tbl.isActive, true));
  const rows = await query;
  return rows as CompetitionTemplateRow[];
}

export async function getCompetitionTemplateById(id: number): Promise<CompetitionTemplateRow | null> {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const tbl = (schema as { competitionTemplates?: typeof import("../drizzle/schema-sqlite").competitionTemplates }).competitionTemplates;
  if (!tbl) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(tbl).where(eq(tbl.id, id)).limit(1);
  const row = rows[0];
  return row ? (row as CompetitionTemplateRow) : null;
}

export type CreateCompetitionTemplateInput = {
  name: string;
  description?: string | null;
  competitionTypeId?: number | null;
  legacyType?: string;
  visibility?: string | null;
  defaultEntryFee: number;
  defaultMaxParticipants?: number | null;
  formSchemaJson?: unknown;
  scoringConfigJson?: unknown;
  settlementConfigJson?: unknown;
  rulesJson?: unknown;
  itemTemplateJson?: unknown;
  isSystem?: boolean;
  isActive?: boolean;
};

export async function createCompetitionTemplate(data: CreateCompetitionTemplateInput): Promise<number> {
  if (!USE_SQLITE) throw new Error("Competition templates are only supported with SQLite");
  const schema = await getSchema();
  const tbl = (schema as { competitionTemplates?: typeof import("../drizzle/schema-sqlite").competitionTemplates }).competitionTemplates;
  if (!tbl) throw new Error("competition_templates schema not available");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const row = await db.insert(tbl).values({
    name: data.name.trim(),
    description: data.description ?? null,
    competitionTypeId: data.competitionTypeId ?? null,
    legacyType: data.legacyType ?? "football",
    visibility: data.visibility ?? "VISIBLE",
    defaultEntryFee: data.defaultEntryFee,
    defaultMaxParticipants: data.defaultMaxParticipants ?? null,
    formSchemaJson: data.formSchemaJson ?? null,
    scoringConfigJson: data.scoringConfigJson ?? null,
    settlementConfigJson: data.settlementConfigJson ?? null,
    rulesJson: data.rulesJson ?? null,
    itemTemplateJson: data.itemTemplateJson ?? null,
    isSystem: data.isSystem ?? false,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: tbl.id });
  return row[0]!.id;
}

export async function updateCompetitionTemplate(id: number, data: Partial<CreateCompetitionTemplateInput>): Promise<boolean> {
  if (!USE_SQLITE) return false;
  const schema = await getSchema();
  const tbl = (schema as { competitionTemplates?: typeof import("../drizzle/schema-sqlite").competitionTemplates }).competitionTemplates;
  if (!tbl) return false;
  const db = await getDb();
  if (!db) return false;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.description !== undefined) update.description = data.description ?? null;
  if (data.competitionTypeId !== undefined) update.competitionTypeId = data.competitionTypeId ?? null;
  if (data.legacyType !== undefined) update.legacyType = data.legacyType;
  if (data.visibility !== undefined) update.visibility = data.visibility ?? null;
  if (data.defaultEntryFee !== undefined) update.defaultEntryFee = data.defaultEntryFee;
  if (data.defaultMaxParticipants !== undefined) update.defaultMaxParticipants = data.defaultMaxParticipants ?? null;
  if (data.formSchemaJson !== undefined) update.formSchemaJson = data.formSchemaJson ?? null;
  if (data.scoringConfigJson !== undefined) update.scoringConfigJson = data.scoringConfigJson ?? null;
  if (data.settlementConfigJson !== undefined) update.settlementConfigJson = data.settlementConfigJson ?? null;
  if (data.rulesJson !== undefined) update.rulesJson = data.rulesJson ?? null;
  if (data.itemTemplateJson !== undefined) update.itemTemplateJson = data.itemTemplateJson ?? null;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  const result = await db.update(tbl).set(update as typeof tbl.$inferInsert).where(eq(tbl.id, id)).returning({ id: tbl.id });
  return result.length > 0;
}

export async function deleteCompetitionTemplate(id: number): Promise<boolean> {
  if (!USE_SQLITE) return false;
  const schema = await getSchema();
  const tbl = (schema as { competitionTemplates?: typeof import("../drizzle/schema-sqlite").competitionTemplates }).competitionTemplates;
  if (!tbl) return false;
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(tbl).where(eq(tbl.id, id)).returning({ id: tbl.id });
  return result.length > 0;
}

export async function duplicateCompetitionTemplate(id: number, newName: string): Promise<number | null> {
  if (!USE_SQLITE) return null;
  const existing = await getCompetitionTemplateById(id);
  if (!existing) return null;
  return createCompetitionTemplate({
    name: newName.trim() || existing.name + " (עותק)",
    description: existing.description,
    competitionTypeId: existing.competitionTypeId,
    legacyType: existing.legacyType,
    visibility: existing.visibility,
    defaultEntryFee: existing.defaultEntryFee,
    defaultMaxParticipants: existing.defaultMaxParticipants,
    formSchemaJson: existing.formSchemaJson,
    scoringConfigJson: existing.scoringConfigJson,
    settlementConfigJson: existing.settlementConfigJson,
    rulesJson: existing.rulesJson,
    itemTemplateJson: existing.itemTemplateJson,
    isSystem: false,
    isActive: existing.isActive,
  });
}

// ---------- Tournament templates (create-from-template flow) ----------
type TournamentTemplateRow = { id: number; name: string; category: string; description: string | null; isActive: boolean; configJson: unknown; createdAt: Date | null; updatedAt: Date | null };

export async function getTournamentTemplateCategories(): Promise<Array<{ id: number; code: string; name: string; displayOrder: number; isActive: boolean }>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const tbl = (schema as { tournamentTemplateCategories?: typeof import("../drizzle/schema-sqlite").tournamentTemplateCategories }).tournamentTemplateCategories;
  if (!tbl) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(tbl).where(eq(tbl.isActive, true)).orderBy(tbl.displayOrder, tbl.id);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    displayOrder: r.displayOrder ?? 0,
    isActive: r.isActive ?? true,
  }));
}

export async function getTournamentTemplates(category?: string | null): Promise<Array<{ id: number; name: string; category: string; description: string | null; configJson: unknown }>> {
  if (!USE_SQLITE) return [];
  const schema = await getSchema();
  const tbl = (schema as { tournamentTemplates?: typeof import("../drizzle/schema-sqlite").tournamentTemplates }).tournamentTemplates;
  if (!tbl) return [];
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(tbl.isActive, true)];
  if (category != null && category.trim() !== "") {
    conditions.push(eq(tbl.category, category.trim()));
  }
  const rows = await db.select().from(tbl).where(and(...conditions)).orderBy(tbl.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description ?? null,
    configJson: r.configJson ?? {},
  }));
}

export async function getTournamentTemplateById(id: number): Promise<TournamentTemplateRow | null> {
  if (!USE_SQLITE) return null;
  const schema = await getSchema();
  const tbl = (schema as { tournamentTemplates?: typeof import("../drizzle/schema-sqlite").tournamentTemplates }).tournamentTemplates;
  if (!tbl) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(tbl).where(eq(tbl.id, id)).limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description ?? null,
    isActive: r.isActive ?? true,
    configJson: r.configJson ?? {},
    createdAt: r.createdAt ?? null,
    updatedAt: r.updatedAt ?? null,
  };
}

export type CreateTournamentFromTemplateOverrides = {
  name: string;
  description?: string | null;
  amount?: number | null;
  opensAt?: string | number | Date | null;
  closesAt?: string | number | Date | null;
  drawDate?: string | null;
  drawTime?: string | null;
  drawCode?: string | null;
  maxParticipants?: number | null;
  visibility?: string | null;
  rulesJson?: unknown;
};

const ALLOWED_LIFECYCLE_STATUSES = ["OPEN", "DRAFT"] as const;
const ALLOWED_LOTTO_DRAW_TIMES = ["20:00", "22:30", "23:00", "23:30", "00:00"] as const;
const ALLOWED_TOURNAMENT_TYPES = ["football", "football_custom", "lotto", "chance", "custom"] as const;

/** Server-side schema validation for template configJson. Returns validated config or error. */
export function validateTemplateConfig(configUnknown: unknown): { valid: true; config: Record<string, unknown> } | { valid: false; error: string } {
  if (configUnknown == null || typeof configUnknown !== "object") {
    return { valid: false, error: "Template config must be an object" };
  }
  const config = configUnknown as Record<string, unknown>;
  const tournamentType = typeof config.tournamentType === "string" ? config.tournamentType : "football";
  if (!ALLOWED_TOURNAMENT_TYPES.includes(tournamentType as typeof ALLOWED_TOURNAMENT_TYPES[number])) {
    return { valid: false, error: `Invalid tournamentType: ${tournamentType}` };
  }
  const defaultEntry = typeof config.defaultEntryAmount === "number" && config.defaultEntryAmount >= 0
    ? config.defaultEntryAmount
    : 10;
  const lifecycle = config.lifecycleDefaults as Record<string, unknown> | undefined;
  const initialStatus = lifecycle && typeof lifecycle.initialStatus === "string" ? lifecycle.initialStatus : "OPEN";
  if (!ALLOWED_LIFECYCLE_STATUSES.includes(initialStatus as typeof ALLOWED_LIFECYCLE_STATUSES[number])) {
    return { valid: false, error: `Invalid lifecycle initialStatus: ${initialStatus}` };
  }
  const participantRules = config.defaultParticipantRules as Record<string, unknown> | undefined;
  if (participantRules != null && typeof participantRules === "object" && participantRules.maxParticipants != null) {
    const max = Number(participantRules.maxParticipants);
    if (!Number.isInteger(max) || max < 0) {
      return { valid: false, error: "defaultParticipantRules.maxParticipants must be a non-negative integer or null" };
    }
  }
  if (tournamentType === "lotto") {
    const durations = config.defaultDurations as Record<string, unknown> | undefined;
    const drawTime = durations && typeof durations.drawTime === "string" ? durations.drawTime.trim() : null;
    if (drawTime && !ALLOWED_LOTTO_DRAW_TIMES.includes(drawTime as typeof ALLOWED_LOTTO_DRAW_TIMES[number])) {
      return { valid: false, error: `Lotto drawTime must be one of: ${ALLOWED_LOTTO_DRAW_TIMES.join(", ")}` };
    }
  }
  return { valid: true, config: { ...config, tournamentType, defaultEntryAmount: defaultEntry } };
}

export async function createTournamentFromTemplate(
  templateId: number,
  overrides: CreateTournamentFromTemplateOverrides
): Promise<number> {
  const template = await getTournamentTemplateById(templateId);
  if (!template) throw new Error("Template not found");
  const rawConfig = template.configJson;
  const validated = validateTemplateConfig(rawConfig);
  if (!validated.valid) throw new Error(`Invalid template config: ${validated.error}`);
  const config = validated.config;
  const tournamentType = (config.tournamentType as string) ?? "football";
  const defaultEntry = typeof config.defaultEntryAmount === "number" ? config.defaultEntryAmount : 10;
  const amount = overrides.amount != null && Number.isInteger(Number(overrides.amount)) && Number(overrides.amount) >= 0
    ? Number(overrides.amount)
    : defaultEntry;
  const name = typeof overrides.name === "string" ? overrides.name.trim() : "";
  if (!name && !template.name) throw new Error("Tournament name is required (template has no default name)");
  const payload = {
    name: name || template.name,
    amount,
    description: overrides.description ?? template.description ?? undefined,
    type: tournamentType,
    visibility: overrides.visibility ?? "VISIBLE",
    opensAt: overrides.opensAt ?? undefined,
    closesAt: overrides.closesAt ?? undefined,
    drawDate: overrides.drawDate ?? undefined,
    drawTime: overrides.drawTime ?? undefined,
    drawCode: overrides.drawCode ?? undefined,
    maxParticipants: overrides.maxParticipants ?? undefined,
    rulesJson: overrides.rulesJson ?? undefined,
    initialStatus: "OPEN" as const,
  };
  return createTournament(payload);
}

export async function createTournament(data: {
  name: string;
  amount: number;
  description?: string;
  type?: string;
  /** Phase 2B: optional link to competition_types. When set, stored on tournament for display/future use. */
  competitionTypeId?: number | null;
  startDate?: string;
  endDate?: string;
  startsAt?: string | number | Date | null;
  endsAt?: string | number | Date | null;
  opensAt?: string | number | Date | null;
  closesAt?: string | number | Date | null;
  maxParticipants?: number | null;
  prizeDistribution?: Record<number, number> | null;
  drawCode?: string | null;
  drawDate?: string | null;
  drawTime?: string | null;
  customIdentifier?: string | null;
  /** Phase 16: visibility (VISIBLE | HIDDEN). */
  visibility?: string | null;
  /** Phase 16: min participants for settlement. */
  minParticipants?: number | null;
  /** Phase 16: optional rules/settings JSON (banner, CMS refs, overrides). */
  rulesJson?: unknown;
  /** Phase 16: settlement/results finalized timestamp. */
  settledAt?: string | number | Date | null;
  resultsFinalizedAt?: string | number | Date | null;
  /** Guaranteed prize (points); displayed and used even if not enough entries. */
  guaranteedPrizeAmount?: number | null;
  /** Initial lifecycle status. Must be OPEN or DRAFT. Default OPEN so new tournaments are visible. */
  initialStatus?: "OPEN" | "DRAFT" | null;
}): Promise<number> {
  const { validateCreateTournamentPayload } = await import("./tournamentCreateValidator");
  const validation = validateCreateTournamentPayload({
    name: data.name,
    amount: data.amount,
    type: data.type,
    initialStatus: data.initialStatus,
    opensAt: data.opensAt,
    closesAt: data.closesAt,
    drawDate: data.drawDate,
    drawTime: data.drawTime,
    drawCode: data.drawCode,
    maxParticipants: data.maxParticipants,
    guaranteedPrizeAmount: data.guaranteedPrizeAmount,
    visibility: data.visibility,
  });
  if (!validation.valid) throw new Error(validation.message);
  const typeVal = validation.normalizedType;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const amountNum = Number(data.amount);
  if (!Number.isInteger(amountNum) || amountNum < 0) {
    throw new Error("Tournament amount must be a non-negative integer (0 = free entry)");
  }
  const validInitialStatuses = ["OPEN", "DRAFT"] as const;
  const initialStatus = data.initialStatus ?? "OPEN";
  if (!validInitialStatuses.includes(initialStatus)) {
    throw new Error("Initial status must be OPEN or DRAFT (lifecycle-compatible for new tournaments)");
  }
  const customId = data.customIdentifier?.trim() || null;
  if (customId) {
    const existing = await db.select({ id: tournaments.id }).from(tournaments).where(
      and(
        eq(tournaments.type, typeVal),
        sql`COALESCE(customIdentifier, '') = ${customId}`,
        inArray(tournaments.status, ["OPEN", "LOCKED"])
      )
    );
    if (existing.length > 0) {
      throw new Error("קיימת כבר תחרות פעילה עם אותו מזהה ייחודי (סוג + מזהה). בחר מזהה אחר או השאר ריק.");
    }
  }
  const row: Record<string, unknown> = { name: data.name, amount: amountNum };
  row.status = initialStatus;
  row.visibility = data.visibility != null && String(data.visibility).trim() !== "" ? data.visibility : "VISIBLE";
  row.hiddenFromHomepage = 0;
  if (data.description != null) row.description = data.description;
  row.type = typeVal;
  if (data.competitionTypeId != null && data.competitionTypeId > 0) row.competitionTypeId = data.competitionTypeId;
  if (data.startDate != null && data.startDate.trim() !== "") row.startDate = data.startDate.trim();
  if (data.endDate != null && data.endDate.trim() !== "") row.endDate = data.endDate.trim();
  if (data.maxParticipants != null) row.maxParticipants = data.maxParticipants;
  if (data.prizeDistribution != null) row.prizeDistribution = data.prizeDistribution;
  if (data.drawCode != null && data.drawCode.trim() !== "") row.drawCode = data.drawCode.trim();
  if (data.drawDate != null && data.drawDate.trim() !== "") row.drawDate = data.drawDate.trim();
  if (data.drawTime != null && data.drawTime.trim() !== "") row.drawTime = data.drawTime.trim();
  if (customId != null) row.customIdentifier = customId;
  if (data.minParticipants != null && data.minParticipants >= 0) row.minParticipants = data.minParticipants;
  if (data.rulesJson != null) row.rulesJson = typeof data.rulesJson === "string" ? data.rulesJson : JSON.stringify(data.rulesJson);
  if (data.guaranteedPrizeAmount != null && data.guaranteedPrizeAmount > 0) row.guaranteedPrizeAmount = data.guaranteedPrizeAmount;
  const startsAtVal = toTimestamp(data.startsAt);
  if (startsAtVal != null) row.startsAt = startsAtVal;
  const endsAtVal = toTimestamp(data.endsAt);
  if (endsAtVal != null) row.endsAt = endsAtVal;
  const opensAtVal = toTimestamp(data.opensAt);
  if (opensAtVal != null) row.opensAt = new Date(opensAtVal);
  let closesAtVal = toTimestamp(data.closesAt);
  if (typeVal === "lotto" && data.drawDate?.trim() && data.drawTime?.trim()) {
    const lottoClose = drawDateAndTimeToTimestamp(data.drawDate.trim(), data.drawTime.trim());
    if (lottoClose > 0) closesAtVal = closesAtVal ?? lottoClose;
  }
  if (closesAtVal != null) row.closesAt = new Date(closesAtVal);
  const settledAtVal = toTimestamp(data.settledAt);
  if (settledAtVal != null) row.settledAt = new Date(settledAtVal);
  const resultsFinalizedVal = toTimestamp(data.resultsFinalizedAt);
  if (resultsFinalizedVal != null) row.resultsFinalizedAt = new Date(resultsFinalizedVal);
  const [inserted] = await db.insert(tournaments).values(row as typeof tournaments.$inferInsert).returning({ id: tournaments.id });
  const id = inserted?.id;
  if (id == null) throw new Error("Failed to get tournament id after insert");
  if (process.env.NODE_ENV !== "production") {
    console.log("[createTournament] created", JSON.stringify({
      id,
      type: row.type ?? typeVal,
      status: row.status,
      opensAt: row.opensAt != null ? String(row.opensAt) : null,
      closesAt: row.closesAt != null ? String(row.closesAt) : null,
    }));
  }
  return id;
}

/** True if tournament was validly completed: prizes distributed or results finalized or archived (no refund allowed). */
export async function isTournamentCompleted(tournamentId: number): Promise<boolean> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return false;
  const status = (tournament as { status?: string }).status;
  if (status === "PRIZES_DISTRIBUTED" || status === "RESULTS_UPDATED" || status === "ARCHIVED") return true;
  const { financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) return false;
  const incomeRecord = await db
    .select({ id: financialRecords.id })
    .from(financialRecords)
    .where(and(eq(financialRecords.competitionId, tournamentId), or(eq(financialRecords.recordType, "income"), isNull(financialRecords.recordType))))
    .limit(1);
  return incomeRecord.length > 0;
}

/** Returns true if user already has a refund point_transaction for this tournament (idempotency). */
async function hasUserRefundForTournament(userId: number, tournamentId: number): Promise<boolean> {
  if (!USE_SQLITE) return false;
  const schema = await getSchema();
  const schemaWithPt = schema as { pointTransactions?: { id: number, userId: number, actionType: string, referenceId: number | null } };
  const pt = schemaWithPt.pointTransactions;
  if (!pt) return false;
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: pt.id })
    .from(pt)
    .where(and(eq(pt.userId, userId), eq(pt.actionType, "refund"), eq(pt.referenceId, tournamentId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Refund all approved (paid) participants for a cancelled tournament.
 * Idempotent: uses payment transaction status when available (paid → refunded); for points-only flow checks point_transactions to avoid double refund.
 * Call when competition is cancelled/closed before valid completion (no prizes distributed).
 */
export async function refundTournamentParticipants(tournamentId: number): Promise<{ refundedCount: number; totalRefunded: number; refundedUserIds: number[]; amountPerUser: number }> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { refundedCount: 0, totalRefunded: 0, refundedUserIds: [], amountPerUser: 0 };
  const amount = Number((tournament as { amount?: number }).amount ?? 0);
  if (amount <= 0) return { refundedCount: 0, totalRefunded: 0, refundedUserIds: [], amountPerUser: 0 };
  const subs = await getSubmissionsByTournament(tournamentId);
  const approved = await filterOutUnlimitedSubmissions(subs.filter((s) => s.status === "approved"));
  const name = (tournament as { name?: string }).name ?? String(tournamentId);
  const statusAtTime = (tournament as { status?: string }).status ?? "CANCELLED";
  let refundedCount = 0;
  let totalRefunded = 0;
  const refundedUserIds: number[] = [];

  const { recordRefundFinancialEvent } = await import("./finance");
  for (const s of approved) {
    if (USE_SQLITE) {
      const payment = await getPaymentBySubmissionId(s.id);
      const pay = payment as { id?: number; type?: string; status?: string } | null;
      if (pay && pay.type === "entry_fee" && pay.status === "paid") {
        await updatePaymentTransactionStatus(pay.id!, "refunded");
        await recordRefundFinancialEvent({ tournamentId, userId: s.userId, amountPoints: amount, payloadJson: { tournamentName: name } });
        refundedCount += 1;
        totalRefunded += amount;
        refundedUserIds.push(s.userId);
        continue;
      }
      if (pay && pay.type === "entry_fee" && pay.status === "refunded") continue;
    }
    const alreadyRefunded = await hasUserRefundForTournament(s.userId, tournamentId);
    if (alreadyRefunded) continue;
    await addUserPoints(s.userId, amount, "refund", {
      referenceId: tournamentId,
      description: `החזר בשל ביטול תחרות: ${name}`,
    });
    await recordRefundFinancialEvent({ tournamentId, userId: s.userId, amountPoints: amount, payloadJson: { tournamentName: name } });
    await insertTransparencyLog({
      competitionId: tournamentId,
      competitionName: name,
      userId: s.userId,
      username: s.username ?? `#${s.userId}`,
      type: "Refund",
      amount,
      siteProfit: 0,
      agentProfit: 0,
      transactionDate: new Date(),
      competitionStatusAtTime: statusAtTime,
    });
    refundedCount += 1;
    totalRefunded += amount;
    refundedUserIds.push(s.userId);
  }
  if (refundedCount > 0) {
    await insertTournamentFinancialEvent(tournamentId, TOURNAMENT_FINANCIAL_EVENT_TYPES.REFUND_ISSUED, {
      refundedCount,
      totalRefunded,
      refundedUserIds,
      amountPerUser: amount,
    });
  }
  return { refundedCount, totalRefunded, refundedUserIds, amountPerUser: refundedCount > 0 ? amount : 0 };
}

/** Tournament IDs that are closed/locked but not validly completed (no prizes distributed) and not already refunded. Safe to run refund on. */
async function getCancelledUnfinishedTournamentIds(): Promise<number[]> {
  const { tournaments, financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(inArray(tournaments.status, ["LOCKED", "CLOSED"]), isNull(tournaments.deletedAt)));
  const ids: number[] = [];
  for (const r of rows) {
    const id = (r as { id: number }).id;
    if (await isTournamentCompleted(id)) continue;
    const refundRecord = await db
      .select({ id: financialRecords.id })
      .from(financialRecords)
      .where(and(eq(financialRecords.competitionId, id), eq(financialRecords.recordType, "refund")))
      .limit(1);
    if (refundRecord.length > 0) continue;
    ids.push(id);
  }
  return ids;
}

/**
 * Repair: find competitions that were closed/cancelled without valid completion and refund participants who were not refunded.
 * Idempotent (refundTournamentParticipants is idempotent). Safe to run multiple times.
 */
export async function repairUnrefundedCancelledCompetitions(): Promise<{
  processedTournamentIds: number[];
  totalRefundedCount: number;
  totalRefundedAmount: number;
  details: { tournamentId: number; tournamentName: string; refundedCount: number; totalRefunded: number }[];
}> {
  const ids = await getCancelledUnfinishedTournamentIds();
  const details: { tournamentId: number; tournamentName: string; refundedCount: number; totalRefunded: number }[] = [];
  let totalRefundedCount = 0;
  let totalRefundedAmount = 0;
  for (const tournamentId of ids) {
    const tournament = await getTournamentById(tournamentId);
    const name = tournament ? (tournament as { name?: string }).name ?? String(tournamentId) : String(tournamentId);
    const amount = tournament ? Number((tournament as { amount?: number }).amount ?? 0) : 0;
    if (amount <= 0) continue;
    const result = await refundTournamentParticipants(tournamentId);
    if (result.refundedCount > 0 && result.totalRefunded > 0) {
      await insertFinancialRecord({
        competitionId: tournamentId,
        competitionName: name,
        recordType: "refund",
        type: tournament ? (tournament as { type?: string }).type ?? "football" : "football",
        totalCollected: result.totalRefunded,
        siteFee: 0,
        totalPrizes: 0,
        netProfit: -result.totalRefunded,
        participantsCount: result.refundedCount,
        winnersCount: 0,
        closedAt: new Date(),
      });
    }
    details.push({ tournamentId, tournamentName: name, refundedCount: result.refundedCount, totalRefunded: result.totalRefunded });
    totalRefundedCount += result.refundedCount;
    totalRefundedAmount += result.totalRefunded;
  }
  return { processedTournamentIds: ids, totalRefundedCount, totalRefundedAmount, details };
}

/** Read-only forensic report: which DB is in use, and suspicious (closed/locked) competitions with payment and refund state. No business logic change. */
export type ForensicTournamentRow = {
  tournamentId: number;
  name: string;
  status: string;
  participantCount: number;
  paidPaymentCount: number;
  refundedPaymentCount: number;
  hasIncomeRecord: boolean;
  hasRefundRecord: boolean;
  hasPrizeEvidence: boolean;
  excludedFromRepairReason: string;
};

export type ForensicReport = {
  databaseInUse: "sqlite" | "mysql";
  sqlitePath: string | null;
  tournaments: ForensicTournamentRow[];
};

export async function getForensicCancelledCompetitionsReport(): Promise<ForensicReport> {
  const { join } = await import("path");
  const sqlitePath = USE_SQLITE ? join(process.cwd(), "data", "worldcup.db") : null;
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return { databaseInUse: USE_SQLITE ? "sqlite" : "mysql", sqlitePath, tournaments: [] };
  const closedStatuses = ["LOCKED", "CLOSED", "SETTLED", "SETTLING", "PRIZES_DISTRIBUTED", "RESULTS_UPDATED", "ARCHIVED"];
  const allRows = await db
    .select({ id: tournaments.id, name: tournaments.name, status: tournaments.status })
    .from(tournaments)
    .where(isNull(tournaments.deletedAt));
  const suspicious = allRows.filter((t) => closedStatuses.includes((t as { status?: string }).status ?? ""));
  const financialRows = await getFinancialRecords();
  const byCompetition = new Map<
    number,
    { hasIncome: boolean; hasRefund: boolean; winnersCount: number; totalPrizes: number }
  >();
  for (const r of financialRows) {
    const cid = (r as { competitionId: number }).competitionId;
    const rt = (r as { recordType?: string }).recordType ?? "income";
    const w = (r as { winnersCount?: number }).winnersCount ?? 0;
    const p = (r as { totalPrizes?: number }).totalPrizes ?? 0;
    if (!byCompetition.has(cid)) byCompetition.set(cid, { hasIncome: false, hasRefund: false, winnersCount: 0, totalPrizes: 0 });
    const cur = byCompetition.get(cid)!;
    if (rt === "income" || rt == null) cur.hasIncome = true;
    if (rt === "refund") cur.hasRefund = true;
    if (w > 0 || p > 0) {
      cur.winnersCount = Math.max(cur.winnersCount, w);
      cur.totalPrizes = Math.max(cur.totalPrizes, p);
    }
  }
  const rows: ForensicTournamentRow[] = [];
  for (const t of suspicious) {
    const tournamentId = (t as { id: number }).id;
    const name = (t as { name?: string }).name ?? String(tournamentId);
    const status = (t as { status?: string }).status ?? "";
    const subs = await getSubmissionsByTournament(tournamentId);
    const participantCount = subs.length;
    let paidPaymentCount = 0;
    let refundedPaymentCount = 0;
    if (USE_SQLITE) {
      const payments = await getPaymentTransactions({ tournamentId, type: "entry_fee", limit: 500 });
      for (const p of payments) {
        const s = (p as { status?: string }).status;
        if (s === "paid") paidPaymentCount += 1;
        if (s === "refunded") refundedPaymentCount += 1;
      }
    }
    const fin = byCompetition.get(tournamentId) ?? { hasIncome: false, hasRefund: false, winnersCount: 0, totalPrizes: 0 };
    const hasIncomeRecord = fin.hasIncome;
    const hasRefundRecord = fin.hasRefund;
    const hasPrizeEvidence =
      status === "PRIZES_DISTRIBUTED" || status === "RESULTS_UPDATED" || status === "ARCHIVED" || (fin.hasIncome && (fin.winnersCount > 0 || fin.totalPrizes > 0));
    let excludedFromRepairReason: string;
    if (status !== "LOCKED" && status !== "CLOSED") {
      excludedFromRepairReason = `status is "${status}" (repair only considers LOCKED/CLOSED)`;
    } else if (await isTournamentCompleted(tournamentId)) {
      excludedFromRepairReason = "considered completed (income record or PRIZES_DISTRIBUTED/RESULTS_UPDATED/ARCHIVED)";
    } else if (hasRefundRecord) {
      excludedFromRepairReason = "already has refund financial record";
    } else {
      excludedFromRepairReason = "INCLUDED (would be processed by repair)";
    }
    rows.push({
      tournamentId,
      name,
      status,
      participantCount,
      paidPaymentCount,
      refundedPaymentCount,
      hasIncomeRecord,
      hasRefundRecord,
      hasPrizeEvidence,
      excludedFromRepairReason,
    });
  }
  return {
    databaseInUse: USE_SQLITE ? "sqlite" : "mysql",
    sqlitePath,
    tournaments: rows,
  };
}

export async function deleteTournament(id: number): Promise<{ refundedCount: number; totalRefunded: number; refundedUserIds: number[]; amountPerUser: number }> {
  const { tournaments, submissions, agentCommissions, customFootballMatches, financialRecords } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const tournament = await getTournamentById(id);
  if (!tournament) return { refundedCount: 0, totalRefunded: 0, refundedUserIds: [], amountPerUser: 0 };

  const status = (tournament as { status?: string }).status;
  const incomeRecord = await db
    .select({ id: financialRecords.id })
    .from(financialRecords)
    .where(and(eq(financialRecords.competitionId, id), or(eq(financialRecords.recordType, "income"), isNull(financialRecords.recordType))))
    .limit(1);
  const prizesDistributed = status === "PRIZES_DISTRIBUTED" || incomeRecord.length > 0;
  const finishedOrArchived = prizesDistributed || status === "RESULTS_UPDATED" || status === "ARCHIVED";

  /** תחרות שהסתיימה / חולקו פרסים – רק מחיקה רכה (deletedAt). אין מחיקה של נתונים פיננסיים. */
  if (finishedOrArchived) {
    await db.update(tournaments).set({ deletedAt: new Date() } as typeof tournaments.$inferInsert).where(eq(tournaments.id, id));
    return { refundedCount: 0, totalRefunded: 0, refundedUserIds: [], amountPerUser: 0 };
  }

  let refundedCount = 0;
  let totalRefunded = 0;
  let refundedUserIds: number[] = [];
  let amountPerUser = 0;
  if (!prizesDistributed) {
    const refund = await refundTournamentParticipants(id);
    refundedCount = refund.refundedCount;
    totalRefunded = refund.totalRefunded;
    refundedUserIds = refund.refundedUserIds ?? [];
    amountPerUser = refund.amountPerUser ?? 0;
    if (refundedCount > 0 && totalRefunded > 0) {
      await insertFinancialRecord({
        competitionId: id,
        competitionName: (tournament as { name?: string }).name ?? String(id),
        recordType: "refund",
        type: (tournament as { type?: string }).type ?? "football",
        totalCollected: totalRefunded,
        siteFee: 0,
        totalPrizes: 0,
        netProfit: -totalRefunded,
        participantsCount: refundedCount,
        winnersCount: 0,
        closedAt: new Date(),
      });
    }
  }

  const subs = await getSubmissionsByTournament(id);
  const submissionIds = subs.map((s) => s.id);
  if (submissionIds.length > 0) {
    await db.delete(agentCommissions).where(inArray(agentCommissions.submissionId, submissionIds));
  }
  await db.delete(submissions).where(eq(submissions.tournamentId, id));
  await db.delete(customFootballMatches).where(eq(customFootballMatches.tournamentId, id));
  await db.delete(tournaments).where(eq(tournaments.id, id));
  return { refundedCount, totalRefunded, refundedUserIds, amountPerUser: refundedCount > 0 ? Math.floor(totalRefunded / refundedCount) : 0 };
}

const FEE_PERCENT = 12.5;

export type TournamentTransparencyRow = {
  tournamentId: number;
  name: string;
  amountPerEntry: number;
  participants: number;
  totalAmount: number;
  fee: number;
  prizePool: number;
};

export type FinancialTransparency = {
  byTournament: TournamentTransparencyRow[];
  totalParticipants: number;
  totalAmount: number;
  totalFee: number;
  totalPrizePool: number;
};

/** חישוב שקיפות כספית: טפסים מאושרים נספרים בקופה (אישור = נחשב כתשלום) */
export async function getFinancialTransparency(): Promise<FinancialTransparency> {
  const subs = await getAllSubmissions();
  const tournaments = await getTournaments();
  const paid = subs.filter((s) => s.status === "approved");

  let totalAmount = 0;
  let totalFee = 0;

  const byTournament: TournamentTransparencyRow[] = tournaments.map((t) => {
    const participants = paid.filter((s) => s.tournamentId === t.id).length;
    const total = participants * t.amount;
    const fee = Math.round(total * (FEE_PERCENT / 100));
    const prizePool = total - fee;
    totalAmount += total;
    totalFee += fee;
    return {
      tournamentId: t.id,
      name: t.name,
      amountPerEntry: t.amount,
      participants,
      totalAmount: total,
      fee,
      prizePool,
    };
  });

  return {
    byTournament,
    totalParticipants: paid.length,
    totalAmount,
    totalFee,
    totalPrizePool: totalAmount - totalFee,
  };
}

export type AdminFinancialRow = {
  tournamentId: number;
  name: string;
  type: string;
  amountPerEntry: number;
  isFinalized: boolean;
  participantCount: number;
  totalParticipation: number;
  fee: number;
  prizeDistributed: number;
  winnerCount: number;
  resultsFinalizedAt: Date | null;
  dataCleanedAt: Date | null;
};

/** דוח כספי למנהל – כל התחרויות כולל סגורות, עם צילום כספי לתחרויות שנסיימו */
export async function getAdminFinancialReport(): Promise<AdminFinancialRow[]> {
  const subs = await getAllSubmissions();
  const paid = subs.filter((s) => s.status === "approved");
  const tournaments = await getTournaments();

  return tournaments.map((t) => {
    const cast = t as {
      resultsFinalizedAt?: Date | null;
      dataCleanedAt?: Date | null;
      financialParticipantCount?: number | null;
      financialTotalParticipation?: number | null;
      financialFee?: number | null;
      financialPrizeDistributed?: number | null;
      financialWinnerCount?: number | null;
      type?: string;
    };
    const isFinalized = cast.resultsFinalizedAt != null;
    if (isFinalized && cast.financialParticipantCount != null) {
      return {
        tournamentId: t.id,
        name: t.name,
        type: cast.type ?? "football",
        amountPerEntry: t.amount,
        isFinalized: true,
        participantCount: cast.financialParticipantCount ?? 0,
        totalParticipation: cast.financialTotalParticipation ?? 0,
        fee: cast.financialFee ?? 0,
        prizeDistributed: cast.financialPrizeDistributed ?? 0,
        winnerCount: cast.financialWinnerCount ?? 0,
        resultsFinalizedAt: cast.resultsFinalizedAt ?? null,
        dataCleanedAt: cast.dataCleanedAt ?? null,
      };
    }
    const participants = paid.filter((s) => s.tournamentId === t.id).length;
    const total = participants * t.amount;
    const fee = Math.round(total * (FEE_PERCENT / 100));
    const prizePool = total - fee;
    return {
      tournamentId: t.id,
      name: t.name,
      type: (t as { type?: string }).type ?? "football",
      amountPerEntry: t.amount,
      isFinalized: false,
      participantCount: participants,
      totalParticipation: total,
      fee,
      prizeDistributed: prizePool,
      winnerCount: 0,
      resultsFinalizedAt: cast.resultsFinalizedAt ?? null,
      dataCleanedAt: cast.dataCleanedAt ?? null,
    };
  });
}
export type TournamentPublicStat = {
  id: number;
  name: string;
  amount: number;
  type?: string;
  isLocked: boolean;
  participants: number;
  prizePool: number;
  drawDate?: string | null;
  drawTime?: string | null;
  /** מועד סגירת הגרלה (timestamp) – להצגת טיימר בלוטו */
  closesAt?: Date | number | null;
  /** תאריך פתיחה (אם הוגדר) – להצגת "נפתח" */
  opensAt?: Date | number | null;
  /** LOCKED = תחרות נעולה, CLOSED = הגרלה נסגרה (לוטו), להצגת טיימר */
  status?: string;
  lockedAt?: Date | null;
  removalScheduledAt?: Date | null;
  /** Phase 17: Builder-defined banner image URL from rulesJson (for tournament card). */
  bannerUrl?: string | null;
};

function getBannerUrlFromRulesJson(rulesJson: unknown): string | null {
  if (rulesJson == null) return null;
  try {
    const raw = typeof rulesJson === "string" ? JSON.parse(rulesJson) : rulesJson;
    if (raw != null && typeof raw === "object" && typeof (raw as Record<string, unknown>).bannerUrl === "string") {
      return (raw as Record<string, unknown>).bannerUrl as string;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function getTournamentPublicStats(activeOnly = true): Promise<TournamentPublicStat[]> {
  const subs = await getAllSubmissions();
  const tournaments = activeOnly ? await getActiveTournaments() : await getTournaments();
  if (process.env.NODE_ENV !== "production" && tournaments.length > 0) {
    console.log("[getTournamentPublicStats] raw tournaments", JSON.stringify({
      activeOnly,
      count: tournaments.length,
      ids: tournaments.slice(0, 20).map((t) => t.id),
    }));
  }
  const paid = subs.filter((s) => s.status === "approved");

  return tournaments.map((t) => {
    const participants = paid.filter((s) => s.tournamentId === t.id).length;
    const amount = t.amount ?? 0;
    const guaranteed = (t as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount;
    const isFreeRoll = amount === 0;
    const total = participants * amount;
    const fee = Math.round(total * (FEE_PERCENT / 100));
    const calculatedPrize = total - fee;
    const prizePool = (guaranteed != null && guaranteed > 0) ? guaranteed : (isFreeRoll ? 0 : calculatedPrize);
    const rulesJson = (t as { rulesJson?: unknown }).rulesJson;
    return {
      id: t.id,
      name: t.name,
      amount: t.amount,
      type: (t as { type?: string }).type ?? "football",
      isLocked: !!t.isLocked,
      participants,
      prizePool,
      drawDate: (t as { drawDate?: string | null }).drawDate ?? null,
      drawTime: (t as { drawTime?: string | null }).drawTime ?? null,
      status: (t as { status?: string }).status ?? "OPEN",
      closesAt: (t as { closesAt?: Date | number | null }).closesAt ?? null,
      opensAt: (t as { opensAt?: Date | number | null }).opensAt ?? null,
      lockedAt: (t as { lockedAt?: Date | null }).lockedAt ?? null,
      removalScheduledAt: (t as { removalScheduledAt?: Date | null }).removalScheduledAt ?? null,
      bannerUrl: getBannerUrlFromRulesJson(rulesJson),
      maxParticipants: (t as { maxParticipants?: number | null }).maxParticipants ?? null,
    };
  });
}

/** Phase 6: Neighbor in leaderboard (real data only). */
export type RankingNeighbor = { username: string; pointsDiff: number };

/** Phase 4 + Phase 5 + Phase 6: My competition summary – active count, best rank, points, progress cues, chase targets, ranking pressure. */
export type MyCompetitionSummary = {
  activeCount: number;
  bestRank: number | null;
  totalPoints: number;
  closingSoonCount: number;
  inTop10Any: boolean;
  /** Phase 5: points needed to tie the position above (in best-ranked tournament). */
  pointsToNextRank: number | null;
  /** Phase 5: points needed to reach 10th place (when bestRank > 10). */
  pointsToTop10: number | null;
  /** Phase 5: next target label – "מקום 1" | "מקום 3" | "טופ 10". */
  nextTargetLabel: string | null;
  /** Phase 5: tournament IDs user has approved participation in (for card-level "שפר מיקום"). */
  participatedTournamentIds: number[];
  /** Phase 5: rank change in best tournament: positive = moved up, negative = moved down. Placeholder if not available. */
  rankChange: number | null;
  /** Phase 6: player above user in best-ranked tournament (real data only). */
  playerAbove: RankingNeighbor | null;
  /** Phase 6: player below user in best-ranked tournament (real data only). */
  playerBelow: RankingNeighbor | null;
  /** Phase 6: true if someone is close behind (within threshold) in best-ranked tournament. */
  someoneCloseBehind: boolean;
  /** Phase 6: true if user is close to overtaking the next rank (pointsToNextRank small). */
  closeToNextRank: boolean;
  /** Phase 6: per-tournament pressure for cards – close to overtake / someone close behind. */
  rankPressureByTournament: Array<{ tournamentId: number; closeToOvertake: boolean; someoneCloseBehind: boolean }>;
};

const mySummaryCache = new Map<number, { result: MyCompetitionSummary; expiresAt: number }>();
const MY_SUMMARY_CACHE_MS = 45_000;

function getTournamentCloseTimestamp(t: { type?: string; closesAt?: Date | number | null; drawDate?: string | null; drawTime?: string | null }): number | null {
  const type = (t.type ?? "football") as string;
  if (type === "chance") {
    const d = (t.drawDate ?? "").toString().trim();
    const tm = (t.drawTime ?? "").toString().trim();
    if (!d || !tm) return null;
    return drawDateAndTimeToTimestamp(d, tm) || null;
  }
  const closesAt = t.closesAt;
  if (closesAt == null) return null;
  return closesAt instanceof Date ? closesAt.getTime() : Number(closesAt);
}

export async function getMyCompetitionSummary(userId: number): Promise<MyCompetitionSummary> {
  const cached = mySummaryCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const subs = await getSubmissionsByUserId(userId);
  const approved = subs.filter((s) => (s as { status?: string }).status === "approved");
  const activeCount = approved.length;
  const totalPoints = approved.reduce((sum, s) => sum + (Number((s as { points?: number }).points) || 0), 0);
  const tournamentIds = [...new Set(approved.map((s) => (s as { tournamentId: number }).tournamentId))];

  let bestRank: number | null = null;
  let bestTournamentId: number | null = null;
  let userPointsInBest = 0;
  let pointsAboveInBest: number | null = null;
  let points10thInBest: number | null = null;
  let playerAboveInBest: RankingNeighbor | null = null;
  let playerBelowInBest: RankingNeighbor | null = null;
  let closingSoonCount = 0;
  let inTop10Any = false;
  const rankPressureByTournament: Array<{ tournamentId: number; closeToOvertake: boolean; someoneCloseBehind: boolean }> = [];
  const now = Date.now();
  const oneHourMs = 3600 * 1000;
  const CLOSE_POINTS = 5;

  for (const tid of tournamentIds) {
    const tournament = await getTournamentById(tid);
    if (!tournament) continue;
    const closeTs = getTournamentCloseTimestamp(tournament as Parameters<typeof getTournamentCloseTimestamp>[0]);
    if (closeTs != null && closeTs > now && closeTs - now <= oneHourMs) closingSoonCount++;

    const sorted = await getLeaderboardRowsForRival(tid);
    if (!sorted?.length) continue;
    const idx = sorted.findIndex((r) => r.userId === userId);
    if (idx < 0) continue;
    const rank = idx + 1;
    const userPoints = sorted[idx].points;
    const above = idx > 0 ? sorted[idx - 1] : null;
    const below = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const gapAbove = above != null ? above.points - userPoints : null;
    const gapBelow = below != null ? userPoints - below.points : null;
    rankPressureByTournament.push({
      tournamentId: tid,
      closeToOvertake: gapAbove != null && gapAbove <= CLOSE_POINTS,
      someoneCloseBehind: gapBelow != null && gapBelow <= CLOSE_POINTS,
    });
    if (bestRank == null || rank < bestRank) {
      bestRank = rank;
      bestTournamentId = tid;
      userPointsInBest = userPoints;
      pointsAboveInBest = above?.points ?? null;
      points10thInBest = sorted.length >= 10 ? sorted[9].points : null;
      playerAboveInBest =
        above != null
          ? { username: above.username ?? `#${above.userId}`, pointsDiff: gapAbove ?? 0 }
          : null;
      playerBelowInBest =
        below != null
          ? { username: below.username ?? `#${below.userId}`, pointsDiff: gapBelow ?? 0 }
          : null;
    }
    if (rank <= 10) inTop10Any = true;
  }

  const pointsToNextRank =
    bestRank != null && bestRank > 1 && pointsAboveInBest != null
      ? Math.max(0, pointsAboveInBest - userPointsInBest + 1)
      : null;
  const pointsToTop10 =
    bestRank != null && bestRank > 10 && points10thInBest != null
      ? Math.max(0, points10thInBest - userPointsInBest + 1)
      : null;
  const nextTargetLabel =
    bestRank == null ? null : bestRank <= 1 ? "מקום 1" : bestRank <= 3 ? "מקום 3" : "טופ 10";
  const someoneCloseBehind = playerBelowInBest != null && playerBelowInBest.pointsDiff <= CLOSE_POINTS;
  const closeToNextRank = pointsToNextRank != null && pointsToNextRank <= 10;

  let rankChange: number | null = null;
  if (bestTournamentId != null) {
    try {
      const drama = await getPositionDrama(userId, bestTournamentId);
      if (drama.delta != null && drama.delta !== 0) rankChange = drama.delta;
    } catch {
      /* placeholder: rankChange stays null */
    }
  }

  const result: MyCompetitionSummary = {
    activeCount,
    bestRank,
    totalPoints,
    closingSoonCount,
    inTop10Any,
    pointsToNextRank,
    pointsToTop10,
    nextTargetLabel,
    participatedTournamentIds: tournamentIds,
    rankChange,
    playerAbove: playerAboveInBest,
    playerBelow: playerBelowInBest,
    someoneCloseBehind,
    closeToNextRank,
    rankPressureByTournament,
  };
  mySummaryCache.set(userId, { result, expiresAt: Date.now() + MY_SUMMARY_CACHE_MS });
  return result;
}

/** Phase 38: Recommendation reason + message for UI. */
export type RecommendedTournamentReason =
  | "closing_soon"
  | "popular"
  | "best_prize"
  | "continue_momentum"
  | "first_easy_entry"
  | "generic";

export type RecommendedTournamentResult = {
  tournamentId: number;
  reason: RecommendedTournamentReason;
  message: string;
  /** Display name for the tournament (from public stat). */
  name?: string;
  amount?: number;
  type?: string;
} | null;

const RECOMMENDATION_CACHE_MS = 45_000;
const recommendationCache = new Map<number, { result: RecommendedTournamentResult; expiresAt: number }>();

function getCachedRecommendation(userId: number): RecommendedTournamentResult | undefined {
  const entry = recommendationCache.get(userId);
  if (!entry || Date.now() > entry.expiresAt) return undefined;
  return entry.result;
}

function setCachedRecommendation(userId: number, result: RecommendedTournamentResult) {
  recommendationCache.set(userId, { result, expiresAt: Date.now() + RECOMMENDATION_CACHE_MS });
}

const REASON_MESSAGES: Record<RecommendedTournamentReason, string> = {
  closing_soon: "נסגרת בקרוב – כדאי להצטרף עכשיו",
  popular: "הרבה משתתפים כבר בפנים",
  best_prize: "אחלה פרס – הצטרף עכשיו",
  continue_momentum: "המשך את המומנטום שלך כאן",
  first_easy_entry: "אחלה הזדמנות להשתתפות ראשונה",
  generic: "הצטרף לתחרות",
};

/** Phase 38: Best tournament for user (OPEN, not yet joined). Lightweight, deterministic. */
export async function getRecommendedTournamentForUser(userId: number): Promise<RecommendedTournamentResult> {
  const cached = getCachedRecommendation(userId);
  if (cached !== undefined) return cached;

  const [stats, userSubs] = await Promise.all([
    getTournamentPublicStats(true),
    getSubmissionsByUserId(userId),
  ]);
  const approved = userSubs.filter((s) => (s as { status?: string }).status === "approved");
  const userJoinedIds = new Set(approved.map((s) => (s as { tournamentId: number }).tournamentId));
  const approvedCount = approved.length;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const joinable = stats.filter((t) => {
    const status = (t as { status?: string }).status;
    const isLocked = (t as { isLocked?: boolean }).isLocked;
    return status === "OPEN" && !isLocked && !userJoinedIds.has(t.id);
  });
  if (joinable.length === 0) {
    const result: RecommendedTournamentResult = null;
    setCachedRecommendation(userId, result);
    return result;
  }

  const withClosesAt = joinable.map((t) => {
    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
    const endMs = closesAt == null ? null : closesAt instanceof Date ? closesAt.getTime() : Number(closesAt);
    const remainingMs = endMs != null && endMs > now ? endMs - now : null;
    return { t, remainingMs, endMs };
  });

  const closingSoon = withClosesAt.filter((x) => x.remainingMs != null && x.remainingMs <= oneDayMs);
  if (closingSoon.length > 0) {
    const pick = closingSoon.sort((a, b) => (a.remainingMs ?? 0) - (b.remainingMs ?? 0))[0];
    const result: RecommendedTournamentResult = {
      tournamentId: pick.t.id,
      reason: "closing_soon",
      message: REASON_MESSAGES.closing_soon,
      name: (pick.t as { name?: string }).name,
      amount: (pick.t as { amount?: number }).amount,
      type: (pick.t as { type?: string }).type,
    };
    setCachedRecommendation(userId, result);
    return result;
  }

  const byParticipants = [...joinable].sort((a, b) => (b.participants ?? 0) - (a.participants ?? 0));
  if (byParticipants[0] && (byParticipants[0].participants ?? 0) >= 10) {
    const pick = byParticipants[0];
    const result: RecommendedTournamentResult = {
      tournamentId: pick.id,
      reason: "popular",
      message: REASON_MESSAGES.popular,
      name: (pick as { name?: string }).name,
      amount: (pick as { amount?: number }).amount,
      type: (pick as { type?: string }).type,
    };
    setCachedRecommendation(userId, result);
    return result;
  }

  if (approvedCount === 0) {
    const byAmount = [...joinable].sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
    const pick = byAmount[0];
    if (pick) {
      const result: RecommendedTournamentResult = {
        tournamentId: pick.id,
        reason: "first_easy_entry",
        message: REASON_MESSAGES.first_easy_entry,
        name: (pick as { name?: string }).name,
        amount: (pick as { amount?: number }).amount,
        type: (pick as { type?: string }).type,
      };
      setCachedRecommendation(userId, result);
      return result;
    }
  }

  const byPrize = [...joinable].sort((a, b) => (b.prizePool ?? 0) - (a.prizePool ?? 0));
  const pick = byPrize[0];
  if (pick) {
    const reason: RecommendedTournamentReason = approvedCount >= 1 ? "continue_momentum" : "best_prize";
    const result: RecommendedTournamentResult = {
      tournamentId: pick.id,
      reason,
      message: REASON_MESSAGES[reason],
      name: (pick as { name?: string }).name,
      amount: (pick as { amount?: number }).amount,
      type: (pick as { type?: string }).type,
    };
    setCachedRecommendation(userId, result);
    return result;
  }

  const fallback = joinable[0];
  const result: RecommendedTournamentResult = fallback
    ? {
        tournamentId: fallback.id,
        reason: "generic",
        message: REASON_MESSAGES.generic,
        name: (fallback as { name?: string }).name,
        amount: (fallback as { amount?: number }).amount,
        type: (fallback as { type?: string }).type,
      }
    : null;
  setCachedRecommendation(userId, result);
  return result;
}

/** הגדרות אתר – מפתח־ערך (טקסטים, צבעים, באנרים) */
export async function getSiteSettings(): Promise<Record<string, string>> {
  const { siteSettings } = await getSchema();
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(siteSettings);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSiteSetting(key: string, value: string) {
  const { siteSettings } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  if (existing.length) {
    await db.update(siteSettings).set({ value, updatedAt: new Date() }).where(eq(siteSettings.key, key));
  } else {
    await db.insert(siteSettings).values({ key, value });
  }
}

// ---------- Phase 12: Public site settings (typed keys, safe for frontend) ----------
export const PUBLIC_SITE_SETTINGS_KEYS = [
  "contact.whatsapp",
  "contact.phone",
  "contact.email",
  "contact.address",
  "cta.primary_text",
  "cta.primary_url",
  "cta.secondary_text",
  "cta.secondary_url",
  "social.instagram",
  "social.facebook",
  "social.telegram",
  "footer.company_name",
  "footer.copyright_text",
  "legal.terms_page_slug",
  "legal.privacy_page_slug",
  "brand.site_name",
  "brand.tagline",
] as const;

const DEFAULT_PUBLIC_SETTINGS: Record<(typeof PUBLIC_SITE_SETTINGS_KEYS)[number], string> = {
  "contact.whatsapp": "972538099212",
  "contact.phone": "",
  "contact.email": "",
  "contact.address": "",
  "cta.primary_text": "בחר טורניר",
  "cta.primary_url": "/tournaments",
  "cta.secondary_text": "",
  "cta.secondary_url": "",
  "social.instagram": "",
  "social.facebook": "",
  "social.telegram": "",
  "footer.company_name": "WinMondial",
  "footer.copyright_text": "",
  "legal.terms_page_slug": "",
  "legal.privacy_page_slug": "",
  "brand.site_name": "WinMondial",
  "brand.tagline": "תחרות ניחושי המונדיאל הגדולה",
};

export type PublicSiteSettings = Record<(typeof PUBLIC_SITE_SETTINGS_KEYS)[number], string>;

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const raw = await getSiteSettings();
  const out = { ...DEFAULT_PUBLIC_SETTINGS };
  for (const key of PUBLIC_SITE_SETTINGS_KEYS) {
    if (raw[key] !== undefined && raw[key] !== null) out[key] = String(raw[key]).trim();
  }
  return out;
}

export async function setSiteSettingsBatch(entries: Record<string, string>) {
  for (const [key, value] of Object.entries(entries)) {
    if (key && typeof key === "string" && typeof value === "string") await setSiteSetting(key, value);
  }
}

// ---------- Phase 11: CMS helpers (SQLite only) ----------
export async function getActiveBanners(key?: string): Promise<Array<{ id: number; key: string; title: string | null; subtitle: string | null; imageUrl: string | null; mobileImageUrl: string | null; buttonText: string | null; buttonUrl: string | null; sortOrder: number; startsAt: Date | null; endsAt: Date | null }>> {
  if (!USE_SQLITE) return [];
  const { siteBanners } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const whereClause = key != null && key !== "" ? and(eq(siteBanners.isActive, true), eq(siteBanners.key, key)) : eq(siteBanners.isActive, true);
  const rows = await db.select().from(siteBanners).where(whereClause).orderBy(asc(siteBanners.sortOrder), asc(siteBanners.id));
  const filtered = (rows as Array<{ id: number; key: string; title: string | null; subtitle: string | null; imageUrl: string | null; mobileImageUrl: string | null; buttonText: string | null; buttonUrl: string | null; isActive: boolean; sortOrder: number; startsAt: Date | null; endsAt: Date | null }>).filter((r) => {
    if (r.startsAt != null && new Date(r.startsAt).getTime() > now) return false;
    if (r.endsAt != null && new Date(r.endsAt).getTime() < now) return false;
    return true;
  });
  return filtered.map((r) => ({ id: r.id, key: r.key, title: r.title, subtitle: r.subtitle, imageUrl: r.imageUrl, mobileImageUrl: r.mobileImageUrl, buttonText: r.buttonText, buttonUrl: r.buttonUrl, sortOrder: r.sortOrder, startsAt: r.startsAt, endsAt: r.endsAt }));
}

export async function getActiveAnnouncements(): Promise<Array<{ id: number; title: string; body: string | null; variant: string }>> {
  if (!USE_SQLITE) return [];
  const { siteAnnouncements } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const rows = await db.select().from(siteAnnouncements).where(eq(siteAnnouncements.isActive, true)).orderBy(asc(siteAnnouncements.id));
  return (rows as Array<{ id: number; title: string; body: string | null; variant: string; startsAt: Date | null; endsAt: Date | null }>).filter((r) => {
    if (r.startsAt != null && new Date(r.startsAt).getTime() > now) return false;
    if (r.endsAt != null && new Date(r.endsAt).getTime() < now) return false;
    return true;
  }).map((r) => ({ id: r.id, title: r.title, body: r.body, variant: r.variant }));
}

export async function listContentPages() {
  if (!USE_SQLITE) return [];
  const { contentPages } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentPages).orderBy(asc(contentPages.slug));
}
/** Public CMS page by slug. Returns page regardless of status (draft or published) so the platform behaves as live; admin can still manage status in DB. */
export async function getContentPageBySlug(slug: string) {
  if (!USE_SQLITE) return null;
  const { contentPages } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contentPages).where(eq(contentPages.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Phase 13: Public page + sections for CMS rendering. Sections for that page only. */
export async function getPublicPageWithSections(slug: string): Promise<{ page: Awaited<ReturnType<typeof getContentPageBySlug>>; sections: Awaited<ReturnType<typeof listContentSections>> }> {
  const page = await getContentPageBySlug(slug);
  if (!page) return { page: null, sections: [] };
  const sections = await listContentSections(page.id);
  return { page, sections: sections.filter((s) => s.isActive) };
}
export async function getContentPageById(id: number) {
  if (!USE_SQLITE) return null;
  const { contentPages } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createContentPage(data: { slug: string; title: string; status?: string; seoTitle?: string | null; seoDescription?: string | null }) {
  const { contentPages } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(contentPages).values({ slug: data.slug, title: data.title, status: data.status ?? "draft", seoTitle: data.seoTitle ?? null, seoDescription: data.seoDescription ?? null }).returning({ id: contentPages.id });
  return row!.id;
}
export async function updateContentPage(id: number, data: { slug?: string; title?: string; status?: string; seoTitle?: string | null; seoDescription?: string | null }) {
  const { contentPages } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contentPages).set({ ...data, updatedAt: new Date() }).where(eq(contentPages.id, id));
}
export async function deleteContentPage(id: number) {
  const { contentPages } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contentPages).where(eq(contentPages.id, id));
}

export async function listContentSections(pageId: number | null) {
  if (!USE_SQLITE) return [];
  const { contentSections } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const where = pageId != null ? eq(contentSections.pageId, pageId) : isNull(contentSections.pageId);
  return db.select().from(contentSections).where(where).orderBy(asc(contentSections.sortOrder), asc(contentSections.id));
}
export async function getContentSectionById(id: number) {
  if (!USE_SQLITE) return null;
  const { contentSections } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contentSections).where(eq(contentSections.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createContentSection(data: { pageId?: number | null; key: string; type: string; title?: string | null; subtitle?: string | null; body?: string | null; imageUrl?: string | null; buttonText?: string | null; buttonUrl?: string | null; sortOrder?: number; isActive?: boolean }) {
  const { contentSections } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(contentSections).values({ pageId: data.pageId ?? null, key: data.key, type: data.type, title: data.title ?? null, subtitle: data.subtitle ?? null, body: data.body ?? null, imageUrl: data.imageUrl ?? null, buttonText: data.buttonText ?? null, buttonUrl: data.buttonUrl ?? null, sortOrder: data.sortOrder ?? 0, isActive: data.isActive ?? true }).returning({ id: contentSections.id });
  return row!.id;
}
export async function updateContentSection(id: number, data: Partial<{ pageId: number | null; key: string; type: string; title: string | null; subtitle: string | null; body: string | null; imageUrl: string | null; buttonText: string | null; buttonUrl: string | null; sortOrder: number; isActive: boolean }>) {
  const { contentSections } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contentSections).set({ ...data, updatedAt: new Date() }).where(eq(contentSections.id, id));
}
export async function deleteContentSection(id: number) {
  const { contentSections } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contentSections).where(eq(contentSections.id, id));
}

export async function listSiteBanners() {
  if (!USE_SQLITE) return [];
  const { siteBanners } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(siteBanners).orderBy(asc(siteBanners.sortOrder), asc(siteBanners.id));
}
export async function getSiteBannerById(id: number) {
  if (!USE_SQLITE) return null;
  const { siteBanners } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(siteBanners).where(eq(siteBanners.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createSiteBanner(data: { key: string; title?: string | null; subtitle?: string | null; imageUrl?: string | null; mobileImageUrl?: string | null; buttonText?: string | null; buttonUrl?: string | null; isActive?: boolean; sortOrder?: number; startsAt?: Date | null; endsAt?: Date | null }) {
  const { siteBanners } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(siteBanners).values({ key: data.key, title: data.title ?? null, subtitle: data.subtitle ?? null, imageUrl: data.imageUrl ?? null, mobileImageUrl: data.mobileImageUrl ?? null, buttonText: data.buttonText ?? null, buttonUrl: data.buttonUrl ?? null, isActive: data.isActive ?? true, sortOrder: data.sortOrder ?? 0, startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null }).returning({ id: siteBanners.id });
  return row!.id;
}
export async function updateSiteBanner(id: number, data: Partial<{ key: string; title: string | null; subtitle: string | null; imageUrl: string | null; mobileImageUrl: string | null; buttonText: string | null; buttonUrl: string | null; isActive: boolean; sortOrder: number; startsAt: Date | null; endsAt: Date | null }>) {
  const { siteBanners } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(siteBanners).set({ ...data, updatedAt: new Date() }).where(eq(siteBanners.id, id));
}
export async function deleteSiteBanner(id: number) {
  const { siteBanners } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(siteBanners).where(eq(siteBanners.id, id));
}

export async function listSiteAnnouncements() {
  if (!USE_SQLITE) return [];
  const { siteAnnouncements } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(siteAnnouncements).orderBy(asc(siteAnnouncements.id));
}
export async function getSiteAnnouncementById(id: number) {
  if (!USE_SQLITE) return null;
  const { siteAnnouncements } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createSiteAnnouncement(data: { title: string; body?: string | null; variant?: string; isActive?: boolean; startsAt?: Date | null; endsAt?: Date | null }) {
  const { siteAnnouncements } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(siteAnnouncements).values({ title: data.title, body: data.body ?? null, variant: data.variant ?? "info", isActive: data.isActive ?? true, startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null }).returning({ id: siteAnnouncements.id });
  return row!.id;
}
export async function updateSiteAnnouncement(id: number, data: Partial<{ title: string; body: string | null; variant: string; isActive: boolean; startsAt: Date | null; endsAt: Date | null }>) {
  const { siteAnnouncements } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(siteAnnouncements).set({ ...data, updatedAt: new Date() }).where(eq(siteAnnouncements.id, id));
}
export async function deleteSiteAnnouncement(id: number) {
  const { siteAnnouncements } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(siteAnnouncements).where(eq(siteAnnouncements.id, id));
}

// ---------- Phase 15: Media assets ----------
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function listMediaAssets(category?: string | null): Promise<Array<{ id: number; filename: string; originalName: string; mimeType: string; sizeBytes: number; url: string; altText: string | null; category: string | null; createdAt: Date | null }>> {
  if (!USE_SQLITE) return [];
  const { mediaAssets } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const where = category != null && category !== "" ? eq(mediaAssets.category, category) : undefined;
  const rows = await db.select().from(mediaAssets).where(where).orderBy(desc(mediaAssets.createdAt));
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    originalName: r.originalName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    url: r.url,
    altText: r.altText ?? null,
    category: r.category ?? null,
    createdAt: r.createdAt ?? null,
  }));
}

export async function createMediaAsset(data: {
  fileBase64: string;
  originalName: string;
  mimeType: string;
  altText?: string | null;
  category?: string | null;
}): Promise<{ id: number; url: string }> {
  const { mediaAssets } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!ALLOWED_IMAGE_TYPES.includes(data.mimeType)) throw new Error("Invalid file type. Allowed: JPEG, PNG, GIF, WebP.");
  const buf = Buffer.from(data.fileBase64, "base64");
  if (buf.length > MAX_MEDIA_SIZE_BYTES) throw new Error("File too large. Max 5MB.");
  if (buf.length === 0) throw new Error("Empty file.");
  const ext = (data.originalName && data.originalName.includes(".")) ? data.originalName.replace(/^.*\./, "").toLowerCase() : "jpg";
  const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "jpg";
  const { nanoid } = await import("nanoid");
  const filename = `${nanoid(12)}.${safeExt}`;
  const { join } = await import("path");
  const { mkdir, writeFile } = await import("fs/promises");
  const { existsSync } = await import("fs");
  const uploadsDir = join(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });
  const filePath = join(uploadsDir, filename);
  await writeFile(filePath, buf);
  const url = `/uploads/${filename}`;
  const [row] = await db.insert(mediaAssets).values({
    filename,
    originalName: data.originalName || filename,
    mimeType: data.mimeType,
    sizeBytes: buf.length,
    url,
    altText: data.altText ?? null,
    category: data.category ?? null,
  }).returning({ id: mediaAssets.id, url: mediaAssets.url });
  return { id: row!.id, url: row!.url };
}

export async function deleteMediaAsset(id: number): Promise<void> {
  const { mediaAssets } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  const row = rows[0];
  if (row) {
    const { join } = await import("path");
    const { unlink } = await import("fs/promises");
    const { existsSync } = await import("fs");
    const filePath = join(process.cwd(), "uploads", row.filename);
    if (existsSync(filePath)) await unlink(filePath).catch(() => {});
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  }
}

export async function updateMediaAsset(id: number, data: { altText?: string | null; category?: string | null }): Promise<void> {
  const { mediaAssets } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mediaAssets).set({ ...data, updatedAt: new Date() }).where(eq(mediaAssets.id, id));
}

const CHANCE_CARDS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export type ChancePredictions = { heart: string; club: string; diamond: string; spade: string };

export function isChancePredictionsValid(p: unknown): p is ChancePredictions {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    CHANCE_CARDS.includes(String(o.heart)) &&
    CHANCE_CARDS.includes(String(o.club)) &&
    CHANCE_CARDS.includes(String(o.diamond)) &&
    CHANCE_CARDS.includes(String(o.spade))
  );
}

export type LottoPredictions = { numbers: number[]; strongNumber: number };
const LOTTO_MIN = 1;
const LOTTO_MAX = 37;
const LOTTO_STRONG_MIN = 1;
const LOTTO_STRONG_MAX = 7;
const LOTTO_COUNT = 6;

export function isLottoPredictionsValid(p: unknown): p is LottoPredictions {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  const nums = o.numbers;
  const strong = o.strongNumber;
  if (!Array.isArray(nums) || nums.length !== LOTTO_COUNT) return false;
  const set = new Set<number>();
  for (const n of nums) {
    const x = Number(n);
    if (!Number.isInteger(x) || x < LOTTO_MIN || x > LOTTO_MAX || set.has(x)) return false;
    set.add(x);
  }
  const s = Number(strong);
  return Number.isInteger(s) && s >= LOTTO_STRONG_MIN && s <= LOTTO_STRONG_MAX;
}

export async function getChanceDrawResult(tournamentId: number) {
  const { chanceDrawResults } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(chanceDrawResults).where(eq(chanceDrawResults.tournamentId, tournamentId)).limit(1);
  return rows[0] ?? null;
}

export async function setChanceDrawResult(
  tournamentId: number,
  data: { heartCard: string; clubCard: string; diamondCard: string; spadeCard: string; drawDate: string },
  updatedBy: number
) {
  const { chanceDrawResults, submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const existing = await db.select().from(chanceDrawResults).where(eq(chanceDrawResults.tournamentId, tournamentId)).limit(1);
  if (existing.length && existing[0].locked) {
    throw new Error("לא ניתן לעדכן – תוצאות ההגרלה נעולות");
  }
  const row = {
    tournamentId,
    heartCard: data.heartCard,
    clubCard: data.clubCard,
    diamondCard: data.diamondCard,
    spadeCard: data.spadeCard,
    drawDate: data.drawDate,
    updatedAt: new Date(),
    updatedBy,
    locked: false,
  };
  if (existing.length) {
    await db.update(chanceDrawResults).set(row).where(eq(chanceDrawResults.tournamentId, tournamentId));
  } else {
    await db.insert(chanceDrawResults).values(row);
  }
  const approved = (await getAllSubmissions()).filter((s) => s.tournamentId === tournamentId && s.status === "approved");
  const tournament = await getTournamentById(tournamentId);
  const { resolveScoring } = await import("./scoring/resolveScoring");
  for (const s of approved) {
    const pred = s.predictions as unknown;
    if (!isChancePredictionsValid(pred)) {
      await updateSubmissionPoints(s.id, 0);
      continue;
    }
    const resolved = await resolveScoring(
      tournament ?? { type: "chance", id: tournamentId },
      {
        type: "chance",
        draw: { heartCard: data.heartCard, clubCard: data.clubCard, diamondCard: data.diamondCard, spadeCard: data.spadeCard },
        predictions: { heart: pred.heart, club: pred.club, diamond: pred.diamond, spade: pred.spade },
      }
    );
    await updateSubmissionPoints(s.id, resolved.points);
  }
}

export async function lockChanceDrawResult(tournamentId: number) {
  const { chanceDrawResults } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(chanceDrawResults).set({ locked: true, updatedAt: new Date() }).where(eq(chanceDrawResults.tournamentId, tournamentId));
}

export type ChanceLeaderboardRow = {
  submissionId: number;
  userId: number;
  username: string;
  points: number;
  isWinner: boolean;
  prizeAmount: number;
};

/** Phase 11: Leaderboard cache for load spikes – 15s TTL per tournament. */
const leaderboardCache = new Map<string, { data: unknown; expiresAt: number }>();
const LEADERBOARD_CACHE_MS = 15_000;

export async function getChanceLeaderboard(tournamentId: number): Promise<{
  drawResult: { heartCard: string; clubCard: string; diamondCard: string; spadeCard: string; drawDate: string } | null;
  rows: ChanceLeaderboardRow[];
  prizePool: number;
  winnerCount: number;
}> {
  const key = `chance:${tournamentId}`;
  const cached = leaderboardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as Awaited<ReturnType<typeof getChanceLeaderboard>>;
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const tournament = await getTournamentById(tournamentId);
  const drawResult = await getChanceDrawResult(tournamentId);
  const guaranteed = tournament ? Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0 : 0;
  const calculatedPool = Math.round(subs.length * (tournament?.amount ?? 0) * 0.875);
  const prizePool = guaranteed > 0 ? guaranteed : calculatedPool;
  const maxPoints = subs.length ? Math.max(...subs.map((s) => s.points)) : 0;
  const winners = subs.filter((s) => s.points === maxPoints);
  const winnerCount = maxPoints > 0 ? winners.length : 0;
  const prizePerWinner = winnerCount > 0 ? Math.round(prizePool / winnerCount) : 0;
  const rows: ChanceLeaderboardRow[] = subs.map((s) => ({
    submissionId: s.id,
    userId: s.userId,
    username: s.username,
    points: s.points,
    isWinner: s.points === maxPoints && maxPoints > 0,
    prizeAmount: s.points === maxPoints && maxPoints > 0 ? prizePerWinner : 0,
  }));
  rows.sort((a, b) => b.points - a.points);
  const result = {
    drawResult: drawResult
      ? {
          heartCard: drawResult.heartCard,
          clubCard: drawResult.clubCard,
          diamondCard: drawResult.diamondCard,
          spadeCard: drawResult.spadeCard,
          drawDate: drawResult.drawDate,
        }
      : null,
    rows,
    prizePool,
    winnerCount,
  };
  leaderboardCache.set(key, { data: result, expiresAt: Date.now() + LEADERBOARD_CACHE_MS });
  return result;
}

export async function getLottoDrawResult(tournamentId: number) {
  const { lottoDrawResults } = await getSchema();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(lottoDrawResults).where(eq(lottoDrawResults.tournamentId, tournamentId)).limit(1);
  return rows[0] ?? null;
}

export async function setLottoDrawResult(
  tournamentId: number,
  data: { num1: number; num2: number; num3: number; num4: number; num5: number; num6: number; strongNumber: number; drawDate: string },
  updatedBy: number
) {
  const { lottoDrawResults, submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const existing = await db.select().from(lottoDrawResults).where(eq(lottoDrawResults.tournamentId, tournamentId)).limit(1);
  if (existing.length && existing[0].locked) {
    throw new Error("לא ניתן לעדכן – תוצאות ההגרלה נעולות");
  }
  const winningSet = new Set([data.num1, data.num2, data.num3, data.num4, data.num5, data.num6]);
  const row = {
    tournamentId,
    num1: data.num1,
    num2: data.num2,
    num3: data.num3,
    num4: data.num4,
    num5: data.num5,
    num6: data.num6,
    strongNumber: data.strongNumber,
    drawDate: data.drawDate,
    updatedAt: new Date(),
    updatedBy,
    locked: false,
  };
  if (existing.length) {
    await db.update(lottoDrawResults).set(row).where(eq(lottoDrawResults.tournamentId, tournamentId));
  } else {
    await db.insert(lottoDrawResults).values(row);
  }
  const approved = (await getAllSubmissions()).filter((s) => s.tournamentId === tournamentId && s.status === "approved");
  const tournament = await getTournamentById(tournamentId);
  const { resolveScoring } = await import("./scoring/resolveScoring");
  for (const s of approved) {
    const pred = s.predictions as unknown;
    if (!isLottoPredictionsValid(pred)) {
      await updateSubmissionLottoResult(s.id, 0, false);
      continue;
    }
    const resolved = await resolveScoring(
      tournament ?? { type: "lotto", id: tournamentId },
      {
        type: "lotto",
        draw: { num1: data.num1, num2: data.num2, num3: data.num3, num4: data.num4, num5: data.num5, num6: data.num6, strongNumber: data.strongNumber },
        predictions: { numbers: pred.numbers, strongNumber: pred.strongNumber },
      }
    );
    await updateSubmissionLottoResult(s.id, resolved.points, resolved.strongHit ?? false);
  }
}

export async function lockLottoDrawResult(tournamentId: number) {
  const { lottoDrawResults } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(lottoDrawResults).set({ locked: true, updatedAt: new Date() }).where(eq(lottoDrawResults.tournamentId, tournamentId));
}

export type LottoLeaderboardRow = {
  submissionId: number;
  userId: number;
  username: string;
  points: number;
  strongHit: boolean;
  isWinner: boolean;
  prizeAmount: number;
};

export async function getLottoLeaderboard(tournamentId: number): Promise<{
  drawResult: { num1: number; num2: number; num3: number; num4: number; num5: number; num6: number; strongNumber: number; drawDate: string } | null;
  rows: LottoLeaderboardRow[];
  prizePool: number;
  winnerCount: number;
}> {
  const key = `lotto:${tournamentId}`;
  const cached = leaderboardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as Awaited<ReturnType<typeof getLottoLeaderboard>>;
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const tournament = await getTournamentById(tournamentId);
  const drawResult = await getLottoDrawResult(tournamentId);
  const guaranteed = tournament ? Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0 : 0;
  const calculatedPool = Math.round(subs.length * (tournament?.amount ?? 0) * 0.875);
  const prizePool = guaranteed > 0 ? guaranteed : calculatedPool;
  // דירוג לוטו מבוסס על הניקוד הכולל (כולל נקודה על המספר החזק אם נפגע).
  const score = (s: { points: number }) => s.points;
  const maxScore = subs.length ? Math.max(...subs.map(score)) : 0;
  const winners = subs.filter((s) => score(s) === maxScore);
  const winnerCount = maxScore > 0 ? winners.length : 0;
  const prizePerWinner = winnerCount > 0 ? Math.round(prizePool / winnerCount) : 0;
  const rows: LottoLeaderboardRow[] = subs.map((s) => ({
    submissionId: s.id,
    userId: s.userId,
    username: s.username,
    points: s.points,
    strongHit: !!s.strongHit,
    isWinner: score(s) === maxScore && maxScore > 0,
    prizeAmount: score(s) === maxScore && maxScore > 0 ? prizePerWinner : 0,
  }));
  rows.sort((a, b) => score(b) - score(a) || Number(b.strongHit) - Number(a.strongHit));
  const result = {
    drawResult: drawResult
      ? {
          num1: drawResult.num1,
          num2: drawResult.num2,
          num3: drawResult.num3,
          num4: drawResult.num4,
          num5: drawResult.num5,
          num6: drawResult.num6,
          strongNumber: drawResult.strongNumber,
          drawDate: drawResult.drawDate,
        }
      : null,
    rows,
    prizePool,
    winnerCount,
  };
  leaderboardCache.set(key, { data: result, expiresAt: Date.now() + LEADERBOARD_CACHE_MS });
  return result;
}

// ——— תחרות כדורגל (משחקים מוגדרים ידנית) ———

export type CustomFootballMatchRow = {
  id: number;
  tournamentId: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string | null;
  matchTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  displayOrder: number;
};

export async function getCustomFootballMatches(tournamentId: number): Promise<CustomFootballMatchRow[]> {
  const { customFootballMatches } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(customFootballMatches).where(eq(customFootballMatches.tournamentId, tournamentId)).orderBy(customFootballMatches.displayOrder, customFootballMatches.id);
  return rows.map((r) => ({
    id: r.id,
    tournamentId: r.tournamentId,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    matchDate: r.matchDate ?? null,
    matchTime: r.matchTime ?? null,
    homeScore: r.homeScore ?? null,
    awayScore: r.awayScore ?? null,
    displayOrder: r.displayOrder ?? 0,
  }));
}

export async function addCustomFootballMatch(data: {
  tournamentId: number;
  homeTeam: string;
  awayTeam: string;
  matchDate?: string | null;
  matchTime?: string | null;
  displayOrder?: number;
}) {
  const { customFootballMatches } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(customFootballMatches).values({
    tournamentId: data.tournamentId,
    homeTeam: data.homeTeam.trim(),
    awayTeam: data.awayTeam.trim(),
    matchDate: data.matchDate?.trim() || null,
    matchTime: data.matchTime?.trim() || null,
    displayOrder: data.displayOrder ?? 0,
  });
}

export async function updateCustomFootballMatchResult(matchId: number, homeScore: number, awayScore: number) {
  const { customFootballMatches } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(customFootballMatches).set({ homeScore, awayScore, updatedAt: new Date() }).where(eq(customFootballMatches.id, matchId));
}

export async function updateCustomFootballMatch(matchId: number, data: { homeTeam?: string; awayTeam?: string; matchDate?: string | null; matchTime?: string | null }) {
  const { customFootballMatches } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.homeTeam !== undefined) set.homeTeam = data.homeTeam.trim();
  if (data.awayTeam !== undefined) set.awayTeam = data.awayTeam.trim();
  if (data.matchDate !== undefined) set.matchDate = data.matchDate?.trim() || null;
  if (data.matchTime !== undefined) set.matchTime = data.matchTime?.trim() || null;
  await db.update(customFootballMatches).set(set).where(eq(customFootballMatches.id, matchId));
}

export async function deleteCustomFootballMatch(matchId: number) {
  const { customFootballMatches } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.delete(customFootballMatches).where(eq(customFootballMatches.id, matchId));
}

export async function getCustomFootballMatchById(matchId: number) {
  const { customFootballMatches } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(customFootballMatches).where(eq(customFootballMatches.id, matchId)).limit(1);
  return r[0];
}

export async function recalcCustomFootballPoints(tournamentId: number) {
  const matches = await getCustomFootballMatches(tournamentId);
  const results = new Map<number, { homeScore: number; awayScore: number }>();
  for (const m of matches) {
    if (m.homeScore != null && m.awayScore != null) results.set(m.id, { homeScore: m.homeScore, awayScore: m.awayScore });
  }
  const subs = await getSubmissionsByTournament(tournamentId);
  const tournament = await getTournamentById(tournamentId);
  const { resolveScoring } = await import("./scoring/resolveScoring");
  for (const s of subs) {
    const preds = s.predictions as unknown;
    if (!Array.isArray(preds) || !preds.every((p: unknown) => p && typeof (p as { matchId?: number }).matchId === "number")) continue;
    const resolved = await resolveScoring(
      tournament ?? { type: "football_custom", id: tournamentId },
      { type: "football", matchResults: results, predictions: preds as Array<{ matchId: number; prediction: "1" | "X" | "2" }> }
    );
    await updateSubmissionPoints(s.id, resolved.points);
  }
}

export type CustomFootballLeaderboardRow = {
  submissionId: number;
  userId: number;
  username: string;
  correctCount: number;
  points: number;
  rank: number;
  prizeAmount: number;
};

export async function getCustomFootballLeaderboard(tournamentId: number): Promise<{
  rows: CustomFootballLeaderboardRow[];
  prizePool: number;
  winnerCount: number;
}> {
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const tournament = await getTournamentById(tournamentId);
  const guaranteed = tournament ? Number((tournament as { guaranteedPrizeAmount?: number | null }).guaranteedPrizeAmount ?? 0) || 0 : 0;
  const calculatedPool = Math.round(subs.length * (tournament?.amount ?? 0) * 0.875);
  const prizePool = guaranteed > 0 ? guaranteed : calculatedPool;
  const maxPoints = subs.length ? Math.max(...subs.map((s) => s.points), 0) : 0;
  const winners = subs.filter((s) => s.points === maxPoints && maxPoints > 0);
  const winnerCount = winners.length;
  const prizePerWinner = winnerCount > 0 ? Math.round(prizePool / winnerCount) : 0;
  const rows: CustomFootballLeaderboardRow[] = subs
    .sort((a, b) => b.points - a.points)
    .map((s, i) => ({
      submissionId: s.id,
      userId: s.userId,
      username: s.username,
      correctCount: Math.floor(s.points / 3),
      points: s.points,
      rank: i + 1,
      prizeAmount: s.points === maxPoints && maxPoints > 0 ? prizePerWinner : 0,
    }));
  return { rows, prizePool, winnerCount };
}

/** Phase 34: Near Win Engine – motivational message by leaderboard position (cache 30s). */
export type NearWinMessageType = "near_win" | "top" | "encouragement" | "danger_drop";

export type NearWinResult = { message: string; type: NearWinMessageType } | null;

const nearWinCache = new Map<string, { result: NearWinResult; expiresAt: number }>();
const NEAR_WIN_CACHE_MS = 30_000;

function getCachedNearWin(userId: number, tournamentId: number): NearWinResult | undefined {
  const key = `${userId}-${tournamentId}`;
  const entry = nearWinCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    nearWinCache.delete(key);
    return undefined;
  }
  return entry.result;
}

function setCachedNearWin(userId: number, tournamentId: number, result: NearWinResult) {
  nearWinCache.set(`${userId}-${tournamentId}`, { result, expiresAt: Date.now() + NEAR_WIN_CACHE_MS });
}

/** Returns user's best rank and points, and first-place points, from a list of rows with userId and points. */
function userRankFromRows(
  rows: { userId: number; points: number }[],
  userId: number
): { position: number; userPoints: number; firstPlacePoints: number } | null {
  const byUser = new Map<number, number>();
  for (const r of rows) {
    const cur = byUser.get(r.userId) ?? 0;
    if (r.points > cur) byUser.set(r.userId, r.points);
  }
  const sorted = Array.from(byUser.entries()).sort((a, b) => b[1] - a[1]);
  const firstPlacePoints = sorted[0]?.[1] ?? 0;
  const idx = sorted.findIndex(([id]) => id === userId);
  if (idx < 0) return null;
  return {
    position: idx + 1,
    userPoints: sorted[idx][1],
    firstPlacePoints,
  };
}

export async function getNearWinMessage(userId: number, tournamentId: number): Promise<NearWinResult> {
  const cached = getCachedNearWin(userId, tournamentId);
  if (cached !== undefined) return cached;

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return null;
  const type = (tournament as { type?: string }).type ?? "football";

  let position: number;
  let userPoints: number;
  let firstPlacePoints: number;

  if (type === "chance") {
    const { rows } = await getChanceLeaderboard(tournamentId);
    const info = userRankFromRows(rows.map((r) => ({ userId: r.userId, points: r.points })), userId);
    if (!info) {
      setCachedNearWin(userId, tournamentId, null);
      return null;
    }
    ({ position, userPoints, firstPlacePoints } = info);
  } else if (type === "lotto") {
    const { rows } = await getLottoLeaderboard(tournamentId);
    const info = userRankFromRows(rows.map((r) => ({ userId: r.userId, points: r.points })), userId);
    if (!info) {
      setCachedNearWin(userId, tournamentId, null);
      return null;
    }
    ({ position, userPoints, firstPlacePoints } = info);
  } else if (type === "football_custom") {
    const { rows } = await getCustomFootballLeaderboard(tournamentId);
    const info = userRankFromRows(rows.map((r) => ({ userId: r.userId, points: r.points })), userId);
    if (!info) {
      setCachedNearWin(userId, tournamentId, null);
      return null;
    }
    ({ position, userPoints, firstPlacePoints } = info);
  } else {
    const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
    const info = userRankFromRows(subs.map((s) => ({ userId: s.userId, points: s.points ?? 0 })), userId);
    if (!info) {
      setCachedNearWin(userId, tournamentId, null);
      return null;
    }
    ({ position, userPoints, firstPlacePoints } = info);
  }

  const gap = firstPlacePoints - userPoints;

  if (position === 1) {
    const result: NearWinResult = { message: "אתה מוביל! המשך כך!", type: "top" };
    setCachedNearWin(userId, tournamentId, result);
    return result;
  }

  if (position >= 2 && position <= 3 && gap <= 2) {
    const result: NearWinResult = {
      message: gap <= 1 ? "עוד ניחוש אחד ואתה מוביל!" : "אתה רק 2 נקודות מהמקום הראשון!",
      type: "danger_drop",
    };
    setCachedNearWin(userId, tournamentId, result);
    return result;
  }

  if (gap <= 3 && gap >= 1) {
    const result: NearWinResult = {
      message: gap === 1 ? "אתה רק נקודה אחת מהמקום הראשון!" : `אתה רק ${gap} נקודות מהמקום הראשון`,
      type: "near_win",
    };
    setCachedNearWin(userId, tournamentId, result);
    return result;
  }

  if (position <= 5) {
    const result: NearWinResult = { message: "אתה בטופ 5 – המשך כך!", type: "top" };
    setCachedNearWin(userId, tournamentId, result);
    return result;
  }

  const result: NearWinResult = { message: "כל ניחוש טוב מקרב אותך לדירוג – בהצלחה!", type: "encouragement" };
  setCachedNearWin(userId, tournamentId, result);
  return result;
}

/** Phase 34 Step 2: Rival System – sorted leaderboard rows (best per user) with username for rival messages. */
type RivalLeaderboardRow = { userId: number; username: string; points: number };

function sortedRivalRowsFromRows(rows: { userId: number; username: string; points: number }[]): RivalLeaderboardRow[] {
  const byUser = new Map<number, { username: string; points: number }>();
  for (const r of rows) {
    const cur = byUser.get(r.userId);
    if (!cur || r.points > cur.points) byUser.set(r.userId, { username: r.username ?? `#${r.userId}`, points: r.points });
  }
  return Array.from(byUser.entries())
    .sort((a, b) => b[1].points - a[1].points)
    .map(([userId, { username, points }]) => ({ userId, username, points }));
}

async function getLeaderboardRowsForRival(tournamentId: number): Promise<RivalLeaderboardRow[] | null> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return null;
  const type = (tournament as { type?: string }).type ?? "football";

  if (type === "chance") {
    const { rows } = await getChanceLeaderboard(tournamentId);
    return sortedRivalRowsFromRows(rows.map((r) => ({ userId: r.userId, username: r.username ?? `#${r.userId}`, points: r.points })));
  }
  if (type === "lotto") {
    const { rows } = await getLottoLeaderboard(tournamentId);
    return sortedRivalRowsFromRows(rows.map((r) => ({ userId: r.userId, username: r.username ?? `#${r.userId}`, points: r.points })));
  }
  if (type === "football_custom") {
    const { rows } = await getCustomFootballLeaderboard(tournamentId);
    return sortedRivalRowsFromRows(rows.map((r) => ({ userId: r.userId, username: r.username ?? `#${r.userId}`, points: r.points })));
  }
  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const rows = subs.map((s) => ({
    userId: s.userId,
    username: (s as { username?: string | null }).username ?? `#${s.userId}`,
    points: s.points ?? 0,
  }));
  return sortedRivalRowsFromRows(rows);
}

export type RivalStatusType = "rival_above" | "rival_below" | "battle_zone" | "generic";
export type RivalStatusResult = {
  message: string;
  type: RivalStatusType;
  rival?: { id: number; username: string; rank: number; gap: number; direction: "above" | "below" };
} | null;

const rivalStatusCache = new Map<string, { result: RivalStatusResult; expiresAt: number }>();
const RIVAL_CACHE_MS = 30_000;

function getCachedRivalStatus(userId: number, tournamentId: number): RivalStatusResult | undefined {
  const key = `rival-${userId}-${tournamentId}`;
  const entry = rivalStatusCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    rivalStatusCache.delete(key);
    return undefined;
  }
  return entry.result;
}

function setCachedRivalStatus(userId: number, tournamentId: number, result: RivalStatusResult) {
  rivalStatusCache.set(`rival-${userId}-${tournamentId}`, { result, expiresAt: Date.now() + RIVAL_CACHE_MS });
}

/** Phase 34 Step 2: Rival System – direct competition message vs user above/below (cache 30s). */
export async function getRivalStatus(userId: number, tournamentId: number): Promise<RivalStatusResult> {
  const cached = getCachedRivalStatus(userId, tournamentId);
  if (cached !== undefined) return cached;

  const sorted = await getLeaderboardRowsForRival(tournamentId);
  if (!sorted?.length) {
    const result: RivalStatusResult = { message: "כל ניחוש טוב מקרב אותך בדירוג", type: "generic" };
    setCachedRivalStatus(userId, tournamentId, result);
    return result;
  }

  const idx = sorted.findIndex((r) => r.userId === userId);
  if (idx < 0) {
    const result: RivalStatusResult = { message: "כל ניחוש טוב מקרב אותך בדירוג", type: "generic" };
    setCachedRivalStatus(userId, tournamentId, result);
    return result;
  }

  const rank = idx + 1;
  const userPoints = sorted[idx].points;
  const above = idx > 0 ? sorted[idx - 1] : null;
  const below = idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const gapAbove = above ? above.points - userPoints : null;
  const gapBelow = below ? userPoints - below.points : null;
  const CLOSE = 3;
  const aboveClose = gapAbove !== null && gapAbove <= CLOSE;
  const belowClose = gapBelow !== null && gapBelow <= CLOSE;

  if (aboveClose && belowClose) {
    const result: RivalStatusResult = {
      message: `אתה נאבק עכשיו על מקום ${rank}`,
      type: "battle_zone",
    };
    setCachedRivalStatus(userId, tournamentId, result);
    return result;
  }

  if (belowClose && (gapBelow ?? 0) <= 1) {
    const rivalName = below!.username;
    const msg = gapBelow === 1 ? `${rivalName} רק נקודה מתחתיך` : `${rivalName} רק ${gapBelow} נקודות מתחתיך`;
    const result: RivalStatusResult = {
      message: msg,
      type: "rival_below",
      rival: { id: below!.userId, username: rivalName, rank: rank + 1, gap: gapBelow!, direction: "below" },
    };
    setCachedRivalStatus(userId, tournamentId, result);
    return result;
  }

  if (aboveClose) {
    const rivalName = above!.username;
    const msg = gapAbove === 1 ? `אתה רק נקודה מתחת ל־${rivalName}` : `אתה רק ${gapAbove} נקודות מתחת ל־${rivalName}`;
    const result: RivalStatusResult = {
      message: msg,
      type: "rival_above",
      rival: { id: above!.userId, username: rivalName, rank: rank - 1, gap: gapAbove!, direction: "above" },
    };
    setCachedRivalStatus(userId, tournamentId, result);
    return result;
  }

  if (belowClose) {
    const rivalName = below!.username;
    const msg = gapBelow === 1 ? `${rivalName} רק נקודה מתחתיך` : `${rivalName} רק ${gapBelow} נקודות מתחתיך`;
    const result: RivalStatusResult = {
      message: msg,
      type: "rival_below",
      rival: { id: below!.userId, username: rivalName, rank: rank + 1, gap: gapBelow!, direction: "below" },
    };
    setCachedRivalStatus(userId, tournamentId, result);
    return result;
  }

  const result: RivalStatusResult = { message: "כל ניחוש טוב מקרב אותך בדירוג", type: "generic" };
  setCachedRivalStatus(userId, tournamentId, result);
  return result;
}

/** Phase 34 Step 3: Streak System – milestones 3,5,7,10,15,20. */
const STREAK_MILESTONES = [3, 5, 7, 10, 15, 20];
const STREAK_GAP_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const STREAK_WARNING_RECENT_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ParticipationStreakType = "active_streak" | "milestone_close" | "streak_warning" | "none";
export type ParticipationStreakResult = {
  streakCount: number;
  nextMilestone?: number;
  message: string;
  type: ParticipationStreakType;
};

const participationStreakCache = new Map<number, { result: ParticipationStreakResult; expiresAt: number }>();
const STREAK_CACHE_MS = 30_000;

function getCachedParticipationStreak(userId: number): ParticipationStreakResult | undefined {
  const entry = participationStreakCache.get(userId);
  if (!entry || Date.now() > entry.expiresAt) {
    participationStreakCache.delete(userId);
    return undefined;
  }
  return entry.result;
}

function setCachedParticipationStreak(userId: number, result: ParticipationStreakResult) {
  participationStreakCache.set(userId, { result, expiresAt: Date.now() + STREAK_CACHE_MS });
}

/** Phase 34 Step 3: Streak System – consecutive participation streak (cache 30s). */
export async function getParticipationStreak(userId: number): Promise<ParticipationStreakResult> {
  const cached = getCachedParticipationStreak(userId);
  if (cached !== undefined) return cached;

  const subs = await getSubmissionsByUserId(userId);
  const approved = subs.filter((s) => (s as { status?: string }).status === "approved");
  if (approved.length === 0) {
    const result: ParticipationStreakResult = { streakCount: 0, message: "", type: "none" };
    setCachedParticipationStreak(userId, result);
    return result;
  }

  const byTournament = new Map<number, number>();
  for (const s of approved) {
    const tid = (s as { tournamentId: number }).tournamentId;
    const ts = Math.max(
      toTimestamp((s as { approvedAt?: Date | null }).approvedAt) ?? 0,
      toTimestamp((s as { updatedAt?: Date | null }).updatedAt) ?? 0
    );
    const cur = byTournament.get(tid) ?? 0;
    if (ts > cur) byTournament.set(tid, ts);
  }
  const sorted = Array.from(byTournament.entries())
    .map(([tournamentId, ts]) => ({ tournamentId, ts }))
    .sort((a, b) => b.ts - a.ts);

  let streakCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      streakCount = 1;
      continue;
    }
    const gap = sorted[i - 1].ts - sorted[i].ts;
    if (gap <= STREAK_GAP_DAYS_MS) streakCount++;
    else break;
  }

  const nextMilestone = STREAK_MILESTONES.find((m) => m > streakCount);
  const oneAwayFromMilestone = nextMilestone != null && nextMilestone - streakCount === 1;
  const lastParticipationTs = sorted[0]?.ts ?? 0;
  const now = Date.now();
  const recentlyParticipated = now - lastParticipationTs <= STREAK_WARNING_RECENT_DAYS_MS;

  if (streakCount >= 2 && oneAwayFromMilestone) {
    const result: ParticipationStreakResult = {
      streakCount,
      nextMilestone: nextMilestone!,
      message: `עוד השתתפות אחת ואתה מגיע לרצף ${nextMilestone}`,
      type: "milestone_close",
    };
    setCachedParticipationStreak(userId, result);
    return result;
  }

  if (streakCount >= 2) {
    const result: ParticipationStreakResult = {
      streakCount,
      nextMilestone,
      message: streakCount >= 4 ? `אתה בכושר – ${streakCount} תחרויות ברצף` : `יש לך רצף של ${streakCount} השתתפויות`,
      type: "active_streak",
    };
    setCachedParticipationStreak(userId, result);
    return result;
  }

  if (streakCount === 1 && recentlyParticipated) {
    const result: ParticipationStreakResult = {
      streakCount: 1,
      nextMilestone: nextMilestone ?? 3,
      message: "אל תשבור את הרצף שלך",
      type: "streak_warning",
    };
    setCachedParticipationStreak(userId, result);
    return result;
  }

  const result: ParticipationStreakResult = { streakCount, nextMilestone, message: "", type: "none" };
  setCachedParticipationStreak(userId, result);
  return result;
}

/** Phase 34 Step 4: Drama / Position Change Engine – lightweight snapshot of last known rank per user+tournament. */
export type PositionDramaType = "move_up" | "move_down" | "entered_top" | "dropped_top" | "stable" | "none";
export type PositionDramaResult = {
  message: string;
  type: PositionDramaType;
  currentRank: number | null;
  previousRank: number | null;
  delta?: number;
};

const positionDramaResultCache = new Map<string, { result: PositionDramaResult; expiresAt: number }>();
const positionDramaResultCacheMs = 30_000;
const lastKnownRankCache = new Map<string, number>();

function getCachedPositionDrama(userId: number, tournamentId: number): PositionDramaResult | undefined {
  const key = `drama-${userId}-${tournamentId}`;
  const entry = positionDramaResultCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    positionDramaResultCache.delete(key);
    return undefined;
  }
  return entry.result;
}

function setCachedPositionDrama(userId: number, tournamentId: number, result: PositionDramaResult) {
  positionDramaResultCache.set(`drama-${userId}-${tournamentId}`, { result, expiresAt: Date.now() + positionDramaResultCacheMs });
}

/** Phase 34 Step 4: Drama Engine – position change vs last known rank (no persistent history). */
export async function getPositionDrama(userId: number, tournamentId: number): Promise<PositionDramaResult> {
  const cached = getCachedPositionDrama(userId, tournamentId);
  if (cached !== undefined) return cached;

  const sorted = await getLeaderboardRowsForRival(tournamentId);
  const idx = sorted?.findIndex((r) => r.userId === userId) ?? -1;
  const currentRank = idx >= 0 ? idx + 1 : null;

  const rankKey = `drama-rank-${userId}-${tournamentId}`;
  const previousRank = lastKnownRankCache.get(rankKey) ?? null;

  if (previousRank == null) {
    if (currentRank != null) lastKnownRankCache.set(rankKey, currentRank);
    const result: PositionDramaResult = { message: "", type: "none", currentRank, previousRank: null };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }

  if (currentRank == null) {
    const result: PositionDramaResult = { message: "", type: "none", currentRank: null, previousRank };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }

  const delta = previousRank - currentRank;
  lastKnownRankCache.set(rankKey, currentRank);

  if (delta === 0) {
    const result: PositionDramaResult = { message: "", type: "stable", currentRank, previousRank };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }

  const enteredTop3 = currentRank <= 3 && previousRank > 3;
  const enteredTop5 = currentRank <= 5 && previousRank > 5;
  const droppedTop3 = currentRank > 3 && previousRank <= 3;
  const droppedTop5 = currentRank > 5 && previousRank <= 5;

  if (enteredTop3) {
    const result: PositionDramaResult = {
      message: "נכנסת לטופ 3",
      type: "entered_top",
      currentRank,
      previousRank,
      delta,
    };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }
  if (enteredTop5) {
    const result: PositionDramaResult = {
      message: "נכנסת לטופ 5",
      type: "entered_top",
      currentRank,
      previousRank,
      delta,
    };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }
  if (droppedTop3) {
    const result: PositionDramaResult = {
      message: "יצאת מהטופ 3",
      type: "dropped_top",
      currentRank,
      previousRank,
      delta,
    };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }
  if (droppedTop5) {
    const result: PositionDramaResult = {
      message: "יצאת מהטופ 5",
      type: "dropped_top",
      currentRank,
      previousRank,
      delta,
    };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }
  if (delta > 0) {
    const result: PositionDramaResult = {
      message: `עלית למקום ${currentRank}`,
      type: "move_up",
      currentRank,
      previousRank,
      delta,
    };
    setCachedPositionDrama(userId, tournamentId, result);
    return result;
  }
  const result: PositionDramaResult = {
    message: currentRank <= 5 ? `ירדת למקום ${currentRank}` : "מישהו עקף אותך",
    type: "move_down",
    currentRank,
    previousRank,
    delta,
  };
  setCachedPositionDrama(userId, tournamentId, result);
  return result;
}

/** Phase 34 Step 5: Loss Aversion / FOMO – only when tournament joinable and user has NOT participated. */
export type LossAversionType = "closing_now" | "closing_today" | "social_fomo" | "momentum_risk" | "generic" | "none";
export type LossAversionResult = { message: string; type: LossAversionType };

const lossAversionCache = new Map<string, { result: LossAversionResult; expiresAt: number }>();
const LOSS_AVERSION_CACHE_MS = 30_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SOCIAL_FOMO_THRESHOLD = 15;

function getCachedLossAversion(userId: number, tournamentId: number): LossAversionResult | undefined {
  const key = `fomo-${userId}-${tournamentId}`;
  const entry = lossAversionCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    lossAversionCache.delete(key);
    return undefined;
  }
  return entry.result;
}

function setCachedLossAversion(userId: number, tournamentId: number, result: LossAversionResult) {
  lossAversionCache.set(`fomo-${userId}-${tournamentId}`, { result, expiresAt: Date.now() + LOSS_AVERSION_CACHE_MS });
}

function closesAtToMs(closesAt: Date | number | null | undefined): number | null {
  if (closesAt == null) return null;
  const t = closesAt instanceof Date ? closesAt.getTime() : Number(closesAt);
  return Number.isNaN(t) ? null : t;
}

export async function getLossAversionMessage(userId: number, tournamentId: number): Promise<LossAversionResult> {
  const cached = getCachedLossAversion(userId, tournamentId);
  if (cached !== undefined) return cached;

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    const result: LossAversionResult = { message: "", type: "none" };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  const status = (tournament as { status?: string }).status;
  if (!status || !["OPEN", "LOCKED"].includes(status)) {
    const result: LossAversionResult = { message: "", type: "none" };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  const userSubs = await getSubmissionsByUserAndTournament(userId, tournamentId);
  if (userSubs.length > 0) {
    const result: LossAversionResult = { message: "", type: "none" };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  const closesAtTs = closesAtToMs((tournament as { closesAt?: Date | number | null }).closesAt);
  const now = Date.now();
  const closesInMs = closesAtTs != null ? closesAtTs - now : null;

  if (closesInMs != null && closesInMs <= 0) {
    const result: LossAversionResult = { message: "", type: "none" };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  if (closesInMs != null && closesInMs <= ONE_HOUR_MS) {
    const result: LossAversionResult = {
      message: "נשאר פחות משעה להיכנס",
      type: "closing_now",
    };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  if (closesInMs != null && closesInMs <= ONE_DAY_MS) {
    const result: LossAversionResult = {
      message: "התחרות נסגרת היום",
      type: "closing_today",
    };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  const subs = await getSubmissionsByTournament(tournamentId);
  const participantCount = subs.length;
  if (participantCount >= SOCIAL_FOMO_THRESHOLD) {
    const result: LossAversionResult = {
      message: "אחרים כבר בפנים – אל תישאר בחוץ",
      type: "social_fomo",
    };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  const streak = await getParticipationStreak(userId);
  if (streak.streakCount >= 2) {
    const result: LossAversionResult = {
      message: "אל תפספס את ההזדמנות שלך",
      type: "momentum_risk",
    };
    setCachedLossAversion(userId, tournamentId, result);
    return result;
  }

  const result: LossAversionResult = {
    message: closesInMs != null ? "אם לא תשלח עכשיו, התחרות תיסגר" : "אל תפספס את ההזדמנות שלך",
    type: "generic",
  };
  setCachedLossAversion(userId, tournamentId, result);
  return result;
}

/** Phase 34 Step 6: Social Proof – public aggregate stats only, no private data. */
export type SocialProofSummary = {
  participantCount?: number;
  joinedToday?: number;
  weeklyParticipants?: number;
  recentWinners?: number;
  activeCompetitions?: number;
  freshLeaderboard?: boolean;
  message?: string;
};

const socialProofCache = new Map<string, { result: SocialProofSummary; expiresAt: number }>();
const SOCIAL_PROOF_CACHE_MS = 45_000;
const FRESH_LEADERBOARD_MS = 5 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const RECENT_WINNERS_DAYS_MS = 14 * ONE_DAY_MS;

function getCachedSocialProof(key: string): SocialProofSummary | undefined {
  const entry = socialProofCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    socialProofCache.delete(key);
    return undefined;
  }
  return entry.result;
}

function setCachedSocialProof(key: string, result: SocialProofSummary) {
  socialProofCache.set(key, { result, expiresAt: Date.now() + SOCIAL_PROOF_CACHE_MS });
}

function tsOf(v: Date | number | null | undefined): number {
  if (v == null) return 0;
  return v instanceof Date ? v.getTime() : Number(v);
}

/** Phase 34 Step 6: Social Proof – lightweight, deterministic, public-safe. */
export async function getSocialProofSummary(tournamentId?: number | null): Promise<SocialProofSummary> {
  const cacheKey = tournamentId != null ? `social-${tournamentId}` : "social-global";
  const cached = getCachedSocialProof(cacheKey);
  if (cached !== undefined) return cached;

  const now = Date.now();
  const weekAgo = now - ONE_WEEK_MS;
  const dayAgo = now - ONE_DAY_MS;

  if (tournamentId != null && tournamentId > 0) {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) {
      const result: SocialProofSummary = {};
      setCachedSocialProof(cacheKey, result);
      return result;
    }
    const subs = await getSubmissionsByTournament(tournamentId);
    const approved = subs.filter((s) => (s as { status?: string }).status === "approved");
    const participantCount = approved.length;
    const joinedToday = approved.filter((s) => tsOf((s as { createdAt?: Date | null }).createdAt) >= dayAgo).length;
    const weeklyParticipants = approved.filter((s) => tsOf((s as { createdAt?: Date | null }).createdAt) >= weekAgo).length;
    const lastUpdated = approved.length
      ? Math.max(...approved.map((s) => tsOf((s as { updatedAt?: Date | null }).updatedAt)))
      : 0;
    const freshLeaderboard = now - lastUpdated <= FRESH_LEADERBOARD_MS;
    const resultsFinalizedAt = (tournament as { resultsFinalizedAt?: Date | null }).resultsFinalizedAt;
    const freshByResults = resultsFinalizedAt != null && now - tsOf(resultsFinalizedAt) <= ONE_DAY_MS;

    let message: string | undefined;
    if (participantCount > 0 && weeklyParticipants > 0) {
      message = weeklyParticipants >= 2 ? `${weeklyParticipants} השתתפו השבוע` : "הטבלה מתעדכנת בזמן אמת";
    } else if (participantCount > 0) {
      message = "הטבלה מתעדכנת בזמן אמת";
    } else if (joinedToday > 0) {
      message = "הצטרפו היום " + joinedToday + " משתתפים";
    }

    const result: SocialProofSummary = {
      participantCount: participantCount || undefined,
      joinedToday: joinedToday || undefined,
      weeklyParticipants: weeklyParticipants || undefined,
      freshLeaderboard: freshLeaderboard || freshByResults,
      message: message || undefined,
    };
    setCachedSocialProof(cacheKey, result);
    return result;
  }

  const active = await getActiveTournaments();
  const activeCompetitions = active.length;
  const from = new Date(now - RECENT_WINNERS_DAYS_MS);
  const to = new Date();
  const records = await getFinancialRecords({ from, to });
  const recentWinners = records.reduce((sum, r) => sum + (r.winnersCount ?? 0), 0);

  let message: string | undefined;
  if (activeCompetitions > 0 && recentWinners > 0) {
    message = recentWinners >= 2 ? `${recentWinners} זוכים קיבלו פרסים לאחרונה` : "תחרויות פעילות – הצטרפו";
  } else if (activeCompetitions > 0) {
    message = activeCompetitions >= 2 ? `${activeCompetitions} תחרויות פעילות` : "תחרות פעילה";
  } else if (recentWinners > 0) {
    message = `${recentWinners} זוכים קיבלו פרסים לאחרונה`;
  }

  const result: SocialProofSummary = {
    activeCompetitions: activeCompetitions || undefined,
    recentWinners: recentWinners || undefined,
    message: message || undefined,
  };
  setCachedSocialProof(cacheKey, result);
  return result;
}
