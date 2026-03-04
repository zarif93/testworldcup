/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - db uses dynamic schema (SQLite/MySQL) so union types cause false errors at compile time; runtime uses SQLite when DATABASE_URL is not set.
import { eq, and, desc, inArray, gte, lte, or, isNull, like, sql } from "drizzle-orm";
import { ENV } from "./_core/env";
import { WORLD_CUP_2026_MATCHES } from "@shared/matchesData";

const USE_SQLITE = !process.env.DATABASE_URL;

let _db: Awaited<ReturnType<typeof initSqlite>> | Awaited<ReturnType<typeof initMysql>> | null = null;
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

  const db = drizzle(sqlite, { schema: { users, tournaments, matches, submissions, agentCommissions, siteSettings, chanceDrawResults, lottoDrawResults, customFootballMatches, pointTransactions, pointTransferLog, adminAuditLog, financialRecords, financialTransparencyLog } });

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
    console.warn("[Database] Failed to connect:", error);
    _db = null;
  }
  return _db;
}

export async function upsertUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
}): Promise<void> {
  const { users } = await getSchema();
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;
  const values: Record<string, unknown> = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod", "lastSignedIn", "role"]) {
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** עדכון סיסמת משתמש (רק מנהל – סיסמה מוצפנת) */
export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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

export type PointActionType = "deposit" | "withdraw" | "participation" | "prize" | "admin_approval" | "refund" | "agent_transfer";

/** מוסיף נקודות למשתמש ורושם לוג */
export async function addUserPoints(
  userId: number,
  amount: number,
  actionType: PointActionType,
  opts?: { performedBy?: number; referenceId?: number; description?: string }
): Promise<void> {
  if (amount <= 0) return;
  const { users, pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  return true;
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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

/** חלוקת פרסים לזוכים בתחרות – קוראים פעם אחת כשהתחרות נגמרת. עיגול פרס למטה. */
export async function distributePrizesForTournament(tournamentId: number): Promise<{ winnerCount: number; prizePerWinner: number; distributed: number; winnerIds: number[] }> {
  const { pointTransactions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error("תחרות לא נמצאה");
  const already = await db
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(and(eq(pointTransactions.actionType, "prize"), eq(pointTransactions.referenceId, tournamentId)))
    .limit(1);
  if (already.length > 0) throw new Error("פרסים כבר חולקו לתחרות זו");

  const subs = (await getSubmissionsByTournament(tournamentId)).filter((s) => s.status === "approved");
  const prizePool = Math.round(subs.length * tournament.amount * 0.875);
  const tType = (tournament as { type?: string }).type ?? "football";

  let winnerIds: number[];
  if (tType === "chance") {
    const maxPoints = subs.length ? Math.max(...subs.map((s) => s.points)) : 0;
    winnerIds = maxPoints > 0 ? subs.filter((s) => s.points === maxPoints).map((s) => s.userId) : [];
  } else if (tType === "lotto") {
    const score = (s: { points: number; strongHit?: boolean | null }) => s.points * 10 + (s.strongHit ? 1 : 0);
    const maxScore = subs.length ? Math.max(...subs.map(score)) : 0;
    winnerIds = maxScore > 0 ? subs.filter((s) => score(s) === maxScore).map((s) => s.userId) : [];
  } else {
    const maxPoints = subs.length ? Math.max(...subs.map((s) => s.points), 0) : 0;
    winnerIds = maxPoints > 0 ? subs.filter((s) => s.points === maxPoints).map((s) => s.userId) : [];
  }

  const winnerCount = winnerIds.length;
  const prizePerWinner = winnerCount > 0 ? Math.floor(prizePool / winnerCount) : 0;
  const distributed = prizePerWinner * winnerCount;
  const tournamentName = (tournament as { name?: string }).name ?? String(tournamentId);

  for (const userId of winnerIds) {
    if (prizePerWinner > 0) {
      await addUserPoints(userId, prizePerWinner, "prize", {
        referenceId: tournamentId,
        description: `זכייה בתחרות: ${tournamentName}`,
      });
      const sub = subs.find((s) => s.userId === userId);
      await insertTransparencyLog({
        competitionId: tournamentId,
        competitionName: tournamentName,
        userId,
        username: sub?.username ?? `#${userId}`,
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
        userId: s.userId,
        username: s.username ?? `#${s.userId}`,
        amountPaid: tournament.amount,
        prizeWon: winnerIds.includes(s.userId) ? prizePerWinner : 0,
      })),
    },
  });
  const { tournaments } = await getSchema();
  await db.update(tournaments).set({ status: "PRIZES_DISTRIBUTED" } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
  return { winnerCount, prizePerWinner, distributed, winnerIds };
}

const VIRTUAL_USER_OPENID = "system-virtual-auto-submissions";

/** משתמש מערכת אחד לכל טפסי הניחושים האוטומטיים – מחזיר את ה-id שלו */
export async function getOrCreateVirtualUser(): Promise<number> {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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

/** יצירת מנהל חדש – רק סופר מנהל. משתמש נכנס עם username + סיסמה. */
export async function createAdminUserBySuperAdmin(data: { username: string; passwordHash: string; name?: string }) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
  const target = await getUserById(adminId);
  if (!target) throw new Error("משתמש לא נמצא");
  if (target.role !== "admin") throw new Error("רק מנהל ניתן למחוק מכאן");
  await db.delete(users).where(eq(users.id, adminId));
}

/** עדכון סיסמה/שם למנהל – רק סופר מנהל */
export async function updateAdmin(adminId: number, data: { passwordHash?: string; username?: string; name?: string }) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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

/** תחרויות לדף הראשי בלבד – visibility=VISIBLE, לא מוסתרות, לא מחוקות (deletedAt). */
export async function getActiveTournaments() {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tournaments).where(
    and(
      isNull(tournaments.deletedAt),
      eq(tournaments.visibility, "VISIBLE"),
      sql`(COALESCE(hiddenFromHomepage, 0) = 0)`,
      inArray(tournaments.status, ["OPEN", "LOCKED", "CLOSED", "SETTLED"])
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
  if (!db) throw new Error("Database not available");
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
export type FinancialRecordParticipant = { userId: number; username: string; amountPaid: number; prizeWon: number };
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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

/** ארכוב תחרות – מעדכן סטטוס ל-ARCHIVED ו-archivedAt. אין מחיקה של נתונים, עמלות או רווחים. */
export async function cleanupTournamentData(tournamentId: number): Promise<void> {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db.update(tournaments).set({
    status: "ARCHIVED",
    archivedAt: now,
    dataCleanedAt: now,
  } as typeof tournaments.$inferInsert).where(eq(tournaments.id, tournamentId));
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
    .limit(1);
  return r[0];
}

export async function createSubmission(data: {
  userId: number;
  username: string;
  tournamentId: number;
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }>;
}) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(submissions).values({
    userId: data.userId,
    username: data.username,
    tournamentId: data.tournamentId,
    predictions: data.predictions as unknown as string,
    status: "pending",
    paymentStatus: "pending",
  });
}

/** הוסף או עדכן טופס לפי (משתמש, טורניר) - מופיע מיד בדירוג */
export async function upsertSubmission(data: {
  userId: number;
  username: string;
  tournamentId: number;
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }> | ChancePredictions | LottoPredictions;
  status?: "pending" | "approved" | "rejected";
  paymentStatus?: "pending" | "completed" | "failed";
}): Promise<number> {
  const existing = await getSubmissionByUserAndTournament(data.userId, data.tournamentId);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { submissions } = await getSchema();
  const status = data.status ?? "pending";
  const paymentStatus = data.paymentStatus ?? "pending";
  const row = {
    userId: data.userId,
    username: data.username,
    tournamentId: data.tournamentId,
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({ paymentStatus, updatedAt: new Date() }).where(eq(submissions.id, id));
}

export async function updateSubmissionPoints(id: number, points: number) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({ points, updatedAt: new Date() }).where(eq(submissions.id, id));
}

export async function updateSubmissionLottoResult(id: number, points: number, strongHit: boolean) {
  const { submissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(submissions).set({
    points,
    strongHit: strongHit ? true : false,
    updatedAt: new Date(),
  }).where(eq(submissions.id, id));
}

export async function deleteSubmission(id: number) {
  const { submissions, agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(agentCommissions).where(eq(agentCommissions.submissionId, id));
  await db.delete(submissions).where(eq(submissions.id, id));
}

/** מחיקת כל הטפסים מהמערכת (היסטוריית טפסים) – למנהל. מוחק גם עמלות סוכנים. */
export async function deleteAllSubmissions(): Promise<number> {
  const { submissions, agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  maxParticipants?: number | null;
  prizeDistribution?: Record<number, number> | null;
  drawCode?: string | null;
  drawDate?: string | null;
  drawTime?: string | null;
  customIdentifier?: string | null;
}) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const row: Record<string, unknown> = { name: data.name, amount: data.amount };
  if (data.description != null) row.description = data.description;
  if (data.type != null) row.type = data.type;
  if (data.startDate != null) row.startDate = data.startDate;
  if (data.endDate != null) row.endDate = data.endDate;
  if (data.maxParticipants != null) row.maxParticipants = data.maxParticipants;
  if (data.prizeDistribution != null) row.prizeDistribution = data.prizeDistribution;
  if (data.drawCode != null && data.drawCode.trim() !== "") row.drawCode = data.drawCode.trim();
  if (data.drawDate != null && data.drawDate.trim() !== "") row.drawDate = data.drawDate.trim();
  if (data.drawTime != null && data.drawTime.trim() !== "") row.drawTime = data.drawTime.trim();
  if (customId != null) row.customIdentifier = customId;
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
    let points = 0;
    let strongHit = false;
    if (isLottoPredictionsValid(pred)) {
      for (const n of pred.numbers) {
        if (winningSet.has(n)) points++;
      }
      strongHit = pred.strongNumber === data.strongNumber;
    }
    await updateSubmissionLottoResult(s.id, points, strongHit);
  }
}

export async function lockLottoDrawResult(tournamentId: number) {
  const { lottoDrawResults } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const score = (s: { points: number; strongHit?: boolean | null }) => (s.points * 10) + (s.strongHit ? 1 : 0);
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
  rows.sort((a, b) => (b.points * 10 + (b.strongHit ? 1 : 0)) - (a.points * 10 + (a.strongHit ? 1 : 0)));
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
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
  await db.update(customFootballMatches).set({ homeScore, awayScore, updatedAt: new Date() }).where(eq(customFootballMatches.id, matchId));
}

export async function updateCustomFootballMatch(matchId: number, data: { homeTeam?: string; awayTeam?: string; matchDate?: string | null; matchTime?: string | null }) {
  const { customFootballMatches } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  if (!db) throw new Error("Database not available");
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
