# Phase 2C: Schema Preparation — Implementation Notes

This document describes the schema-driven foundation added in Phase 2C. No production behavior was changed: PredictionForm, scoring, and submit flows are unchanged.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **server/schema/competitionFormSchema.ts** | **New.** Typed form schema contract (FootballMatchFormSchema, LottoFormSchema, ChanceFormSchema); `parseCompetitionFormSchema`, `getDefaultFormSchemaForLegacyType`. |
| **server/schema/competitionScoringConfig.ts** | **New.** Typed scoring config (MatchResultScoringConfig, LottoScoringConfig, ChanceScoringConfig); `parseCompetitionScoringConfig`, `getDefaultScoringConfigForLegacyType`. |
| **server/schema/competitionSettlementConfig.ts** | **New.** Typed settlement config (CompetitionSettlementConfig); `parseCompetitionSettlementConfig`, `getDefaultSettlementConfigForLegacyType`. |
| **server/schema/resolveTournamentSchemas.ts** | **New.** `resolveTournamentSchemas`, `resolveTournamentFormSchema`, `resolveTournamentScoringConfig`, `resolveTournamentSettlementConfig`. |
| **server/schema/validateEntryAgainstFormSchema.ts** | **New.** `validateEntryAgainstFormSchema(schema, payload)` → `{ valid, errors }`. |
| **server/schema/buildRendererModel.ts** | **New.** `buildRendererModelFromFormSchema(schema)`, `getFieldRendererType(field)` — output for future dynamic form. |
| **server/schema/index.ts** | **New.** Re-exports all schema types and helpers. |
| **server/routers.ts** | Import `resolveTournamentSchemas`; added `admin.getTournamentResolvedSchemas` (tournamentId → resolved schemas). |
| **client/src/components/admin/SchemaDebugModal.tsx** | **New.** Admin-only modal: shows resolved competition type, form schema, scoring config, settlement config (read-only). |
| **client/src/components/admin/CompetitionsTable.tsx** | Optional prop `onViewSchema(tournamentId)`; added "Schema" (Code icon) button per row when provided. |
| **client/src/pages/AdminPanel.tsx** | State `schemaDebugTournamentId`; Dialog with `SchemaDebugModal`; passes `onViewSchema={setSchemaDebugTournamentId}` to CompetitionsTable. |
| **PHASE-2C-SCHEMA-PREPARATION-NOTES.md** | **New.** This file. |

---

## 2. New Schema Contracts

### 2.1 Form schema

- **FormSchemaKind:** `football_match_predictions` | `lotto` | `chance` | `custom`
- **FormSchemaField:** key, type (select | number | text), label, required, options, min/max, outcomeType (1X2)
- **FootballMatchFormSchema:** kind, matchSource (world_cup | custom | draw_items), outcomeType, fieldsPerMatch, itemSourceRef
- **LottoFormSchema:** kind, regularCount, regularMin/Max, strongMin/Max
- **ChanceFormSchema:** kind, suits[], cardValues[]
- **CompetitionFormSchema:** union of the above

### 2.2 Scoring config

- **ScoringMode:** match_result | lotto_match | chance_suits | custom
- **MatchResultScoringConfig:** mode, pointsPerCorrectResult, outcomeType (1X2)
- **LottoScoringConfig:** mode, pointsPerMatchingNumber, pointsForStrongHit
- **ChanceScoringConfig:** mode, compareCardsPerSuit, pointsPerMatch (optional)
- **CompetitionScoringConfig:** union of the above

### 2.3 Settlement config

- **PrizeMode:** top_n | exact_match | custom
- **CompetitionSettlementConfig:** prizeMode, minParticipants, prizeDistributionDefault (rank → percent), tieHandling (split | first_wins)

---

## 3. Parsing and Normalization Strategy

- **Input:** Raw `formSchemaJson` / `scoringConfigJson` / `settlementConfigJson` from DB (string or object).
- **Parsing:** Try `JSON.parse` if string; validate shape and coerce to typed struct; invalid or unknown → return legacy default for the given `legacyType`.
- **Warnings:** Parsers return `{ schema|config, warnings: string[] }` so callers can log or show debug info without failing.
- **Defaults:** `getDefaultFormSchemaForLegacyType`, `getDefaultScoringConfigForLegacyType`, `getDefaultSettlementConfigForLegacyType` return the same structs used by current football/lotto/chance logic.

---

## 4. Fallback Strategy for Legacy Tournaments

- **resolveTournamentSchemas(tournament):**
  1. If `tournament.competitionTypeId` is set, load competition type by id; use its JSON fields if present.
  2. Else if `tournament.type` is set, load competition type by code; use its JSON if present.
  3. Else use `tournament.type` (or "football") to derive legacy type and return **legacy defaults** only (no DB JSON).
- Existing competitions with `competitionTypeId = null` therefore always get the same behavior as today (football 3 pts, lotto 1+strong, chance per-suit, etc.) via the default configs.

---

## 5. What Is Now Ready for Phase 3

- **Schema resolution:** Any code can call `resolveTournamentFormSchema(t)`, `resolveTournamentScoringConfig(t)`, `resolveTournamentSettlementConfig(t)` or `resolveTournamentSchemas(t)` to get typed form/scoring/settlement for a tournament (DB-driven or legacy default).
- **Validation:** `validateEntryAgainstFormSchema(schema, payload)` can be used in a future schema-driven submit path to validate payloads without changing current zod-based submit.
- **Renderer preparation:** `buildRendererModelFromFormSchema(schema)` and `getFieldRendererType(field)` produce a renderer-ready model; a future dynamic PredictionForm can consume this.
- **Admin debug:** Admins can click "Schema" on a competition row to see resolved type and all three configs (read-only), helping verify resolution and prepare for Phase 3.

---

## 6. What Remains Intentionally Hardcoded

- **PredictionForm:** Still fully driven by `tournament.type` switch (WORLD_CUP, FOOTBALL, CHANCE, LOTTO). No dynamic form rendering yet.
- **Submit validation:** Routers still use existing zod schemas and `isLottoPredictionsValid` / `isChancePredictionsValid`; `validateEntryAgainstFormSchema` is not used in the submit path.
- **Scoring:** `scoringService.calcPoints` / `calcSubmissionPoints` and lotto/chance scoring in `db.ts` are unchanged. Scoring config is resolved but not yet read by the scoring engine.
- **Settlement:** Prize distribution and fee logic still use existing code paths; settlement config is resolved but not yet applied by the settlement engine.

---

## 7. Risks / Caveats

- **Seed alignment:** Phase 2A seeded JSON for football, football_custom, lotto, chance already matches the new contracts (kind, matchSource, outcomeType, pointsPerCorrectResult, etc.). No migration of existing `competition_types` rows was run; if a row was edited by hand and JSON is invalid, resolution falls back to legacy default and warnings are returned.
- **New types:** If a new `competition_types` row has a code not in the legacy enum (e.g. "quiz"), resolution still works but `legacyType` may be "football" or "custom"; submit/scoring continue to rely on `tournament.type` until Phase 3.
- **Renderer model:** `buildRendererModelFromFormSchema` is tailored to current football/lotto/chance shapes. A future form type (e.g. quiz) may require extending the form schema contract and the renderer model.
- **Validation:** `validateEntryAgainstFormSchema` does not validate match count vs. actual matches (e.g. 72 for World Cup); that remains the responsibility of the submit path that has access to matches.

---

## 8. Seed / Config Alignment

The Phase 2A seed in `server/db.ts` was not modified. The existing JSON for football, football_custom, lotto, and chance already conforms to the new typed contracts:

- **football / football_custom:** kind, matchSource, outcomeType, fieldsPerMatch → parsed by `parseCompetitionFormSchema`; pointsPerCorrectResult, outcomeType → parsed by `parseCompetitionScoringConfig`.
- **lotto:** kind, regularCount, regularMin/Max, strongMin/Max → form; pointsPerMatchingNumber, pointsForStrongHit → scoring.
- **chance:** kind, suits, cardValues → form; compareCardsPerSuit → scoring.

No data migration or seed re-run is required for Phase 2C.
