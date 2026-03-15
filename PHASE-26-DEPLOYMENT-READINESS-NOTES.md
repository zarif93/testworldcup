# Phase 26: Deployment / Production Rollout Readiness

This document summarizes deployment readiness work: environment requirements, startup hardening, build/start/deploy guidance, storage and automation notes, and rollout checklist.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `server/_core/index.ts` | Production fail-fast: require `JWT_SECRET` (exit 1 if missing). Ensure `uploads` directory exists at startup (create if missing) before mounting `/uploads` static. |
| `server/_core/vite.ts` | In production, if build directory `dist/public` is missing, log error and `process.exit(1)` so deploy fails fast. |
| `.env.production.example` | (Existing) Template for production env; no code change. |
| **PHASE-26-DEPLOYMENT-READINESS-NOTES.md** | This document. |

---

## 2. Environment Variables

### Required (production)

| Variable | Purpose | Used in |
|----------|---------|--------|
| `NODE_ENV` | Set to `production` for production. | Env loading, auth, CORS, static path, fail-fast checks. |
| `JWT_SECRET` | Session/JWT signing. **Must** be set in production; server exits at startup if missing. | `server/auth.ts`, `server/_core/sdk.ts`, `server/_core/env.ts` (cookieSecret). |

### Recommended (production)

| Variable | Purpose | Notes |
|----------|---------|--------|
| `PORT` | HTTP port (default `3000`). | Set if not 3000. |
| `BASE_URL` | Public app URL (e.g. `https://yourdomain.com`). | Used for OAuth and analytics; defaults to `http://localhost:PORT` if unset. |
| `DATABASE_URL` | MySQL connection string. | If unset, app uses SQLite with `./data/worldcup.db`. |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins. | Recommended in production to restrict origins. |
| `ADMIN_SECRET` | Optional code to access admin panel. | Recommended if admin is exposed. |
| `OAUTH_SERVER_URL` | OAuth server URL. | Defaults to `BASE_URL` if unset. |
| `.env.production` | Production env file. | Loaded by `server/_core/loadEnv.ts` when `NODE_ENV=production` (override). |

### Optional

| Variable | Purpose |
|----------|--------|
| `SUPER_ADMIN_USERNAMES` | Comma-separated super-admin usernames (default includes `Yoven!,Yoven`). |
| `SAME_SITE_LAX_SAME_ORIGIN` | Set to `1` for sameSite=lax when API and site are same-origin over HTTPS. |
| `AGENT_COMMISSION_PERCENT_OF_FEE` | Agent commission % of site fee (0–100). |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Optional forge/AI. |
| `OWNER_OPEN_ID` | Optional OAuth owner. |

- **Unsafe production defaults:** None for critical security (JWT). Dev/test uses a default JWT secret only when not in production; production has no default and exits if missing.
- **Local dev:** Works without `JWT_SECRET` (warning only); `NODE_ENV=development` and no `.env.production` override.

---

## 3. Build / Start / Deploy Commands

- **Install:**  
  `pnpm install` (or `npm install`)

- **Build:**  
  `pnpm run build`  
  - Runs `vite build` (client → `dist/public`) and `esbuild` (server → `dist/index.js`).  
  - Production start expects `dist/public` to exist; server exits if missing.

- **Start (production):**  
  `pnpm run start`  
  - Sets `NODE_ENV=production` and runs `node dist/index.js`.  
  - Ensure `JWT_SECRET` (and optionally other env) is set (e.g. via `.env.production` or process env).

- **Restart / update:**  
  - Stop the process (Ctrl+C or process manager).  
  - Pull/copy new code, run `pnpm install` if deps changed, run `pnpm run build`, then `pnpm run start`.  
  - With PM2 (optional): e.g. `pm2 start dist/index.js --name app`, then `pm2 restart app` after build.

- **Health check:**  
  - `GET /ping` returns `200` with body `ok`. Use for load balancer or smoke checks.

---

## 4. SQLite vs MySQL Deployment

- **SQLite** is used when `DATABASE_URL` is **not** set:
  - DB file: `./data/worldcup.db`.
  - Directory `./data` is created on first DB init (in `server/db.ts`).
  - Single process, single file; suitable for small/medium single-node deployments.
  - Ensure the process has **write** access to `./data` and that `./data` is included in backups.

- **MySQL** is used when `DATABASE_URL` is set (e.g. `mysql://user:password@host:3306/dbname`):
  - No local `./data` creation; all data in MySQL.
  - Prefer for multi-instance or higher-availability setups.

- **Backup/restore:** No built-in backup system in this phase. Use external backups:
  - SQLite: copy `./data/worldcup.db` (and optionally `./uploads`) during a quiet period or with appropriate locking.
  - MySQL: use `mysqldump` or your provider’s backup tool.
  - Document backup schedule and restore procedure in your runbook.

---

## 5. Uploads / Media Persistence

- **Path:** `./uploads` under process cwd (same as server root in typical deployment).
- **Creation:** Directory is created at **server startup** if missing (Phase 26 change). Previously it was created on first media upload.
- **Serving:** Mounted at `/uploads` via `express.static(uploadsDir)`.
- **Persistence:** Files are on local disk; they persist across restarts as long as the same cwd and filesystem are used. No built-in backup; include `./uploads` in your backup strategy.
- **Assumptions:** No S3 or external object store in default path; all media is filesystem-based under `./uploads`.

---

## 6. Automation Runtime Notes

- All automation runs **in-process** after the HTTP server is listening (inside `server.listen` callback in `server/_core/index.ts`).
- Intervals:
  - **Cleanup** (archive old tournaments): 60 s
  - **Auto-close** (close submissions): 60 s
  - **Settle** (settle due tournaments): 60 s
  - **Retry failed jobs**: 60 s
  - **Closing-soon notifications**: 1 h
  - **Locked tournaments removal** (homepage): 60 s
  - **Settling recovery** (stuck “settling”): 60 s
  - **Financial integrity check**: 5 min
- No separate worker process; restarting the app restarts all intervals. For zero-downtime or scaling, consider moving heavy jobs to a queue/worker later (out of scope for this phase).

---

## 7. Remaining Production Risks

- **Single process:** One Node process handles HTTP and all automation; crash or restart affects everything.
- **No built-in backup:** DB and uploads must be backed up externally; restore not automated.
- **Env sensitivity:** Correct `BASE_URL`, `ALLOWED_ORIGINS`, and (if used) `DATABASE_URL` are important for correct and secure behavior.
- **CORS:** In production, set `ALLOWED_ORIGINS` to avoid overly permissive origins.
- **Secrets:** Keep `JWT_SECRET` and `.env.production` out of version control and restrict access.
- **Build directory:** Server exits in production if `dist/public` is missing; ensures deploy is not run without a prior successful build.

---

## 8. Rollout Checklist

- [ ] Dependencies: run `pnpm install`.
- [ ] Environment: set `NODE_ENV=production` and `JWT_SECRET`; optionally copy `.env.production.example` to `.env.production` and fill values (BASE_URL, PORT, DATABASE_URL, ALLOWED_ORIGINS, ADMIN_SECRET, etc.).
- [ ] Database: ensure write access to `./data` for SQLite, or set `DATABASE_URL` for MySQL and that DB is reachable.
- [ ] Build: run `pnpm run build`; confirm `dist/public` and `dist/index.js` exist.
- [ ] Start: run `pnpm run start` (or start via PM2/equivalent).
- [ ] Smoke check: `GET /ping` returns 200; open app URL and verify login and one critical path.
- [ ] Uploads: confirm `./uploads` exists (created at startup if missing); upload a test file and verify `/uploads/...` serves it.
- [ ] Static assets: verify main app and assets load from `dist/public`.
- [ ] Logs: confirm no startup errors (JWT, DB, or build directory); check automation logs if needed.
- [ ] Backup: document and schedule backups for `./data` (and `./uploads` if used).

---

## 9. Rollout Readiness Summary

- **Production env:** Required vars (`NODE_ENV`, `JWT_SECRET`) are enforced at startup (exit if JWT_SECRET missing in production). Recommended vars are documented and templated in `.env.production.example`.
- **Startup:** Uploads directory is created at boot; production build path is checked and process exits if `dist/public` is missing.
- **Build/start/deploy:** Clear path: install → build → start; optional PM2; health check via `/ping`.
- **Storage:** SQLite (default) and MySQL options documented; uploads path and persistence clarified; backup/restore is documentation-only.
- **Automation:** All in-process intervals documented; no new product features or UI changes.
- **Backward compatibility:** Local dev unchanged; warnings and docs preferred over risky refactors.

Phase 26 is complete for deployment and production rollout readiness as specified.
