# Phase 15: Backup and recovery readiness

## DB backup procedure

- **SQLite:** Copy the database file(s) under `./data/` (or path configured for SQLite). Ensure no write is in progress: either stop the app or use SQLite backup API (`sqlite3_backup_*`) for hot backup.
- **MySQL:** Use `mysqldump` or your provider’s backup tool. Example:  
  `mysqldump -u user -p -h host dbname > backup.sql`
- **Frequency:** At least daily for production; consider WAL + incremental if supported.

## Restore verification checklist

1. Restore DB from backup to a staging or test instance.
2. Run migrations (if any) so schema matches application version.
3. Start the application; confirm `/ready` returns 200 and `/health` shows `db: "ok"`.
4. Run `runFinancialIntegrityCheck()` (or equivalent) and confirm no delta.
5. Spot-check: login, load a tournament, load leaderboard, run settlement recovery for any stuck SETTLING.

## Migration rollback safety

- Migrations are applied in `db.ts` init (SQLite) or via your migration runner. Avoid destructive changes in a single step; prefer additive changes (new tables, new columns with defaults).
- Before deploying a migration that drops columns or tables, ensure no release still expects them. Keep one release of backward compatibility where possible.
- For rollback: restore DB from pre-migration backup, or run a separate “down” migration script if you maintain one. Application rollback: deploy previous app version that matches the restored schema.
