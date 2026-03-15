# Full Project Stability + Consistency Pass

This document records the results of a full audit performed to verify project stability, database mode consistency, authentication, tournament/submission/admin flows, freeroll/guaranteed-prize logic, delete/visibility, refunds/repair, automation, and payments/accounting.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `server/db.ts` | **Consistency:** Added `isNull(tournaments.deletedAt)` to `getTournamentsToAutoClose()`, `getTournamentsToSettleNow()`, and `getTournamentsClosingSoon()` so soft-deleted tournaments are never returned for automation or “closing soon” notifications. |

No other files were modified. Existing fixes (e.g. MySQL `stripeCustomerId` in `initMysql`, freeroll/guaranteed-prize in settlement, duplicate `tAmount` removal) were left as-is.

---

## 2. Issues Found

1. **Automation / cleanup queries could include soft-deleted tournaments**  
   - **Location:** `getTournamentsToAutoClose`, `getTournamentsToSettleNow`, `getTournamentsClosingSoon` in `server/db.ts`.  
   - **Root cause:** These functions did not filter on `deletedAt`. Soft-deleted tournaments (deletedAt set) could still be OPEN/CLOSED with `closesAt`/`settledAt` set and could be picked up by intervals.  
   - **Impact:** Low: `runAutomationJob` uses `getTournamentById`, which already excludes soft-deleted tournaments, so jobs would skip with “Tournament not found”. Still, listing them was redundant and could cause extra DB work or confusion.  
   - **Fix:** Added `isNull(tournaments.deletedAt)` to the `where` clause in all three functions.

No other concrete bugs were found in:

- Schema/DB selection (SQLite when `DATABASE_URL` unset, MySQL when set; `loadEnv` runs first in `index.ts`).
- Auth/login/register and session (login uses `getUserByUsername`; MySQL missing-column handled in `initMysql`).
- Tournament create/validation (amount ≥ 0 allowed; freeroll/guaranteed-prize supported).
- Submissions (cost 0 path, no payment; `getTournamentById` used with null checks).
- Admin flows (create/edit, distribute prizes, delete, repair refunds).
- Refunds/repair (`refundTournamentParticipants` early-return for amount ≤ 0; `getCancelledUnfinishedTournamentIds` already had `isNull(deletedAt)`).
- Settlement (guaranteed prize used when set; freeroll finance with `netProfit = -distributed`).
- Visibility/soft-delete (`getTournamentById`, `getActiveTournaments`, `getTournaments` exclude deleted; `getTournamentDeletedAtMap` used for `tournamentRemoved` on submissions).
- Client (Submissions/Admin: Edit and Duplicate buttons gated by `!removed`/`canEdit`; PredictionForm handles NOT_FOUND when tournament is deleted).

---

## 3. Root Cause of Each Issue

- **Automation/cleanup including soft-deleted:** Queries were written before or without aligning with the rule that “soft-deleted = excluded from all operational lists”. The rest of the app (e.g. `getTournamentById`) already enforced this; these three helpers were the only ones still not filtering on `deletedAt`.

---

## 4. Exact Fixes Applied

- **server/db.ts**
  - `getTournamentsToAutoClose()`: In the `where` clause, added `isNull(tournaments.deletedAt)` next to `eq(tournaments.status, "OPEN")` and `isNotNull(tournaments.closesAt)`.
  - `getTournamentsToSettleNow()`: In the `where` clause, added `isNull(tournaments.deletedAt)` next to status and `settledAt` conditions.
  - `getTournamentsClosingSoon()`: In the `where` clause, added `isNull(tournaments.deletedAt)` next to `eq(tournaments.status, "OPEN")` and `isNotNull(tournaments.closesAt)`.

All changes are backward-compatible and only narrow the result set to non–soft-deleted tournaments.

---

## 5. What Was Verified as Working

- **Startup:** Server starts; `loadEnv` is first import in `server/_core/index.ts`, so `process.env` (including `DATABASE_URL`) is set before DB code runs.  
- **DB mode:** `USE_SQLITE = !process.env.DATABASE_URL`; when `DATABASE_URL` is unset (e.g. local dev), SQLite and `drizzle/schema-sqlite` are used; when set, MySQL and `drizzle/schema.ts` are used.  
- **Auth:** Login/register use `getUserByUsername`; MySQL path ensures `users.stripeCustomerId` exists via `initMysql()` ALTER.  
- **Tournament creation:** Admin and Free Competition Builder allow amount ≥ 0; validation and API use `z.number().int().min(0)`.  
- **Submissions:** Cost 0 skips payment/deduction; `getTournamentById` is used and null-checked before submit/update.  
- **Admin:** Create/edit, distribute prizes, delete tournament, repair refunds; permissions and audit logging referenced.  
- **Freeroll/guaranteed prize:** Settlement uses `guaranteedPrizeAmount` when set; finance record uses `totalCollected = 0`, `netProfit = -distributed` for freerolls; leaderboards use guaranteed pool when applicable.  
- **Delete/visibility:** `getTournamentById` and public lists exclude `deletedAt`; submissions get `tournamentRemoved` from `getTournamentDeletedAtMap`; UI hides Edit/Duplicate for removed tournaments.  
- **Refunds/repair:** `refundTournamentParticipants` returns early for amount ≤ 0; repair uses `getCancelledUnfinishedTournamentIds` (which already filters `isNull(deletedAt)`).  
- **Automation:** `runAutomationJob` uses `getTournamentById` and skips when tournament is missing (e.g. soft-deleted); after the fix, auto-close/settle/closing-soon queries also exclude soft-deleted tournaments.  
- **Payments/accounting:** Financial records support `recordType` “income”/“refund”; freeroll records do not create fake entry revenue.

---

## 6. Remaining Risks or Limitations

- **Local dev DB choice:** If `.env` (or environment) sets `DATABASE_URL`, the app uses MySQL. For local SQLite, leave `DATABASE_URL` unset. No code change was made to force SQLite in dev.  
- **MySQL schema drift:** If new columns are added to `drizzle/schema.ts` (MySQL) and the DB is not migrated, similar “Unknown column” errors can occur; `initMysql` currently only ensures `stripeCustomerId`.  
- **Soft-deleted in admin lists:** `getTournaments()` excludes `deletedAt`, so soft-deleted tournaments do not appear in the main admin tournament list; there is no separate “deleted” audit view.  
- **PredictionForm for deleted tournament:** Navigating to `/predict/:id` for a soft-deleted tournament returns NOT_FOUND from `getById`; the UI shows error/not-found state. Consider a friendlier “תחרות לא נמצאה” message if not already present.  
- **Custom prize schemas:** Custom settlement schemas should respect the `prizePoolTotal` (and thus guaranteed prize) passed from the settlement layer; no additional checks were added in this pass.

---

## 7. Local Dev Stability

- **Stable:** With `DATABASE_URL` unset, the app uses SQLite and `./data/worldcup.db`. `loadEnv` runs first, so no accidental use of a stale or wrong env before DB init.  
- **Recommendation:** Do not set `DATABASE_URL` in `.env` for local development if you intend to use SQLite.

---

## 8. Internal Consistency of Admin / Tournament / Submission / Payment Flows

- **Admin:** Create (chance, lotto, football, football_custom, Free Competition Builder, wizard) allows amount ≥ 0 and optional guaranteed prize; distribute prizes uses settlement with guaranteed prize; delete does soft-delete when completed or hard-delete + refund when not.  
- **Tournament:** Visibility and soft-delete are consistent: `getTournamentById`, `getActiveTournaments`, `getTournaments`, and (after the fix) auto-close, settle, and closing-soon all exclude soft-deleted tournaments.  
- **Submissions:** Submit/update require a non-deleted tournament via `getTournamentById`; submission lists include `tournamentRemoved` for removed tournaments; UI disables Edit/Duplicate when removed.  
- **Payment/accounting:** Entry fee 0 creates no payment transaction; refund path skips when amount ≤ 0; financial record for freerolls uses zero entry revenue and negative net profit; refund records use `recordType: "refund"`.

---

## Summary

- **Changes:** One file (`server/db.ts`), three functions updated to exclude soft-deleted tournaments from auto-close, settle, and closing-soon queries.  
- **Verified:** Startup order, DB mode selection, auth, tournament/submission/admin flows, freeroll/guaranteed-prize, delete/visibility, refunds/repair, automation, and payment/accounting behavior.  
- **Result:** Project is in a stable, internally consistent state for the areas audited; no breaking changes; local dev remains stable when using SQLite (no `DATABASE_URL`).
