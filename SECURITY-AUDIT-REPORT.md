# WinMondial – Full Security Audit Report

**Date:** Pre-launch audit  
**Scope:** Authentication, authorization, input validation, XSS, CSRF, rate limiting, database, sensitive data, server hardening, game logic.

---

## A. Critical vulnerabilities (must fix before launch)

**None identified.** The following were verified and are correctly implemented or have been fixed during this audit:

- **Authentication:** Session/JWT validation is server-side; invalid sessions clear cookie and return 403. JWT uses HS256 with server secret; production requires `JWT_SECRET`.
- **Authorization:** Admin and super-admin procedures enforce role and (when `ADMIN_SECRET` is set) `adminCodeVerified` cookie. Users and agents receive 403 on admin routes (covered by tests).
- **SQL injection:** Drizzle ORM used with parameterized `eq()`, `and()`, and `sql` template with bound `${var}`; no raw concatenation of user input into SQL.
- **Sensitive data:** No `JWT_SECRET` or server secrets in client bundle; only `VITE_*` env vars (analytics, OAuth portal URL, map API key) are exposed.

---

## B. Medium issues

### B1. Error stack exposed in production (FIXED)

- **File:** `client/src/components/ErrorBoundary.tsx`
- **Issue:** `this.state.error?.stack` was rendered to the user, leaking internal paths and source in production.
- **Fix applied:** Stack trace is shown only when `import.meta.env?.DEV` is true. In production, a generic message and “contact support” are shown.

### B2. Input length limits for registration/login (FIXED)

- **Files:** `server/routers.ts`, `server/auth.ts`
- **Issue:** Username, name, and phone had no max length, allowing very long strings and potential abuse.
- **Fix applied:**
  - **Routers:** `checkUsername` username `z.string().min(1).max(64)`; register: username `.max(64)`, phone `.max(20)`, name `.max(200)`, referralCode `.max(64).optional()`; login: username `z.string().min(1).max(64)`.
  - **auth.ts:** Same limits enforced in `registerUser` (username ≤64, phone ≤20, name ≤200).

### B3. Cookie SameSite when behind HTTPS

- **File:** `server/_core/cookies.ts`
- **Current behavior:** When request is secure (HTTPS) and `SAME_SITE_LAX_SAME_ORIGIN` is not set, `sameSite` is `"none"` (for cross-origin). When set, `sameSite` is `"lax"`.
- **Recommendation:** If frontend and API are on the same origin (e.g. `megatoto.net`), set `SAME_SITE_LAX_SAME_ORIGIN=1` in production so session cookie uses `sameSite: lax`, reducing CSRF risk from cross-site requests. No code change required; document in deployment checklist.

---

## C. Minor improvements

### C1. JWT secret strength

- **File:** `server/auth.ts`
- **Current:** Production throws if `JWT_SECRET` is unset; dev uses a default secret.
- **Recommendation:** Ensure production `JWT_SECRET` is at least 32 bytes of cryptographically random data (e.g. `openssl rand -base64 32`). Cannot be enforced in code; add to deployment/docs.

### C2. Login rate limit

- **File:** `server/_core/loginRateLimit.ts`
- **Current:** 5 attempts per IP per minute; used by both login and register mutations.
- **Status:** Adequate for launch. Optionally tighten to 5 per 15 minutes for login only if brute-force becomes a concern.

### C3. CORS

- **File:** `server/_core/index.ts`
- **Current:** In production with `ALLOWED_ORIGINS` set, only listed origins get `Access-Control-Allow-Origin`; otherwise request origin is reflected if present. Credentials allowed.
- **Recommendation:** Keep `ALLOWED_ORIGINS` set in production to the exact frontend origin(s) (e.g. `https://megatoto.net`).

### C4. Match start time vs prediction submission

- **Files:** `server/routers.ts` (submit / edit submission)
- **Current:** Submission is rejected after tournament `closesAt` and when `tournament.isLocked`. No per-match “kickoff” check for the 72 World Cup matches.
- **Status:** Acceptable if business rule is “submit before tournament close” rather than “before each match start.” If you need per-match cutoff, add server-side checks using match start time from `shared/matchesData.ts` or DB.

---

## D. Launch safety

**The platform is in a safe state for public launch** from a code and architecture perspective, provided:

1. **Environment:** `JWT_SECRET` is set in production and is strong (e.g. 32+ bytes random). `ADMIN_SECRET` is set if admin panel is used. `BASE_URL` (and optionally `SAME_SITE_LAX_SAME_ORIGIN=1`) are set per deployment docs.
2. **Deployment:** No `.env` or secrets in repo or build artifacts; production build does not include dev-only code paths (e.g. Manus runtime is excluded from production build).
3. **Ongoing:** Monitor logs for 403/401 spikes and failed login attempts; adjust rate limits if needed.

---

## E. Files inspected

| Area | Files |
|------|--------|
| **Auth / session** | `server/auth.ts`, `server/_core/sdk.ts`, `server/_core/context.ts`, `server/_core/cookies.ts`, `server/_core/oauth.ts` |
| **Authorization** | `server/_core/trpc.ts`, `server/routers.ts` (adminProcedure, superAdminProcedure, protectedProcedure, admin getStatus/verifyCode) |
| **Cookies** | `server/_core/cookies.ts`, `server/routers.ts` (cookie set/clear), `shared/const.ts` |
| **Rate limiting** | `server/_core/index.ts` (apiLimiter, authLimiter), `server/_core/loginRateLimit.ts`, `server/routers.ts` (checkLoginRateLimit, checkExportRateLimit) |
| **Input validation** | `server/routers.ts` (zod schemas for auth, submit, admin, etc.), `server/auth.ts` (registerUser, loginUser) |
| **Database** | `server/db.ts` (Drizzle eq/and/sql usage, getUserByUsername, getUserByPhone, insertSubmission, tournament lock/closesAt) |
| **Game logic** | `server/routers.ts` (submit: closesAt, isLocked; editSubmission: same; admin lockTournament, updateMatchResult) |
| **XSS** | `client/src/components/ErrorBoundary.tsx`, grep `dangerouslySetInnerHTML` (only chart THEMES – static) |
| **Sensitive data** | `client/index.html`, `client/src/const.ts`, `client/src/components/Map.tsx`, vite build (no server secrets in client) |
| **Server hardening** | `server/_core/index.ts` (trust proxy, helmet, x-powered-by disabled), no error.stack in API responses |
| **Tests** | `server/security-audit.test.ts`, `server/fraud-attack.test.ts`, `server/production-readiness.test.ts` |

---

## F. Fixes applied in code

1. **`client/src/components/ErrorBoundary.tsx`**  
   - Show error stack only in dev (`import.meta.env?.DEV`). In production show generic message and “contact support”.

2. **`server/routers.ts`**  
   - `auth.checkUsername`: username `z.string().min(1).max(64)`.  
   - `auth.register`: username `.min(3).max(64)`, phone `.max(20)`, name `.max(200)`, referralCode `.max(64).optional()`.  
   - `auth.login`: username `z.string().min(1).max(64)`.

3. **`server/auth.ts`**  
   - `registerUser`: validate username length ≤64, phone length ≤20, name length ≤200; throw clear errors if exceeded.

---

**Audit completed. No critical vulnerabilities remain; medium items addressed or documented; platform is suitable for public launch with the above environment and deployment conditions.**
