# Jackpot Full Purge – Hard Delete Plan

## A. Database schema deletion

1. **Do not add new enums** – financial_events.eventType in Drizzle already has no jackpot values.
2. **Drop jackpot-specific tables** (in dependency order):  
   jackpot_draw_snapshots → jackpot_wins → jackpot_contributions → jackpot_balance_history → jackpot_draws → jackpots → jackpot_balance → jackpot_background_images.
3. **No jackpot columns** remain in shared tables (already removed).

## B. Database data purge (order matters)

1. **Shared tables – delete jackpot rows first**
   - `DELETE FROM financial_events WHERE eventType IN ('JACKPOT_CONTRIBUTION','JACKPOT_PAYOUT','JACKPOT_REVERSAL','JACKPOT_ADJUSTMENT_CREDIT','JACKPOT_ADJUSTMENT_DEBIT','JACKPOT_RESET');`
   - `DELETE FROM point_transactions WHERE description LIKE '%jackpot%' OR description LIKE '%Jackpot%';` (and any actionType if we ever had one – schema has no jackpot actionType; safe to use description only).
   - `DELETE FROM payment_transactions WHERE type = 'jackpot_payout';` (only if column allows it; schema enum may already disallow – run only if table has such rows).
   - `DELETE FROM analytics_events WHERE eventName IN ('jackpot_cta_click','jackpot_hero_view');`
   - `DELETE FROM site_settings WHERE key LIKE 'jackpot.%';`
2. **Then drop jackpot tables** (see A.2).
3. **Recreate financial_events** only if the existing table still has a CHECK/constraint that includes jackpot event types (SQLite may not enforce enum; we just deleted rows, so no need to recreate table unless we want strict CHECK without jackpot).

## C. Financial model cleanup

- Already done in prior decommission: PnL, settlement, global, agent reports, CSV, financial center are competition-only. No jackpot margin or jackpot rows.

## D. Application cleanup

1. **server/db.ts** – Remove `entryAddon` from ParticipationWithLockParams, getEntryCostBreakdown return type and value, validateTournamentEntry return type and value. Remove comment that mentions JACKPOT in skipWalletDeduction.
2. **server/routers.ts** – Stop reading validation.entryAddon and stop passing entryAddon to executeParticipationWithLock.
3. **server/participation-atomic-sqlite.test.ts** – Remove `jackpotContribution: 0` from all executeParticipationWithLock param objects.
4. **server/security-hardening.test.ts** – Same.
5. **scripts/audit-jackpot-decommission.ts** – Delete file.
6. **docs** – Remove or rewrite jackpot docs: JACKPOT-DECOMMISSION-PHASE1-DISCOVERY.md, JACKPOT-DECOMMISSION-PHASE2-PLAN.md, JACKPOT-DECOMMISSION-FINAL-REPORT.md; strip jackpot mentions from FINANCIAL-SYSTEM-CONSISTENCY-AUDIT.md, UPLOAD-413-FIX-REPORT.md, UPLOAD-MULTIPART-ARCHITECTURE.md (or leave historical “formerly included jackpot” one-liner if desired).
7. **Migration file** – Replace sqlite-jackpot-decommission.sql with hard-delete version: DELETE rows then DROP tables.

## E. Validation

- Grep repo for jackpot, JACKPOT_, next_draw, jackpot_ → zero runtime references.
- DB: no jackpot tables, no jackpot rows in shared tables.
- Build + tests pass.
