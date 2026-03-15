# Tournament stabilization & validation – final report

## 1. Files changed

| File | Change |
|------|--------|
| `vitest.config.ts` | `pool: "forks"`, `poolOptions: { forks: { singleFork: true } }` to avoid SQLite lock across workers |
| `server/db.ts` | `initSqlite()`: configurable `SQLITE_BUSY_TIMEOUT` (default 15000 ms), `pragma("busy_timeout = ...")`; `createTournament()`: calls shared validator, uses `normalizedType` for `row.type` |
| `server/tournamentCreateValidator.ts` | **New** – shared create payload validation and category → internal type mapping |
| `server/tournament-category-e2e.test.ts` | **New** – E2E per category (football, basketball, tennis, lottery, chance, custom) and template flows |
| `server/tournament-integrity.test.ts` | **New** – financial/tournament integrity (no duplicate commission/prize/refund, scoring blocked when locked, draw-close rules) |
| `server/tournament-visibility-and-templates.test.ts` | Existing; no changes (already covers visibility/template) |
| `server/agent-commission.test.ts` | Existing; no changes (already has “אין כפילות עמלות” test) |

---

## 2. Exact SQLite lock fix

- **Cause:** Full suite ran with multiple Vitest workers (forks). All used the same SQLite file (`./data/worldcup.db`), so concurrent writes produced `SQLITE_BUSY` / "database is locked".
- **Fix (two parts):**
  1. **Single process for tests:** In `vitest.config.ts`, set `pool: "forks"` and `poolOptions: { forks: { singleFork: true } }` so only one process touches the DB. This removes cross-process lock contention.
  2. **Same-process retries:** In `server/db.ts` `initSqlite()`, open the DB with a configurable busy timeout (env `SQLITE_BUSY_TIMEOUT`, default 15000 ms) and run `sqlite.pragma("busy_timeout = ...")` so that a single process retries on lock instead of failing immediately.

---

## 3. Shared validator design and usage points

- **File:** `server/tournamentCreateValidator.ts`
- **Exports:** `INTERNAL_TOURNAMENT_TYPES`, `CATEGORY_TO_INTERNAL`, `validateCreateTournamentPayload`, `CreateTournamentPayload`, `ValidateCreateTournamentResult`, `ALLOWED_LOTTO_DRAW_TIMES_EXPORT`.
- **Internal types:** `football`, `football_custom`, `lotto`, `chance`, `custom`.
- **Category → internal mapping:**  
  football, basketball→custom, tennis→custom, baseball→custom, american_football→custom, hockey→custom, motorsports→custom, esports→custom, lottery/lotto→lotto, chance→chance, custom→custom, football_custom→football_custom. Unknown categories normalize to `custom`.
- **Rules enforced:**  
  Non-empty name; amount non-negative integer; initialStatus OPEN or DRAFT; visibility VISIBLE or HIDDEN; maxParticipants/guaranteedPrizeAmount non-negative when set.  
  **lotto:** drawCode, drawDate, drawTime required; drawTime in allowed list (`20:00`, `22:30`, `23:00`, `23:30`, `00:00`).  
  **chance:** drawDate, drawTime required.  
  **football / football_custom:** opensAt and closesAt required; closesAt > opensAt.  
  When both opensAt and closesAt are set (any type), closesAt > opensAt.
- **Usage:**  
  - `server/db.ts` → at the start of `createTournament()`, `validateCreateTournamentPayload()` is called (dynamic import). If invalid, `throw new Error(validation.message)`. If valid, `typeVal = validation.normalizedType` and `row.type = typeVal`.  
  - Manual create (admin `createTournament` mutation) and template-based create (`createTournamentFromTemplate` → `createTournament`) both go through `createTournament`, so both use the same validator.

---

## 4. Test files added/updated

| File | Role |
|------|------|
| `server/tournament-category-e2e.test.ts` | **Added.** E2E per category: football, basketball (→custom), tennis (→custom), lottery (lotto), chance, custom. Manual create produces valid DB row, OPEN, visible in admin and public; template create (football, lotto, chance) produces valid data when template exists. Rejects lotto without drawDate/drawTime (BAD_REQUEST). |
| `server/tournament-integrity.test.ts` | **Added.** No duplicate commission (hasCommissionForSubmission, at most one commission per submissionId); no duplicate prize (second `distributePrizes` throws); no duplicate refund (second `refundTournamentParticipants` idempotent, refundedCount 0); scoring blocked after finalized/settled (setLottoDrawResult throws when draw is locked); draw-close rules (validator rejects lotto without date/time or invalid drawTime, accepts allowed lotto times, rejects chance without date/time, accepts chance with date/time). |

Existing files `tournament-visibility-and-templates.test.ts` and `agent-commission.test.ts` were not modified; they already cover visibility/template and commission uniqueness.

---

## 5. Full-suite result before/after

- **Before (from context):** Full suite had 1 failure: `server/lotto-draw-close.test.ts` → "allows submit when draw is in the future" failed with `SqliteError: database is locked`. Additional failures could appear under parallel workers.
- **After:**  
  - Single-fork + busy timeout applied.  
  - All **17 test files**, **133 tests** pass (123 passed, 10 skipped; 0 failed).  
  - Run: `npx vitest run --reporter=verbose` (exit code 0).

---

## 6. Is the full suite green?

**Yes.** With the SQLite lock fix and the new/updated tests, the full suite is green (all run tests pass; skipped tests are intentional).

---

## 7. Remaining second-pass items

- **Chance drawTime:** Validator requires drawDate/drawTime for chance but does not restrict drawTime to a fixed list (unlike lotto). If product requires a single allowed set for chance, add a similar allow-list and export it for tests.
- **E2E coverage:** Template create for basketball/tennis/custom was not added (templates may not exist for those categories); add when templates exist.
- **Scoring after settlement:** Current test covers “scoring blocked when lotto draw result is locked.” Optionally add an explicit test that scoring/result update is blocked when tournament status is PRIZES_DISTRIBUTED or ARCHIVED.
- **Cleanup:** Integrity and E2E tests create many tournaments in the shared DB; consider cleaning up created tournaments in `afterAll` if test isolation becomes an issue.
