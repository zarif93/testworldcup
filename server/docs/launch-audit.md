# Phase 16: Final launch audit

End-to-end readiness review before real-world launch. No new features or major refactors.

---

## 1. Critical flow verification

| Flow | Entry point | Validation / behavior | Status |
|------|-------------|------------------------|--------|
| **User registration** | `auth.register` (tRPC) → `registerUser()` | Username/email uniqueness, password hash, user row + optional points. | Verified: auth.ts registerUser; routers.ts auth.register. |
| **Login** | `auth.login` (tRPC) → `loginUser()` | Rate limit (loginRateLimit), password verify, JWT cookie set. Device recorded for anti-cheat. | Verified: auth.ts loginUser; routers set cookie; recordDevice on success. |
| **Tournament join** | `submissions.create` (tRPC) | Tournament OPEN, not locked; balance/cost; maxParticipants and status checked in same transaction (executeParticipationWithLock or insertSubmission). Idempotency key supported. | Verified: executeParticipationWithLock + insertSubmission both enforce OPEN + capacity. |
| **Submission update** | `submissions.update` (tRPC) → `updateSubmissionContent()` | Owner or admin; tournament OPEN and not locked. Audit log with optional IP/userAgent. | Verified: db updateSubmissionContent; routers pass getAuditIp. |
| **Leaderboard view** | `leaderboard.getChanceLeaderboard` / `getLottoLeaderboard` (tRPC) | Rate limit (leaderboard); 15s cache per tournament; data from getSubmissionsByTournament (indexed). trackLeaderboardView. | Verified: rateLimits checkLeaderboardRateLimit; db cache + getSubmissionsByTournament. |
| **Settlement cycle** | Automation interval (getTournamentsToSettleNow → runAutomationJob TOURNAMENT_SETTLE) or manual `distributePrizesForTournament` | Status not PRIZES_DISTRIBUTED/ARCHIVED/SETTLING; single-writer via SETTLING update; resumable payout (skips already-paid per PRIZE_ALLOCATED events). | Verified: distributePrizesForTournament lock; doDistributePrizesBody resumable. |
| **Prize credit** | Inside `doDistributePrizesBody` | addUserPoints(..., "prize", referenceId: tournamentId); transparency log; tournament_financial_event PRIZE_ALLOCATED. No double credit (skip if submissionId in prior PRIZE_ALLOCATED). | Verified: loop skips alreadyPaidSubIds; point_transactions + events. |
| **Refund flow** | `refundTournamentParticipants()` (e.g. repair flow or admin) | Idempotent per user (hasUserRefundForTournament / payment status); addUserPoints(..., "refund"); REFUND_ISSUED financial event. | Verified: db refundTournamentParticipants; repairUnrefundedCancelledCompetitions. |

**Preconditions for settlement:** Tournament status RESULTS_UPDATED / LOCKED / CLOSED; settledAt <= now (for scheduled); no prior prize point_transactions for that tournament.

---

## 2. Failure scenario review

| Scenario | Simulated behavior | Recovery / mitigation |
|---------|--------------------|------------------------|
| **DB temporary failure** | getDb() returns null or throws; API calls that need DB fail. /ready and /health return 503 or db: "error". | Retry client-side; ensure DB and disk are stable; restore from backup if data loss. Startup validates DB in production and exits if unavailable. |
| **Settlement crash mid-loop** | Tournament left in SETTLING; some winners may have prize credits and PRIZE_ALLOCATED events, others not. | runRecoverSettlements (or triggerSettlementRecovery) re-runs doDistributePrizesBody; payout loop skips submissionIds already in PRIZE_ALLOCATED. No double credit. After full completion, status → ARCHIVED. |
| **Notification worker failure** | Pending notifications remain status=created; delivery cycle fails for some; failed marked with lastError. | Worker is optional (in-app notifications still work). Run runDeliveryCycle manually or fix worker; retry logic (3 attempts) and status=delivered/failed prevent duplicate send. |
| **Rate-limit spikes** | Clients get 429; rateLimitHits metric increments. Submissions/leaderboard/login limited per config. | In-memory limits; after window passes, requests succeed. For multi-instance, consider Redis-backed limits. Document limits for support. |
| **Reconciliation anomaly** | verifyPrizePoolIntegrity returns ok: false (e.g. distributed > pool). reconciliationAnomalies metric increments; onAnomaly hook and log. | runFinancialReconciliationJob (or system.runReconciliation) surfaces anomalies; investigate and fix data or code; no auto-revert. |

---

## 3. Monitoring readiness

- **Health / readiness**
  - **GET /health** – JSON: ok, db, dbError, metrics, timestamp. 200 if db ok, else 503.
  - **GET /ready** – 200 "ready" or 503 "not ready" (DB only).
  - **tRPC system.health** – Same payload as /health.
  - Sufficient for load balancer and basic uptime checks.

- **Metrics coverage (early launch)**
  - settlementRuns, settlementFailures
  - notificationDeliverySuccess, notificationDeliveryFailure
  - tournamentJoins
  - rateLimitHits
  - reconciliationAnomalies
  - Exposed via /health and system.getMetrics (admin). In-memory; for scale consider exporting to Prometheus/StatsD.

- **Critical logs**
  - Structured production logs: server/_core/logger (JSON in production with level, message, meta).
  - logError(context, error, meta) used in critical paths (e.g. submission.create).
  - Settlement: logger in runAutomationJob and distributePrizesForTournament; recovery logs recovered/errors.
  - To trace: include requestId or correlationId in meta where available; search logs by tournamentId, userId, or error message.

---

## 4. Configuration clarity

**Minimal required config**

| Env | Local | Staging | Production |
|-----|--------|--------|------------|
| **NODE_ENV** | development | staging or production | production |
| **JWT_SECRET** | Optional (can be empty) | Set | **Required** (non-empty) |
| **DATABASE_URL** | Omit (SQLite ./data) | Optional (SQLite or MySQL) | Optional; if omit, SQLite with write access to ./data |
| **ADMIN_SECRET** | Optional | Recommended | Recommended; if set, must be non-empty |
| **PORT** | 3000 or free | Set as needed | Set as needed |
| **BASE_URL** | Optional | Full URL | Full URL (for OAuth/links) |
| **INSTANCE_ID** | Optional | Optional (multi-instance) | Optional (worker/lock identity) |
| **ALLOWED_ORIGINS** | Optional | Optional | Recommended for CORS |
| **SUPER_ADMIN_USERNAMES** | Default Yoven!,Yoven | Override if needed | Override if needed |

Startup runs `validateConfigAndExitIfInvalid()`: in production, exits with code 1 if JWT_SECRET missing or DB connectivity fails.

---

## 5. Launch risk checklist

**Known risks**

- **In-memory metrics and rate limits** – Reset on restart; not shared across instances. Mitigation: Single instance at launch or accept resets; plan Redis (or similar) for multi-instance.
- **SQLite as default** – Single-writer; fine for moderate load. Mitigation: Use MySQL (DATABASE_URL) for higher concurrency.
- **Notification delivery** – Stub implementation; no real email/SMS. Mitigation: Pending queue and status exist; plug in provider and run worker.
- **Abuse enforcement** – Soft warn / temp block are hooks; no automatic block in UI yet. Mitigation: Use getReviewFlaggedUserIds and escalateForReview; add UI blocks when ready.
- **No built-in backup cron** – Backup procedure is documented, not automated. Mitigation: Schedule OS/DB backups externally.

**Mitigations in place**

- Settlement: Single-writer (SETTLING), resumable payout, recovery job.
- Submissions: OPEN + maxParticipants in same transaction; idempotency key support.
- Refunds: Idempotent per user; repair job for cancelled competitions.
- Config: Fail-fast on missing JWT_SECRET and DB in production.
- Health/ready and metrics for basic observability.

**Acceptable launch limitations**

- Single region/single instance recommended until metrics and locks are externalized.
- Leaderboard and rate limits are per-process; acceptable for controlled launch.
- Notification delivery can remain stub until provider is integrated; in-app notifications work.
- Reconciliation is periodic manual or scheduled job; no real-time auto-fix.

---

## 6. Quick verification commands (for humans)

- **Health:** `curl -s http://localhost:PORT/health | jq`
- **Ready:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:PORT/ready` (expect 200)
- **Metrics (admin):** tRPC `system.getMetrics`
- **Stuck settlements:** tRPC `system.getStuckSettlementTournaments`
- **Trigger recovery:** tRPC `system.triggerSettlementRecovery`
- **Run reconciliation:** tRPC `system.runReconciliation` (e.g. sinceDays: 7)
