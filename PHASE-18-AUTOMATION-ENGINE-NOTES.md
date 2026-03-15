# Phase 18: Automation Engine — Implementation Notes

## Overview

Phase 18 adds a **lifecycle automation engine** that automates tournament transitions (close submissions, lock, finalize results, settle) based on tournament dates, while keeping full manual fallback and avoiding unsafe automatic actions.

---

## 1. Files Changed

| Area | File | Change |
|------|------|--------|
| Schema | `drizzle/schema-sqlite.ts` | Added `automationJobs` table (already present from prior step). |
| DB | `server/db.ts` | `automation_jobs` CREATE TABLE; `insertAutomationJob`, `getAutomationJobsForTournament`, `getTournamentsToSettleNow`, `runAutoCloseSingleTournament`; `runAutoCloseTournaments` / `runAutoCloseSingleTournament` now set `removalScheduledAt` (5 min) for non-lotto so locked removal runs. |
| Automation | `server/automation/jobTypes.ts` | **New.** Job type constants: `tournament_close_submissions`, `tournament_lock`, `tournament_finalize_results`, `tournament_settle`, `tournament_publish`. |
| Automation | `server/automation/runJob.ts` | **New.** Idempotent `runAutomationJob(jobType, tournamentId, options?)`; logs to `automation_jobs` and logger; never throws. |
| Automation | `server/automation/getNextScheduledActions.ts` | **New.** Read-only derivation of next scheduled actions from tournament state (closesAt, drawDate/Time, settledAt). |
| Core | `server/_core/index.ts` | Replaced direct `runAutoCloseTournaments()` with per-tournament `runAutomationJob(TOURNAMENT_CLOSE_SUBMISSIONS, id)`; added 60s interval for `getTournamentsToSettleNow()` + `runAutomationJob(TOURNAMENT_SETTLE, id)`. |
| API | `server/routers.ts` | Import `getAutomationJobsForTournament`; added admin query `getTournamentScheduledActions` (tournamentId → nextScheduledActions + recentJobs). |
| Admin UI | `client/src/components/admin/SchemaDebugModal.tsx` | **New block:** Phase 18 Automation — Next scheduled actions + Last automation runs (read-only). |
| Docs | `PHASE-18-AUTOMATION-ENGINE-NOTES.md` | **New.** This file. |

---

## 2. Automation Architecture

- **Job table (`automation_jobs`)**: Stores each execution attempt: `jobType`, `entityType` (e.g. `tournament`), `entityId`, `scheduledAt`, `executedAt`, `status` (`executed` | `skipped` | `failed`), `lastError`, `createdAt`. SQLite-only for now; other backends get empty job history.
- **Runner (`runAutomationJob`)**: Single entry point for executing one job. Checks preconditions (status, dates, draw locked, etc.); if not met → skip and log; if met → call existing DB/server functions (e.g. `runAutoCloseSingleTournament`, `setTournamentResultsFinalized`, `distributePrizesForTournament`). All outcomes (executed/skipped/failed) are written to `automation_jobs` and logger.
- **Tick (in `_core/index.ts`)**: Two 60s intervals:
  1. **Close submissions:** `getTournamentsToAutoClose()` → for each id, `runAutomationJob(TOURNAMENT_CLOSE_SUBMISSIONS, id)`.
  2. **Settle:** `getTournamentsToSettleNow()` → for each id, `runAutomationJob(TOURNAMENT_SETTLE, id, { scheduledAt })`.
- **Manual flows:** Unchanged. Admins can still lock, settle, finalize results manually; automation only runs when conditions are met and does not replace manual control.

---

## 3. Job Types Supported

| Job type | When it runs (tick / trigger) | Preconditions | Effect |
|----------|--------------------------------|----------------|--------|
| `tournament_close_submissions` | Tick: OPEN + `closesAt` ≤ now | Status OPEN; in `getTournamentsToAutoClose()` | `runAutoCloseSingleTournament` → LOCKED/CLOSED + `lockedAt` + `removalScheduledAt` (5 min) for non-lotto |
| `tournament_lock` | Not scheduled by tick (manual or future) | Status OPEN | `lockTournament(id, true)` |
| `tournament_finalize_results` | Not scheduled by tick (manual or future; draw date can be used by a future extension) | Not RESULTS_UPDATED/SETTLING/ARCHIVED; lotto/chance: draw locked; football: match results in | `setTournamentResultsFinalized(tournamentId)` |
| `tournament_settle` | Tick: status in (RESULTS_UPDATED, LOCKED, CLOSED) + `settledAt` ≤ now | Not ARCHIVED/PRIZES_DISTRIBUTED/SETTLING; “already distributed” → skip (idempotent) | `distributePrizesForTournament(tournamentId)` |
| `tournament_publish` | Optional / not implemented | — | Currently logs “skipped – not implemented” |

---

## 4. Where Automation Is Triggered / Executed

- **Triggered:** In `server/_core/index.ts` setInterval (every 60s):
  - Close: list from `getTournamentsToAutoClose()`.
  - Settle: list from `getTournamentsToSettleNow()`.
- **Executed:** `server/automation/runJob.ts` → `runAutomationJob(jobType, tournamentId, options?)`, which calls existing DB logic and records the result.

---

## 5. Hook Builder/Runtime Dates

- **Close:** Uses existing `closesAt`. When OPEN and `closesAt` ≤ now, tick runs `tournament_close_submissions`.
- **Settle:** Uses existing `settledAt`. When status allows and `settledAt` ≤ now, tick runs `tournament_settle`.
- **Finalize:** No tick yet. `getNextScheduledActions` shows a possible “finalize” time for lotto/chance from `drawDate` + `drawTime` (after draw is locked). Football has no single scheduled finalization date in the model.

---

## 6. Safety / Idempotency / Fallback

- **Idempotent:** If already locked/settled/finalized, the runner skips and records `skipped` (e.g. “Already settled or settling”, “Prizes already distributed”).
- **Missing data:** If tournament not found, required data missing, or preconditions not met → skip with reason, log, no throw.
- **No crash:** All job execution is in try/catch; failures are logged and stored as `failed` with `lastError`; the process never throws from the job runner.
- **Manual override:** Lock, settle, and result updates remain available to admins; automation only complements them.

---

## 7. Admin Visibility

- **API:** `admin.getTournamentScheduledActions({ tournamentId })` returns:
  - `nextScheduledActions`: array of `{ jobType, scheduledAt, reason }` derived from tournament state (read-only).
  - `recentJobs`: last 20 automation job rows (id, jobType, status, executedAt, lastError, createdAt).
- **UI:** In Schema Debug modal (competition detail), a read-only “Phase 18: Automation” block shows next scheduled actions and last automation runs.

---

## 8. Backward Compatibility

- Existing manual flows (lock, settle, finalize, update results) unchanged.
- Tournaments without `closesAt` / `settledAt` are simply not picked by the tick; no automation runs for them.
- Automation is additive; no removal of manual APIs or behavior.
- If scheduling is uncertain or conditions are not met, the job is skipped, not executed.

---

## 9. Future Extension Points

- **Notifications:** Emit events or call notification hooks when a job is executed (e.g. “tournament closed”, “tournament settled”).
- **More job types:** e.g. `tournament_publish` when implemented; optional “finalize results” tick using `drawDate`/`drawTime` or a dedicated field.
- **Scheduled jobs table:** Optional future model where jobs are inserted with `scheduled_at` and a worker runs due jobs (instead of only “poll tournament list”).
- **Non-SQLite:** Extend `automation_jobs` and `getAutomationJobsForTournament` / `insertAutomationJob` to other DBs for full job history everywhere.

---

## 10. Remaining Gaps (Optional / Later)

- **Auto finalize results:** No tick yet that runs `tournament_finalize_results` by date (e.g. after draw date for lotto/chance); can be added when desired.
- **tournament_publish:** Placeholder only; implement when publish workflow is defined.
- **Football finalization by tournament:** Currently finalize checks “any match has results”; for multi-tournament football, filtering by tournament may be needed.
