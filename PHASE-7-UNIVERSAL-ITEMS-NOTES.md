# Phase 7: Universal Events / Matches Engine – Implementation Notes

## Overview

Phase 7 introduces a **generic competition item/event model** so the platform can represent football matches, lotto draws, chance draws, and future competition types without hardcoding structures each time. Implementation is **additive** and **backward compatible**: existing tournament, form, scoring, and settlement flows are unchanged; the universal engine is used only in new admin/debug paths and is prepared for future integration.

---

## Files Changed

### New files
- **`server/competitionItems/types.ts`** – Types: `SourceType`, `CompetitionItemSetResolved`, `CompetitionItemResolved`, `CompetitionItemRendererModel`, `CompetitionItemResultModel`, `CompetitionItemOptionModel`
- **`server/competitionItems/resolve.ts`** – Resolvers: `resolveLegacyMatchesAsCompetitionItems`, `resolveLegacyCustomMatchesAsCompetitionItems`, `resolveLottoAsCompetitionItems`, `resolveChanceAsCompetitionItems`, `resolveTournamentItems`
- **`server/competitionItems/helpers.ts`** – Typed helpers: `getCompetitionItemRendererModel`, `getCompetitionItemResultModel`, `getCompetitionItemOptionModel`
- **`server/competitionItems/index.ts`** – Public API re-exports
- **`PHASE-7-UNIVERSAL-ITEMS-NOTES.md`** – This file

### Modified files
- **`drizzle/schema-sqlite.ts`** – Added tables: `competition_item_sets`, `competition_items`
- **`server/db.ts`** – CREATE TABLE for both (SQLite only), `getCompetitionItemSetsByTournament`, `getCompetitionItemsBySetId` (return empty on MySQL)
- **`server/routers.ts`** – Imports from `db` and `competitionItems`; new admin procedures: `getResolvedTournamentItems`, `getCompetitionItemSets`, `getCompetitionItemsBySet`
- **`client/src/components/admin/SchemaDebugModal.tsx`** – Phase 7 section: resolved competition items (sets + items), expand “View all item details” for optionSchema/resultSchema/metadata

---

## New Tables / Entities (SQLite only)

| Table | Purpose |
|-------|---------|
| **competition_item_sets** | id, tournamentId, title, description, itemType, sourceType (legacy \| universal), stage, round, groupKey, sortOrder, metadataJson, createdAt, updatedAt |
| **competition_items** | id, itemSetId, externalKey, title, subtitle, itemKind, startsAt, closesAt, sortOrder, optionSchemaJson, resultSchemaJson, status, metadataJson, createdAt, updatedAt |

- **sourceType** in sets: `legacy` = built from existing matches/draws; `universal` = stored in these tables.
- Resolution in Phase 7 is **legacy-only**: no rows are written to these tables; resolvers build the unified shape from existing data. The tables exist for future phases (e.g. custom events stored in DB).

---

## Compatibility Strategy

- **No migration of existing tournaments.** All current competitions continue to use existing storage (matches, custom_football_matches, lotto_draw_results, chance_draw_results).
- **Compatibility layer:** `resolveTournamentItems(tournamentId)` loads the tournament, switches on `type` (football, football_custom, lotto, chance), and returns one or more `CompetitionItemSetResolved` with `CompetitionItemResolved` items built from legacy data. No reads from `competition_item_sets` / `competition_items` yet.
- **Football items** carry `legacyMatchId` so existing prediction keying (e.g. by match id) can be preserved when/if form or scoring switch to the universal model.
- **Lotto / chance** are modeled as one set with one item each; `optionSchema` / `resultSchema` describe the draw structure (e.g. regularCount 6, strong 1–7; suits/cards).
- **Existing form and scoring** still use current APIs (`getMatches()`, `getCustomFootballMatches(tournamentId)`, etc.); they are **not** switched to the universal resolver in this phase.

---

## Current Tournament Types Mapped to Universal Item Model

| Type | Mapping |
|------|--------|
| **football** | World cup matches → one set “משחקי מונדיאל”, one item per match; optionSchema 1/X/2, resultSchema score; `legacyMatchId` = match id. |
| **football_custom** | Custom football matches for tournament → one set per tournament, one item per match; same option/result schema; `legacyMatchId` = custom match id. |
| **lotto** | One synthetic set, one item; optionSchema: regularCount 6, numbers 1–37, strong 1–7. |
| **chance** | One synthetic set, one item; optionSchema: suits and cards. |

---

## Where the Universal Item Model Is Used

- **Admin / debug only:**
  - `admin.getResolvedTournamentItems` – returns `resolveTournamentItems(tournamentId)` for a given tournament.
  - Schema Debug modal (Phase 7 section): lists resolved sets and items; “View all item details” shows full optionSchema, resultSchema, metadata per item.
- **Not yet used:** Prediction form, scoring, settlement, or public competition views. Those remain on legacy paths.

---

## Admin UI Added/Changed

- **Schema Debug modal** (“עיין ב-schema” per tournament): new section “Phase 7: Resolved competition items (universal / legacy)”.
  - Shows each resolved set (title, sourceType, itemType, item count).
  - Preview of first 3 items (id, title, itemKind, sourceType, legacyMatchId).
  - Button “View all item details” toggles full JSON of all items (optionSchema, resultSchema, metadata).
- **Admin API:** `getCompetitionItemSets`, `getCompetitionItemsBySet` – list DB-stored sets/items (universal only; currently empty). No dedicated admin page for create/edit/delete in this phase; documented as recommended next step.

---

## What Remains Intentionally Legacy (for later)

- **Form rendering** – Still uses `matchesList` / legacy match APIs; no switch to `resolveTournamentItems` or renderer model.
- **Scoring / settlement** – Still use legacy match IDs and result shapes; no use of `getCompetitionItemResultModel` in live scoring.
- **Population of `competition_item_sets` / `competition_items`** – No seeding or sync from legacy data; no admin CRUD for universal items yet.
- **MySQL** – Phase 7 tables and helpers are SQLite-only; `getCompetitionItemSetsByTournament` / `getCompetitionItemsBySetId` return empty on MySQL.

---

## Typed Helpers (for future phases)

- **`getCompetitionItemRendererModel(item)`** – Returns renderer-friendly model (id, title, subtitle, itemKind, sourceType, legacyMatchId, optionSchema, metadata).
- **`getCompetitionItemResultModel(item)`** – Returns result model for scoring/admin (id, externalKey, title, itemKind, resultSchema, legacyMatchId, metadata).
- **`getCompetitionItemOptionModel(item)`** – Returns option model (itemId, itemKind, options, optionSchema).

These are ready to be used when form/scoring integrate with the universal item engine.

---

## Recommended Next Phase

1. **Optional:** Add admin CRUD for universal items (create/edit/delete item sets and items), especially for `football_custom` and future custom event types.
2. **Optional:** Use `resolveTournamentItems` (or equivalent) in one non-critical path (e.g. admin “preview competition items”) to validate the pipeline before touching form/scoring.
3. **When ready:** Migrate form and scoring to consume resolved items and typed helpers, while keeping legacy resolution for existing tournaments.
4. **If needed:** Add MySQL schema and migration for `competition_item_sets` and `competition_items` when universal storage is required on MySQL.
