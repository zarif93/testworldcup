/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - db uses dynamic schema (SQLite/MySQL) so union types cause false errors at compile time; runtime uses SQLite when DATABASE_URL is not set.
import { eq, and, desc, inArray, gte, lte, or, isNull, isNotNull, like, sql, notInArray } from "drizzle-orm";
import { ENV } from "./_core/env";
import { WORLD_CUP_2026_MATCHES } from "@shared/matchesData";

const USE_SQLITE = !process.env.DATABASE_URL;
export { USE_SQLITE };

let _db: Awaited<ReturnType<typeof initSqlite>> | Awaited<ReturnType<typeof initMysql>> | null = null;
let _dbInitError: unknown = null;
let _sqlite: import("better-sqlite3").Database | null = null;
let _schema: (typeof import("../drizzle/schema-sqlite")) | (typeof import("../drizzle/schema")) | null = null;

async function getSchema() {
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
  const t = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
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
  const sqlite = new Database(dbPath);
  const { users, tournaments, matches, submissions, agentCommissions, siteSettings, chanceDrawResults, lottoDrawResults, customFootballMatches, pointTransactions, pointTransferLog, adminAuditLog, financialRecords, financialTransparencyLog } = await import("../drizzle/schema-sqlite");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT, email TEXT, loginMethod TEXT, phone TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      username TEXT UNIQUE, passwordHash TEXT,
      agentId INTEGER, referralCode TEXT UNIQUE,
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
    CREATE TABLE IF NOT EXISTS custom_football_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournamentId INTEGER NOT NULL,
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
    ["description", "TEXT"],
    ["type", "TEXT"],
    ["startDate", "TEXT"],
    ["endDate", "TEXT"],
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
    ["opensAt", "INTEGER"],
    ["closesAt", "INTEGER"],
    ["entryCostPoints", "INTEGER"],
    ["houseFeeRate", "INTEGER"],
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
  sqlite.prepare("UPDATE tournaments SET status = 'OPEN' WHERE status IS NULL OR status = ''").run();
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

  const { leagues, results, settlement, ledgerTransactions, auditLogs } = await import("../drizzle/schema-sqlite");
  const db = drizzle(sqlite, { schema: { users, tournaments, matches, submissions, agentCommissions, siteSettings, chanceDrawResults, lottoDrawResults, customFootballMatches, pointTransactions, pointTransferLog, adminAuditLog, financialRecords, financialTransparencyLog, leagues, results, settlement, ledgerTransactions, auditLogs } });

  // עדכון רשימת המשחקים מהקבוע – מוחק את הקיימים ומכניס את 72 המשחקים המעודכנים (כולל דגלים)
  sqlite.prepare("DELETE FROM matches").run();
  for (const m of WORLD_CUP_2026_MATCHES) {
    sqlite.prepare(`
      INSERT INTO matches (matchNumber, homeTeam, awayTeam, groupName, matchDate, matchTime, stadium, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(m.matchNumber, m.homeTeam, m.awayTeam, m.group, m.date, m.time, m.stadium, m.city);
  }
  console.log("[DB] Synced 72 matches (World Cup 2026)");

  const tourCount = sqlite.prepare("SELECT COUNT(*) as c FROM tournaments").get() as { c: number };
  // לא מוסיפים טורנירים אוטומטית – האתר נשאר במצב שבו נסגר (אין seed בהפעלה)
  if (tourCount.c === 0) {
    console.log("[DB] No tournaments – add from admin panel");
  }

  _sqlite = sqlite;
  return db;
}


async function initMysql() {
  const { drizzle } = await import("drizzle-orm/mysql2");
  return drizzle(process.env.DATABASE_URL!);
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
  });
}

/** עדכון תפקיד משתמש (למנהלים) */
export async function updateUserRole(userId: number, role: "user" | "admin" | "agent") {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
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
  });
}

export async function getUserById(id: number) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0];
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
  if (isAdmin || cost <= 0) {
    const currentBalance = cost <= 0 ? 0 : await getUserPoints(userId);
    return { allowed: true, cost, currentBalance };
  }
  const currentBalance = await getUserPoints(userId);
  return { allowed: currentBalance >= cost, cost, currentBalance };
}

export type PointActionType = "deposit" | "withdraw" | "participation" | "prize" | "admin_approval" | "refund" | "agent_transfer";

/** מוסיף נקודות למשתמש ורושם לוג */
export async function addUserPoints(
  userId: number,
  amount: number,
  actionType: PointActionType,
  opts?: { performedBy?: number; referenceId?: number; description?: string; agentId?: number }
): Promise<void> {
  if (amount <= 0) return;
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

/** מפחית נקודות (רק אם היתרה לא תהפוך לשלילית). מחזיר true אם בוצע, false אם לא מספיק */
export async function deductUserPoints(
  userId: number,
  amount: number,
  actionType: PointActionType,
  opts?: { performedBy?: number; referenceId?: number; description?: string; commissionAgent?: number; commissionSite?: number; agentId?: number }
): Promise<boolean> {
  if (amount <= 0) return true;
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

/** חיוב נקודות + יצירת submission בטרנזקציה אחת עם נעילת שורת משתמש – מונע race condition ויתרה שלילית. */
export async function executeParticipationWithLock(params: {
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
}): Promise<{ success: true; submissionId: number; balanceAfter: number } | { success: false }> {
  const { users, pointTransactions, submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  try {
    const result = await db.transaction(async (tx) => {
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
      return { success: true as const, submissionId, balanceAfter };
    });
    return result;
  } catch {
    return { success: false };
  }
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

/** דוח רווח והפסד לשחקן – לפי טווח תאריכים. רווח=זכיות+החזרים, הפסד=השתתפויות. אופציונלי: סינון לפי סוג תחרות. */
export async function getPlayerPnL(
  userId: number,
  opts?: { from?: string; to?: string; tournamentType?: string }
): Promise<{ profit: number; loss: number; net: number; transactions: Array<{ id: number; createdAt: Date | null; actionType: string; amount: number; balanceAfter: number; kind: "profit" | "loss"; referenceId?: number | null }> }> {
  const rows = await getPointsHistory(userId, { limit: 5000, from: opts?.from, to: opts?.to });
  let tournamentIds: number[] | null = null;
  if (opts?.tournamentType) {
    const { tournaments } = await getSchema();
    const db = await getDb();
    if (db) {
      const list = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.type, opts.tournamentType));
      tournamentIds = list.map((r) => (r as { id: number }).id);
    }
  }
  let profit = 0;
  let loss = 0;
  const transactions: Array<{ id: number; createdAt: Date | null; actionType: string; amount: number; balanceAfter: number; kind: "profit" | "loss"; referenceId?: number | null }> = [];
  for (const r of rows) {
    const amount = (r as { amount: number }).amount ?? 0;
    const actionType = (r as { actionType: string }).actionType ?? "";
    const balanceAfter = (r as { balanceAfter: number }).balanceAfter ?? 0;
    const referenceId = (r as { referenceId?: number | null }).referenceId ?? null;
    const isTournamentRelated = actionType === "prize" || actionType === "refund" || actionType === "participation";
    const includeRow = !isTournamentRelated || !tournamentIds || (referenceId != null && tournamentIds.includes(referenceId));
    if (!includeRow) continue;
    if (actionType === "prize" || actionType === "refund") {
      profit += amount;
      transactions.push({ id: (r as { id: number }).id, createdAt: (r as { createdAt: Date | null }).createdAt ?? null, actionType, amount, balanceAfter, kind: "profit", referenceId });
    } else if (actionType === "participation") {
      const absAmount = Math.abs(amount);
      loss += absAmount;
      transactions.push({ id: (r as { id: number }).id, createdAt: (r as { createdAt: Date | null }).createdAt ?? null, actionType, amount: -absAmount, balanceAfter, kind: "loss", referenceId });
    }
  }
  return { profit, loss, net: profit - loss, transactions };
}

function displayNameFromUser(u: unknown, fallbackId?: number): string {
  const name = (u as { name?: string | null })?.name ?? null;
  const username = (u as { username?: string | null })?.username ?? null;
  return (name && String(name).trim()) || (username && String(username).trim()) || (fallbackId != null ? `#${fallbackId}` : "—");
}

export type AdminPnLReportRow = {
  id: number;
  createdAt: Date | null;
  actionType: string;
  playerId: number | null;
  playerName: string | null;
  agentId: number | null;
  agentName: string | null;
  tournamentId: number | null;
  tournamentName: string | null;
  tournamentType: string | null;
  participationAmount: number;
  prizeAmount: number;
  siteCommission: number;
  agentCommission: number;
  pointsDelta: number;
  balanceAfter: number;
};

export async function getAdminPnLReportRows(opts?: {
  from?: string;
  to?: string;
  tournamentType?: string;
  playerId?: number;
  agentId?: number;
  limit?: number;
}): Promise<AdminPnLReportRow[]> {
  const { pointTransactions, users, tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const limit = opts?.limit ?? 2000;

  const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lte>> = [];
  if (opts?.playerId != null) conditions.push(eq(pointTransactions.userId, opts.playerId));
  if (opts?.from) conditions.push(gte(pointTransactions.createdAt, new Date(opts.from)));
  if (opts?.to) {
    const toEnd = new Date(opts.to);
    toEnd.setHours(23, 59, 59, 999);
    conditions.push(lte(pointTransactions.createdAt, toEnd));
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const rows = whereClause
    ? await db.select().from(pointTransactions).where(whereClause).orderBy(desc(pointTransactions.createdAt)).limit(limit)
    : await db.select().from(pointTransactions).orderBy(desc(pointTransactions.createdAt)).limit(limit);

  const userIds = new Set<number>();
  const tournamentIds = new Set<number>();
  for (const r of rows) {
    const uid = (r as { userId?: number }).userId;
    if (typeof uid === "number") userIds.add(uid);
    const agentId = (r as { agentId?: number | null }).agentId;
    if (typeof agentId === "number") userIds.add(agentId);
    const ref = (r as { referenceId?: number | null }).referenceId;
    const actionType = (r as { actionType?: string }).actionType ?? "";
    // referenceId is tournamentId for tournament-related actions; for agent_transfer it is counterparty userId
    if (typeof ref === "number" && ["participation", "prize", "refund"].includes(actionType)) tournamentIds.add(ref);
    if (actionType === "agent_transfer" && typeof ref === "number") userIds.add(ref);
  }

  const usersRows = userIds.size
    ? await db.select().from(users).where(inArray(users.id, Array.from(userIds)))
    : [];
  const userMap = new Map<number, unknown>();
  for (const u of usersRows) userMap.set((u as { id: number }).id, u);

  const tournamentRows = tournamentIds.size
    ? await db.select().from(tournaments).where(inArray(tournaments.id, Array.from(tournamentIds)))
    : [];
  const tournamentMap = new Map<number, unknown>();
  for (const t of tournamentRows) tournamentMap.set((t as { id: number }).id, t);

  const out: AdminPnLReportRow[] = [];
  for (const r of rows) {
    const actionType = (r as { actionType?: string }).actionType ?? "";
    const amount = Number((r as { amount?: number }).amount ?? 0);
    const balanceAfter = Number((r as { balanceAfter?: number }).balanceAfter ?? 0);
    const referenceId = (r as { referenceId?: number | null }).referenceId ?? null;
    const baseUserId = Number((r as { userId?: number }).userId ?? 0);
    const baseUser = userMap.get(baseUserId);
    const baseRole = (baseUser as { role?: string })?.role ?? "user";

    const tournamentId = referenceId != null && ["participation", "prize", "refund"].includes(actionType) ? referenceId : null;
    const tournament = tournamentId != null ? tournamentMap.get(tournamentId) : undefined;
    const tournamentType = tournament ? ((tournament as { type?: string | null }).type ?? null) : null;
    if (opts?.tournamentType && tournamentType !== opts.tournamentType) continue;

    // Derive player/agent for transfers and for tournament-related actions
    const rowAgentIdRaw = (r as { agentId?: number | null }).agentId ?? null;
    const derivedPlayerId =
      actionType === "agent_transfer" && baseRole === "agent"
        ? (typeof referenceId === "number" ? referenceId : null)
        : baseRole === "user"
          ? baseUserId
          : null;
    const derivedAgentId =
      actionType === "agent_transfer" && baseRole === "agent"
        ? baseUserId
        : actionType === "agent_transfer" && baseRole === "user"
          ? (typeof referenceId === "number" ? referenceId : null)
          : baseRole === "user"
            ? (rowAgentIdRaw ?? null)
            : null;

    if (opts?.agentId != null && derivedAgentId !== opts.agentId) continue;

    const playerUser = derivedPlayerId != null ? userMap.get(derivedPlayerId) : null;
    const agentUser = derivedAgentId != null ? userMap.get(derivedAgentId) : null;

    const participationAmount = actionType === "participation" ? Math.abs(amount) : 0;
    const prizeAmount = actionType === "prize" || actionType === "refund" ? amount : 0;
    const siteCommission = Number((r as { commissionSite?: number | null }).commissionSite ?? 0);
    const agentCommission = Number((r as { commissionAgent?: number | null }).commissionAgent ?? 0);

    out.push({
      id: Number((r as { id?: number }).id ?? 0),
      createdAt: (r as { createdAt?: Date | null }).createdAt ?? null,
      actionType,
      playerId: derivedPlayerId,
      playerName: derivedPlayerId != null ? displayNameFromUser(playerUser, derivedPlayerId) : null,
      agentId: derivedAgentId,
      agentName: derivedAgentId != null ? displayNameFromUser(agentUser, derivedAgentId) : null,
      tournamentId,
      tournamentName: tournament ? ((tournament as { name?: string | null }).name ?? null) : null,
      tournamentType,
      participationAmount,
      prizeAmount,
      siteCommission,
      agentCommission,
      pointsDelta: amount,
      balanceAfter,
    });
  }
  return out;
}

export type AgentPnLReportRow = {
  id: number;
  createdAt: Date | null;
  playerId: number | null;
  playerName: string | null;
  tournamentType: string | null;
  participationAmount: number;
  agentCommission: number;
  pointsDelta: number;
  agentBalanceAfter: number;
};

export async function getAgentPnLReportRows(
  agentId: number,
  opts?: { from?: string; to?: string; tournamentType?: string; playerId?: number; limit?: number }
): Promise<AgentPnLReportRow[]> {
  const { pointTransactions, users, tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const limit = opts?.limit ?? 2000;

  // Agent wallet movements (real balanceAfter exists here)
  const agentTxConditions: Array<ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lte>> = [
    eq(pointTransactions.userId, agentId),
  ];
  if (opts?.from) agentTxConditions.push(gte(pointTransactions.createdAt, new Date(opts.from)));
  if (opts?.to) {
    const toEnd = new Date(opts.to);
    toEnd.setHours(23, 59, 59, 999);
    agentTxConditions.push(lte(pointTransactions.createdAt, toEnd));
  }
  const agentTx = await db
    .select()
    .from(pointTransactions)
    .where(and(...agentTxConditions))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);

  const agentBalanceTimeline = agentTx
    .map((r) => ({
      at: ((r as { createdAt?: Date | null }).createdAt ?? null) as Date | null,
      balanceAfter: Number((r as { balanceAfter?: number }).balanceAfter ?? 0),
    }))
    .filter((x) => x.at != null)
    .sort((a, b) => (a.at ? a.at.getTime() : 0) - (b.at ? b.at.getTime() : 0));

  const getBalanceAt = (d: Date | null): number => {
    if (!d) return 0;
    // find last <= d (timeline is small; linear scan is OK)
    let last = agentBalanceTimeline[0]?.balanceAfter ?? 0;
    for (const x of agentBalanceTimeline) {
      if (!x.at) continue;
      if (x.at.getTime() <= d.getTime()) last = x.balanceAfter;
      else break;
    }
    return last;
  };

  // Commission rows: derived from player participation rows where agentId is set
  const commissionConditions: Array<ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lte>> = [
    eq(pointTransactions.actionType, "participation"),
    eq(pointTransactions.agentId, agentId),
  ];
  if (opts?.playerId != null) commissionConditions.push(eq(pointTransactions.userId, opts.playerId));
  if (opts?.from) commissionConditions.push(gte(pointTransactions.createdAt, new Date(opts.from)));
  if (opts?.to) {
    const toEnd = new Date(opts.to);
    toEnd.setHours(23, 59, 59, 999);
    commissionConditions.push(lte(pointTransactions.createdAt, toEnd));
  }
  const commissionRows = await db
    .select()
    .from(pointTransactions)
    .where(and(...commissionConditions))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);

  const userIds = new Set<number>();
  const tournamentIds = new Set<number>();
  for (const r of commissionRows) {
    const uid = (r as { userId?: number }).userId;
    if (typeof uid === "number") userIds.add(uid);
    const ref = (r as { referenceId?: number | null }).referenceId;
    if (typeof ref === "number") tournamentIds.add(ref);
  }
  for (const r of agentTx) {
    const ref = (r as { referenceId?: number | null }).referenceId;
    const actionType = (r as { actionType?: string }).actionType ?? "";
    if (actionType === "agent_transfer" && typeof ref === "number") userIds.add(ref);
  }

  const usersRows = userIds.size
    ? await db.select().from(users).where(inArray(users.id, Array.from(userIds)))
    : [];
  const userMap = new Map<number, unknown>();
  for (const u of usersRows) userMap.set((u as { id: number }).id, u);

  const tournamentRows = tournamentIds.size
    ? await db.select().from(tournaments).where(inArray(tournaments.id, Array.from(tournamentIds)))
    : [];
  const tournamentMap = new Map<number, unknown>();
  for (const t of tournamentRows) tournamentMap.set((t as { id: number }).id, t);

  const out: AgentPnLReportRow[] = [];

  for (const r of commissionRows) {
    const createdAt = (r as { createdAt?: Date | null }).createdAt ?? null;
    const tournamentId = (r as { referenceId?: number | null }).referenceId ?? null;
    const tournament = tournamentId != null ? tournamentMap.get(tournamentId) : undefined;
    const tournamentType = tournament ? ((tournament as { type?: string | null }).type ?? null) : null;
    if (opts?.tournamentType && tournamentType !== opts.tournamentType) continue;
    const playerId = Number((r as { userId?: number }).userId ?? 0);
    const player = userMap.get(playerId);
    out.push({
      id: Number((r as { id?: number }).id ?? 0),
      createdAt,
      playerId,
      playerName: displayNameFromUser(player, playerId),
      tournamentType,
      participationAmount: Math.abs(Number((r as { amount?: number }).amount ?? 0)),
      agentCommission: Number((r as { commissionAgent?: number | null }).commissionAgent ?? 0),
      pointsDelta: 0,
      agentBalanceAfter: getBalanceAt(createdAt),
    });
  }

  for (const r of agentTx) {
    const actionType = (r as { actionType?: string }).actionType ?? "";
    const createdAt = (r as { createdAt?: Date | null }).createdAt ?? null;
    const amount = Number((r as { amount?: number }).amount ?? 0);
    const balanceAfter = Number((r as { balanceAfter?: number }).balanceAfter ?? 0);
    const ref = (r as { referenceId?: number | null }).referenceId ?? null;
    const playerId = actionType === "agent_transfer" && typeof ref === "number" ? ref : null;
    const player = playerId != null ? userMap.get(playerId) : null;
    out.push({
      id: Number((r as { id?: number }).id ?? 0) + 10_000_000,
      createdAt,
      playerId,
      playerName: playerId != null ? displayNameFromUser(player, playerId) : null,
      tournamentType: null,
      participationAmount: 0,
      agentCommission: 0,
      pointsDelta: amount,
      agentBalanceAfter: balanceAfter,
    });
  }

  out.sort((a, b) => (b.createdAt ? b.createdAt.getTime() : 0) - (a.createdAt ? a.createdAt.getTime() : 0));
  return out;
}

/** הפקדות סוכן לשחקנים בטווח תאריכים – להפסד בדוח רווח/הפסד. מחזיר גם שם שחקן. */
async function getAgentDepositsToPlayersInRange(
  agentId: number,
  opts?: { from?: string; to?: string }
): Promise<{ total: number; rows: Array<{ id: number; createdAt: Date | null; amount: number; toUserId: number; playerName: string | null; playerUsername: string | null }> }> {
  const { pointTransferLog, users } = await getSchema();
  const db = await getDb();
  if (!db) return { total: 0, rows: [] };
  const conditions = [eq(pointTransferLog.fromUserId, agentId), eq(pointTransferLog.type, "DEPOSIT")];
  if (opts?.from) conditions.push(gte(pointTransferLog.createdAt, new Date(opts.from)));
  if (opts?.to) {
    const toEnd = new Date(opts.to);
    toEnd.setHours(23, 59, 59, 999);
    conditions.push(lte(pointTransferLog.createdAt, toEnd));
  }
  const rows = await db
    .select({
      id: pointTransferLog.id,
      createdAt: pointTransferLog.createdAt,
      amount: pointTransferLog.amount,
      toUserId: pointTransferLog.toUserId,
      playerName: users.name,
      playerUsername: users.username,
    })
    .from(pointTransferLog)
    .innerJoin(users, eq(pointTransferLog.toUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(pointTransferLog.createdAt));
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt ?? null,
      amount: r.amount ?? 0,
      toUserId: r.toUserId ?? 0,
      playerName: r.playerName ?? null,
      playerUsername: r.playerUsername ?? null,
    })),
  };
}

/** דוח רווח והפסד לסוכן – רווח=עמלות, הפסד=הפקדות לשחקנים. כולל תאריך, שחקן, סוג פעולה, סכום, תחרות, מאזן לאחר הפעולה. */
export async function getAgentPnL(
  agentId: number,
  opts?: { from?: string; to?: string; tournamentType?: string }
): Promise<{
  profit: number;
  loss: number;
  net: number;
  transactions: Array<{
    id: number;
    date: Date | null;
    type: "COMMISSION" | "DEPOSIT" | "PRIZE";
    amount: number;
    description?: string;
    submissionId?: number;
    userId?: number;
    playerName: string | null;
    tournamentName: string | null;
    tournamentId?: number;
    balanceAfter: number;
  }>;
}> {
  const { rows: commissionRows, totalCommission } = await getAgentCommissionsByAgentIdWithDateRange(agentId, { from: opts?.from, to: opts?.to, limit: 5000, tournamentType: opts?.tournamentType });
  const { total: depositTotal, rows: depositRows } = await getAgentDepositsToPlayersInRange(agentId, opts);
  const profit = totalCommission;
  const loss = depositTotal;
  type Row = { id: number; date: Date | null; type: "COMMISSION" | "DEPOSIT" | "PRIZE"; amount: number; description?: string; submissionId?: number; userId?: number; playerName: string | null; tournamentName: string | null; tournamentId?: number };
  const rows: Row[] = [];
  for (const r of commissionRows) {
    rows.push({
      id: r.id,
      date: r.createdAt ?? null,
      type: "COMMISSION",
      amount: r.commissionAmount ?? 0,
      description: `עמלה טופס #${r.submissionId}`,
      submissionId: r.submissionId ?? undefined,
      userId: r.userId ?? undefined,
      playerName: (r.name ?? r.username ?? null) as string | null,
      tournamentName: (r as { tournamentName?: string | null }).tournamentName ?? null,
      tournamentId: (r as { tournamentId?: number }).tournamentId,
    });
  }
  for (const r of depositRows) {
    rows.push({
      id: r.id + 1000000,
      date: r.createdAt,
      type: "DEPOSIT",
      amount: -r.amount,
      description: `הפקדה לשחקן`,
      playerName: r.playerName ?? r.playerUsername ?? null,
      tournamentName: null,
    });
  }
  const playerIds = await getUsersByAgentId(agentId).then((list) => list.map((u) => u.id));
  if (playerIds.length > 0 && opts) {
    const { pointTransactions, users, tournaments } = await getSchema();
    const db = await getDb();
    if (db) {
      const prizeCond = [inArray(pointTransactions.userId, playerIds), eq(pointTransactions.actionType, "prize")];
      if (opts.from) prizeCond.push(gte(pointTransactions.createdAt, new Date(opts.from)));
      if (opts.to) {
        const toEnd = new Date(opts.to);
        toEnd.setHours(23, 59, 59, 999);
        prizeCond.push(lte(pointTransactions.createdAt, toEnd));
      }
      const prizeRows = await db
        .select({
          id: pointTransactions.id,
          createdAt: pointTransactions.createdAt,
          amount: pointTransactions.amount,
          userId: pointTransactions.userId,
          referenceId: pointTransactions.referenceId,
          name: users.name,
          username: users.username,
          tournamentName: tournaments.name,
        })
        .from(pointTransactions)
        .innerJoin(users, eq(pointTransactions.userId, users.id))
        .leftJoin(tournaments, eq(pointTransactions.referenceId, tournaments.id))
        .where(and(...prizeCond))
        .orderBy(desc(pointTransactions.createdAt))
        .limit(1000);
      for (const p of prizeRows) {
        rows.push({
          id: (p as { id: number }).id + 2000000,
          date: (p as { createdAt?: Date | null }).createdAt ?? null,
          type: "PRIZE",
          amount: (p as { amount: number }).amount ?? 0,
          description: "זכייה בתחרות",
          userId: (p as { userId: number }).userId,
          playerName: ((p as { name?: string | null }).name ?? (p as { username?: string | null }).username ?? null) as string | null,
          tournamentName: (p as { tournamentName?: string | null }).tournamentName ?? null,
          tournamentId: (p as { referenceId?: number | null }).referenceId ?? undefined,
        });
      }
    }
  }
  rows.sort((a, b) => (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0));
  let running = 0;
  const withBalance: Array<Row & { balanceAfter: number }> = [];
  for (const r of rows) {
    if (r.type === "COMMISSION") running += r.amount;
    else if (r.type === "DEPOSIT") running += r.amount;
    withBalance.push({ ...r, balanceAfter: running });
  }
  withBalance.reverse();
  return {
    profit,
    loss,
    net: profit - loss,
    transactions: withBalance,
  };
}

/** דוח רווח והפסד לכל שחקן של סוכן – לטבלה בדף סוכן. אופציונלי: סינון לפי סוג תחרות. */
export async function getAgentPlayersPnL(
  agentId: number,
  opts?: { from?: string; to?: string; tournamentType?: string }
): Promise<Array<{ playerId: number; username: string | null; name: string | null; profit: number; loss: number; net: number }>> {
  const players = await getMyPlayersWithBalances(agentId);
  const result: Array<{ playerId: number; username: string | null; name: string | null; profit: number; loss: number; net: number }> = [];
  for (const p of players) {
    const pnl = await getPlayerPnL(p.id, opts);
    result.push({
      playerId: p.id,
      username: p.username ?? null,
      name: p.name ?? null,
      profit: pnl.profit,
      loss: pnl.loss,
      net: pnl.net,
    });
  }
  return result;
}

/** סיכום דוח רווח והפסד למנהל – כל השחקנים וכל הסוכנים בטווח. אופציונלי: סינון לפי סוג תחרות. */
export async function getAdminPnLSummary(opts?: { from?: string; to?: string; tournamentType?: string }): Promise<{
  totalPlayersProfit: number;
  totalPlayersLoss: number;
  totalAgentsProfit: number;
  totalAgentsLoss: number;
  totalNet: number;
  agents: Array<{ id: number; username: string | null; name: string | null; profit: number; loss: number; net: number }>;
  playersByAgent: Array<{ agentId: number; agentName: string; players: Array<{ playerId: number; username: string | null; name: string | null; profit: number; loss: number; net: number }> }>;
}> {
  const { pointTransactions, agentCommissions, pointTransferLog, users, submissions, tournaments } = await getSchema();
  const db = await getDb();
  if (!db) {
    return {
      totalPlayersProfit: 0,
      totalPlayersLoss: 0,
      totalAgentsProfit: 0,
      totalAgentsLoss: 0,
      totalNet: 0,
      agents: [],
      playersByAgent: [],
    };
  }
  const condFrom = opts?.from ? gte(pointTransactions.createdAt, new Date(opts.from)) : undefined;
  const toEnd = opts?.to ? (() => { const d = new Date(opts.to); d.setHours(23, 59, 59, 999); return d; })() : undefined;
  const condTo = opts?.to ? lte(pointTransactions.createdAt, toEnd) : undefined;
  let tournamentIds: number[] = [];
  if (opts?.tournamentType) {
    const { tournaments } = await getSchema();
    const list = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.type, opts.tournamentType));
    tournamentIds = list.map((r) => (r as { id: number }).id);
  }
  const ptConditions = [eq(pointTransactions.actionType, "prize")];
  if (condFrom) ptConditions.push(condFrom);
  if (condTo) ptConditions.push(condTo);
  const prizeRows = await db.select({ userId: pointTransactions.userId, amount: pointTransactions.amount, referenceId: pointTransactions.referenceId }).from(pointTransactions).where(and(...ptConditions));
  const refundConditions = [eq(pointTransactions.actionType, "refund")];
  if (condFrom) refundConditions.push(condFrom);
  if (condTo) refundConditions.push(condTo);
  const refundRows = await db.select({ userId: pointTransactions.userId, amount: pointTransactions.amount, referenceId: pointTransactions.referenceId }).from(pointTransactions).where(and(...refundConditions));
  const partConditions = [eq(pointTransactions.actionType, "participation")];
  if (condFrom) partConditions.push(condFrom);
  if (condTo) partConditions.push(condTo);
  const partRows = await db.select({ userId: pointTransactions.userId, amount: pointTransactions.amount, referenceId: pointTransactions.referenceId }).from(pointTransactions).where(and(...partConditions));
  let totalPlayersProfit = 0;
  let totalPlayersLoss = 0;
  const userRoleMap = new Map<number, string>();
  const allUsers = await db.select({ id: users.id, role: users.role }).from(users);
  for (const u of allUsers) userRoleMap.set((u as { id: number }).id, (u as { role: string }).role ?? "user");
  const playerProfitByUser = new Map<number, number>();
  const playerLossByUser = new Map<number, number>();
  const includeByRef = (refId: number | null) => tournamentIds.length === 0 || (refId != null && tournamentIds.includes(refId));
  for (const r of prizeRows) {
    const uid = (r as { userId: number }).userId;
    if (userRoleMap.get(uid) === "user" && includeByRef((r as { referenceId: number | null }).referenceId ?? null)) {
      const amt = (r as { amount: number }).amount ?? 0;
      totalPlayersProfit += amt;
      playerProfitByUser.set(uid, (playerProfitByUser.get(uid) ?? 0) + amt);
    }
  }
  for (const r of refundRows) {
    const uid = (r as { userId: number }).userId;
    if (userRoleMap.get(uid) === "user" && includeByRef((r as { referenceId: number | null }).referenceId ?? null)) {
      const amt = (r as { amount: number }).amount ?? 0;
      totalPlayersProfit += amt;
      playerProfitByUser.set(uid, (playerProfitByUser.get(uid) ?? 0) + amt);
    }
  }
  for (const r of partRows) {
    const uid = (r as { userId: number }).userId;
    if (userRoleMap.get(uid) === "user" && includeByRef((r as { referenceId: number | null }).referenceId ?? null)) {
      const amt = Math.abs((r as { amount: number }).amount ?? 0);
      totalPlayersLoss += amt;
      playerLossByUser.set(uid, (playerLossByUser.get(uid) ?? 0) + amt);
    }
  }
  const agents = await getAgents();
  const acConditions = [];
  if (opts?.from) acConditions.push(gte(agentCommissions.createdAt, new Date(opts.from)));
  if (opts?.to) {
    const toEndAc = new Date(opts.to);
    toEndAc.setHours(23, 59, 59, 999);
    acConditions.push(lte(agentCommissions.createdAt, toEndAc));
  }
  const commissionRows = opts?.tournamentType
    ? await db
        .select({ agentId: agentCommissions.agentId, amount: agentCommissions.commissionAmount })
        .from(agentCommissions)
        .innerJoin(submissions, eq(agentCommissions.submissionId, submissions.id))
        .innerJoin(tournaments, eq(submissions.tournamentId, tournaments.id))
        .where(and(...acConditions, eq(tournaments.type, opts.tournamentType)))
    : acConditions.length > 0
      ? await db.select({ agentId: agentCommissions.agentId, amount: agentCommissions.commissionAmount }).from(agentCommissions).where(and(...acConditions))
      : await db.select({ agentId: agentCommissions.agentId, amount: agentCommissions.commissionAmount }).from(agentCommissions);
  const totalAgentsProfit = commissionRows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const ptlConditions = [eq(pointTransferLog.type, "DEPOSIT")];
  if (opts?.from) ptlConditions.push(gte(pointTransferLog.createdAt, new Date(opts.from)));
  if (opts?.to) ptlConditions.push(lte(pointTransferLog.createdAt, toEnd!));
  const depositRows = await db.select({ fromUserId: pointTransferLog.fromUserId, amount: pointTransferLog.amount }).from(pointTransferLog).where(and(...ptlConditions));
  const agentLossByUser = new Map<number, number>();
  let totalAgentsLoss = 0;
  for (const r of depositRows) {
    const fromId = (r as { fromUserId: number | null }).fromUserId;
    if (fromId != null && userRoleMap.get(fromId) === "agent") {
      const amt = (r as { amount: number }).amount ?? 0;
      totalAgentsLoss += amt;
      agentLossByUser.set(fromId, (agentLossByUser.get(fromId) ?? 0) + amt);
    }
  }
  const commissionByAgent = new Map<number, number>();
  for (const r of commissionRows) {
    const aid = (r as { agentId: number }).agentId;
    commissionByAgent.set(aid, (commissionByAgent.get(aid) ?? 0) + (r.amount ?? 0));
  }
  const agentsList: Array<{ id: number; username: string | null; name: string | null; profit: number; loss: number; net: number }> = [];
  for (const a of agents) {
    const id = (a as { id: number }).id;
    const profit = commissionByAgent.get(id) ?? 0;
    const loss = agentLossByUser.get(id) ?? 0;
    agentsList.push({
      id,
      username: (a as { username?: string | null }).username ?? null,
      name: (a as { name?: string | null }).name ?? null,
      profit,
      loss,
      net: profit - loss,
    });
  }
  const playersByAgent: Array<{ agentId: number; agentName: string; players: Array<{ playerId: number; username: string | null; name: string | null; profit: number; loss: number; net: number }> }> = [];
  for (const a of agents) {
    const aid = (a as { id: number }).id;
    const players = await getAgentPlayersPnL(aid, opts);
    playersByAgent.push({
      agentId: aid,
      agentName: (a as { name?: string | null }).name ?? (a as { username?: string | null }).username ?? `#${aid}`,
      players: players.map((p) => ({ playerId: p.playerId, username: p.username, name: p.name, profit: p.profit, loss: p.loss, net: p.net })),
    });
  }
  return {
    totalPlayersProfit,
    totalPlayersLoss,
    totalAgentsProfit,
    totalAgentsLoss,
    totalNet: totalPlayersProfit - totalPlayersLoss + totalAgentsProfit - totalAgentsLoss,
    agents: agentsList,
    playersByAgent,
  };
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

const SUPER_ADMIN_POINTS = 999999999;

/** ניקוי מלא של האתר – מוחק את כל הנתונים ומשאיר רק סופר מנהל (Yoven! / Yoven).
 * 1. מחיקת משתמשים: כל השחקנים (user) וכל הסוכנים (agent) – נשארים רק מנהלים ששמם ב-SUPER_ADMIN_USERNAMES.
 * 2. מחיקת תחרויות: טורנירים, טפסים, תוצאות הגרלות (צ'אנס, לוטו, כדורגל מותאם), משחקי מונדיאל.
 * 3. מחיקת נקודות והיסטוריה: point_transactions, point_transfer_log, עמלות, דוחות כספיים, audit.
 * 4. איפוס דוחות: עמלות, מאזנים – הכל נמחק עם הטבלאות לעיל.
 * 5. סופר מנהל שנשאר מקבל points=999999999 (בפועל אינסוף), deletedAt=NULL, isBlocked=0.
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
        sqlite.prepare("UPDATE users SET points = ?, updatedAt = ?, deletedAt = NULL, isBlocked = 0, agentId = NULL WHERE id = ?").run(SUPER_ADMIN_POINTS, now, id);
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
  const prizePool = Math.round(subs.length * tournament.amount * 0.875);
  const tType = (tournament as { type?: string }).type ?? "football";

  let winnerSubmissions: typeof subs;
  if (tType === "chance") {
    const maxPoints = subs.length ? Math.max(...subs.map((s) => s.points)) : 0;
    winnerSubmissions = maxPoints > 0 ? subs.filter((s) => s.points === maxPoints) : [];
  } else if (tType === "lotto") {
    // בלוטו הדירוג והפרסים מתבססים על הניקוד הכולל:
    // נקודה לכל מספר רגיל שנפגע + נקודה נוספת לפגיעה במספר החזק.
    const lottoScore = (s: { points: number }) => s.points;
    const maxScore = subs.length ? Math.max(...subs.map(lottoScore)) : 0;
    winnerSubmissions = maxScore > 0 ? subs.filter((s) => lottoScore(s) === maxScore) : [];
  } else {
    const maxPoints = subs.length ? Math.max(...subs.map((s) => s.points), 0) : 0;
    winnerSubmissions = maxPoints > 0 ? subs.filter((s) => s.points === maxPoints) : [];
  }

  const winnerCount = winnerSubmissions.length;
  const prizePerWinner = winnerCount > 0 ? Math.floor(prizePool / winnerCount) : 0;
  const distributed = prizePerWinner * winnerCount;
  const tournamentName = (tournament as { name?: string }).name ?? String(tournamentId);
  const winnerSubIds = new Set(winnerSubmissions.map((s) => s.id));

  for (const sub of winnerSubmissions) {
    if (prizePerWinner > 0) {
      await addUserPoints(sub.userId, prizePerWinner, "prize", {
        referenceId: tournamentId,
        description: `זכייה בתחרות: ${tournamentName}`,
      });
      await insertTransparencyLog({
        competitionId: tournamentId,
        competitionName: tournamentName,
        userId: sub.userId,
        username: sub.username ?? `#${sub.userId}`,
        type: "Prize",
        amount: prizePerWinner,
        siteProfit: 0,
        agentProfit: 0,
        transactionDate: new Date(),
        competitionStatusAtTime: "PRIZES_DISTRIBUTED",
      });
    }
  }
  const participantCount = subs.length;
  const totalParticipation = participantCount * tournament.amount;
  const fee = Math.round(totalParticipation * (12.5 / 100));
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
    netProfit: fee,
    participantsCount: participantCount,
    winnersCount: winnerCount,
    closedAt,
    participantSnapshot: {
      participants: subs.map((s) => ({
        submissionId: s.id,
        userId: s.userId,
        username: s.username ?? `#${s.userId}`,
        amountPaid: tournament.amount,
        prizeWon: winnerSubIds.has(s.id) ? prizePerWinner : 0,
      })),
    },
  });
  await db.update(tournaments).set({
    status: "ARCHIVED",
    visibility: "HIDDEN",
    archivedAt: closedAt,
    dataCleanedAt: closedAt,
  } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
  return { winnerCount, prizePerWinner, distributed, winnerIds: winnerSubmissions.map((s) => s.userId) };
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
        const now = new Date();
        await db.update(tournaments).set({
          status: "ARCHIVED",
          visibility: "HIDDEN",
          archivedAt: now,
          dataCleanedAt: now,
        } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
        recovered.push(tournamentId);
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

/** בדיקת יושרה כספית: Total Entry Points = Total Payouts + System Balance. אם יש סטייה – מחזיר פרטים ללוג. */
export async function runFinancialIntegrityCheck(): Promise<{
  totalEntryPoints: number;
  totalPayouts: number;
  systemBalance: number;
  delta: number;
  ok: boolean;
}> {
  const { users, pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) return { totalEntryPoints: 0, totalPayouts: 0, systemBalance: 0, delta: 0, ok: true };
  const partRows = await db
    .select({ s: sql<number>`coalesce(sum(abs(${pointTransactions.amount})), 0)` })
    .from(pointTransactions)
    .where(eq(pointTransactions.actionType, "participation"));
  const prizeRows = await db
    .select({ s: sql<number>`coalesce(sum(${pointTransactions.amount}), 0)` })
    .from(pointTransactions)
    .where(eq(pointTransactions.actionType, "prize"));
  const balanceRows = await db.select({ s: sql<number>`coalesce(sum(${users.points}), 0)` }).from(users);
  const totalEntryPoints = Number(partRows[0]?.s ?? 0);
  const totalPayouts = Number(prizeRows[0]?.s ?? 0);
  const systemBalance = Number(balanceRows[0]?.s ?? 0);
  const delta = totalEntryPoints - totalPayouts - systemBalance;
  const ok = Math.abs(delta) < 1;
  return { totalEntryPoints, totalPayouts, systemBalance, delta, ok };
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

/** עדכון שיוך שחקן לסוכן (מנהל בלבד). agentId = null להסרת שיוך. */
export async function updateUserAgentId(playerId: number, agentId: number | null): Promise<void> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(users).set({ agentId, updatedAt: new Date() }).where(eq(users.id, playerId));
}

/** רישום עמלה לסוכן כשטופס מאושר */
export async function recordAgentCommission(data: {
  agentId: number;
  submissionId: number;
  userId: number;
  entryAmount: number;
  commissionAmount: number;
}) {
  const { agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.insert(agentCommissions).values(data);
}

/** בדיקה אם כבר נרשמה עמלה לטופס זה */
export async function hasCommissionForSubmission(submissionId: number) {
  const { agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) return false;
  const r = await db.select().from(agentCommissions).where(eq(agentCommissions.submissionId, submissionId)).limit(1);
  return r.length > 0;
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

export async function getTournamentById(id: number) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  return r[0];
}

/** הסתרת תחרות מדף הראשי בידי מנהל – לא משנה סטטוס/visibility, רק hiddenFromHomepage. */
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

/** שמירה לצמיתות – רשומה כספית בעת חלוקת פרסים או החזר. לא נמחקת אוטומטית. */
export type FinancialRecordParticipant = { submissionId?: number; userId: number; username: string; amountPaid: number; prizeWon: number };
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
export async function getTournamentsToAutoClose(): Promise<Array<{ id: number }>> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const all = await db.select({ id: tournaments.id, closesAt: tournaments.closesAt }).from(tournaments).where(
    and(eq(tournaments.status, "OPEN"), isNotNull(tournaments.closesAt))
  );
  const now = Date.now();
  return all
    .filter((t) => t.closesAt != null && (t.closesAt instanceof Date ? t.closesAt.getTime() : Number(t.closesAt)) <= now)
    .map((t) => ({ id: t.id }));
}

/** סגירה אוטומטית: מעבר תחרות ל-LOCKED כשהזמן closesAt עבר */
export async function runAutoCloseTournaments(): Promise<number[]> {
  const list = await getTournamentsToAutoClose();
  if (list.length === 0) return [];
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const ids: number[] = [];
  for (const { id } of list) {
    await db.update(tournaments).set({
      status: "LOCKED",
      lockedAt: now,
    } as typeof tournaments.$inferInsert).where(eq(tournaments.id, id));
    ids.push(id);
  }
  return ids;
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

/** כניסה חדשה בלבד – תמיד יוצר שורה חדשה (אין הגבלה על מספר כניסות לאותה תחרות). מחזיר id של הטופס החדש. */
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
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const { submissions } = await getSchema();
  const countRows = await db.select().from(submissions).where(eq(submissions.tournamentId, data.tournamentId));
  const nextNum = countRows.length + 1;
  const status = data.status ?? "pending";
  const paymentStatus = data.paymentStatus ?? "pending";
  await db.insert(submissions).values({
    userId: data.userId,
    username: data.username,
    tournamentId: data.tournamentId,
    agentId: data.agentId ?? null,
    submissionNumber: nextNum,
    predictions: data.predictions as never,
    points: 0,
    status,
    paymentStatus,
    strongHit: data.strongHit ?? null,
  });
  const created = await db.select({ id: submissions.id }).from(submissions)
    .where(and(eq(submissions.userId, data.userId), eq(submissions.tournamentId, data.tournamentId)))
    .orderBy(desc(submissions.id))
    .limit(1);
  return created[0]?.id ?? 0;
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

export async function updateSubmissionPoints(id: number, points: number) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  await db.update(submissions).set({ points, updatedAt: new Date() }).where(eq(submissions.id, id));
}

export async function updateSubmissionLottoResult(id: number, points: number, strongHit: boolean) {
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
  diffJson?: Record<string, unknown> | null
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

export async function createTournament(data: {
  name: string;
  amount: number;
  description?: string;
  type?: string;
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
}) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available" + (getDbInitError() ? ": " + String(getDbInitError()) : ""));
  const amountNum = Number(data.amount);
  if (!Number.isInteger(amountNum) || amountNum < 1) {
    throw new Error("Tournament amount must be a positive integer");
  }
  const typeVal = data.type ?? "football";
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
  if (data.description != null) row.description = data.description;
  if (data.type != null) row.type = data.type;
  if (data.startDate != null && data.startDate.trim() !== "") row.startDate = data.startDate.trim();
  if (data.endDate != null && data.endDate.trim() !== "") row.endDate = data.endDate.trim();
  if (data.maxParticipants != null) row.maxParticipants = data.maxParticipants;
  if (data.prizeDistribution != null) row.prizeDistribution = data.prizeDistribution;
  if (data.drawCode != null && data.drawCode.trim() !== "") row.drawCode = data.drawCode.trim();
  if (data.drawDate != null && data.drawDate.trim() !== "") row.drawDate = data.drawDate.trim();
  if (data.drawTime != null && data.drawTime.trim() !== "") row.drawTime = data.drawTime.trim();
  if (customId != null) row.customIdentifier = customId;
  const startsAtVal = toTimestamp(data.startsAt);
  if (startsAtVal != null) row.startsAt = startsAtVal;
  const endsAtVal = toTimestamp(data.endsAt);
  if (endsAtVal != null) row.endsAt = endsAtVal;
  const opensAtVal = toTimestamp(data.opensAt);
  if (opensAtVal != null) row.opensAt = opensAtVal;
  const closesAtVal = toTimestamp(data.closesAt);
  if (closesAtVal != null) row.closesAt = closesAtVal;
  await db.insert(tournaments).values(row as typeof tournaments.$inferInsert);
}

/** מחזיר נקודות למשתתפים שאושרו כשתחרות מבוטלת – קוראים לפני מחיקת תחרות */
export async function refundTournamentParticipants(tournamentId: number): Promise<{ refundedCount: number; totalRefunded: number; refundedUserIds: number[]; amountPerUser: number }> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { refundedCount: 0, totalRefunded: 0, refundedUserIds: [], amountPerUser: 0 };
  const amount = tournament.amount;
  if (amount <= 0) return { refundedCount: 0, totalRefunded: 0, refundedUserIds: [], amountPerUser: 0 };
  const subs = await getSubmissionsByTournament(tournamentId);
  const approved = subs.filter((s) => s.status === "approved");
  const name = (tournament as { name?: string }).name ?? String(tournamentId);
  const statusAtTime = (tournament as { status?: string }).status ?? "CANCELLED";
  for (const s of approved) {
    await addUserPoints(s.userId, amount, "refund", {
      referenceId: tournamentId,
      description: `החזר בשל ביטול תחרות: ${name}`,
    });
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
  }
  return { refundedCount: approved.length, totalRefunded: approved.length * amount, refundedUserIds: approved.map((s) => s.userId), amountPerUser: amount };
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
  /** LOCKED = תחרות נעולה, להצגת טיימר */
  status?: string;
  lockedAt?: Date | null;
  removalScheduledAt?: Date | null;
};

export async function getTournamentPublicStats(activeOnly = true): Promise<TournamentPublicStat[]> {
  const subs = await getAllSubmissions();
  const tournaments = activeOnly ? await getActiveTournaments() : await getTournaments();
  const paid = subs.filter((s) => s.status === "approved");

  return tournaments.map((t) => {
    const participants = paid.filter((s) => s.tournamentId === t.id).length;
    const total = participants * t.amount;
    const fee = Math.round(total * (FEE_PERCENT / 100));
    const prizePool = total - fee;
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
      lockedAt: (t as { lockedAt?: Date | null }).lockedAt ?? null,
      removalScheduledAt: (t as { removalScheduledAt?: Date | null }).removalScheduledAt ?? null,
    };
  });
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
  for (const s of approved) {
    const pred = s.predictions as unknown;
    let hits = 0;
    if (isChancePredictionsValid(pred)) {
      if (String(pred.heart) === data.heartCard) hits++;
      if (String(pred.club) === data.clubCard) hits++;
      if (String(pred.diamond) === data.diamondCard) hits++;
      if (String(pred.spade) === data.spadeCard) hits++;
    }
    await updateSubmissionPoints(s.id, hits);
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

export async function getChanceLeaderboard(tournamentId: number): Promise<{
  drawResult: { heartCard: string; clubCard: string; diamondCard: string; spadeCard: string; drawDate: string } | null;
  rows: ChanceLeaderboardRow[];
  prizePool: number;
  winnerCount: number;
}> {
  const subs = (await getAllSubmissions()).filter((s) => s.tournamentId === tournamentId && s.status === "approved");
  const tournament = await getTournamentById(tournamentId);
  const drawResult = await getChanceDrawResult(tournamentId);
  const prizePool = Math.round(subs.length * (tournament?.amount ?? 0) * 0.875);
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
  return {
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
  for (const s of approved) {
    const pred = s.predictions as unknown;
    let regularMatches = 0;
    let strongHit = false;
    if (isLottoPredictionsValid(pred)) {
      for (const n of pred.numbers) {
        if (winningSet.has(n)) regularMatches++;
      }
      strongHit = pred.strongNumber === data.strongNumber;
    }
    // ניקוד לוטו: נקודה לכל מספר רגיל שנפגע + נקודה נוספת על פגיעה במספר החזק.
    const totalPoints = regularMatches + (strongHit ? 1 : 0);
    await updateSubmissionLottoResult(s.id, totalPoints, strongHit);
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
  const subs = (await getAllSubmissions()).filter((s) => s.tournamentId === tournamentId && s.status === "approved");
  const tournament = await getTournamentById(tournamentId);
  const drawResult = await getLottoDrawResult(tournamentId);
  const prizePool = Math.round(subs.length * (tournament?.amount ?? 0) * 0.875);
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
  return {
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
  const { calcSubmissionPoints } = await import("./services/scoringService");
  const matches = await getCustomFootballMatches(tournamentId);
  const results = new Map<number, { homeScore: number; awayScore: number }>();
  for (const m of matches) {
    if (m.homeScore != null && m.awayScore != null) results.set(m.id, { homeScore: m.homeScore, awayScore: m.awayScore });
  }
  const subs = await getSubmissionsByTournament(tournamentId);
  for (const s of subs) {
    const preds = s.predictions as unknown;
    if (!Array.isArray(preds) || !preds.every((p: unknown) => p && typeof (p as { matchId?: number }).matchId === "number")) continue;
    const pts = calcSubmissionPoints(preds as Array<{ matchId: number; prediction: "1" | "X" | "2" }>, results);
    await updateSubmissionPoints(s.id, pts);
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
  const prizePool = Math.round(subs.length * (tournament?.amount ?? 0) * 0.875);
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
