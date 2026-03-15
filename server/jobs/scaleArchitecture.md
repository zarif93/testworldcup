# Phase 14: Scale architecture and concurrency safety

## Failure recovery design

### Mid-settlement crash

- **State:** Tournament is in `SETTLING`; some winners may already have received prize credits.
- **Recovery path:**
  1. Run `runSettlementRecovery()` (or `runRecoverSettlements()`). It finds all tournaments with `status = SETTLING`.
  2. For each, if prize `point_transactions` already exist for that tournament → mark tournament `ARCHIVED` (done).
  3. Otherwise call `doDistributePrizesBody` again. Payout loop is **resumable**: it reads `tournament_financial_events` for type `PRIZE_ALLOCATED`, builds the set of already-paid `submissionId`s, and skips those. So no double credit.
- **Partial payout corruption:** Avoided by idempotent per-winner credit (skip if already in PRIZE_ALLOCATED events) and by not moving to ARCHIVED until all payouts and financial record are done.

### Stuck lock

- Locks in `tournament_locks` have `expiresAt`. If a process dies without releasing, the lock expires and another instance can acquire after TTL.

## Query scaling strategy

### Leaderboard

- **Caching:** 15s TTL in-memory cache per tournament (`getChanceLeaderboard`, `getLottoLeaderboard`). Key: `chance:{id}` / `lotto:{id}`.
- **Heavy read mitigation:**
  - Queries use `getSubmissionsByTournament(tournamentId)` (indexed) instead of full table scan.
  - Index: `submissions(tournamentId, status)`.
- **Future:** For multi-instance, use a shared cache (e.g. Redis) with same TTL, or a dedicated read replica for leaderboard queries.

### Settlement and financial reads

- Settlement runs under a distributed lock (one at a time per tournament). No read scaling needed for the write path.
- Reconciliation job reads financial records and runs integrity checks; can be run at low frequency (e.g. daily).
