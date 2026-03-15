# Tournament Visibility Fix + Template System — Implementation Summary

## 1. Files changed

| File | Changes |
|------|---------|
| `server/db.ts` | createTournament: set `row.status`, `row.visibility`, `row.hiddenFromHomepage`; add `initialStatus` param and validation; debug logging after insert. getTournamentPublicStats: debug logging of raw tournaments. Safer NULL-status repair (only non-deleted, non-finalized). New tables: tournament_template_categories, tournament_templates. Seed categories and 6 templates. New functions: getTournamentTemplateCategories, getTournamentTemplates, getTournamentTemplateById, createTournamentFromTemplate. |
| `drizzle/schema-sqlite.ts` | New tables: tournamentTemplateCategories, tournamentTemplates (with category, configJson). |
| `server/routers.ts` | Imports: getTournamentTemplateCategories, getTournamentTemplates, getTournamentTemplateById, createTournamentFromTemplate. New procedures: getTournamentTemplateCategories, getTournamentTemplates, getTournamentTemplateById, createTournamentFromTemplate (new template system). Old createTournamentFromTemplate renamed to createTournamentFromCompetitionTemplate (Phase 20 wizard). |
| `client/src/components/admin/CreateTournamentFromTemplateDialog.tsx` | **New.** 3-step dialog: (1) choose category, (2) choose template, (3) edit details + create. Uses admin.getTournamentTemplateCategories, getTournamentTemplates, getTournamentTemplateById, createTournamentFromTemplate. |
| `client/src/pages/AdminPanel.tsx` | Import CreateTournamentFromTemplateDialog. State templateCreateOpen. Button "צור מתבנית" next to "צור תחרות". Render CreateTournamentFromTemplateDialog. |
| `docs/TOURNAMENT-VISIBILITY-AND-TEMPLATES-IMPLEMENTATION.md` | **New.** This file. |

---

## 2. Exact root-cause fix applied

- **Cause:** New tournaments were stored with `status = NULL` because `createTournament()` never set `status`, and the column was added via ALTER TABLE without a DEFAULT. `getActiveTournaments()` only returns `status IN ('OPEN','LOCKED')`, so new rows were excluded from homepage and public lists.
- **Fix in `server/db.ts` `createTournament()`:**
  - Set **`row.status = initialStatus`** with `initialStatus` defaulting to **`"OPEN"`** (valid values: `"OPEN"` or `"DRAFT"`).
  - Set **`row.visibility = data.visibility ?? "VISIBLE"`** when not explicitly provided.
  - Set **`row.hiddenFromHomepage = 0`** so new tournaments are not hidden.
  - Added optional **`initialStatus`** parameter with validation: only `"OPEN"` or `"DRAFT"` allowed.
  - After insert, **debug log** (non-production): `{ id, type, status, opensAt, closesAt }`.
- **Debug logging in `getTournamentPublicStats()`:** When not in production, log `{ activeOnly, count, ids }` of the raw tournaments list before mapping.

---

## 3. Migration/repair applied for existing NULL status tournaments

- **Location:** `server/db.ts` init (where other tournament migrations run).
- **Logic:** Only rows that are clearly intended to be active are updated. We do **not** set `OPEN` for:
  - Deleted tournaments (`deletedAt IS NOT NULL`).
  - Finalized/settled tournaments (`settledAt IS NOT NULL` or `resultsFinalizedAt IS NOT NULL` / `!= 0`).
- **SQL:**  
  `UPDATE tournaments SET status = 'OPEN' WHERE (status IS NULL OR status = '') AND deletedAt IS NULL AND settledAt IS NULL AND (resultsFinalizedAt IS NULL OR resultsFinalizedAt = 0)`  
- So: only non-deleted, non-settled tournaments with missing status get `status = 'OPEN'`. Historical/finalized rows are unchanged.

---

## 4. Template DB schema

- **Table `tournament_template_categories`**
  - `id` INTEGER PK
  - `code` TEXT NOT NULL UNIQUE (e.g. football, basketball, lottery, chance, custom)
  - `name` TEXT NOT NULL
  - `displayOrder` INTEGER NOT NULL DEFAULT 0
  - `isActive` INTEGER NOT NULL DEFAULT 1
  - `createdAt`, `updatedAt` INTEGER (timestamp)

- **Table `tournament_templates`**
  - `id` INTEGER PK
  - `name` TEXT NOT NULL
  - `category` TEXT NOT NULL (category code)
  - `description` TEXT
  - `isActive` INTEGER NOT NULL DEFAULT 1
  - `configJson` TEXT NOT NULL (JSON)
  - `createdAt`, `updatedAt` INTEGER (timestamp)

- **configJson** supports: tournamentType, scoringModel, inputFormat, prizeModel, defaultEntryAmount, defaultParticipantRules, defaultDurations, lifecycleDefaults, uiHints, sport-specific settings.

---

## 5. Backend endpoints/functions added

- **DB**
  - `getTournamentTemplateCategories()` → list active categories.
  - `getTournamentTemplates(category?: string | null)` → list active templates, optionally by category.
  - `getTournamentTemplateById(id)` → single template by id.
  - `createTournamentFromTemplate(templateId, overrides)` → load template, merge config + overrides, call `createTournament()` with `initialStatus: "OPEN"`.

- **Router (admin)**
  - `getTournamentTemplateCategories` — query, no input.
  - `getTournamentTemplates` — query, optional input `{ category }`.
  - `getTournamentTemplateById` — query, input `{ id }`.
  - `createTournamentFromTemplate` — mutation, input: templateId, name, description?, amount?, opensAt?, closesAt?, drawDate?, drawTime?, drawCode?, maxParticipants?, visibility?, rulesJson?. Validates type-specific required fields (lotto/chance/football) before calling DB.

- **Legacy:** `createTournamentFromTemplate` (Phase 20, competition_templates) renamed to **`createTournamentFromCompetitionTemplate`** so the new template system can use the name `createTournamentFromTemplate`.

---

## 6. Admin flow changes

- **New button:** "צור מתבנית" next to "צור תחרות" on the competitions section (when the create wizard is not shown).
- **New dialog:** `CreateTournamentFromTemplateDialog` — 3 steps:
  1. **Choose category** — grid of categories from `getTournamentTemplateCategories`.
  2. **Choose template** — list of templates from `getTournamentTemplates(category)`.
  3. **Edit & create** — form: name, description, amount; for football/football_custom: opensAt, closesAt; for lotto: drawCode, drawDate, drawTime; for chance: drawDate, drawTime. Submit calls `createTournamentFromTemplate`.
- Existing "צור תחרות" (FreeCompetitionBuilder) and per-type create forms (chance, lotto, mondial, football_custom) are unchanged.

---

## 7. Seed templates added

- **Categories (11):** Football, Basketball, Tennis, Baseball, American Football, Hockey, Motorsports, Esports, Lottery, Chance, Custom.
- **Templates (6):**
  - Football basic (type football)
  - Basketball basic (type football_custom)
  - Tennis basic (type football_custom)
  - Lottery basic (type lotto)
  - Chance basic (type chance)
  - Custom basic (type custom)

Each template has a realistic configJson (tournamentType, scoringModel, inputFormat, prizeModel, defaultEntryAmount, defaultDurations, lifecycleDefaults, uiHints). Seeds run only when the respective table is empty.

---

## 8. Anything still needing a second pass

- **Logging:** Debug logs in `createTournament` and `getTournamentPublicStats` are gated by `process.env.NODE_ENV !== "production"`. Remove or reduce later if desired.
- **Custom type on homepage:** Homepage splits by football, lotto, chance, football_custom only. Tournaments with `type === 'custom'` do not appear in any of these buckets; they would need a fifth section or mapping (e.g. show custom under "Custom" or under football_custom). Not changed in this pass.
- **createTournamentFromTemplate (DB):** For lotto, `createTournament()` in db derives `closesAt` from drawDate+drawTime when type is lotto. So passing drawDate and drawTime in overrides is enough; no extra logic needed in createTournamentFromTemplate.
- **Phase 20 wizard:** Still uses `getTemplateAsBuilderPrefill` and the old competition_templates flow. Create from that wizard uses the builder’s create (or would use `createTournamentFromCompetitionTemplate` if a one-shot create from template is added there). No change in this pass.
