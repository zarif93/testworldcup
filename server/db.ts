/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - db uses dynamic schema (SQLite/MySQL) so union types cause false errors at compile time; runtime uses SQLite when DATABASE_URL is not set.
import { eq, and, desc } from "drizzle-orm";
import { ENV } from "./_core/env";
import { WORLD_CUP_2026_MATCHES } from "@shared/matchesData";

const USE_SQLITE = !process.env.DATABASE_URL;

let _db: Awaited<ReturnType<typeof initSqlite>> | Awaited<ReturnType<typeof initMysql>> | null = null;
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
  const { users, tournaments, matches, submissions, agentCommissions } = await import("../drizzle/schema-sqlite");

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
      amount INTEGER NOT NULL UNIQUE,
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

  const db = drizzle(sqlite, { schema: { users, tournaments, matches, submissions, agentCommissions } });

  const matchCount = sqlite.prepare("SELECT COUNT(*) as c FROM matches").get() as { c: number };
  if (matchCount.c === 0) {
    for (const m of WORLD_CUP_2026_MATCHES) {
      sqlite.prepare(`
        INSERT INTO matches (matchNumber, homeTeam, awayTeam, groupName, matchDate, matchTime, stadium, city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(m.matchNumber, m.homeTeam, m.awayTeam, m.group, m.date, m.time, m.stadium, m.city);
    }
    console.log("[DB] Seeded 72 matches");
  }

  const tourCount = sqlite.prepare("SELECT COUNT(*) as c FROM tournaments").get() as { c: number };
  if (tourCount.c === 0) {
    for (const [amount, name] of [
      [50, "טורניר 50"],
      [100, "טורניר 100"],
      [200, "טורניר 200"],
      [500, "טורניר 500"],
      [1000, "טורניר 1000"],
      [2000, "טורניר 2000"],
    ]) {
      sqlite.prepare("INSERT INTO tournaments (amount, name) VALUES (?, ?)").run(amount, name);
    }
    console.log("[DB] Seeded 6 tournaments");
  } else {
    // הוספת טורנירים חדשים אם חסרים (50, 100)
    const existing = sqlite.prepare("SELECT amount FROM tournaments").all() as { amount: number }[];
    const amounts = new Set(existing.map((r) => r.amount));
    for (const [amount, name] of [
      [50, "טורניר 50"],
      [100, "טורניר 100"],
    ] as [number, string][]) {
      if (!amounts.has(amount)) {
        sqlite.prepare("INSERT INTO tournaments (amount, name) VALUES (?, ?)").run(amount, name);
        console.log(`[DB] Added tournament: ${name}`);
      }
    }
  }

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
  return r[0];
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

export async function getAllUsers() {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

/** מחזיר סוכן לפי קוד הפניה (רק role=agent) */
export async function getAgentByReferralCode(referralCode: string) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);
  const u = r[0];
  return u?.role === "agent" ? u : undefined;
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

/** רשימת כל הסוכנים */
export async function getAgents() {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "agent")).orderBy(desc(users.createdAt));
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

/** רשימת משתמשים שהביא סוכן */
export async function getUsersByAgentId(agentId: number) {
  const { users } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.agentId, agentId)).orderBy(desc(users.createdAt));
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
  return db.select().from(tournaments);
}

export async function getTournamentById(id: number) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  return r[0];
}

export async function getMatches() {
  const { matches } = await getSchema();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(matches).orderBy(matches.matchDate, matches.matchTime);
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
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }>;
}) {
  const existing = await getSubmissionByUserAndTournament(data.userId, data.tournamentId);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { submissions } = await getSchema();
  const row = {
    userId: data.userId,
    username: data.username,
    tournamentId: data.tournamentId,
    predictions: data.predictions as unknown as string,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(submissions).set({
      ...row,
      status: "pending",
      points: 0,
    }).where(eq(submissions.id, existing.id));
    return existing.id;
  }
  await db.insert(submissions).values({
    ...row,
    status: "pending",
    paymentStatus: "pending",
    points: 0,
  });
  const created = await getSubmissionByUserAndTournament(data.userId, data.tournamentId);
  return created?.id;
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

export async function deleteSubmission(id: number) {
  const { submissions, agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(agentCommissions).where(eq(agentCommissions.submissionId, id));
  await db.delete(submissions).where(eq(submissions.id, id));
}

/** מחיקת משתמש (שחקן או סוכן) – לא מנהלים. שחקן: מוחק גם את כל הטפסים והעמלות. סוכן: מנתק שחקנים מהסוכן ומוחק עמלות. */
export async function deleteUser(id: number) {
  const { users, agentCommissions } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const user = await getUserById(id);
  if (!user) throw new Error("User not found");
  if (user.role === "admin") throw new Error("Cannot delete admin");

  if (user.role === "user") {
    const subs = await getSubmissionsByUserId(id);
    for (const s of subs) await deleteSubmission(s.id);
  }
  if (user.role === "agent") {
    await db.update(users).set({ agentId: null, updatedAt: new Date() }).where(eq(users.agentId, id));
    await db.delete(agentCommissions).where(eq(agentCommissions.agentId, id));
  }
  await db.delete(users).where(eq(users.id, id));
}

export async function setTournamentLocked(tournamentId: number, isLocked: boolean) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tournaments).set({ isLocked }).where(eq(tournaments.id, tournamentId));
}

export async function createTournament(data: { name: string; amount: number }) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(tournaments).values({ name: data.name, amount: data.amount });
}

export async function deleteTournament(id: number) {
  const { tournaments } = await getSchema();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tournaments).where(eq(tournaments.id, id));
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

/** סטטיסטיקות ציבוריות לתצוגה בשחקנים: משתתפים וסך פרסים לאחר עמלה 12.5% */
export type TournamentPublicStat = {
  id: number;
  name: string;
  amount: number;
  isLocked: boolean;
  participants: number;
  prizePool: number;
};

export async function getTournamentPublicStats(): Promise<TournamentPublicStat[]> {
  const subs = await getAllSubmissions();
  const tournaments = await getTournaments();
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
      isLocked: !!t.isLocked,
      participants,
      prizePool,
    };
  });
}
