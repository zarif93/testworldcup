# Phase 17: Builder Activation & Runtime Consumption

## Overview

Builder-defined settings from the no-code competition wizard (Phase 16) now affect runtime behavior. Resolution order: **1) builder override**, **2) competition_type config**, **3) legacy default**. Invalid or missing `rulesJson` never crashes the runtime; all overrides fail safely.

---

## 1. Files Changed

### Server

- **`server/schema/resolveTournamentSchemas.ts`**
  - Extended tournament input type to `TournamentWithBuilder` (optional `rulesJson`, `minParticipants`, `prizeDistribution`).
  - `parseRulesJson()` safely parses `rulesJson`; invalid JSON or non-object is ignored.
  - **Form schema:** If `rules.formSchemaOverride` is a valid object, use `parseCompetitionFormSchema(formSchemaOverride, legacyType).schema`; on parse error, fall back to type then legacy. Sets `resolutionSource.form` to `builder` / `type` / `legacy`.
  - **Scoring:** If `rules.scoringOverride` is a valid object, use `parseCompetitionScoringConfig(scoringOverride, legacyType).config`; on error, fall back. After resolution, if `rules.pointsPerCorrect` is a number, merge onto config (`pointsPerCorrectResult` for match_result). Sets `resolutionSource.scoring`.
  - **Settlement:** Resolve from type/legacy; then apply **tournament-level overrides:** `tournament.minParticipants` → `config.minParticipants`, `tournament.prizeDistribution` → `config.prizeDistributionDefault`, `rules.tieHandling` (`first_wins` | `split`) → `config.tieHandling`. Sets `resolutionSource.settlement`.
  - Return type extended with `resolutionSource` and `builderOverrides` (for admin/debug).
  - `resolveTournamentFormSchema`, `resolveTournamentScoringConfig`, `resolveTournamentSettlementConfig` now accept `TournamentWithBuilder` and pass it through to `resolveTournamentSchemas`.

- **`server/routers.ts`**
  - `getTournamentResolvedSchemas`: passes full `tournament` (not a narrowed type) so `rulesJson` and DB fields are available; response includes new `resolutionSource` and `builderOverrides`.
  - `getResolvedFormSchema`: passes full tournament to `resolveTournamentFormSchema` so builder form override is used.
  - `tournaments.getById`: returns `{ ...t, bannerUrl }` where `bannerUrl` is read from `t.rulesJson.bannerUrl` (safe parse).

- **`server/db.ts`**
  - `getBannerUrlFromRulesJson(rulesJson)`: helper to safely extract `bannerUrl` from `rulesJson`.
  - `TournamentPublicStat`: added optional `bannerUrl?: string | null`.
  - `getTournamentPublicStats`: sets `bannerUrl: getBannerUrlFromRulesJson((t as { rulesJson }).rulesJson)` on each returned stat.

### Client

- **`client/src/components/admin/SchemaDebugModal.tsx`**
  - New block: when `data.resolutionSource` or `data.builderOverrides` is present, shows “Phase 17: Resolution source / Builder overrides” with form/scoring/settlement source and JSON of builder overrides.

- **`client/src/pages/Home.tsx`**
  - Mobile tournament cards: when `(t as { bannerUrl }).bannerUrl` is set, render a small banner image at the top of the card.

- **`client/src/pages/PredictionForm.tsx`**
  - When `tournament.bannerUrl` is set (from `getById`), render a banner image section below the title.

---

## 2. Builder Fields Now Consumed at Runtime

| Builder field | Where stored | Runtime use |
|---------------|--------------|-------------|
| `formSchemaOverride` | `tournament.rulesJson.formSchemaOverride` | `resolveTournamentFormSchema` → form validation, dynamic form UI (priority 1). |
| `scoringOverride` | `tournament.rulesJson.scoringOverride` | `resolveTournamentScoringConfig` → schema scoring (priority 1). |
| `pointsPerCorrect` | `tournament.rulesJson.pointsPerCorrect` | Merged onto resolved scoring config for match_result → `scoreFootballBySchema` / `scoreBySchema`. |
| `tieHandling` | `tournament.rulesJson.tieHandling` | Merged into settlement config → `selectWinnersBySchema` (split vs first_wins). |
| `minParticipants` | `tournament.minParticipants` (DB column) | Merged into settlement config → `shouldUseSchemaSettlement` and prize distribution. |
| `prizeDistribution` | `tournament.prizeDistribution` (DB column) | Merged into settlement config as `prizeDistributionDefault` → `distributePrizesBySchema`. |
| `bannerUrl` | `tournament.rulesJson.bannerUrl` | Public stats + getById → Home cards and PredictionForm banner. |

---

## 3. Merge / Priority Strategy

- **Form schema:** 1) If `rulesJson.formSchemaOverride` is valid object → use it (builder). 2) Else if `competition_type.formSchemaJson` exists → use it (type). 3) Else → legacy default by `effectiveLegacyType`.
- **Scoring:** 1) If `rulesJson.scoringOverride` is valid object → use it (builder). 2) Else if `competition_type.scoringConfigJson` exists → use it (type). 3) Else → legacy default. Then, if `rulesJson.pointsPerCorrect` is number → overwrite `pointsPerCorrectResult` on the resolved config.
- **Settlement:** 1) Resolve from type or legacy (as before). 2) If `tournament.minParticipants != null` → set `config.minParticipants`. 3) If `tournament.prizeDistribution` is non-empty object → set `config.prizeDistributionDefault`. 4) If `rulesJson.tieHandling` is `first_wins` or `split` → set `config.tieHandling`.

---

## 4. Public / Admin Integrations Added

- **Public**
  - **Home:** Tournament list (mobile) shows builder banner image when `bannerUrl` is present (from `getTournamentPublicStats`).
  - **PredictionForm:** Shows builder banner below title when `tournament.bannerUrl` is present (from `tournaments.getById`).
- **Admin**
  - **Schema Debug modal:** Shows “Phase 17: Resolution source / Builder overrides” with form/scoring/settlement source and raw builder overrides.

---

## 5. Fallback Behavior

- **Invalid or missing `rulesJson`:** `parseRulesJson` returns `null`; no builder overrides applied; type/legacy resolution unchanged.
- **Invalid `formSchemaOverride` / `scoringOverride`:** Try/catch around parse; on error, fall back to type then legacy; add warning to `formSchemaWarnings` / `scoringConfigWarnings`.
- **Missing `minParticipants` / `prizeDistribution` / `tieHandling`:** No merge; resolved config from type/legacy is used as-is.
- **Missing `bannerUrl`:** `getBannerUrlFromRulesJson` returns `null`; no banner shown; no extra payload.

---

## 6. Backward Compatibility

- Tournaments without `rulesJson` or with empty/invalid `rulesJson`: behavior unchanged (type or legacy).
- Existing callers of `resolveTournamentFormSchema` / `resolveTournamentScoringConfig` / `resolveTournamentSettlementConfig` that pass only `{ competitionTypeId, type }` still work (no rulesJson/minParticipants/prizeDistribution).
- Settlement and scoring engines unchanged; they only receive the already-merged config.
- Public stats and getById remain backward compatible; new `bannerUrl` is optional.

---

## 7. Remaining Builder Features Not Yet Active

- **CMS metadata:** `cmsBannerKey`, `cmsIntroSectionId`, `cmsLegalPageSlug` are stored in `rulesJson` but are **not** yet used in public or admin UI (no routing or section selection by tournament). Can be wired to competition detail or legal footer in a later phase.
- **Full top-3 prize distribution:** `distributePrizesBySchema` currently uses only `prizeDistributionDefault["1"]` for the first rank; multi-rank distribution (e.g. 50/30/20 for 1st/2nd/3rd) would require extending that function.
- **Admin tournament list:** No banner or CMS badges in admin competition tables yet; only Schema Debug and public surfaces use builder data.
