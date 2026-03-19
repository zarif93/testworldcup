-- Jackpot FULL PURGE: delete all jackpot history then drop all jackpot tables.
-- SQLite only. Run: sqlite3 data/worldcup.db < drizzle/migrations/sqlite-jackpot-decommission.sql
-- Backup recommended before running.

BEGIN TRANSACTION;

-- 1) Delete all jackpot-related rows from shared tables (order: respect FKs / references).
DELETE FROM financial_events
WHERE eventType IN (
  'JACKPOT_CONTRIBUTION',
  'JACKPOT_PAYOUT',
  'JACKPOT_REVERSAL',
  'JACKPOT_ADJUSTMENT_CREDIT',
  'JACKPOT_ADJUSTMENT_DEBIT',
  'JACKPOT_RESET'
);

DELETE FROM point_transactions
WHERE description LIKE '%jackpot%' OR description LIKE '%Jackpot%';

DELETE FROM payment_transactions
WHERE type = 'jackpot_payout';

DELETE FROM analytics_events
WHERE eventName IN ('jackpot_cta_click', 'jackpot_hero_view');

DELETE FROM site_settings
WHERE key LIKE 'jackpot.%';

-- 2) Drop jackpot-specific tables (children first).
DROP TABLE IF EXISTS jackpot_draw_snapshots;
DROP TABLE IF EXISTS jackpot_wins;
DROP TABLE IF EXISTS jackpot_contributions;
DROP TABLE IF EXISTS jackpot_balance_history;
DROP TABLE IF EXISTS jackpot_draws;
DROP TABLE IF EXISTS jackpots;
DROP TABLE IF EXISTS jackpot_balance;
DROP TABLE IF EXISTS jackpot_background_images;

COMMIT;
