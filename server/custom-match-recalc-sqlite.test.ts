/**
 * SQLite: recalcCustomMatchPoints must use a sync transaction (better-sqlite3).
 * Integration: real DB rows + updateCustomMatchResult + recalc.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  USE_SQLITE,
  getSqlite,
  getDb,
  recalcCustomMatchPoints,
  updateCustomMatchResult,
} from "./db";

describe("custom match recalc on SQLite", () => {
  beforeAll(async () => {
    if (!USE_SQLITE) return;
    await getDb();
  });

  it("skips when not SQLite", async () => {
    if (USE_SQLITE) return;
    await expect(recalcCustomMatchPoints(1)).rejects.toThrow();
  });

  it("recalc updates submission points after scores (REGULAR_1X2) and correction via updateCustomMatchResult", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const suffix = now % 100000;
    const tournamentId = 920000 + suffix;
    const userId = 930000 + suffix;
    const matchId = 940000 + suffix;
    const submissionId = 950000 + suffix;

    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', 100, 0, ?, ?)`
        )
        .run(userId, `open-cm-${userId}`, `u${userId}`, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO tournaments (id, amount, name, type, status, isLocked, createdAt) VALUES (?, ?, ?, 'football_custom', 'OPEN', 0, ?)`
        )
        .run(tournamentId, 10, `T${tournamentId}`, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO custom_matches (id, tournamentId, homeTeam, awayTeam, marketType, homeSpread, awaySpread, homeScore, awayScore, displayOrder, createdAt, updatedAt) VALUES (?, ?, 'A', 'B', 'REGULAR_1X2', NULL, NULL, 1, 0, 0, ?, ?)`
        )
        .run(matchId, tournamentId, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO submissions (id, userId, username, tournamentId, predictions, points, status, paymentStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, 'approved', 'completed', ?, ?)`
        )
        .run(
          submissionId,
          userId,
          `u${userId}`,
          tournamentId,
          JSON.stringify([{ matchId, prediction: "1" }]),
          now,
          now
        );
    })();

    await recalcCustomMatchPoints(tournamentId);
    const row1 = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionId) as { points: number } | undefined;
    expect(row1?.points).toBe(3);

    await updateCustomMatchResult(matchId, 0, 1);
    await recalcCustomMatchPoints(tournamentId);
    const row2 = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionId) as { points: number } | undefined;
    expect(row2?.points).toBe(0);
  });

  it("recalc scores SPREAD and MONEYLINE submissions", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const suffix = (now % 100000) + 1;
    const tournamentId = 960000 + suffix;
    const userId = 970000 + suffix;
    const midMl = 980000 + suffix;
    const midSp = 981000 + suffix;
    const subMl = 990000 + suffix;
    const subSp = 991000 + suffix;

    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', 100, 0, ?, ?)`
        )
        .run(userId, `open-cm2-${userId}`, `u2${userId}`, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO tournaments (id, amount, name, type, status, isLocked, createdAt) VALUES (?, ?, ?, 'football_custom', 'OPEN', 0, ?)`
        )
        .run(tournamentId, 10, `T2${tournamentId}`, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO custom_matches (id, tournamentId, homeTeam, awayTeam, marketType, homeSpread, awaySpread, homeScore, awayScore, displayOrder, createdAt, updatedAt) VALUES (?, ?, 'H', 'A', 'MONEYLINE', NULL, NULL, 2, 1, 0, ?, ?)`
        )
        .run(midMl, tournamentId, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO custom_matches (id, tournamentId, homeTeam, awayTeam, marketType, homeSpread, awaySpread, homeScore, awayScore, displayOrder, createdAt, updatedAt) VALUES (?, ?, 'H', 'A', 'SPREAD', -5, 5, 10, 3, 1, ?, ?)`
        )
        .run(midSp, tournamentId, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO submissions (id, userId, username, tournamentId, predictions, points, status, paymentStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, 'approved', 'completed', ?, ?)`
        )
        .run(
          subMl,
          userId,
          `u2${userId}`,
          tournamentId,
          JSON.stringify([{ matchId: midMl, prediction: "HOME" }]),
          now,
          now
        );
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO submissions (id, userId, username, tournamentId, predictions, points, status, paymentStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, 'approved', 'completed', ?, ?)`
        )
        .run(
          subSp,
          userId,
          `u2${userId}`,
          tournamentId,
          JSON.stringify([{ matchId: midSp, prediction: "AWAY_SPREAD" }]),
          now,
          now
        );
    })();

    await recalcCustomMatchPoints(tournamentId);
    const pMl = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(subMl) as { points: number } | undefined;
    const pSp = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(subSp) as { points: number } | undefined;
    expect(pMl?.points).toBe(3);
    expect(pSp?.points).toBe(3);
  });

  it("SPREAD: second updateCustomMatchResult overwrites points (HOME_COVER flip + PUSH transition)", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const suffix = (now % 100000) + 3;
    const tournamentId = 961000 + suffix;
    const userId = 971000 + suffix;
    const matchId = 982000 + suffix;
    const submissionHome = 992000 + suffix;
    const submissionAway = 993000 + suffix;

    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', 100, 0, ?, ?)`
        )
        .run(userId, `open-sp2-${userId}`, `usp${userId}`, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO tournaments (id, amount, name, type, status, isLocked, createdAt) VALUES (?, ?, ?, 'football_custom', 'OPEN', 0, ?)`
        )
        .run(tournamentId, 10, `Tsp2${tournamentId}`, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO custom_matches (id, tournamentId, homeTeam, awayTeam, marketType, homeSpread, awaySpread, homeScore, awayScore, displayOrder, createdAt, updatedAt) VALUES (?, ?, 'H', 'A', 'SPREAD', -5, 5, NULL, NULL, 0, ?, ?)`
        )
        .run(matchId, tournamentId, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO submissions (id, userId, username, tournamentId, predictions, points, status, paymentStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, 'approved', 'completed', ?, ?)`
        )
        .run(
          submissionHome,
          userId,
          `usp${userId}`,
          tournamentId,
          JSON.stringify([{ matchId, prediction: "HOME_SPREAD" }]),
          now,
          now
        );
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO submissions (id, userId, username, tournamentId, predictions, points, status, paymentStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, 'approved', 'completed', ?, ?)`
        )
        .run(
          submissionAway,
          userId,
          `usp${userId}`,
          tournamentId,
          JSON.stringify([{ matchId, prediction: "AWAY_SPREAD" }]),
          now,
          now
        );
    })();

    // First save: 80-72 → adjusted 75 vs 77 → AWAY_COVER
    await updateCustomMatchResult(matchId, 80, 72);
    await recalcCustomMatchPoints(tournamentId);
    const p1Home = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionHome) as { points: number } | undefined;
    const p1Away = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionAway) as { points: number } | undefined;
    expect(p1Home?.points).toBe(0);
    expect(p1Away?.points).toBe(3);

    // Second save: 90-72 → adjusted 85 vs 77 → HOME_COVER
    await updateCustomMatchResult(matchId, 90, 72);
    await recalcCustomMatchPoints(tournamentId);
    const p2Home = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionHome) as { points: number } | undefined;
    const p2Away = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionAway) as { points: number } | undefined;
    expect(p2Home?.points).toBe(3);
    expect(p2Away?.points).toBe(0);

    await recalcCustomMatchPoints(tournamentId);
    const p3Home = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionHome) as { points: number } | undefined;
    const p3Away = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionAway) as { points: number } | undefined;
    expect(p3Home?.points).toBe(3);
    expect(p3Away?.points).toBe(0);
  });

  it("SPREAD: PUSH then HOME_COVER on second save clears stale push grading", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const suffix = (now % 100000) + 4;
    const tournamentId = 962000 + suffix;
    const userId = 972000 + suffix;
    const matchId = 983000 + suffix;
    const submissionId = 994000 + suffix;

    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO users (id, openId, username, role, points, unlimitedPoints, createdAt, updatedAt) VALUES (?, ?, ?, 'user', 100, 0, ?, ?)`
        )
        .run(userId, `open-push-${userId}`, `upush${userId}`, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO tournaments (id, amount, name, type, status, isLocked, createdAt) VALUES (?, ?, ?, 'football_custom', 'OPEN', 0, ?)`
        )
        .run(tournamentId, 10, `Tpush${tournamentId}`, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO custom_matches (id, tournamentId, homeTeam, awayTeam, marketType, homeSpread, awaySpread, homeScore, awayScore, displayOrder, createdAt, updatedAt) VALUES (?, ?, 'H', 'A', 'SPREAD', -8, 8, NULL, NULL, 0, ?, ?)`
        )
        .run(matchId, tournamentId, now, now);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO submissions (id, userId, username, tournamentId, predictions, points, status, paymentStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, 'approved', 'completed', ?, ?)`
        )
        .run(
          submissionId,
          userId,
          `upush${userId}`,
          tournamentId,
          JSON.stringify([{ matchId, prediction: "HOME_SPREAD" }]),
          now,
          now
        );
    })();

    await updateCustomMatchResult(matchId, 80, 64);
    await recalcCustomMatchPoints(tournamentId);
    const pushPts = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionId) as { points: number } | undefined;
    expect(pushPts?.points).toBe(0);

    await updateCustomMatchResult(matchId, 81, 64);
    await recalcCustomMatchPoints(tournamentId);
    const coverPts = sqlite.prepare("SELECT points FROM submissions WHERE id = ?").get(submissionId) as { points: number } | undefined;
    expect(coverPts?.points).toBe(3);
  });

  it("recalc throws when tournament results are finalized", async () => {
    if (!USE_SQLITE) return;
    const sqlite = await getSqlite();
    if (!sqlite) return;

    const now = Date.now();
    const suffix = (now % 100000) + 2;
    const tournamentId = 920000 + suffix + 50000;

    sqlite
      .prepare(
        `INSERT OR REPLACE INTO tournaments (id, amount, name, type, status, isLocked, createdAt) VALUES (?, ?, ?, 'football_custom', 'SETTLED', 0, ?)`
      )
      .run(tournamentId, 10, `Tfin${tournamentId}`, now);

    await expect(recalcCustomMatchPoints(tournamentId)).rejects.toThrow(/finalized/i);
  });
});
