# Phase 16: No-Code Competition Builder

## Overview

Structured 9-step competition creation wizard so admins can create any new competition fully from the UI. Reuses existing schema models, universal item engine, and settlement engine; does not duplicate logic; supports legacy tournaments.

---

## 1. Files Changed

### Server

- **`server/db.ts`**
  - `createTournament`: Now returns `Promise<number>` (new tournament id). Accepts optional `visibility`, `minParticipants`, `rulesJson`, `settledAt`, `resultsFinalizedAt`. Uses `.returning({ id: tournaments.id })` and returns the inserted id.

- **`server/routers.ts`**
  - `admin.createTournament` input extended with: `visibility`, `minParticipants`, `rulesJson`, `settledAt`, `resultsFinalizedAt`.
  - Response changed from `{ success: true }` to `{ success: true, id: tournamentId }`.

### Client

- **`client/src/components/admin/CompetitionWizardBasicStep.tsx`**
  - `BasicDetailsState`: Added `visibility`, `bannerUrl`, `customIdentifier`.
  - New props: `showVisibilityAndBanner`, `onOpenMediaPicker`. When true, renders visibility select and banner media picker button.
  - `DEFAULT_BASIC_DETAILS`: Includes new fields.

- **`client/src/components/admin/CompetitionWizardItemsStep.tsx`** (new)
  - Step 3: Item source (universal/legacy) and optional list of sets to create after tournament creation. Inline add/remove sets (title, itemType, sourceType).

- **`client/src/components/admin/CompetitionWizardFormSchemaStep.tsx`** (new)
  - Step 4: Form schema preview from competition type + optional JSON override textarea.

- **`client/src/components/admin/CompetitionWizardScoringStep.tsx`** (new)
  - Step 5: Scoring preview from type + optional points-per-correct and JSON override.

- **`client/src/components/admin/CompetitionWizardSettlementStep.tsx`** (new)
  - Step 6: Prize mode (first / top3 / custom), distribution %, min participants, tie handling (split / first_wins).

- **`client/src/components/admin/CompetitionWizardDatesStep.tsx`** (new)
  - Step 7: Open/close dates (football), draw code/date/time (lotto/chance), optional settlement/results-finalized date.

- **`client/src/components/admin/CompetitionWizardCmsStep.tsx`** (new)
  - Step 8: Select banner (key), intro section (id), legal page (slug). Uses `admin.listSiteBanners`, `admin.listContentSections`, `admin.listContentPages`.

- **`client/src/components/admin/CreateCompetitionWizard.tsx`**
  - Replaced 4-step flow with 9-step flow. Steps: Basic → Type → Items → Form schema → Scoring → Settlement → Dates → CMS → Review.
  - State for all steps; validation per step (basic, type, settlement, dates). Media picker for banner. On publish: builds payload (including `rulesJson` for banner, CMS, overrides, tieHandling), calls `createTournament`, then creates item sets via `createCompetitionItemSet` when provided.

- **`client/src/components/admin/CompetitionWizardReviewStep.tsx`**
  - Displays visibility and prize summary when present (Phase 16 fields).

---

## 2. Wizard Structure

| Step | Title            | Purpose |
|------|------------------|--------|
| 1    | פרטים בסיסיים    | Name, description, entry fee, max participants, visibility, banner (media picker), custom identifier |
| 2    | סוג תחרות        | Choose `competitionTypeId`; preview type name/description |
| 3    | פריטים           | Source: universal / legacy; optional sets to create after tournament |
| 4    | סכמת טופס        | Preview form schema from type; optional JSON override |
| 5    | חוקי ניקוד       | Preview scoring from type; optional points-per-correct and JSON override |
| 6    | התנחלות          | Prize mode, distribution %, min participants, tie handling |
| 7    | תאריכים          | Open/close (football), draw code/date/time (lotto/chance), settlement date |
| 8    | שילוב CMS        | Banner key, intro section id, legal page slug |
| 9    | סיכום ויצירה     | Summary and "Create tournament" |

---

## 3. Data Flow Architecture

- **Wizard state** is held in React state (basic, selectedType, itemsStep, formSchemaStep, scoringStep, settlementStep, datesStep, cmsStep).
- **Resolved type data** for steps 4–5: `competitionTypes.getById(selectedType.id)` returns `formSchemaJson`, `scoringConfigJson` for preview and optional overrides.
- **Publish flow:**
  1. Build `createTournament` payload from basic, type, dates, settlement, and optional `rulesJson` (bannerUrl, formSchemaOverride, scoringOverride, pointsPerCorrect, tieHandling, cmsBannerKey, cmsIntroSectionId, cmsLegalPageSlug).
  2. Call `admin.createTournament`; receive `id`.
  3. For each entry in `itemsStep.sets` (with non-empty title), call `admin.createCompetitionItemSet` with `tournamentId: id`.
  4. Invalidate `tournaments.getAll`, call `onSuccess`.

- **Existing engines:** Form schema, scoring, and settlement continue to be resolved via `resolveTournamentSchemas(tournament)` from `competition_types` (and legacy defaults). Tournament-level overrides can be stored in `tournament.rulesJson` for future resolution (e.g. formSchemaOverride/scoringOverride in resolveTournamentSchemas).

---

## 4. Integration Points

- **Competition types:** `competitionTypes.list` (step 2), `competitionTypes.getById` (steps 4–5).
- **Media:** `MediaPickerModal` + `admin.listMediaAssets` / `admin.uploadMediaAsset` for banner URL; URL stored in basic state and in `rulesJson.bannerUrl`.
- **Item sets:** `admin.createCompetitionItemSet` after tournament creation when wizard defines sets.
- **CMS:** `admin.listSiteBanners`, `admin.listContentSections`, `admin.listContentPages` for step 8; selected values stored in `rulesJson` (cmsBannerKey, cmsIntroSectionId, cmsLegalPageSlug).
- **RBAC:** Wizard is used from admin panel; `admin.createTournament` and `admin.createCompetitionItemSet` are protected by `requirePermission("competitions.create")` / `competitions.edit`.

---

## 5. Validation Logic

- **Step 0 (Basic):** Name required; amount required, integer ≥ 1.
- **Step 1 (Type):** At least one competition type selected.
- **Step 5 (Settlement):** If min participants filled, must be non-negative number.
- **Step 6 (Dates):** Depends on legacy type:
  - Football/Football_custom: open date+time, close date+time required.
  - Lotto: drawCode, drawDate, drawTime required.
  - Chance: drawDate, drawTime required.
- Steps 2, 3, 4, 7, 8: No blocking validation; optional fields only.

---

## 6. Backward Compatibility

- **Existing tournaments:** Unchanged. No migration on existing rows; new columns/fields are optional.
- **createTournament API:** New input fields are optional. Return value extended to `{ success: true, id }`; callers that ignore return value (e.g. quick-create forms in AdminPanel) continue to work.
- **Legacy type behavior:** When `competitionTypeId` is set, type is validated against `type`; resolution still uses `resolveTournamentSchemas` and legacy defaults when needed.
- **Existing 4-step flow:** Replaced by the 9-step wizard in the same entry point (`CreateCompetitionWizard`). No separate "quick" path; all creation goes through the full wizard.

---

## 7. Future Extension Points

- **Resolve `rulesJson` in schema layer:** In `resolveTournamentSchemas` (or form/scoring resolvers), read `tournament.rulesJson.formSchemaOverride` / `scoringOverride` / `pointsPerCorrect` and merge over type defaults.
- **Banner/CMS on frontend:** Use `rulesJson.bannerUrl`, `cmsBannerKey`, `cmsIntroSectionId`, `cmsLegalPageSlug` when rendering competition detail or entry page.
- **Create competition type from wizard:** Optional path to create a new `competition_types` row (with formSchemaJson, scoringConfigJson, settlementConfigJson) from steps 4–6 and then create tournament with that type.
- **Universal items in wizard:** Step 3 could offer "clone from existing set" or "import from template" and create items via `createCompetitionItem` after sets are created.
- **Draft / save progress:** Persist wizard state to backend or localStorage so admins can resume later.
