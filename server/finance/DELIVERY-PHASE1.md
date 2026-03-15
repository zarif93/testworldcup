# Phase 1 Commission / PnL – Delivery Summary

## 1. Files changed

- **Design**
  - `server/finance/FINANCE-DESIGN.md` – Rounding, residue, idempotency patterns; refund key note.

- **Schema / DB**
  - `drizzle/schema-sqlite.ts` – `tournaments.commissionPercentBasisPoints`, `agent_commission_config`, `financial_events`.
  - `server/db.ts` – init (CREATE agent_commission_config, ALTER tournaments, backfill), `getSchema` exported; `executeParticipationWithLock` (ENTRY_FEE + agent_commissions insert); `doDistributePrizesBody` (basis points + floor, `recordSettlementFinancialEvents`); `refundTournamentParticipants` (REFUND event via `recordRefundFinancialEvent`); `applyParticipationAccounting` (basis points + floor).

- **Finance module**
  - `server/finance/constants.ts` – Defaults, IDEMPOTENCY helpers, `floorPoints`.
  - `server/finance/types.ts` – Basis points types, `PlayerFinancialProfile` (competitionNetPnL, walletNetFlow).
  - `server/finance/commissionService.ts` – `getCommissionBasisPoints`, `computePlatformCommission`, `computePrizePool`, `computeAgentShare`, `getAgentShareBasisPoints`, `computePlatformNetCommission`.
  - `server/finance/financialEventService.ts` – `appendFinancialEvent` (idempotency), get-by-tournament/user/agent/range.
  - `server/finance/playerFinanceService.ts` – `getPlayerFinancialProfile` from `financial_events` + point_transactions.
  - `server/finance/agentFinanceService.ts` – `getAgentDashboardMetrics` from events.
  - `server/finance/tournamentFinanceService.ts` – `getTournamentFinancialSummary` from events.
  - `server/finance/adminFinanceService.ts` – `getAdminGlobalDashboard` from events.
  - `server/finance/recordFinancialEvents.ts` – `recordSettlementFinancialEvents` (PRIZE_PAYOUT, PLATFORM_COMMISSION, AGENT_COMMISSION), `recordRefundFinancialEvent`, `recordAdjustmentFinancialEvent`, `refundIdempotencyKey`.
  - `server/finance/index.ts` – Re-exports.

- **Routers**
  - `server/routers.ts` – Participation commission via `getCommissionBasisPoints` / `getAgentShareBasisPoints`, floor.

- **Tests**
  - `server/finance/finance-commission.test.ts` – Commission, residue, idempotency, PnL, settlement retry.

---

## 2. Schema changes

- **tournaments**
  - `commissionPercentBasisPoints` INTEGER NOT NULL DEFAULT 1250 (1250 = 12.5%).
  - Backfill: existing NULL set to 1250.

- **agent_commission_config** (new)
  - `agentId` INTEGER UNIQUE NOT NULL, `agentShareBasisPoints` INTEGER (nullable). Override per agent; default 5000 (50%) when null.

- **financial_events** (existing; semantics clarified)
  - `amountPoints` ≥ 0; direction by event type (ENTRY_FEE = debit, PRIZE_PAYOUT = credit, etc.).

---

## 3. Rounding rule chosen

**Floor (round down)** for all points: platform commission, agent commission, prize pool, rank distribution, payout tables, refunds. Implemented via `floorPoints()` / `Math.floor` in commission and event code.

---

## 4. Residue rule chosen

**Residue stays with the platform.** Any remainder from floor-based splits (commission or prizes) is not assigned to agents or winners; it remains platform revenue.

---

## 5. Idempotency key patterns implemented

| Event              | Pattern |
|--------------------|--------|
| ENTRY_FEE          | `entry:{submissionId}` |
| PLATFORM_COMMISSION| `settlement:{tournamentId}:platform` |
| AGENT_COMMISSION   | `settlement:{tournamentId}:agent:{agentId}` |
| PRIZE_PAYOUT       | `settlement:{tournamentId}:prize:{submissionId}` |
| REFUND             | `refund:{refundId}` (e.g. `refund:tournament:{tournamentId}:{userId}`) |
| ADJUSTMENT         | `adjustment:{adjustmentId}` |

`appendFinancialEvent` checks by idempotency key before insert; duplicate key returns existing id and does not insert again.

---

## 6. Services added

- **Commission:** `getCommissionBasisPoints`, `computePlatformCommission`, `computePrizePool`, `computeAgentShare`, `getAgentShareBasisPoints`, `computePlatformNetCommission`.
- **Events:** `appendFinancialEvent`, `getFinancialEventsByTournament`, `getFinancialEventsByUser`, `getFinancialEventsByAgent`, `getFinancialEventsByTimeRange`.
- **Summaries:** `getPlayerFinancialProfile`, `getAgentDashboardMetrics`, `getTournamentFinancialSummary`, `getAdminGlobalDashboard`.
- **Recording:** `recordSettlementFinancialEvents`, `recordRefundFinancialEvent`, `recordAdjustmentFinancialEvent`.

All new finance reporting reads from `financial_events` as canonical source.

---

## 7. Tests added

- **server/finance/finance-commission.test.ts**
  - Commission basis points (tournament + legacy fallback, default).
  - `computePlatformCommission` / `computePrizePool` / `computeAgentShare` / `computePlatformNetCommission` (floor).
  - Residue: `floorPoints` and small-pool example (platform gets floor, residue stays with platform).
  - Agent share: `getAgentShareBasisPoints` default when no config.
  - Idempotency: `appendFinancialEvent` same key → same id, single row; `recordRefundFinancialEvent` twice → one REFUND; `recordSettlementFinancialEvents` twice → no duplicate PRIZE_PAYOUT/PLATFORM_COMMISSION.
  - Wallet vs competition PnL: `getPlayerFinancialProfile` exposes `competitionNetPnL` and `walletNetFlow`.
  - Settlement retry: two calls to `recordSettlementFinancialEvents` do not double prize or commission.

---

## 8. Remaining second-pass items

- **Settlement in single transaction:** `recordSettlementFinancialEvents` currently appends events one-by-one (each idempotent). Optionally wrap in one DB transaction so partial failure rolls back all settlement events.
- **ADJUSTMENT call sites:** `recordAdjustmentFinancialEvent` is implemented and exported; call sites for admin adjustments (e.g. manual balance corrections) to be wired when needed.
- **REFUND in player profile:** `getPlayerFinancialProfile` could optionally treat REFUND events as reducing effective entries for competition PnL; currently REFUND is stored but not yet applied in `competitionNetPnL` formula.
- **Legacy PnL APIs:** `getPlayerPnL`, `getAgentPnL`, etc. still exist; migration to finance summaries from `financial_events` can be done incrementally.
