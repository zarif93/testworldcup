# Phase 15: Idempotency and critical-path audit

## Critical write paths

| Path | Idempotent? | Retry-safe? | Notes |
|------|-------------|-------------|--------|
| **Submission create** | Keyed by idempotencyKey (client) 30s TTL | Yes | Same key returns cached result; DB path uses transaction + OPEN/maxParticipants check. |
| **Entry deduction** | No duplicate deduction per (user, tournament, submission) | Yes | Single transaction in `executeParticipationWithLock`; balance check and insert submission atomic. |
| **Prize distribution** | Per-tournament: only one process can set SETTLING; per-winner: skip if already in PRIZE_ALLOCATED events | Yes | Resumable payout loop; recovery re-runs `doDistributePrizesBody` and skips already-paid. |
| **Refund** | Per-user: `hasUserRefundForTournament` / payment status | Yes | `refundTournamentParticipants` skips already-refunded. |
| **Notification delivery** | Mark delivered/failed after send attempt | Yes | Worker processes pending once; status update prevents re-delivery. |
| **State transition** | Lifecycle allows only valid transitions; lock prevents concurrent transition | Yes | Use transition lock for multi-instance. |

## Gaps patched

- **Settlement mid-crash:** Payout loop now skips winners already present in `tournament_financial_events` (PRIZE_ALLOCATED). Recovery can safely re-run.
- **Submission after LOCKED:** `executeParticipationWithLock` and `insertSubmission` both check `status === 'OPEN'` inside the same transaction as the insert.
- **maxParticipants race:** Enforced inside the same transaction as submission insert in both paths.

## Retry safety

- Settlement: use `runSettlementJobWithLock`; lock TTL ensures stuck process releases.
- Notification worker: each cycle fetches pending; status updated after attempt; no double send for same notification.
