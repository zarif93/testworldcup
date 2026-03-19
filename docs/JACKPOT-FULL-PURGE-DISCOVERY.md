# Jackpot Full Purge – Discovery

## Backup

**Database backup created before any deletion:**  
`data\worldcup.db.backup-pre-jackpot-purge-20260319-144743`

---

## 1. Tables (schema / data)

| Item | Location | Notes |
|------|----------|------|
| **jackpot_draws** | schema (already dropped in prior decommission) | Draw lifecycle |
| **jackpot_draw_snapshots** | schema (dropped) | Per-user snapshot at draw |
| **jackpots** | schema (dropped) | Pool balance and config |
| **jackpot_contributions** | schema (dropped) | Per-contribution audit |
| **jackpot_wins** | schema (dropped) | Payout obligation |
| **jackpot_balance_history** | schema (dropped) | Balance audit |
| **jackpot_background_images** | schema (dropped) | Hero backgrounds |
| **jackpot_balance** | may exist in some DBs | Legacy balance table |
| **financial_events** | shared table | Rows: JACKPOT_CONTRIBUTION, JACKPOT_PAYOUT, JACKPOT_REVERSAL, JACKPOT_ADJUSTMENT_*, JACKPOT_RESET → DELETE |
| **point_transactions** | shared table | Rows with description/actionType mentioning jackpot → DELETE |
| **payment_transactions** | shared table | type = 'jackpot_payout' → DELETE (enum already removed from schema) |
| **analytics_events** | shared table | eventName IN ('jackpot_cta_click','jackpot_hero_view') → DELETE |
| **site_settings** | shared table | key LIKE 'jackpot.%' → DELETE |

## 2. Columns

- **payment_transactions.type** – enum already no longer includes `jackpot_payout` in schema.
- No remaining jackpot-specific columns in shared tables (prior decommission removed jackpot tables).

## 3. Event types

- **financial_events.eventType:** JACKPOT_CONTRIBUTION, JACKPOT_PAYOUT, JACKPOT_REVERSAL, JACKPOT_ADJUSTMENT_CREDIT, JACKPOT_ADJUSTMENT_DEBIT, JACKPOT_RESET → purge all such rows.
- **Drizzle schema:** financial_events enum already restricted to non-jackpot types.

## 4. Point transaction action types

- Schema enum: deposit, withdraw, participation, prize, admin_approval, refund, agent_transfer (no jackpot).
- Rows to delete: those with description or actionType containing 'jackpot' (e.g. "Jackpot draw #N").

## 5. Analytics events

- eventName: `jackpot_cta_click`, `jackpot_hero_view` → DELETE.

## 6. Cron / timers

- Removed in prior decommission (no setInterval/runJackpotDraw).

## 7. UI components

- Removed in prior decommission (JackpotHero, JackpotSection, JackpotBackgroundSection, SettlementReportsSection jackpot tab, Home jackpot blocks, AdminPanel jackpot section, PredictionForm jackpot line).

## 8. API procedures

- Removed in prior decommission (getJackpotBanner, getJackpotLastDraws, getJackpotProgress, getJackpotFinancialEvents, exportJackpotFinancialEventsCSV, getJackpotWinsForMyPlayers, admin jackpot procedures).

## 9. Report logic

- Player PnL, settlement, global, agent, CSV: already competition-only (prior decommission).

## 10. Tests

- **server/participation-atomic-sqlite.test.ts** – passes `jackpotContribution: 0` in params (type expects `entryAddon`).
- **server/security-hardening.test.ts** – passes `jackpotContribution: 0`.
- No remaining jackpot-specific test files (jackpot tests deleted).

## 11. Scripts

- **scripts/audit-jackpot-decommission.ts** – references JACKPOT_* and jackpot tables for audit → DELETE.

## 12. Docs

- **docs/JACKPOT-DECOMMISSION-PHASE1-DISCOVERY.md**
- **docs/JACKPOT-DECOMMISSION-PHASE2-PLAN.md**
- **docs/JACKPOT-DECOMMISSION-FINAL-REPORT.md**
- **docs/FINANCIAL-SYSTEM-CONSISTENCY-AUDIT.md** (mentions jackpot)
- **docs/UPLOAD-413-FIX-REPORT.md** (mentions MAX_JACKPOT_BACKGROUND_BYTES)
- **docs/UPLOAD-MULTIPART-ARCHITECTURE.md** (mentions jackpot processor/validate)

## 13. Runtime code (remaining)

- **server/db.ts** – getEntryCostBreakdown returns `entryAddon`, validateTournamentEntry returns `entryAddon`, ParticipationWithLockParams has `entryAddon` (replaced jackpotContribution; to be removed for full purge so no addon concept).
- **server/routers.ts** – passes `entryAddon` from validation into executeParticipationWithLock.
- **Tests** – still pass `jackpotContribution: 0` (param name); type expects `entryAddon`.
