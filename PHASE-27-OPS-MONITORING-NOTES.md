# Phase 27: Post-Launch Monitoring / Support / Recovery

This document describes operational visibility, support/recovery procedures, and post-launch readiness added in Phase 27. No product features or UI redesigns were introduced; changes are additive and read-only for ops.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `server/analytics/dashboard.ts` | Added `getSystemStatus()` (Phase 27): returns `mode`, `db`, `uploadsExists`, `automationFailed`, `unreadNotifications`, `version`. Uses `fs`/`path` for uploads check and `package.json` version. |
| `server/routers.ts` | Added `admin.getSystemStatus` procedure (reports.view); read-only. |
| `client/src/components/admin/OpsStatusSection.tsx` | **New.** Admin read-only view: environment, database type, uploads folder status, automation failed count, unread notifications, app version. |
| `client/src/pages/AdminPanel.tsx` | Added section `ops` and nav item "סטטוס מערכת" (System Status) for users with reports.view; renders `OpsStatusSection`. |
| `server/_core/index.ts` | Production startup: added one log line `Environment` with `NODE_ENV` and `db` (sqlite/mysql) after "Server listening". |
| **PHASE-27-OPS-MONITORING-NOTES.md** | This document. |

---

## 2. Ops / Support Visibility Added

- **Admin → סטטוס מערכת (System Status / Ops)**  
  Read-only panel (permission: `reports.view`) showing:
  - **Environment (סביבה):** `NODE_ENV` (e.g. production / development).
  - **Database (מסד נתונים):** `sqlite` or `mysql`.
  - **Uploads folder (תיקיית העלאות):** exists or not (helps confirm `/uploads` serving).
  - **Automation failed (אוטומציה נכשלו):** count of failed automation jobs (SQLite only; MySQL shows 0 in current implementation).
  - **Unread notifications (התראות לא נקראו):** total unread count (SQLite only; MySQL shows 0 in current implementation).
  - **App version (גרסת אפליקציה):** from `package.json` `version`.

- **Existing analytics dashboard**  
  Still provides: automation executed/skipped/failed, failed last 24h, retries, stuck settling, long-pending, and unread notifications (see Phase 21/23).

- **Startup logs**  
  In production, after "Server listening", one line: `Environment` with `NODE_ENV` and `db` (sqlite/mysql) for quick log-based confirmation.

- **Health check**  
  Unchanged: `GET /ping` returns `200` with body `ok` for load balancers and smoke checks.

---

## 3. Support / Recovery Checklist

### Restart procedure

1. Stop the app (Ctrl+C or process manager: `pm2 stop app`, etc.).
2. Optionally run `pnpm run backup-db` (or your backup script) before restart if you need a snapshot.
3. Start again: `pnpm run start` (or `pm2 start dist/index.js --name app`).
4. Check logs for "Server listening" and "Environment"; confirm no "JWT_SECRET is required" or "Could not find the build directory".
5. Smoke check: `GET /ping` and open the app URL.

### Build / deploy flow

1. `pnpm install` (if dependencies changed).
2. `pnpm run build` (ensures `dist/public` and `dist/index.js` exist).
3. Stop the running process, then `pnpm run start` (or restart via PM2).
4. Verify `/ping` and one critical user path.

See **PHASE-26-DEPLOYMENT-READINESS-NOTES.md** for full deploy commands and env vars.

### Health check usage

- **Endpoint:** `GET /ping` → `200` + body `ok`.
- Use for: load balancer health, post-deploy smoke test, simple uptime checks.
- Does not check DB or automation; for deeper status use Admin → סטטוס מערכת and/or Analytics.

### Uploads backup note

- **Path:** `./uploads` (under process cwd).
- **Persistence:** Files persist across restarts; directory is created at startup if missing (Phase 26).
- **Backup:** No built-in backup. Include `./uploads` in your backup plan (e.g. periodic copy or snapshot). Ensure app is not writing during filesystem backup, or use a backup method that is consistent with open files.

### SQLite backup note

- **DB file:** `./data/worldcup.db`.
- **Backup:** Use `pnpm run backup-db` if available, or copy `./data/worldcup.db` during a quiet period. For minimal downtime, consider SQLite backup APIs or a quick copy while the process is running (SQLite handles single-writer; copy may be consistent for most use).
- **Restore:** Stop app, replace `./data/worldcup.db` with backup, start app.

### MySQL note

- When `DATABASE_URL` is set, all data is in MySQL; no local `./data` file.
- Backup/restore via your MySQL tooling (`mysqldump`, provider backups, etc.).
- Admin "Automation failed" and "Unread notifications" counts currently show 0 when using MySQL (counters are implemented for SQLite only); use MySQL monitoring and app logs for issues.

### What to check first if the site is broken

1. **HTTP response:** Can you reach the server at all? Try `GET /ping`. If no response, check process, port, firewall, reverse proxy.
2. **Startup logs:** If the process exits immediately, look for: "JWT_SECRET is required", "Could not find the build directory", or DB errors. Fix env or run `pnpm run build` and ensure `dist/public` exists.
3. **White/blank page:** Confirm `dist/public` exists and contains built assets; check browser console and network tab for 404s on JS/CSS.
4. **API errors:** Check server logs; confirm `DATABASE_URL` (if MySQL) or `./data` write access (if SQLite). Admin → סטטוס מערכת shows DB type and uploads folder.
5. **Login/auth issues:** Confirm `JWT_SECRET` is set and unchanged across restarts; check `BASE_URL`/CORS if OAuth or cross-origin.

### What to check if automation is not running

1. **Process:** Automation runs in the same process as the server; if the app is down, automation is down. Restart the app and check logs.
2. **Logs:** Look for "Automation (close) error", "Automation (settle) error", "Cleanup error", "Settling recovery error", etc. These indicate automation ran but hit errors.
3. **Admin → אנליטיקה:** Check "אוטומציה – סיכום ובריאות": executed/skipped/failed, failed last 24h, stuck settling. High failed count or stuck settling may need data or config fixes.
4. **Admin → סטטוס מערכת:** "אוטומציה נכשלו" shows failed job count (SQLite only). If using MySQL, check DB and app logs.
5. **DB:** With SQLite, ensure `./data` is writable and not corrupted. With MySQL, ensure connectivity and that automation tables exist and are writable.

### What to check if uploads are missing

1. **Admin → סטטוס מערכת:** "תיקיית העלאות" should show "קיימת" after first startup (Phase 26 creates it). If "לא קיימת", check process cwd and filesystem permissions; restart may recreate it.
2. **Path:** Uploads live under `./uploads` (relative to process cwd). Ensure deploy uses the same cwd and that the directory is not removed by deploy scripts.
3. **URLs:** Media URLs are like `/uploads/...`. If 404, confirm `express.static("uploads")` is mounted (it is by default) and that the file exists on disk.
4. **Backup:** If uploads were lost, restore from backup of `./uploads`; DB stores references, so filenames/paths must match.

### What to check if notifications are not appearing

1. **Admin → התראות:** Check that notifications exist and are in expected status (read/unread). Admin → סטטוס מערכת shows "התראות לא נקראו" (SQLite only).
2. **Recipient:** Notifications are per recipient (user/agent/admin). Confirm you are checking the correct context (e.g. admin vs user).
3. **Logs:** Look for "Notifications (closing soon) error" or other notification-related errors.
4. **Feature:** Notifications are created by automation (e.g. closing-soon) and by other flows; if automation is failing, some notifications may not be created. Fix automation first if needed.

---

## 4. Runtime / Health Notes

- **Single process:** HTTP and all automation run in one Node process. A crash or restart affects both.
- **No dedicated health endpoint for DB:** `/ping` does not verify DB or automation; use Admin status and logs for that.
- **Automation intervals:** Run after server listen (cleanup, close, settle, retry, closing-soon notifications, locked removal, settling recovery, financial integrity). All in-process; see Phase 26 doc for intervals.
- **Logs:** Production uses `logger.info`/`logger.warn`/`logger.error`. Ensure log output is captured (e.g. stdout/stderr or file) for incident review.

---

## 5. Remaining Operational Risks

- **Single point of failure:** One process; no built-in HA or multi-instance automation coordination.
- **MySQL counters:** Automation failed and unread notification counts in Admin are 0 when using MySQL; rely on MySQL monitoring and logs for those.
- **No built-in alerting:** No pager or external alerts; ops must rely on logs and periodic checks of Admin status and Analytics.
- **Backup/restore:** Documented but not automated; responsibility of the deployer.
- **Secrets and env:** Incorrect or rotated `JWT_SECRET`/env can break auth or startup; changes must be coordinated with restarts.

---

## 6. Future Monitoring / Alerting Ideas

- **External health checks:** A cron or monitoring service calling `/ping` and optionally an admin-only lightweight status endpoint (e.g. DB connectivity) with alert on failure.
- **Structured logging:** Emit JSON logs for aggregation (e.g. ELK, Datadog) and search by error type or automation job.
- **Alert on automation failures:** After N failed jobs in a window, send email or webhook to ops (e.g. using existing notification or external system).
- **Metrics export:** Expose Prometheus or similar metrics (request count, automation run count, failure count) for graphing and alerting.
- **MySQL support for status counters:** Implement automation failed count and unread notification count for MySQL so Admin status is accurate in all deployments.

---

## 7. Post-Launch Readiness Summary

- **Operational visibility:** Admin "סטטוס מערכת" provides at-a-glance env, DB type, uploads, automation failures, unread notifications, and app version; Analytics continues to provide automation health and business metrics.
- **Support/debugging:** Recovery checklist and "what to check first" sections above give clear steps for site down, automation, uploads, and notifications.
- **Recovery-oriented docs:** Restart, build/deploy, health check, backup notes for uploads and SQLite/MySQL are documented.
- **Small helpers:** Startup log line (env + db), app version in status, read-only status panel; no new product features or UI redesign.
- **Compatibility:** All changes are additive and read-only; local dev and existing production behavior unchanged.

Phase 27 post-launch monitoring and support work is complete as specified.
