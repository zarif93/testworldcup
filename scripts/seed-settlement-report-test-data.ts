/**
 * Seed DB with test data for Player Settlement Report verification.
 * Run: npx tsx scripts/seed-settlement-report-test-data.ts
 * Uses SQLite only. Creates user 999001, 6 tournaments (899001–899006), 6 submissions, financial_events.
 *
 * Cases:
 * 1. entry 500, winnings 250, commission 250 => result -250
 * 2. entry 500, winnings 375, commission 125 => result -125
 * 3. entry 500, winnings 900, commission 100 => result +400
 * 4. entry 500, winnings 500, commission 100 => result 0
 * 5. entry 500, refund 500 => result 0
 * 6. entry 0, winnings 300 => result +300
 */

import { getDb, getSqlite, USE_SQLITE } from "../server/db";

const TEST_USER_ID = 999001;
const TOURNAMENT_IDS = [899001, 899002, 899003, 899004, 899005, 899006];
const SUBMISSION_IDS = [899001, 899002, 899003, 899004, 899005, 899006];

async function main() {
  if (!USE_SQLITE) {
    console.error("This seed is for SQLite only. Set no DATABASE_URL.");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error("Database not available.");
    process.exit(1);
  }
  const sqlite = await getSqlite();
  if (!sqlite) {
    console.error("SQLite not available.");
    process.exit(1);
  }

  const now = Date.now();

  // 1) Ensure test user exists (raw SQL so we can set id)
  const existingUser = sqlite.prepare("SELECT id FROM users WHERE id = ?").get(TEST_USER_ID) as { id: number } | undefined;
  if (!existingUser) {
    sqlite.prepare(`
      INSERT INTO users (id, openId, username, role, points, createdAt, updatedAt, lastSignedIn)
      VALUES (?, ?, ?, 'user', 0, ?, ?, ?)
    `).run(TEST_USER_ID, `settlement-test-${TEST_USER_ID}`, "settlement_test_player", now, now, now);
    console.log("Created test user", TEST_USER_ID);
  } else {
    console.log("Test user already exists", TEST_USER_ID);
  }

  // 2) Create 6 tournaments (ARCHIVED so they appear in settled report)
  for (let i = 0; i < 6; i++) {
    const tid = TOURNAMENT_IDS[i];
    const amount = i === 5 ? 0 : 500; // Case 6 = freeroll
    const name = `Settlement Test T${i + 1}`;
    const existingT = sqlite.prepare("SELECT id FROM tournaments WHERE id = ?").get(tid) as { id: number } | undefined;
    if (!existingT) {
      sqlite.prepare(`
        INSERT INTO tournaments (id, amount, name, status, type, createdAt)
        VALUES (?, ?, ?, 'ARCHIVED', 'football', ?)
      `).run(tid, amount, name, now);
      console.log("Created tournament", tid, name);
    }
  }

  // 3) Create 6 submissions (one per tournament for test user)
  for (let i = 0; i < 6; i++) {
    const sid = SUBMISSION_IDS[i];
    const tid = TOURNAMENT_IDS[i];
    const existingS = sqlite.prepare("SELECT id FROM submissions WHERE id = ?").get(sid) as { id: number } | undefined;
    if (!existingS) {
      sqlite.prepare(`
        INSERT INTO submissions (id, userId, username, tournamentId, predictions, points, status, paymentStatus, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, '{}', 0, 'approved', 'completed', ?, ?)
      `).run(sid, TEST_USER_ID, "settlement_test_player", tid, now, now);
      console.log("Created submission", sid, "tournament", tid);
    }
  }

  // 4) Insert financial_events (avoid duplicate by idempotencyKey)
  const idempotencyKeys = [
    "seed:entry:899001",
    "seed:entry:899002",
    "seed:entry:899003",
    "seed:entry:899004",
    "seed:entry:899005",
    "seed:entry:899006",
  ];
  const existingEntry = sqlite.prepare("SELECT id FROM financial_events WHERE idempotencyKey = ?").get(idempotencyKeys[0]) as { id: number } | undefined;
  if (existingEntry) {
    console.log("Financial events already seeded (idempotency key exists). Skip insert.");
  } else {
    // Case 1: entry 500, winnings 250, commission 250
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, payloadJson, createdAt)
      VALUES ('ENTRY_FEE', 500, 899001, ?, 899001, 'seed:entry:899001', ?, ?)
    `).run(TEST_USER_ID, JSON.stringify({ commissionAmount: 250, agentCommissionAmount: 0 }), now);
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, createdAt)
      VALUES ('PRIZE_PAYOUT', 250, 899001, ?, 899001, 'seed:prize:899001', ?)
    `).run(TEST_USER_ID, now);

    // Case 2: entry 500, winnings 375, commission 125
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, payloadJson, createdAt)
      VALUES ('ENTRY_FEE', 500, 899002, ?, 899002, 'seed:entry:899002', ?, ?)
    `).run(TEST_USER_ID, JSON.stringify({ commissionAmount: 125, agentCommissionAmount: 0 }), now);
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, createdAt)
      VALUES ('PRIZE_PAYOUT', 375, 899002, ?, 899002, 'seed:prize:899002', ?)
    `).run(TEST_USER_ID, now);

    // Case 3: entry 500, winnings 900, commission 100
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, payloadJson, createdAt)
      VALUES ('ENTRY_FEE', 500, 899003, ?, 899003, 'seed:entry:899003', ?, ?)
    `).run(TEST_USER_ID, JSON.stringify({ commissionAmount: 100, agentCommissionAmount: 0 }), now);
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, createdAt)
      VALUES ('PRIZE_PAYOUT', 900, 899003, ?, 899003, 'seed:prize:899003', ?)
    `).run(TEST_USER_ID, now);

    // Case 4: entry 500, winnings 500, commission 100
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, payloadJson, createdAt)
      VALUES ('ENTRY_FEE', 500, 899004, ?, 899004, 'seed:entry:899004', ?, ?)
    `).run(TEST_USER_ID, JSON.stringify({ commissionAmount: 100, agentCommissionAmount: 0 }), now);
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, createdAt)
      VALUES ('PRIZE_PAYOUT', 500, 899004, ?, 899004, 'seed:prize:899004', ?)
    `).run(TEST_USER_ID, now);

    // Case 5: entry 500, refund 500 (no prize)
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, payloadJson, createdAt)
      VALUES ('ENTRY_FEE', 500, 899005, ?, 899005, 'seed:entry:899005', ?, ?)
    `).run(TEST_USER_ID, JSON.stringify({ commissionAmount: 0, agentCommissionAmount: 0 }), now);
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, idempotencyKey, createdAt)
      VALUES ('REFUND', 500, 899005, ?, 'seed:refund:899005', ?)
    `).run(TEST_USER_ID, now);

    // Case 6: entry 0, winnings 300 (freeroll)
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, payloadJson, createdAt)
      VALUES ('ENTRY_FEE', 0, 899006, ?, 899006, 'seed:entry:899006', ?, ?)
    `).run(TEST_USER_ID, JSON.stringify({ commissionAmount: 0, agentCommissionAmount: 0 }), now);
    sqlite.prepare(`
      INSERT INTO financial_events (eventType, amountPoints, tournamentId, userId, submissionId, idempotencyKey, createdAt)
      VALUES ('PRIZE_PAYOUT', 300, 899006, ?, 899006, 'seed:prize:899006', ?)
    `).run(TEST_USER_ID, now);

    console.log("Inserted financial_events for 6 cases.");
  }

  console.log("Done. Test player ID for report:", TEST_USER_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
