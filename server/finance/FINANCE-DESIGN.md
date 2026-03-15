# Commission / Agent / PnL – Implementation Contract

## 1. Rounding rule

**Rule: floor (round down) for all points calculations.**

- **Platform commission:** `floor(totalPool * commissionBasisPoints / 10_000)`
- **Agent commission (per agent):** `floor(agentGeneratedCommission * agentShareBasisPoints / 10_000)`
- **Prize pool:** `totalPool - platformCommission` (integer)
- **Rank distribution / prize per winner:** `floor(prizePool * rankShareBasisPoints / 10_000)` or equal split `floor(prizePool / winnerCount)`
- **Payout tables:** All amounts computed with `Math.floor`
- **Refunds:** `floor(amount * refundPercent / 100)` when partial

No half-up, no banker's rounding. Single rule everywhere.

---

## 2. Residue allocation rule

**Rule: Residue stays with the platform.**

- When splitting commission across agents using floor, any leftover points (from `platformCommission - sum(agentCommission)`) remain platform revenue.
- When distributing prizes by rank or equal split using floor, any leftover points (from `prizePool - sum(prizeToWinner)`) remain with the platform (not given to first rank or any winner).
- Deterministic and auditable.

---

## 3. Settlement idempotency key patterns

| Event type           | Idempotency key pattern                    | Notes |
|----------------------|-------------------------------------------|--------|
| ENTRY_FEE            | `entry:{submissionId}`                    | One per submission. |
| PLATFORM_COMMISSION  | `settlement:{tournamentId}:platform`       | One per tournament at settlement. |
| AGENT_COMMISSION     | `settlement:{tournamentId}:agent:{agentId}`| One per agent per tournament. |
| PRIZE_PAYOUT         | `settlement:{tournamentId}:prize:{submissionId}` | One per winning submission. |
| REFUND               | `refund:{refundId}`                       | refundId = unique id (e.g. `tournament:{tournamentId}:{userId}` for tournament refunds, or UUID). |
| ADJUSTMENT           | `adjustment:{adjustmentId}`               | adjustmentId = unique id. |

Partial settlement retries: before inserting any event, check if idempotency key exists; if so, skip insert (or return existing id). No duplicate payout or commission events.

---

## 4. Settlement transaction boundary

**One transaction** wraps (1) all settlement financial_events (PRIZE_PAYOUT, PLATFORM_COMMISSION, AGENT_COMMISSION) and (2) tournament status update to ARCHIVED. Prize credits (point_transactions, transparency log, tournament_financial_events PRIZE_ALLOCATED) and financial_records run before this transaction.

**SQLite (better-sqlite3):** Async transaction callbacks are not supported; settlement runs as two steps: (1) recordSettlementFinancialEvents, (2) tournament status → ARCHIVED. Idempotency keys make retries safe. Partial state possible only if process dies between (1) and (2) (tournament stays SETTLING; retry rewrites events and updates ARCHIVED).

**Non-SQLite (e.g. MySQL):** One transaction wraps settlement events + ARCHIVED update.

**Failure modes:**
- **Transaction throws (non-SQLite):** Entire settlement-event write + ARCHIVED update rolls back; tournament remains SETTLING. Retry is safe.
- **Process crash mid-transaction:** DB commits atomically; outcome is either full commit or full rollback.
- **Partial state (SQLite):** If process dies after events but before ARCHIVED update, tournament stays SETTLING; next run writes events again (idempotent) and updates ARCHIVED.

---

## 5. Refund accounting rule

- **Entry-fee refunds (REFUND events):** Reduce effective entries for competition PnL.  
  `competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds` (all from financial_events).
- **Prize reversals:** Not implemented as separate event type. If added, would reduce totalPrizesWon in the same formula.
- **walletNetFlow:** Cash flow from point_transactions: deposits + prizes + refunds − entries − withdrawals. Refunds (actionType `refund`) add to wallet; use same entry total (from events) for consistency where needed.
