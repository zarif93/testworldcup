# Admin Finance Dashboard & Reporting UI – Delivery Summary

## 1. Files changed

**Backend**
- `server/finance/types.ts` – Added `AdminFinanceDashboardSummary`, `TournamentFinanceRow`, `AgentFinanceRow`, `FinancialEventRow`.
- `server/finance/adminFinanceService.ts` – Added `getAdminFinanceDashboardSummary`, `getTournamentFinanceList`, `getTournamentFinanceDetail`, `getAgentFinanceList`, `getPlayerFinanceList`.
- `server/routers.ts` – Added admin procedures: `getFinanceDashboardSummary`, `getTournamentFinanceList`, `getTournamentFinanceDetail`, `getAgentFinanceList`, `getAgentFinanceDetail`, `getPlayerFinanceList`.

**Client**
- `client/src/components/admin/FinanceSection.tsx` – New: full finance dashboard (summary cards, period/custom range, tabs: summary / tournaments / agents / players, tournament table with sort/filter, agent table with sort, player table with search/agent/date filters, tournament detail dialog with event ledger, agent detail dialog with player breakdown).
- `client/src/pages/AdminPanel.tsx` – Added `"finance"` to `AdminSection`, nav item "כספים ועמלות", import and render of `FinanceSection` when `section === "finance"`.

---

## 2. Endpoints added

| Endpoint | Input | Description |
|----------|--------|-------------|
| `admin.getFinanceDashboardSummary` | `{ period?: "day" \| "week" \| "month", from?: string, to?: string }` | Summary for period or custom date range: totalPlatformProfit, totalCommissions, totalAgentCommissions, totalPrizePayouts, totalRefundedPoints, activeTournamentsCount, totalPlayersCount, totalAgentsCount. |
| `admin.getTournamentFinanceList` | — | List of all non-deleted tournaments with financial summary (totalPool, commission, platform/agent commission, prize pool, prizes paid, refunded, platform net, status). |
| `admin.getTournamentFinanceDetail` | `{ tournamentId: number }` | Tournament financial summary + full event ledger from `financial_events` (eventType, amountPoints, userId, agentId, submissionId, createdAt, idempotencyKey). |
| `admin.getAgentFinanceList` | — | List of all agents with finance metrics: player count, total entries, commission generated, agent earned, platform net, total player prizes. |
| `admin.getAgentFinanceDetail` | `{ agentId: number }` | Same as `getAgentDashboardMetrics`: agent totals + `playerListWithPnL` (per-player entries, prizes, refunds, competitionNetPnL, commission, agent share, platform profit). |
| `admin.getPlayerFinanceList` | `{ search?, agentId?, from?, to?, limit?, cursor? }` | Paginated list of players with `PlayerFinancialProfile` (entries, prizes, refunds, competitionNetPnL, walletNetFlow, commission, platform profit). Optional search, agent filter, date range. |

All use canonical finance services; data source is `financial_events` (and counts from DB where noted).

---

## 3. Pages / components added

- **Page/section:** Admin panel section `"finance"` – single full-page view `FinanceSection` (no separate route).
- **Component:** `client/src/components/admin/FinanceSection.tsx`:
  - Period filter bar (today / week / month + custom date range).
  - Summary cards (8): platform profit, commissions, agent commissions, prize payouts, refunded points, active tournaments count, total players, total agents.
  - Tabs: סיכום | תחרויות | סוכנים | שחקנים.
  - Tournament finance table (sortable columns, status filter).
  - Agent finance table (sortable, “פירוט שחקנים” opens drilldown).
  - Player finance table (search, agent dropdown filter, from/to date, list from `getPlayerFinanceList`).
  - Tournament detail dialog: summary line + event ledger table (event type, points, user, agent, submission, date, idempotency key).
  - Agent detail dialog: agent summary line + table of players (username, entries, prizes, refunds, competitionNetPnL, commission generated, agent commission, platform profit).

---

## 4. Dashboard widgets implemented

- **Summary cards (8):**
  - רווח פלטפורמה (תקופה)
  - עמלות (פלטפורמה)
  - עמלות סוכנים
  - פרסים ששולמו
  - החזרים
  - תחרויות פעילות
  - שחקנים
  - סוכנים
- **Period filters:** היום | שבוע | חודש + טווח תאריכים מותאם (from–to).

---

## 5. Drilldowns implemented

- **Tournament → יומן (ledger):** Button in tournament row opens dialog with tournament summary + full `financial_events` table for that tournament (event type, amount, user, agent, submission, createdAt, idempotency key).
- **Agent → פירוט שחקנים:** Button in agent row opens dialog with agent summary + table of all players under that agent (username, entries, prizes, refunds, competitionNetPnL, commission generated, agent commission, platform profit from player).

---

## 6. Second pass / remaining

- **Permissions:** Finance section is visible to any admin; can be gated with e.g. `reports.view` or a dedicated `finance.view` permission if required.
- **Pagination:** Player list uses `limit: 300` and optional `cursor`; UI does not yet show “Load more” / next page (nextCursor is returned).
- **Export:** No CSV/Excel export from the new finance tables yet; can be added using the same patterns as existing PnL exports.
- **Tournament table:** Refund column added; sorting by “החזרים” can be added to the sort state if desired.
- **Mobile:** Layout is responsive (grid, overflow-x-auto on tables); further tweaks for very small screens (e.g. card layout for summary) are optional.
