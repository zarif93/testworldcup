# Phase 23: Smart Lifecycle Automation – Implementation Notes

## Overview

Phase 23 extends the automation system with a **lifecycle state machine** (read-only mapping), **retry logic**, **automation health metrics**, and **admin visibility** of lifecycle and retry state. Existing automation behavior and manual admin controls are unchanged.

---

## Files Changed

| Area | File | Change |
|------|------|--------|
| Automation | `server/automation/lifecycleStateMachine.ts` | **New.** Canonical phases, getLifecyclePhase, getLifecyclePhaseLabel, getNextPossibleTransitions, getPendingLifecycleActions |
| Schema | `drizzle/schema-sqlite.ts` | automationJobs: added retryCount, nextRetryAt, maxRetries |
| DB init | `server/db.ts` | ALTER TABLE automation_jobs: retry_count, next_retry_at, max_retries; insertAutomationJob accepts retry/nextRetry/maxRetries; getAutomationJobsForTournament returns retryCount/nextRetryAt; getRetryableFailedJobs, getAutomationFailedCountSince, getAutomationTotalRetryCount, getStuckSettlingTournamentIds, getLongPendingTournamentsCount |
| Automation | `server/automation/runJob.ts` | options.retryCount; logAndRecord passes retryCount and maxRetries to insertAutomationJob |
| Core | `server/_core/index.ts` | Import getRetryableFailedJobs; new setInterval: retry failed jobs (valid job types, retryCount+1) |
| Analytics | `server/analytics/dashboard.ts` | getAutomationAnalytics: added failedLast24h, totalRetries, longPendingCount, stuckSettlingCount |
| Router | `server/routers.ts` | getTournamentScheduledActions: returns lifecyclePhase, lifecyclePhaseLabel, nextPossibleTransitions, pendingLifecycleActions, retryState |
| Client | `client/src/components/admin/AnalyticsDashboardSection.tsx` | Automation health card: failedLast24h, totalRetries, longPendingCount, stuckSettlingCount |
| Client | `client/src/components/admin/SchemaDebugModal.tsx` | Lifecycle phase, next possible transitions, retry state; recent jobs show retryCount and nextRetryAt |

---

## Lifecycle Model

Canonical phases (display only; DB status values unchanged):

| Phase | DB status(es) | Description |
|-------|----------------|-------------|
| DRAFT | UPCOMING, DRAFT | Not yet open |
| PUBLISHED | (optional) | Mapped same as OPEN if needed |
| OPEN | OPEN | Accepting submissions |
| CLOSED | LOCKED, CLOSED | Submissions closed; results may be pending |
| RESULTS_PENDING | LOCKED/CLOSED without resultsFinalizedAt | Waiting for results |
| RESULTS_FINALIZED | RESULTS_UPDATED (or LOCKED/CLOSED with resultsFinalizedAt) | Results in; ready for settlement |
| SETTLEMENT_PENDING | SETTLING | Settlement in progress |
| SETTLED | (conceptually after prizes) | Mapped to ARCHIVED in DB |
| ARCHIVED | ARCHIVED, PRIZES_DISTRIBUTED | Final state |

Mapping is in `getLifecyclePhase(tournament)`. No DB writes from the lifecycle module.

---

## Automation Chain Logic

- **When CLOSED** (LOCKED/CLOSED): Existing logic already “checks if results ready” in TOURNAMENT_FINALIZE_RESULTS (draw locked for lotto/chance; match results for football). No change.
- **When RESULTS_FINALIZED**: Settlement is driven by `settledAt` and `getTournamentsToSettleNow()`; cron runs TOURNAMENT_SETTLE. No new chain step.
- **When SETTLED**: `distributePrizesForTournament` sets status to ARCHIVED; `getTournamentsToCleanup()` and `cleanupTournamentData` handle display-window cleanup. No new chain step.

Chains remain **idempotent** (each job checks state and skips if already done), **respect manual overrides**, and **log** via existing `insertAutomationJob`.

---

## Retry Strategy

- **Columns:** `retry_count` (attempt index, 0-based), `next_retry_at` (when to retry), `max_retries` (default 3).
- **On failure:** `insertAutomationJob` is called with status `failed` and `retryCount`; if `retryCount < maxRetries`, `next_retry_at` is set to now + 5 minutes.
- **Retry cron:** Every 60s, `getRetryableFailedJobs()` returns last failed job per (entityType, entityId, jobType) where `status=failed`, `retry_count < max_retries`, and `next_retry_at <= now`. For each, `runAutomationJob(jobType, entityId, { retryCount: retryCount + 1 })` is called. Only known job types are run.
- **Escalation:** On failure, existing admin notification (AUTOMATION_FAILED) is sent; no additional escalation in this phase.

---

## Admin Visibility

- **Per-tournament (Schema Debug / automation section):** `getTournamentScheduledActions` now returns:
  - **lifecyclePhase** / **lifecyclePhaseLabel** – current phase and Hebrew label
  - **nextPossibleTransitions** – possible next steps (display)
  - **pendingLifecycleActions** – same as nextScheduledActions (derived from tournament state)
  - **retryState** – if last job is failed: `{ retryCount, nextRetryAt }`
  - **recentJobs** – each job can show retryCount and nextRetryAt

- **Analytics dashboard:** Automation health card shows:
  - executed / skipped / failed (unchanged)
  - failedLast24h, totalRetries, longPendingCount (7+ days OPEN/LOCKED/CLOSED), stuckSettlingCount (SETTLING)

---

## Analytics Extensions

- **getAutomationAnalytics** (and API): added **failedLast24h**, **totalRetries**, **longPendingCount**, **stuckSettlingCount**.
- **getAutomationFailedCountSince(sinceMs)** – count of failed jobs with `createdAt >= since`.
- **getAutomationTotalRetryCount()** – sum of `retry_count` over failed jobs.
- **getLongPendingTournamentsCount(days)** – count OPEN/LOCKED/CLOSED with `createdAt` older than N days.
- **getStuckSettlingTournamentIds()** – tournaments with status SETTLING (existing helper).

---

## Backward Compatibility

- Existing status values and flows unchanged. Lifecycle is a **read-only** mapping.
- New columns on `automation_jobs` are added via ALTER; existing rows get defaults (retry_count 0, max_retries 3, next_retry_at null).
- Manual close/lock/finalize/settle/archive unchanged. Retries only re-run the same job type for the same entity.
- Existing admin procedures and UI remain; only extended with new fields.

---

## Fallback Behavior

- If SQLite or `automation_jobs` is missing: retry helpers return []/0; insertAutomationJob no-ops; getRetryableFailedJobs returns [].
- If new columns are missing (old DB): migration adds them on startup; select/insert use optional chaining/defaults where needed.
- Retry cron: only runs jobs whose type is in AUTOMATION_JOB_TYPES; errors are caught and logged.
- Analytics: new health metrics use try/catch and return 0 or [] on error.

---

## Extension Points

- **Exponential backoff:** Replace fixed 5-minute delay with e.g. `next_retry_at = now + min(5 * 2^retryCount, 60)` minutes.
- **Max retries per job type:** Make `max_retries` configurable per job type (e.g. in config or DB).
- **Chained auto-run:** After TOURNAMENT_CLOSE_SUBMISSIONS executes, optionally call TOURNAMENT_FINALIZE_RESULTS for the same tournament if conditions are already met (e.g. draw locked).
- **Lifecycle transitions log:** Separate table or payload logging “phase A → phase B” for audits.
- **Large-scale scheduling:** Replace setInterval with a queue (e.g. Bull/Agenda) and workers; keep same job types and idempotency rules.
