# Deep Security Audit Report

**Date:** March 2025  
**Scope:** Authentication, authorization, session/cookie, input validation, submission/tournament abuse, financial/commission, race conditions, SQL/ORM, frontend assumptions, secrets/config, logging.

**Severity legend:** Critical | High | Medium | Low

---

## CRITICAL

### C-1. (Fixed) Session/OAuth signing with empty secret in production

| Field | Value |
|-------|--------|
| **File** | `server/_core/sdk.ts` |
| **Function** | `getSessionSecret()` |
| **Vulnerability** | When `JWT_SECRET` was not set, `getSessionSecret()` returned `TextEncoder().encode("")`. OAuth/Manus session signing and verification used this empty key. Auth module throws in production when secret is missing, but SDK only used the secret at request time, so first OAuth/session request could run with empty secret if env was misconfigured. |
| **Exploit scenario** | Deploy without JWT_SECRET; OAuth callback or session verify runs; tokens signed/verified with empty key; attacker could forge session tokens. |
| **Impact** | Full authentication bypass for OAuth/session flow. |
| **Fix** | Require non-empty `cookieSecret` in production in `getSessionSecret()` and throw same as auth.ts. **Applied.** |

---

## HIGH

### H-1. (Fixed) Logout did not clear admin verification cookie

| Field | Value |
|-------|--------|
| **File** | `server/routers.ts` |
| **Section** | `auth.logout` mutation |
| **Vulnerability** | Only `COOKIE_NAME` (session) was cleared. `ADMIN_VERIFIED_COOKIE` was left set. On a shared machine, next user who is an admin would have `adminCodeVerified === true` without entering the admin code. |
| **Exploit scenario** | Admin logs out on shared computer; next user (also admin) logs in; they get admin panel access without entering ADMIN_SECRET. |
| **Impact** | Weakened second factor on shared devices; compliance/audit concern. |
| **Fix** | Clear `ADMIN_VERIFIED_COOKIE` on logout with same options as session cookie. **Applied.** |

### H-2. (Already fixed in prior audit) upsertUser role from caller

| Field | Value |
|-------|--------|
| **File** | `server/db.ts` |
| **Function** | `upsertUser` |
| **Vulnerability** | Previously accepted `role` and wrote it to DB; OAuth/sync could have been extended to pass role. |
| **Fix** | Role removed from parameter and from field loop; only set when `openId === ENV.ownerOpenId`. **Already applied in prior audit.** |

### H-3. (Already fixed in prior audit) createTournament amount not validated in db

| Field | Value |
|-------|--------|
| **File** | `server/db.ts` |
| **Function** | `createTournament` |
| **Vulnerability** | Direct call could pass amount ≤ 0. |
| **Fix** | Validate amount is integer ≥ 1; use normalized value in row. **Already applied in prior audit.** |

---

## MEDIUM

### M-1. (Fixed) Registration had no rate limit

| Field | Value |
|-------|--------|
| **File** | `server/routers.ts` |
| **Section** | `auth.register` mutation |
| **Vulnerability** | Login used `checkLoginRateLimit` (5 attempts per IP per minute). Register had no rate limit. Attacker could enumerate usernames or create many accounts. |
| **Exploit scenario** | Script registers many accounts or probes “username taken” to enumerate valid usernames. |
| **Impact** | Abuse (spam accounts), username enumeration, resource exhaustion. |
| **Fix** | Reuse login rate limiter for register so same IP is limited for both login and register. **Applied.** |

### M-2. Admin verification cookie is not httpOnly (verification)

| Field | Value |
|-------|--------|
| **File** | `server/routers.ts` |
| **Section** | `admin.verifyCode` – `ctx.res.cookie(ADMIN_VERIFIED_COOKIE, "1", { ...getSessionCookieOptions(ctx.req), ... })` |
| **Vulnerability** | `getSessionCookieOptions` returns `httpOnly: true`, so the cookie **is** httpOnly. No change needed; documented for clarity. |
| **Fix** | None. Confirmed httpOnly is set. |

### M-3. Stale session after privilege change

| Field | Value |
|-------|--------|
| **File** | `server/_core/context.ts`, `server/_core/sdk.ts` |
| **Vulnerability** | User is loaded from DB on every request (by userId from JWT or openId from session). If an admin is demoted to user in DB, next request uses updated role. If JWT is used (local auth), payload has userId/username only; role comes from `getUserById`. So privilege changes take effect on next request. **No bug.** |
| **Fix** | None. |

### M-4. CORS and ALLOWED_ORIGINS

| Field | Value |
|-------|--------|
| **File** | `server/_core/index.ts` |
| **Section** | CORS middleware |
| **Vulnerability** | In production with `ALLOWED_ORIGINS` empty, code uses `origin` from request or first origin. If ALLOWED_ORIGINS is set, only those origins get Access-Control-Allow-Origin. Credentials are allowed. Misconfiguration could allow unintended origins. |
| **Fix** | Document: in production set ALLOWED_ORIGINS to exact front-end origin(s). No code change. |

---

## LOW

### L-1. Login rate limit is per-IP only

| Field | Value |
|-------|--------|
| **File** | `server/_core/loginRateLimit.ts` |
| **Vulnerability** | Rate limit key is IP. Distributed or proxy-spoofed IPs could allow many attempts. |
| **Fix** | Optional: add per-username (or account) rate limit in addition to IP. |

### L-2. Idempotency store is in-memory

| Field | Value |
|-------|--------|
| **File** | `server/routers.ts` |
| **Vulnerability** | `idempotencyStore` is a Map; restart clears it. Double-submit protection only within process and 30s window. |
| **Fix** | Acceptable for current design. For strict idempotency across restarts, use Redis or DB. |

### L-3. Verbose error in OAuth sync

| Field | Value |
|-------|--------|
| **File** | `server/_core/sdk.ts` |
| **Section** | `authenticateRequest` – `console.error("[Auth] Failed to sync user from OAuth:", error)` |
| **Vulnerability** | Full error object may contain provider-specific details. Unlikely to leak secrets. |
| **Fix** | Prefer logging only message and code, not full stack to external logs. |

### L-4. Dev warning for missing JWT_SECRET

| Field | Value |
|-------|--------|
| **File** | `server/auth.ts` |
| **Vulnerability** | In dev, default secret was used silently. |
| **Fix** | Added console.warn in development when JWT_SECRET is not set (and not in test). **Applied.** |

---

## Authorization / Access Control – Summary

- **Admin actions** (create tournament, delete, approve submission, deposit/withdraw, assign agent, export reports, etc.): All behind `adminProcedure`. Server checks `ctx.user?.role === "admin"` and, when `ENV.adminSecret` is set, `ctx.adminCodeVerified`. No role from client input.
- **Super admin** (delete financial history, delete transparency, create/delete admin): Behind `superAdminProcedure`; role is admin and username in `ENV.superAdminUsernames`. Enforced server-side.
- **Agent actions** (deposit/withdraw to player): Check `ctx.user.role === "agent"` and that player’s `agentId === ctx.user.id` in db layer.
- **Submission edit**: Owner or admin; tournament must be OPEN and not locked. Enforced server-side.
- **getUsersList** `input.role`: Filter only; procedure is admin-only. Safe.

---

## Session / Cookie Security – Summary

- Session cookie: Set with `getSessionCookieOptions` → httpOnly, secure from request, sameSite (lax or none). MaxAge 7 days for login/register.
- Admin verified cookie: Set with same options (httpOnly, etc.) after correct ADMIN_SECRET. Cleared on logout (**fixed**).
- Logout: Clears both session and admin verification cookie (**fixed**).

---

## Input Validation – Summary

- **createTournament**: amount validated in db (integer ≥ 1). Timestamps normalized via `toTimestamp()`. **Already applied.**
- **depositPoints / withdrawPoints**: zod `amount: z.number().int().min(1)`. Server uses input.userId (admin only).
- **submit**: userId from `ctx.user.id`; tournamentId and predictions from input; validated (tournament OPEN, closesAt, etc.).
- **approveSubmission / rejectSubmission**: input.id only; admin only; no client-supplied status.
- No raw SQL with user-controlled concatenation; Drizzle/sqlite.prepare use parameters.

---

## Financial / Commission – Summary

- Prize distribution: SETTLING lock; check “already distributed”; single winner path. No double payout from current code.
- Agent commission: From tournament amount and ENV; agentId from user record, not input.
- Agent deposit/withdraw: Player must have `agentId === ctx.user.id`; balance checks in transaction.

---

## Race Conditions – Summary

- Submit: Rate limit (30/minute per user), optional idempotency key (30s in-memory). Multiple submissions per user per tournament are allowed by design.
- Prize distribution: SETTLING status lock and “already distributed” check.
- Participation: `executeParticipationWithLock` (transaction + balance check).

---

## SQL / Database – Summary

- No user-controlled SQL concatenation. `optionalCols` and migration strings are fixed. `fullResetForSuperAdmin` uses parameterized placeholders with server-controlled usernames.
- Drizzle used for inserts/updates with typed schema.

---

## Logging / Data Exposure – Summary

- No passwords or tokens logged. Logger uses userId, amount, submissionId, tournamentId, etc.
- deleteFinancialHistory requires password but does not log it.

---

## Vulnerabilities Fixed in This Audit

1. **sdk.ts** – `getSessionSecret()`: In production, throw if `cookieSecret` is empty so OAuth/session never use a weak secret.
2. **routers.ts** – `auth.logout`: Clear `ADMIN_VERIFIED_COOKIE` in addition to session cookie.
3. **auth.ts** – Dev warning when JWT_SECRET is not set (excluding test).
4. **routers.ts** – `auth.register`: Apply same per-IP rate limit as login to prevent registration spam and abuse.

---

## Vulnerabilities Requiring Manual Decision

1. **L-1. Per-username rate limit** – Optional hardening for login (in addition to per-IP).
2. **M-4. CORS** – Document ALLOWED_ORIGINS for production.

---

## Recommended Security Checklist Before Go-Live

- [ ] Set **JWT_SECRET** (long random string) in production; never commit .env.production.
- [ ] Set **NODE_ENV=production** when starting the server.
- [ ] If using admin code: set **ADMIN_SECRET**; ensure admin panel requires verification.
- [ ] Set **ALLOWED_ORIGINS** to exact front-end origin(s) if using CORS restrictively.
- [ ] Run app behind HTTPS; ensure cookie `secure` and SameSite are correct (reverse proxy sets x-forwarded-proto).
- [ ] Consider per-username rate limit on login in addition to per-IP (optional).
- [ ] Ensure logout clears both session and admin verification cookie (done in this audit).
- [ ] No secrets or passwords in logs; verify logger usage.
- [ ] Database backups; test restore.
- [ ] Super admin usernames (SUPER_ADMIN_USERNAMES) and owner openId (OWNER_OPEN_ID) configured and documented.
