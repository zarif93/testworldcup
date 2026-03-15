# Phase 4: Schema-Driven Scoring Engine — Implementation Notes

This document describes the first schema-driven scoring path with safe fallback to legacy scoring. **Settlement, payout, profit/loss, and commissions are unchanged.** Only the **scoring calculation** can now use resolved scoring config when applicable.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **server/scoring/types.ts** | **New.** Shared types: `SchemaScoreResult`, `ScoringSource`, `ScoringContext` (football/lotto/chance), `SCORING_ENGINE_VERSION`. |
| **server/scoring/scoreFootballBySchema.ts** | **New.** Scores 1/X/2 predictions from `MatchResultScoringConfig`; mirrors legacy (points per correct result, default 3). |
| **server/scoring/scoreLottoBySchema.ts** | **New.** Scores lotto from `LottoScoringConfig`; points per matching number + strong hit (default 1 each). |
| **server/scoring/scoreChanceBySchema.ts** | **New.** Scores chance from `ChanceScoringConfig`; one point per matching card per suit (default 1). |
| **server/scoring/schemaScoringEngine.ts** | **New.** Single entry `scoreBySchema(config, context)`; dispatches by config mode to the correct scorer. |
| **server/scoring/resolveScoring.ts** | **New.** `resolveScoring(tournament, context)` → try schema first when applicable, else legacy; returns `{ points, scoringSource, strongHit?, warnings }`. `getLegacyScoreForContext(context)` for debug comparison. |
| **server/scoring/index.ts** | **New.** Re-exports scoring engine and resolver. |
| **server/db.ts** | `setChanceDrawResult`: load tournament, use `resolveScoring` per submission, then `updateSubmissionPoints`. `setLottoDrawResult`: same with `resolveScoring` and `updateSubmissionLottoResult`. `recalcCustomFootballPoints`: load tournament, use `resolveScoring` per submission, then `updateSubmissionPoints`. |
| **server/routers.ts** | Removed direct `calcSubmissionPoints` import. `updateMatchResult`: for each submission load tournament (cached), build football context, `resolveScoring`, `updateSubmissionPoints`. `createAutoSubmissions` (football branch): use `resolveScoring` instead of `calcSubmissionPoints`. Added `admin.getScoreComparison` (tournamentId + submissionId → legacy vs schema comparison). Imports: `resolveScoring`, `getLegacyScoreForContext`, `scoreBySchema`, `resolveTournamentScoringConfig`. |
| **client/src/components/admin/SchemaDebugModal.tsx** | Phase 4 section: input Submission ID, "Compare score" button, calls `admin.getScoreComparison`, shows stored/legacy/schema points, match/mismatch, warnings, breakdown. |

---

## 2. Scoring Engine Modules and Helpers

- **scoreFootballBySchema(config, ctx)** — 1/X/2 per match; `pointsPerCorrectResult` (default 3); returns `SchemaScoreResult` with breakdown per match.
- **scoreLottoBySchema(config, ctx)** — Regular numbers vs draw set + strong number; `pointsPerMatchingNumber`, `pointsForStrongHit` (default 1 each); returns total, `strongHit`, breakdown.
- **scoreChanceBySchema(config, ctx)** — Compare each suit (heart/club/diamond/spade); `pointsPerMatch` (default 1); returns total, matched count, breakdown per suit.
- **scoreBySchema(config, context)** — Dispatches by `config.mode` to the correct scorer; returns `SchemaScoreResult` or a zero result with warning on mode mismatch.
- **resolveScoring(tournament, context)** — Resolves scoring config via `resolveTournamentScoringConfig`; if `shouldUseSchemaScoring` and config valid, runs `scoreBySchema` and returns points; on failure or unsupported type falls back to legacy and returns same shape.
- **shouldUseSchemaScoring(tournament, config, context)** — True only when legacy type is football/football_custom/lotto/chance, config mode is not custom, and context type matches config mode.
- **getLegacyScoreForContext(context)** — Returns `{ points, strongHit? }` using the same legacy logic (scoringService for football, inline lotto/chance logic) for debug comparison.

---

## 3. Tournament Types Supported by Schema Scoring

| Type | Config mode | Behavior |
|------|-------------|----------|
| **football** | `match_result` | Points per correct 1/X/2 (config `pointsPerCorrectResult`, default 3). |
| **football_custom** | `match_result` | Same as football. |
| **lotto** | `lotto_match` | Points per matching regular number + points for strong hit (config defaults 1 each). |
| **chance** | `chance_suits` | Points per matching card per suit (config `pointsPerMatch`, default 1). |

Schema scoring is used only when the resolved scoring config has the matching mode and the tournament type is one of the above. All other types or custom config use legacy only.

---

## 4. Where Schema Scoring Is Used in the Live Flow

- **Chance draw result saved** — `setChanceDrawResult` (db): for each approved submission, `resolveScoring(tournament, chanceContext)` → `updateSubmissionPoints(s.id, resolved.points)`.
- **Lotto draw result saved** — `setLottoDrawResult` (db): for each approved submission, `resolveScoring(tournament, lottoContext)` → `updateSubmissionLottoResult(s.id, resolved.points, resolved.strongHit)`.
- **Custom football recalc** — `recalcCustomFootballPoints` (db): for each submission, `resolveScoring(tournament, footballContext)` → `updateSubmissionPoints(s.id, resolved.points)`.
- **World cup match result updated** — `admin.matches.updateMatchResult` (routers): for each submission with predictions array, load tournament (cached), `resolveScoring(tournament, footballContext)` → `updateSubmissionPoints(s.id, resolved.points)`.
- **Auto submissions created (football)** — `admin.createAutoSubmissions` (routers): after creating entries, for each submission in tournament `resolveScoring(tournament, footballContext)` → `updateSubmissionPoints(s.id, resolved.points)`.

In all cases the **external behavior** (when results are saved, when points are recalculated, which API is called) is unchanged; only the internal calculation may use schema or legacy.

---

## 5. When Fallback to Legacy Scoring Happens

- Tournament type is not one of football, football_custom, lotto, chance.
- Resolved scoring config has `mode: "custom"`.
- Config mode does not match context type (e.g. lotto context with match_result config).
- `resolveTournamentScoringConfig` throws or returns an invalid config.
- `scoreBySchema` throws (caught in `resolveScoring`, then legacy is used and a warning is logged).

On fallback, the same legacy logic as before Phase 4 is used (scoringService for football, inline formulas for lotto/chance), and the returned `scoringSource` is `"legacy"`.

---

## 6. Debug / Compare Tooling

- **Admin API:** `admin.getScoreComparison({ tournamentId, submissionId })`  
  Returns: `storedPoints`, `legacyPoints`, `schemaPoints` (or null if not applicable), `match` (true if legacy and schema agree or schema not used), `legacyStrongHit` (lotto), `schemaBreakdown`, `schemaWarnings`, `configMode`.

- **Schema Debug Modal (Phase 4 section):**  
  Input "Submission ID", button "Compare score". Calls `getScoreComparison` and shows stored/legacy/schema, match/mismatch, config mode, warnings, and schema breakdown.

This allows admins to verify that schema scoring matches legacy for existing data before relying on it fully.

---

## 7. Backward Compatibility

- **Storage:** Only `submissions.points` (and lotto `strongHit`) are written; no new required columns. No data migration.
- **Existing flows:** All triggers (set chance draw, set lotto draw, update match result, recalc custom football, create auto submissions) behave the same from the outside; only the scoring implementation can switch to schema when conditions are met.
- **Legacy path:** Unchanged; `calcSubmissionPoints` (football) and the inline lotto/chance logic remain and are used whenever `resolveScoring` chooses legacy.
- **Settlement/payout:** Not modified; leaderboards and reports continue to use `submissions.points` as before.

---

## 8. Intentionally Left Unchanged (for Later)

- **Settlement / payout logic** — Prize distribution, winner selection, profit/loss, commissions, reports.
- **Scoring config storage** — Still read from competition_types (or legacy defaults); no new persistence for scoring results beyond existing points.
- **Optional breakdown storage** — Schema engine returns breakdown/metadata but it is not persisted; only total points are. Future phases may store breakdown if needed.

---

## 9. Known Limitations

- Schema scoring uses the same defaults as legacy when config is missing or invalid (via fallback), so behavior stays aligned.
- No client-side scoring; all scoring remains server-side.
- Comparison API requires a valid draw result (lotto/chance) or match results (football) to compute both legacy and schema scores.

---

## 10. Recommended Next Phase

- **Phase 5 (optional):** Use resolved **settlement** config for prize distribution and winner selection while keeping payout/commission rules unchanged.
- Store optional scoring breakdown/metadata (e.g. per-match or per-suit) if needed for auditing or display.
- Extend schema scoring to additional competition types when their configs are introduced.
