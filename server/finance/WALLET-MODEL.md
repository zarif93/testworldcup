# Wallet model – design confirmation

## Short answer

**`user.points` is not only derived from financial events.** It is the **wallet balance** and can be changed by:

- **Manual admin adjustments** – `admin.depositPoints` (add), `admin.withdrawPoints` (deduct). Both go through the ledger.
- **Admin approval / bonuses** – `addUserPoints(..., "admin_approval")` or `"deposit"` (counted in `getDepositsTotal` as deposit + admin_approval).
- **Deposits / withdrawals** – `deposit` and `withdraw` action types in `point_transactions`.
- **Agent transfers** – `agent_transfer` (agent ↔ player moves).
- **Game flow** – `participation` (entry), `prize` (payout), `refund` (refund). These also write to `financial_events`.

There is already a **ledger layer** (`point_transactions`), and reports already distinguish **Game PnL** vs **Wallet balance**.

---

## 1. Ledger layer: `point_transactions`

Every change to `user.points` in production goes through:

- **addUserPoints** or **deductUserPoints** in `server/db.ts`, which:
  1. Update `users.points`
  2. Insert a row into **point_transactions** (amount, balanceAfter, actionType, performedBy, referenceId, …)
  3. Insert into **ledger_transactions** for audit

So the wallet is **ledger-based**: the balance is the result of applying all `point_transactions` (in practice, the last `balanceAfter` is the current balance).

**Action types** (`PointActionType`):

| actionType       | Direction | Used for                          |
|------------------|-----------|------------------------------------|
| deposit          | +         | Admin deposit                      |
| withdraw         | −         | Admin withdrawal                   |
| admin_approval   | + or −    | Manual admin adjustments / bonuses |
| participation    | −         | Entry fee (game)                   |
| prize            | +         | Prize payout (game)                 |
| refund           | +         | Entry refund (game)                |
| agent_transfer   | + or −    | Agent ↔ player transfer            |

External scripts or other code **must not** update `users.points` directly; they should use the same helpers (or new ones that write to `point_transactions`) so the ledger stays complete.

---

## 2. Game-only source: `financial_events`

Game-related accounting uses **financial_events** (ENTRY_FEE, PRIZE_PAYOUT, REFUND, PLATFORM_COMMISSION, AGENT_COMMISSION). This is the **canonical source for game PnL and commissions**, independent of deposits/withdrawals/adjustments.

- **Player game PnL**: `competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds` (from `getPlayerFinancialProfile` / financial_events).
- **Commission / agent / platform** totals are also derived from financial_events.

---

## 3. Reports: Game PnL vs Wallet balance

Reports already separate the two concepts:

| Report / concept   | Game PnL (from financial_events)     | Wallet balance (from point_transactions / users) |
|--------------------|--------------------------------------|--------------------------------------------------|
| **General report** | `profitLoss` = competitionNetPnL     | `finalBalance` = **user.points**                 |
| **Player report**  | `netProfitLoss` = winnings−bets+refunds | Not shown in summary (could be added as “יתרה” = user.points) |
| **Agent report**   | Players’ PnL, commission, platform share | —                                            |
| **playerFinanceService** | `competitionNetPnL`              | `walletNetFlow` = deposits + prizes + refunds − entries − withdrawals |

So:

- **Game PnL** = result of play only (bets, wins, refunds; commissions are derived from the same events).
- **Wallet balance** = `user.points` = result of **all** point_transactions (game + deposits + withdrawals + admin adjustments + agent transfers).

No change is required for “Game PnL vs Wallet balance” in reports; the distinction is already there. Optional improvement: in the Player report UI, show “יתרה נוכחית” (current wallet = user.points) next to “יתרה סופית” (currently showing net from play) so both are visible.

---

## 4. Summary

| Question | Answer |
|----------|--------|
| Is `user.points` only from financial events? | **No.** It is the wallet and can be changed by admin deposit/withdraw, admin_approval (adjustments/bonuses), deposits/withdrawals, agent transfers, and game (participation/prize/refund). |
| Is there a proper financial ledger? | **Yes.** `point_transactions` is the ledger; all production balance changes go through it (via addUserPoints/deductUserPoints). |
| Do reports distinguish Game PnL vs Wallet? | **Yes.** General report has `profitLoss` (game) and `finalBalance` (wallet); playerFinanceService exposes `competitionNetPnL` and `walletNetFlow`; financial_events are used for game/commission reporting. |
| Can points be modified by external scripts? | Only if they call the same DB helpers and write to `point_transactions`. Direct `UPDATE users SET points = ...` would bypass the ledger and is not allowed in the current design. |

---

## 5. Developer rule – future features

**All balance changes must go through the wallet helpers. Do not update `user.points` directly.**

- Use **addUserPoints** for credits: deposit, prize, refund, admin_approval, agent_transfer (incoming).
- Use **deductUserPoints** for debits: participation, withdraw, admin_approval, agent_transfer (outgoing).

Any new feature that adds or removes points (bonuses, promotions, manual adjustments, integrations) must call these functions (or extend them with a new `PointActionType` and then use them). This keeps the ledger (`point_transactions`) and audit trail (`ledger_transactions`) correct and preserves the separation between Game PnL and Wallet balance in reports.
