# Tournament Creation & Visibility Audit + Template System Architecture

**Role:** Senior backend + frontend architect  
**Scope:** Full tournament creation and rendering flow; template system design.  
**Deliverable:** Root cause analysis, fix plan, template architecture, migration strategy, implementation steps. No implementation yet.

---

## PART 1 — CRITICAL BUG: Newly Created Tournaments Do Not Appear

### 1.1 Full Flow Trace

| Step | Location | What happens |
|------|----------|--------------|
| 1. Admin modal/form | `client/src/components/admin/FreeCompetitionBuilder.tsx`, `client/src/pages/AdminPanel.tsx` (chance/lotto/mondial/football_custom create forms) | User fills name, description, amount, type, opensAt, closesAt, visibility, rulesJson, etc. Submits via `trpc.admin.createTournament.useMutation()`. |
| 2. API mutation | `server/routers.ts` ~2066–2174 | `admin.createTournament` validates input (type, drawCode, drawDate/drawTime for lotto/chance, opensAt/closesAt for football/football_custom), then calls `createTournament({ ... })` from db. |
| 3. DB insert | `server/db.ts` ~6285–6371 | `createTournament(data)` builds a `row` object with: name, amount, description, type, startDate, endDate, maxParticipants, prizeDistribution, drawCode, drawDate, drawTime, customIdentifier, visibility, minParticipants, rulesJson, guaranteedPrizeAmount, startsAt, endsAt, opensAt, closesAt, settledAt, resultsFinalizedAt. **It never sets `status` (or explicitly sets `visibility`/`hiddenFromHomepage`).** Inserts via `db.insert(tournaments).values(row).returning({ id })`. |
| 4. Lifecycle / state | N/A at create | Lifecycle state machine (`server/tournament/lifecycle.ts`) maps DB `status` to phases. No transition is called on create; the row is created with whatever status the DB stores. |
| 5. Homepage query | `server/routers.ts` ~585–586 | `tournaments.getPublicStats` → `getTournamentPublicStats(true)` → `getActiveTournaments()`. |
| 6. Active tournaments filter | `server/db.ts` ~4020–4031 | `getActiveTournaments()` returns rows where: `deletedAt IS NULL`, `COALESCE(visibility,'VISIBLE')='VISIBLE'`, `COALESCE(hiddenFromHomepage,0)=0`, **`status IN ('OPEN','LOCKED')`**. |
| 7. Homepage rendering | `client/src/pages/Home.tsx` ~186, 231–247 | Uses `tournamentStats` from `tournaments.getPublicStats`. Builds `byType` (football, lotto, chance, footballCustom) from that list. **Only these four types are shown;** `type === 'custom'` is grouped into none of them, so custom tournaments would only appear if we added a "custom" bucket (they still wouldn’t appear if they’re missing from `getPublicStats`). |

### 1.2 What DB Status Is Assigned on Create?

- **In code:** `createTournament()` never sets `row.status`. Only keys present in `row` are sent in the INSERT.
- **In DB:** The `tournaments` table was created in `server/db.ts` with a minimal `CREATE TABLE` (id, amount, name, isLocked, createdAt). The `status` column was added later via **ALTER TABLE ADD COLUMN status TEXT** (see optionalCols in db.ts ~375, 398). **No DEFAULT** is used in that ALTER. So for every new insert that omits `status`, SQLite stores **NULL**.
- **Conclusion:** Newly created tournaments have **status = NULL** in the database.

### 1.3 Does the Lifecycle State Machine Map It to a Visible State?

- **Lifecycle:** `getLifecycleState(dbStatus)` maps null/undefined → `"DRAFT"`. So conceptually the tournament is in DRAFT. The **visibility** logic does not use the lifecycle layer; it uses the raw query in `getActiveTournaments()` which requires `status IN ('OPEN','LOCKED')`. So **NULL is not considered visible**.

### 1.4 Do Homepage Filters Exclude It?

- **Yes.** `getActiveTournaments()` uses `inArray(tournaments.status, ["OPEN", "LOCKED"])`. In SQL, `NULL` is not equal to any value and is not “in” the list, so the new tournament is **excluded** from the result set. So it never appears in `getPublicStats` → homepage.

### 1.5 Date Logic / Type Mismatch / Caching

- **Date logic:** Not the cause. The tournament is filtered out earlier by `status`. opensAt/closesAt are not used in `getActiveTournaments()`.
- **Type mismatch:** Homepage splits by `football`, `lotto`, `chance`, `football_custom`. If we fixed visibility and the tournament had `type === 'custom'`, it would still not appear in any of the four buckets (would need a fifth bucket or mapping custom → one of these). So for **custom** type there is an additional UI filter; for **football/lotto/chance/football_custom** the main blocker is status.
- **Caching:** `getTournamentPublicStats` uses no cache; it calls `getActiveTournaments()` each time. No caching layer is hiding the tournament.

### 1.6 Admin Lists

- **Admin `tournaments.getAll`:** Uses `getTournaments()` when `ctx.user?.role === 'admin'`. `getTournaments()` only filters `deletedAt IS NULL`, so it does **not** filter by status. So in principle the new tournament **should** appear in admin lists that use `getAll`. If it sometimes doesn’t, possible causes: a different endpoint used in some tab (e.g. one that uses `getActiveTournaments()` or a cached list), or a refetch not triggered after create. The **root cause of “not visible anywhere”** is still the missing `status` for public and any admin view that might use active-only data.

### 1.7 Root Cause (Single Statement)

**Newly created tournaments are stored with `status = NULL` because `createTournament()` never sets `status`, and the `status` column was added with ALTER TABLE without a DEFAULT. `getActiveTournaments()` (and thus `getPublicStats`) only returns rows with `status IN ('OPEN','LOCKED')`, so new tournaments are excluded from the homepage and any UI that relies on “active” lists.**

### 1.8 Exact Fix Plan (Logic Only)

1. **In `server/db.ts` inside `createTournament()`:**  
   Before `db.insert(tournaments).values(...)`, set the initial status explicitly:
   - Set **`row.status = "OPEN"`** for the insert (canonical “created and open for participation” state per lifecycle).
2. **Defensive (optional but recommended):**  
   Set **`row.visibility = data.visibility ?? "VISIBLE"`** if not already set, so the row is visible by default even if the column has no default. Similarly ensure **`row.hiddenFromHomepage = false`** (or 0) if the column exists and you want to avoid any legacy NULL behavior.
3. **Logging (as requested):**  
   - After the insert in `createTournament()`, log the created row (e.g. `console.log("[createTournament] created", { id, status: row.status, type: row.type, name: row.name })`).  
   - In the procedure that calls `getTournamentPublicStats` (or inside `getTournamentPublicStats`/`getActiveTournaments` when in dev), log the raw count or first few IDs so you can confirm new tournaments appear in the result.
4. **No other changes:**  
   No UI changes, no copy changes, no new filters. Lifecycle and settlement logic remain unchanged; we only set the initial DB state correctly.

### 1.9 Verification After Fix

- Create an OPEN tournament (any type: football, football_custom, lotto, chance, custom) via the admin “Create Tournament” flow.
- Confirm in DB (or via log) that the new row has `status = 'OPEN'`.
- Confirm that the next request to `tournaments.getPublicStats` (homepage load) includes this tournament.
- Confirm it appears in the correct section on the homepage (and, for custom, either in a new “custom” bucket or in an existing bucket if you map custom → one of the four types).
- Confirm it appears in admin tournament lists that use `getAll` (and, if any use active-only, there too).

---

## PART 2 — Tournament Templates System (Required Feature)

### 2.1 Goal (Restated)

Admins should not create tournaments from scratch. Flow: **first select sport category → then select template → then edit parameters → create.**

### 2.2 Current State

- **Phase 20** already introduced `competition_templates` and procedures: `listCompetitionTemplates`, `getCompetitionTemplateById`, `createCompetitionTemplate`, `createTournamentFromTemplate`, `getTemplateAsBuilderPrefill`, etc.
- Templates are tied to **legacyType** (football, football_custom, lotto, chance) and optional **competitionTypeId**. There is no broader “sport category” (e.g. Football, Basketball, Tennis, Esports, Lottery, Chance, Custom).
- Creation flows today: (1) Direct create (FreeCompetitionBuilder / chance/lotto/mondial/football_custom forms) with `admin.createTournament`, (2) Wizard with optional “from template” prefill and `createTournamentFromTemplate`.

### 2.3 Proposed “Create from Template” Architecture

- **Categories (sport/category):** First-class list the admin sees first, e.g. Football, Basketball, Tennis, Baseball, American Football, Hockey, Motorsports, Esports, Lottery, Chance, Custom.
- **Templates:** Each template belongs to one category. Defines default structure, scoring type, input format, participant logic, prize model, UI hints, default durations, lifecycle defaults.
- **Flow:** Step 1 – Choose category. Step 2 – Choose template (within that category). Step 3 – Edit tournament (name, dates, entry fee, overrides). Step 4 – Create (backend creates from template + overrides).

### 2.4 DB Layer

**Option A – Extend existing `competition_templates` and add a category table**

- **New table: `tournament_template_categories`** (or reuse a simple enum/list)
  - `id`, `code` (e.g. `football`, `basketball`, `esports`, `lottery`, `chance`, `custom`), `name`, `displayOrder`, `isActive`.
- **Extend `competition_templates`:**
  - Add **`categoryCode`** (or `categoryId` FK) to group templates by sport/category.
  - Keep existing: legacyType, formSchemaJson, scoringConfigJson, settlementConfigJson, rulesJson, itemTemplateJson, defaultEntryFee, defaultMaxParticipants, etc.
- **JSON config schema (per template)** can include:
  - `defaultTournamentStructure`, `scoringType`, `inputFormat`, `participantLogic`, `prizeModel`, `uiHints`, `defaultDurations`, `lifecycleDefaults`, plus any existing rulesJson/settlement/formSchema fields.

**Option B – New `tournament_templates` table (as in your spec)**

- Table **`tournament_templates`**:
  - `id`, `category` (TEXT or FK to categories), `name`, `description`, `configJson` (JSON: structure, scoring, input format, participants logic, prize model, UI hints, durations, lifecycle defaults).
  - Optional: `legacyType` / `competitionTypeId` for compatibility with existing settlement/runtime.
- **Migration strategy:** Either migrate existing `competition_templates` into this table (with category derived from legacyType) or run both in parallel and have `createTournamentFromTemplate` read from the new table (with a fallback to old template API if needed).

Recommendation: **Option A** if you want to keep one template store and add categories; **Option B** if you want a clean “category + config” model and are willing to deprecate or map from the old table.

### 2.5 Backend

- **`getTemplates(category?: string)`**  
  Returns templates for the given category (or all if no category). Reads from `competition_templates` (with new category filter) or from `tournament_templates`; returns id, name, category, config summary.
- **`createTournamentFromTemplate(templateId, overrides)`**  
  Load template by id; build tournament payload from template config + overrides (name, opensAt, closesAt, drawDate, drawTime, entry fee, etc.); call existing `createTournament(payload)`; return new tournament id. Ensure **status** is set to `"OPEN"` in that payload (or in `createTournament` as in Part 1).
- **Backwards compatibility:** Existing tournaments and existing `createTournament`/`createTournamentFromTemplate` flows keep working. New flow is additive (category → template → edit → create). Existing templates can get a `categoryCode` (e.g. football, lotto, chance, custom) so they appear in the new flow.

### 2.6 Frontend Admin

- **Step 1 – Choose category:** List categories (from API or static list). Single selection (e.g. Football, Lotto, Chance, Custom).
- **Step 2 – Choose template:** Call `getTemplates(category)` and show template list; user picks one.
- **Step 3 – Edit tournament:** Prefill form from template (name, description, entry fee, opensAt, closesAt, drawDate/drawTime if needed, maxParticipants, etc.). All overridable.
- **Step 4 – Create:** Submit overrides + templateId to `createTournamentFromTemplate(templateId, overrides)` (or equivalent). Show success and redirect or refresh list; new tournament must appear (after Part 1 fix).

No UI redesign or copy change beyond what’s needed for this flow.

### 2.7 Extensibility

- New categories: add row to `tournament_template_categories` (or config) and optionally a new legacyType/competitionType if needed.
- New templates: add rows to `competition_templates` / `tournament_templates` with the right category and configJson. No code change required if the UI and backend are driven by category + config schema.

### 2.8 Constraints Respected

- No fake data; no temporary fixes; no performance regressions.
- Lifecycle state machine: new tournaments start as OPEN; transitions unchanged.
- Settlement logic: unchanged; templates only supply default config and overrides for the same `createTournament` path.

---

## PART 3 — Architecture Constraints Checklist

- No fake data.
- No temporary fixes (fix root cause in createTournament).
- No UI redesign beyond the template flow (category → template → edit → create).
- No emotional/copy changes.
- No performance regressions (add only minimal logging; optional defensive defaults are one-time on insert).
- Respect lifecycle state machine (initial status OPEN; no new transitions).
- Respect settlement logic (no changes to settlement).

---

## Deliverables Summary

| # | Deliverable | Content |
|---|-------------|---------|
| 1 | Root cause analysis | New tournaments get `status = NULL` because `createTournament()` never sets it and the column has no DEFAULT; `getActiveTournaments()` excludes NULL → not visible on homepage or any active list. |
| 2 | Exact fix plan | Set `row.status = "OPEN"` (and optionally visibility/hiddenFromHomepage) in `createTournament()`; add logging after insert and on homepage fetch; no other logic/UI/copy changes. |
| 3 | Template system architecture | Category-first (sport/category) then template then edit then create; DB: category table or field + template table with category + configJson; backend: getTemplates(category), createTournamentFromTemplate(templateId, overrides); frontend: 4-step flow; backwards compatible; extensible via data. |
| 4 | Migration strategy | (1) Fix createTournament (Part 1) first and deploy. (2) Add category to schema and backfill existing templates with category from legacyType. (3) Add getTemplates(category) and new admin flow; keep existing create flows. (4) Optionally migrate to a single tournament_templates table and deprecate old template usage. |
| 5 | Implementation steps | See below. |

---

## Implementation Steps (Order)

1. **Fix visibility bug**
   - In `server/db.ts` `createTournament()`: set `row.status = "OPEN"`. Optionally set `row.visibility = data.visibility ?? "VISIBLE"` and `row.hiddenFromHomepage = false`.
   - Add logging: after insert log `{ id, status, type, name }`; in getActiveTournaments or getTournamentPublicStats (dev-only if preferred) log result count or sample IDs.
   - Run create flow and verify new tournament appears in DB with status OPEN and on homepage.

2. **Template system – DB**
   - Add `tournament_template_categories` (or equivalent) and `categoryCode` (or categoryId) to templates; or create new `tournament_templates` with category + configJson.
   - Migration: add columns/tables; backfill category for existing templates.

3. **Template system – backend**
   - Implement getTemplates(category?) and ensure createTournamentFromTemplate builds payload with status OPEN (or rely on createTournament fix). Keep createTournamentFromTemplate backwards compatible.

4. **Template system – frontend**
   - Add “Create from template” flow: Step 1 category, Step 2 template list, Step 3 edit form, Step 4 create. Wire to getTemplates and createTournamentFromTemplate.

5. **Verification**
   - Create tournament from scratch and from template; confirm both appear in admin and on homepage immediately.
