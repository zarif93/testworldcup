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
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** טורנירים: 50, 100, 200, 500, 1000, 2000 */
export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amount: integer("amount").notNull().unique(),
  name: text("name").notNull(),
  isLocked: integer("isLocked", { mode: "boolean" }).default(false),
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

/** טפסי ניחושים - משתמש שולח טופס לטורניר */
export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  username: text("username").notNull(),
  tournamentId: integer("tournamentId").notNull(),
  predictions: text("predictions", { mode: "json" }).notNull(),
  points: integer("points").default(0).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  paymentStatus: text("paymentStatus", { enum: ["pending", "completed", "failed"] }).default("pending").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  approvedAt: integer("approvedAt", { mode: "timestamp" }),
  approvedBy: integer("approvedBy"),
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
