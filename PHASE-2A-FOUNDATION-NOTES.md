# Phase 2A: Foundation Layer — Implementation Notes

This document describes what was added in Phase 2A and how backward compatibility is preserved.

---

## 1. What Was Added

### 1.1 Database

- **New table: `competition_types`** (in `drizzle/schema-sqlite.ts` and SQLite init in `server/db.ts`)
  - Columns: `id`, `code` (unique), `name`, `description`, `category`, `icon`, `isActive`, `sortOrder`, `defaultEntryFee`, `defaultHouseFeePercent`, `defaultAgentSharePercent`, `formSchemaJson`, `scoringConfigJson`, `settlementConfigJson`, `uiConfigJson`, `createdAt`, `updatedAt`.
  - Naming follows project convention (camelCase in schema; SQLite columns created with same names).

- **New column on `tournaments`**: **`competitionTypeId`** (nullable INTEGER)
  - Optional FK to `competition_types.id`. Existing rows have `NULL`; no data migration.

### 1.2 Migrations / Bootstrap

- **SQLite**: In `server/db.ts` (initSqlite):
  - `CREATE TABLE IF NOT EXISTS competition_types` with the columns above.
  - `ALTER TABLE tournaments ADD COLUMN competitionTypeId INTEGER` (via existing optionalCols loop).
  - **Seed**: If `SELECT COUNT(*) FROM competition_types` is 0, insert 4 rows (football, football_custom, lotto, chance) with initial config JSON.

- **MySQL**: This phase only touches the SQLite path. If you use MySQL in production, add equivalent `competition_types` table and `competition_type_id` on tournaments there separately.

### 1.3 Backend APIs

- **db.ts**
  - `getCompetitionTypes(opts?: { activeOnly?: boolean })` — list types, ordered by sortOrder. Returns `[]` when not using SQLite.
  - `getCompetitionTypeById(id)` — one type or null. Returns null when not SQLite.
  - `getCompetitionTypeByCode(code)` — one type or null. Returns null when not SQLite.

- **competitionTypeUtils.ts** (new file)
  - `resolveCompetitionTypeForTournament(tournament)` — async; returns `{ id, code, name, legacyType }` from `competitionTypeId` or from `type` via code lookup.
  - `getLegacyTypeFromCompetitionType(codeOrEntity)` — returns `football` | `football_custom` | `lotto` | `chance` | `custom` for use in existing branches.
  - `getCompetitionTypeDisplayName(tournamentOrType)` — async; returns display name (from DB or legacy map).
  - `getLegacyTypeDisplayName(legacyType)` — sync Hebrew label for legacy type.

- **tRPC router: `competitionTypes`**
  - `competitionTypes.list({ activeOnly?: boolean })` — public; returns all (or active-only) types.
  - `competitionTypes.getById({ id })` — public; 404 if not found.
  - `competitionTypes.getByCode({ code })` — public; 404 if not found.

### 1.4 Seeded Competition Types

| code            | name                | category | form_schema / scoring (summary) |
|-----------------|---------------------|----------|----------------------------------|
| football        | מונדיאל / כדורגל   | sports   | 1/X/2 per match, matchSource world_cup; 3 pts per correct |
| football_custom | כדורגל מותאם      | sports   | 1/X/2 per match, matchSource custom; 3 pts per correct |
| lotto           | לוטו                | lottery  | 6 numbers 1–37, strong 1–7; 1 pt per number + 1 for strong |
| chance          | צ'אנס               | cards    | 4 suits, cards 7–A; compare per suit |

Full JSON is stored in `formSchemaJson`, `scoringConfigJson`, `settlementConfigJson` for each row. Current system behavior is encoded there; **no scoring or form logic was changed** in this phase.

---

## 2. How Backward Compatibility Is Preserved

- **Existing tournaments**
  - All have `competitionTypeId = NULL`. No backfill was run.
  - All existing code that reads `tournament.type` (football, football_custom, lotto, chance) continues to work. Create, submit, score, lock, PnL filters — all still use the legacy `type` field and existing branches.

- **Create flow**
  - `createTournament` in db and routers was **not** changed. It still accepts and stores `type` only; it does **not** set `competitionTypeId`. So every new competition created from the current admin form still behaves exactly as before.

- **Resolving type for display or future logic**
  - Use `resolveCompetitionTypeForTournament(tournament)` when you want a single “type” object. When `competitionTypeId` is null, it derives from `tournament.type` and looks up by code (so the 4 seeded types are found). When `competitionTypeId` is set (future), it uses the row from `competition_types`.

- **Legacy type in code**
  - `getLegacyTypeFromCompetitionType(code)` returns the string expected by existing enums/branches. So when Phase 2B starts setting `competitionTypeId` on new competitions, you can still pass `legacyType` into current scoring/submit logic until a generic engine is introduced.

- **MySQL**
  - If the app runs with `DATABASE_URL` set (MySQL), `getCompetitionTypes` / `getById` / `getByCode` return empty or null. No crash; admin can keep using hardcoded type list until MySQL schema is extended.

---

## 3. What Still Remains Hardcoded (For Later Phases)

- **Admin UI**
  - Competition create form still uses a single form with type dropdown and type-specific fields. No wizard yet.
  - PnL/report filters still use a hardcoded list of type labels (e.g. `PNL_TOURNAMENT_TYPE_OPTIONS`). These can be switched to `competitionTypes.list()` in Phase 2B.

- **PredictionForm**
  - Still fully driven by tournament type switch (WORLD_CUP, FOOTBALL, CHANCE, LOTTO). No dynamic form rendering from `formSchemaJson`.

- **Scoring**
  - `scoringService.ts` and lotto/chance logic in `db.ts` are unchanged. Points (3 for football, 1 per number + strong for lotto, etc.) are still in code, not read from `scoringConfigJson`.

- **Create tournament**
  - Router and db `createTournament` do not accept or set `competitionTypeId`. Phase 2B can add optional `competitionTypeId` to the create input and set it when creating from the wizard.

- **World Cup matches**
  - Still a single hardcoded set in `shared/matchesData.ts`. No “match set” or “draw items” table yet.

---

## 4. Recommended Phase 2B Work

1. **Admin: competition types list**
   - New section or page that calls `competitionTypes.list()` and displays the table. Optional: edit name/description/config (or leave read-only at first).

2. **Admin: create competition wizard**
   - Step 1: choose type from `competitionTypes.list()`.
   - Step 2: type-specific fields (reuse current validation), and set `competitionTypeId` when calling `createTournament` (extend input in Phase 2B).

3. **Admin: filters from API**
   - Replace hardcoded `PNL_TOURNAMENT_TYPE_OPTIONS` (and any other type dropdowns) with options from `competitionTypes.list()`. Display labels from API so new types (if added later) appear without code change.

4. **Optional: backfill**
   - One-time script or admin action: for existing tournaments with `type IN ('football','football_custom','lotto','chance')`, set `competitionTypeId` to the corresponding `competition_types.id`. Not required for correctness; only for consistency and so `resolveCompetitionTypeForTournament` always returns the DB row.

---

## 5. Files Touched (Summary)

| File | Change |
|------|--------|
| `drizzle/schema-sqlite.ts` | Added `competitionTypes` table; added `competitionTypeId` to `tournaments`. |
| `server/db.ts` | optionalCols: `competitionTypeId`; CREATE TABLE + seed for `competition_types`; added `competitionTypes` to drizzle schema; added `getCompetitionTypes`, `getCompetitionTypeById`, `getCompetitionTypeByCode`. |
| `server/competitionTypeUtils.ts` | **New.** Helpers: resolveCompetitionTypeForTournament, getLegacyTypeFromCompetitionType, getCompetitionTypeDisplayName, getLegacyTypeDisplayName. |
| `server/routers.ts` | Imports for getCompetitionTypes, getCompetitionTypeById, getCompetitionTypeByCode; new `competitionTypes` router (list, getById, getByCode). |
| `PHASE-2A-FOUNDATION-NOTES.md` | **New.** This file. |

No changes were made to: PredictionForm, scoringService, createTournament mutation input, AdminPanel UI (no redesign), or any submit/approve/score flows.

---

## 6. TODOs Left for Later

- **Admin UI**: Replace hardcoded competition type options with `trpc.competitionTypes.list.useQuery()` where filters or dropdowns are used (e.g. PnL type filter). Marked as Phase 2B in roadmap.
- **createTournament**: Accept optional `competitionTypeId` and persist it when creating from wizard (Phase 2B).
- **Backfill** (optional): Set `competitionTypeId` on existing tournaments from their `type` (Phase 2B or one-off script).
- **MySQL**: Add `competition_types` table and `competition_type_id` on tournaments in MySQL schema if that dialect is used in production.
