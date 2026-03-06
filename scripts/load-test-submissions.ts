/**
 * Load test למערכת submissions – 20–50 שליחות במקביל.
 * בודק: אין negative balance, אין submissions כפולים לא חוקיים, אין double debit.
 * הרצה: pnpm exec tsx scripts/load-test-submissions.ts [concurrency]
 * דורש DB (dotenv). ברירת מחדל: 30 שליחות במקביל.
 */
import "dotenv/config";
import { getDb, getUserPoints, getSubmissionsByUserAndTournament, getPointsHistory } from "../server/db";
import { users, tournaments } from "../drizzle/schema-sqlite";
import { eq } from "drizzle-orm";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const CONCURRENCY = Math.min(50, Math.max(20, parseInt(process.argv[2] ?? "30", 10)));

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    adminCodeVerified: true,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as TrpcContext["res"],
  };
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB not available. Set .env / DATABASE_URL.");
    process.exit(1);
  }
  const uniq = `loadtest_${Date.now()}`;
  const cost = 10;
  const initialPoints = CONCURRENCY * cost + 100;

  const [existingUser] = await db.select().from(users).where(eq(users.username, uniq)).limit(1);
  let userId: number;
  if (existingUser) {
    userId = existingUser.id;
    await db.update(users).set({ points: initialPoints }).where(eq(users.id, userId));
  } else {
    const [inserted] = await db.insert(users).values({
      openId: `openid-${uniq}`,
      username: uniq,
      name: "Load Test User",
      role: "user",
      points: initialPoints,
      loginMethod: "local",
    }).returning({ id: users.id });
    if (!inserted) throw new Error("Failed to create user");
    userId = inserted.id;
  }

  const [tour] = await db.select().from(tournaments).where(eq(tournaments.status, "OPEN")).limit(1);
  if (!tour) {
    console.error("No OPEN tournament found. Create one first.");
    process.exit(1);
  }
  const tournamentId = tour.id;

  const ctxUser = {
    id: userId,
    openId: `openid-${uniq}`,
    username: uniq,
    name: "Load Test User",
    role: "user" as const,
    points: initialPoints,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    email: null as string | null,
    loginMethod: "local" as const,
    phone: null as string | null,
    passwordHash: null as string | null,
    agentId: null as number | null,
    referralCode: null as string | null,
    isBlocked: false,
    deletedAt: null as Date | null,
  } as TrpcContext["user"];

  const caller = appRouter.createCaller(createContext(ctxUser));
  const payload = { tournamentId, predictionsChance: { heart: "7" as const, club: "8" as const, diamond: "9" as const, spade: "10" as const } };

  const beforeBalance = await getUserPoints(userId);
  const start = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () => caller.submissions.submit(payload))
  );
  const elapsed = Date.now() - start;

  const success = results.filter((r) => r.status === "fulfilled" && (r.value as { success?: boolean }).success).length;
  const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !(r.value as { success?: boolean }).success)).length;

  const afterBalance = await getUserPoints(userId);
  const subs = await getSubmissionsByUserAndTournament(userId, tournamentId);
  const history = await getPointsHistory(userId, { limit: 500 });
  const participationDebits = history.filter((h) => h.actionType === "participation" && h.referenceId === tournamentId);

  const negativeBalance = afterBalance < 0;
  const submissionCount = subs.length;
  const debitCount = participationDebits.length;
  const doubleDebit = debitCount > success;
  const duplicateSubs = submissionCount > CONCURRENCY;

  const report = {
    concurrency: CONCURRENCY,
    success,
    failed,
    elapsedMs: elapsed,
    beforeBalance,
    afterBalance,
    negativeBalance,
    submissionCount,
    debitCount,
    expectedDebits: success,
    doubleDebit,
    duplicateSubs,
    ok: !negativeBalance && !doubleDebit && !duplicateSubs,
  };

  console.log("Load Test Submissions – Report");
  console.log(JSON.stringify(report, null, 2));
  if (report.negativeBalance) console.error("FAIL: negative balance");
  if (report.doubleDebit) console.error("FAIL: double debit (debits > successful submissions)");
  if (report.duplicateSubs) console.error("FAIL: duplicate submissions");
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
