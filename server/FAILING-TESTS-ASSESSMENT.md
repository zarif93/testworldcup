# Failing Tests – Engineering Assessment

**Context:** Real-money traffic; production rollout blocked until stability is confirmed.  
**Scope:** 8 failing tests across 3 files. No fixes applied; assessment only.

---

## 1. List of Currently Failing Tests

| # | File | Test name |
|---|------|-----------|
| 1 | `server/lotto-scoring.test.ts` | lotto scoring > 0 מספרים + חזק = 1 נקודה |
| 2 | `server/lotto-scoring.test.ts` | lotto scoring > 0 מספרים בלי חזק = 0 נקודות |
| 3 | `server/production-readiness.test.ts` | Security – IDOR והרשאות > checkLoginRateLimit – מגביל אחרי 5 ניסיונות ל-IP |
| 4 | `server/report-export-permissions.test.ts` | report export permissions > admin can export admin report |
| 5 | `server/report-export-permissions.test.ts` | report export permissions > agent cannot export admin report (403) |
| 6 | `server/report-export-permissions.test.ts` | report export permissions > player cannot export admin report (403) |
| 7 | `server/report-export-permissions.test.ts` | report export permissions > agent cannot export from agent export endpoints anymore (403) |
| 8 | `server/report-export-permissions.test.ts` | report export permissions > player cannot export personal report via auth.exportMyPlayerReport (403) |

---

## 2. Category and Root Cause per Failure

### 2.1 Lotto scoring (2 failures)

| Category | **Core gameplay logic** |
|----------|-------------------------|
| **Observed** | "0 מספרים + חזק": expected `points === 1`, got `7`. "0 מספרים בלי חזק": expected `points === 0`, got `6`. |
| **Root cause** | **Test isolation / shared state.** One tournament is shared across all 5 tests; each test adds a new submission and then sets the draw. When the draw is set, `setLottoDrawResult` rescores **all** approved submissions for that tournament with the **new** draw. So the same tournament ends up with multiple submissions (e.g. [1,2,3,4,5,6]+strong from earlier tests and [11,…,16]+strong from the last two). The test assumes “last submission” = submission with max `id` via `getSubmissionsByUserAndTournament` + `reduce` by max id. If ordering or timing makes a different submission have the highest id (e.g. another test or suite inserting into `submissions`), or if the “last” submission is actually an earlier one (e.g. [1,2,3,4,5,6] with the new draw [1,2,3,4,5,6] strong 7 → 6+1=7), the test reads the wrong submission. So: either the test is reading a different submission than the one just created (isolation/ordering), or the scoring path is applying the wrong draw/predictions to a submission (logic bug). The scoring formula in `scoreLottoBySchema` itself is correct (0+strong=1, 0+no strong=0). |

---

### 2.2 Login rate limit (1 failure)

| Category | **Security critical** |
|----------|------------------------|
| **Observed** | After 5 calls to `checkLoginRateLimit(req)` the test expects the 6th to return `false` (blocked). Actual: 6th call still returns `true` (allowed). |
| **Root cause** | **Test design vs API contract.** `checkLoginRateLimit(req)` only **checks** whether the IP is under the limit; it does **not** record an attempt. Recording is done by `recordFailedLogin(req)` (e.g. when login fails). The test never calls `recordFailedLogin`, so the in-memory map for that IP has zero failed attempts, and `recent.length < MAX_FAILED_ATTEMPTS` is always true. The implementation in `_core/loginRateLimit.ts` is consistent with “record on failure, check before attempt”; the test is wrong in assuming that calling `checkLoginRateLimit` 5 times counts as 5 failed attempts. |

---

### 2.3 Report export permissions (5 failures)

| Category | **Reporting / analytics** (with security implications: who can export what) |
|----------|-----------------------------------------------------------------------------|
| **Observed** | Admin test: `No procedure found on path "admin,exportPnLSummaryCSV"`. Permission tests: expected `FORBIDDEN`, got `NOT_FOUND` (procedure missing). Same for `agent.exportPnLReportCSV` and `auth.exportMyPlayerReport`. |
| **Root cause** | **Removed/renamed API.** The procedures `admin.exportPnLSummaryCSV`, `agent.exportPnLReportCSV`, and `auth.exportMyPlayerReport` are not present on the current app router. The codebase has moved to settlement-based exports (`exportPlayerSettlementCSV`, `exportAgentSettlementCSV`, `exportGlobalSettlementCSV`, `exportCommissionReportCSV`, etc.) and the old PnL export procedures are referenced in docs (`SECURITY-THREAT-MODEL.md`, `PHASE-9-PNL-REPORTS-NOTES.md`, `FRAUD-AUDIT-REPORT.md`) and in this test file only. So the tests are asserting behavior of procedures that no longer exist; the failure is NOT_FOUND (procedure missing), not FORBIDDEN (authorization). |

---

## 3. Production Blockers vs Technical Debt

| Failure(s) | Production blocker? | Rationale |
|------------|---------------------|-----------|
| **Lotto scoring (2)** | **Yes.** | Incorrect lotto scoring or wrong submission being scored would directly affect payouts and leaderboards. Must be resolved or conclusively proven to be test-only (isolation) before real-money use. |
| **checkLoginRateLimit (1)** | **Yes.** | Rate limiting is part of brute-force protection. The implementation is correct; the test is wrong. Until the test is fixed, we cannot be sure that future changes to rate limiting won’t break the intended behavior. Fixing the test is quick and reduces risk. |
| **Report export (5)** | **No (technical debt).** | Export paths have moved to settlement reports; the old PnL procedures are gone. The tests document **intent** (admin can export admin report; agent/player get 403 on admin/agent export). That intent should be revalidated against **current** export procedures (e.g. settlement CSV endpoints and authz). So: not a direct production blocker (no one can call missing procedures), but leaving tests red is technical debt and can hide real authz regressions if new export procedures are added. |

**Summary**

- **Production blockers:** 3 (lotto scoring × 2, login rate limit test × 1).
- **Technical debt:** 5 (report export permission tests).

---

## 4. Fix Plan and Estimated Complexity

| # | Item | Action | Complexity |
|---|------|--------|------------|
| 1 | **Lotto scoring – 0+strong = 1** | (A) **Isolation:** Ensure “last” submission is the one created in the current test (e.g. create a fresh tournament per test, or select by a unique identifier tied to the just-created submission). (B) If still failing, **debug scoring path:** confirm which submission is updated in `setLottoDrawResult`, which draw/predictions are passed to `resolveScoring`, and that `updateSubmissionLottoResult` is called for the expected submission. | **Medium.** Isolation is a few lines (e.g. new tournament per test or select by `createdAt`/id right after submit). Debugging scoring path may require tracing through `resolveScoring` and schema config. |
| 2 | **Lotto scoring – 0+no strong = 0** | Same as #1; same root cause (shared tournament / wrong submission or wrong draw). | **Low** once #1 is fixed (same test file and flow). |
| 3 | **checkLoginRateLimit** | Change test to match API: call `recordFailedLogin(req)` 5 times, then call `checkLoginRateLimit(req)` and expect `false`. Optionally assert that 6th `recordFailedLogin` does not change the result. | **Low.** One test edit; ~5 minutes. |
| 4 | **admin can export admin report** | Either (A) **Restore procedure:** Implement `admin.exportPnLSummaryCSV` (or equivalent) and wire to current reporting (e.g. settlement or general report) so the test passes, or (B) **Update test:** Point to an existing admin export (e.g. `exportGlobalSettlementCSV` or `exportCommissionReportCSV`) and assert success + CSV shape. Prefer (B) unless product explicitly requires the old PnL summary CSV. | **Low (B)** – update test to existing procedure. **Medium (A)** – implement and secure new procedure. |
| 5–8 | **Report export 403 tests** | **Update tests** to use **existing** export procedures and assert **FORBIDDEN** for agent/player on admin/agent export, and for player on personal export if such a procedure exists. If there is no “personal report” export anymore, remove or skip that test and document. | **Low.** Change procedure names and inputs to match router; adjust expectations to FORBIDDEN where applicable. |

**Rough effort**

- **Unblock production (lotto + rate limit):** ~0.5–1 day (lotto isolation/debug + rate limit test fix).
- **Clear technical debt (report export):** ~0.25 day (align tests with current export API and authz).

---

## 5. Risk Classification Summary

| Category | Count | Production blocker? | Recommended order |
|----------|-------|----------------------|-------------------|
| **Core gameplay logic** | 2 | Yes | Fix first (lotto scoring). |
| **Security critical** | 1 | Yes (test only) | Fix immediately after (rate limit test). |
| **Reporting / analytics** | 5 | No | Fix as technical debt (update tests to current API). |
| **Financial critical** | 0 | — | — |
| **Non-critical / UI / legacy** | 0 | — | — |

---

**Document version:** 1.0  
**No code changes were made; this is an assessment only.**
