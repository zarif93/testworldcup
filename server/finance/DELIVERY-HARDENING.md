# Finance Layer Hardening – Delivery Summary

## 1. Files changed

- **server/finance/FINANCE-DESIGN.md** – Section 4 (settlement transaction boundary, SQLite vs non-SQLite); Section 5 (refund accounting rule).
- **server/finance/financialEventService.ts** – `appendFinancialEvent(input, tx?)` accepts optional transaction client; `getFinancialEventsByUserFiltered(userId, filter)` for date/tournament filters.
- **server/finance/recordFinancialEvents.ts** – `recordSettlementFinancialEventsWithTx(tx, params)` for use inside a transaction; `recordSettlementFinancialEvents` delegates to it with `getDb()`.
- **server/finance/types.ts** – `PlayerFinancialProfile.totalEntryFeeRefunds`; `TournamentFinancialSummary.totalRefunded`; `AgentDashboardMetrics.playerListWithPnL` extended with `totalEntryFeeRefunds`, `agentCommissionFromPlayer`.
- **server/finance/playerFinanceService.ts** – Refund rule: sum REFUND events as `totalEntryFeeRefunds`; `competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds`; `walletNetFlow` includes `getRefundsTotal(userId)`; optional `PlayerFinancialProfileFilter` (from, to, tournamentType, sourceLabel) for filtered profile.
- **server/finance/agentFinanceService.ts** – `getAgentDashboardMetrics(agentId, opts?)` passes opts to `getPlayerFinancialProfile`; player list includes `totalEntryFeeRefunds`, `agentCommissionFromPlayer`.
- **server/finance/tournamentFinanceService.ts** – Sum REFUND events as `totalRefunded` in tournament summary.
- **server/db.ts** – `getRefundsTotal(userId)`; `doDistributePrizesBody`: SQLite path runs `recordSettlementFinancialEvents` then status update; non-SQLite path runs one transaction with `recordSettlementFinancialEventsWithTx` + ARCHIVED update; `getPlayerPnL` uses `getPlayerFinancialProfile` for totals (net, totalBets, totalWinnings, totalCommission); `getAgentPnL` implemented via `getAgentDashboardMetrics` and maps to legacy shape.
- **server/finance/finance-commission.test.ts** – Settlement transaction safety test; refund effect on competitionNetPnL; refund and walletNetFlow; canonical reporting (getPlayerPnL ↔ profile, getAgentPnL ↔ metrics).

---

## 2. Settlement transaction changes

- **Single boundary:** Settlement financial_events (PRIZE_PAYOUT, PLATFORM_COMMISSION, AGENT_COMMISSION) and tournament status update to ARCHIVED are the settlement “commit” boundary.
- **SQLite:** Async transaction callbacks are not supported by better-sqlite3. Settlement runs as two sequential steps: (1) `recordSettlementFinancialEvents(settlementParams)`, (2) `db.update(tournaments).set({ status: "ARCHIVED", ... })`. Idempotency keys make retries safe; partial state only if process dies between (1) and (2).
- **Non-SQLite (e.g. MySQL):** One `db.transaction(async (tx) => { ... })` runs `recordSettlementFinancialEventsWithTx(tx, params)` and then `tx.update(tournaments)...`, so events + ARCHIVED are atomic.
- **Failure modes** documented in FINANCE-DESIGN.md §4.

---

## 3. Exact refund accounting rule adopted

- **Entry-fee refunds (REFUND events):** Reduce effective entries for competition PnL.  
  **Formula:** `competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds`  
  (all from `financial_events`: ENTRY_FEE, PRIZE_PAYOUT, REFUND).
- **Prize reversals:** Not implemented as a separate event type; if added later, they would reduce `totalPrizesWon` in the same formula.
- **walletNetFlow:** `deposits + prizes + refunds − entries − withdrawals`.  
  Refunds are taken from `point_transactions` (actionType `refund`) via `getRefundsTotal(userId)`. Entries use `totalEntryFees` from events for consistency.

---

## 4. Canonical reporting endpoints / services

- **Canonical source of truth:** `financial_events` (and for wallet flow: `point_transactions`).
- **Canonical services:**
  - **Player:** `getPlayerFinancialProfile(userId, opts?)` – competition PnL and wallet flow; supports optional date/tournament filters.
  - **Agent:** `getAgentDashboardMetrics(agentId, opts?)` – aggregates from events and per-player profiles (with same opts).
  - **Tournament:** `getTournamentFinancialSummary(tournamentId)` – from events only (includes `totalRefunded`).
  - **Admin:** `getAdminGlobalDashboard(...)` – from `getFinancialEventsByTimeRange` and aggregates.
- **Legacy wrappers (call canonical services, with fallback):**
  - **getPlayerPnL(userId, opts)** – Uses `getPlayerFinancialProfile(userId, opts)` for `net`, `totalBets`, `totalWinnings`, `totalCommission` when profile has event data; otherwise falls back to totals derived from `getSubmissionFinancialRows` (for data created before financial_events). Keeps `entries` and `transactions` from existing submission/points APIs for detail.
  - **getAgentPnL(agentId, opts)** – Uses `getAgentDashboardMetrics(agentId, opts)` when metrics show any event-derived totals; otherwise falls back to `getSubmissionFinancialRows` + legacy aggregation. Return shape unchanged (profit, loss, net, totalBets, totalWinnings, totalAgentCommission, players[]).

---

## 5. Tests added/updated

- **Settlement transaction safety:** `recordSettlementFinancialEventsWithTx(db, params)` writes events when given db client (used in doDistributePrizesBody; on SQLite without async tx, two-step flow).
- **Refund effect on competitionNetPnL:** REFUND events reduce effective entries; assertion `competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds` (with ENTRY_FEE + REFUND for a test user).
- **Refund and walletNetFlow:** `getPlayerFinancialProfile` includes `totalEntryFeeRefunds` and `walletNetFlow` (refunds from point_transactions).
- **Canonical reporting consistency:** `getPlayerPnL` net and totals align with `getPlayerFinancialProfile` for the same user; `getAgentPnL` structure and totals derived from `getAgentDashboardMetrics`.

---

## 6. Legacy fallback

When there are no financial_events for a user/agent (e.g. data created before the finance layer or test data), getPlayerPnL and getAgentPnL fall back to the previous derivation from submissions + financialRecords + point_transactions so existing tests and legacy data still show correct totals.

## 7. Remaining second-pass items

- **SQLite atomic settlement:** If a future SQLite driver or wrapper supports async transactions, switch the SQLite path to a single transaction for events + ARCHIVED.
- **Filtered walletNetFlow:** `getPlayerFinancialProfile` with date/tournament filter currently leaves `totalDeposits` and `walletNetFlow` as all-time; optional later: filter point_transactions by date/tournament for a filtered wallet flow.
- **getAgentPnL players detail:** Legacy shape has `name`, `phoneNumber`, `betsCount`, `lastActivity`; current wrapper returns null/0. Can enrich from users/submissions if needed.
- **Prize reversal event type:** If business adds prize clawbacks, add event type (e.g. PRIZE_REFUND or REFUND with payload) and include in `totalPrizesWon` (or a separate field) and in the same competitionNetPnL formula.
