# Phase 20: Reusable Competition Templates — Implementation Notes

## Overview

Phase 20 adds a **reusable competition templates** layer on top of the existing builder and runtime. Admins can save configurations as templates, create tournaments from templates, clone tournaments into templates, and duplicate templates. The builder continues to support "blank" or "from template" and remains fully backward compatible.

---

## 1. Files Changed

| Area | File | Change |
|------|------|--------|
| Schema | `drizzle/schema-sqlite.ts` | Added `competitionTemplates` table. |
| DB | `server/db.ts` | CREATE TABLE `competition_templates`; `listCompetitionTemplates`, `getCompetitionTemplateById`, `createCompetitionTemplate`, `updateCompetitionTemplate`, `deleteCompetitionTemplate`, `duplicateCompetitionTemplate`. |
| Routers | `server/routers.ts` | Admin procedures: `listCompetitionTemplates`, `getCompetitionTemplateById`, `createCompetitionTemplate`, `updateCompetitionTemplate`, `deleteCompetitionTemplate`, `duplicateCompetitionTemplate`, `createTemplateFromTournament`, `createTemplateFromBuilder`, `getTemplateAsBuilderPrefill`, `createTournamentFromTemplate`. |
| Wizard | `client/.../CreateCompetitionWizard.tsx` | `initialTemplateId` prop; fetch `getTemplateAsBuilderPrefill` and prefill steps; "שמור כתבנית" on review step calling `createTemplateFromBuilder`. |
| Admin | `client/.../TemplatesSection.tsx` | **New.** List templates, create/edit/delete/duplicate, "Create from competition" dialog, "Use template" opens wizard with prefill. |
| Admin | `client/.../AdminPanel.tsx` | Section "תבניות תחרות", `createWizardTemplateId` state, Dialog moved to global so it opens from templates section; `TemplatesSection` with `onUseTemplate`. |
| Docs | `PHASE-20-TEMPLATES-NOTES.md` | **New.** This file. |

---

## 2. Template Schema/Model

**Table `competition_templates`**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment. |
| name | TEXT | Template display name. |
| description | TEXT | Optional. |
| competitionTypeId | INTEGER | FK to competition_types (optional). |
| legacyType | TEXT | football \| football_custom \| lotto \| chance. |
| visibility | TEXT | VISIBLE \| HIDDEN default. |
| defaultEntryFee | INTEGER | Default entry fee (points). |
| defaultMaxParticipants | INTEGER | Optional. |
| formSchemaJson | TEXT (JSON) | Builder form override. |
| scoringConfigJson | TEXT (JSON) | Builder scoring override. |
| settlementConfigJson | TEXT (JSON) | minParticipants, prizeDistribution, tieHandling. |
| rulesJson | TEXT (JSON) | Banner, CMS, pointsPerCorrect, tieHandling, etc. |
| itemTemplateJson | TEXT (JSON) | Array of { title, itemType, sourceType } for item sets to create when instantiating. |
| isSystem | INTEGER (boolean) | Reserved for system templates. |
| isActive | INTEGER (boolean) | Inactive templates can be hidden from lists. |
| createdAt, updatedAt | INTEGER (timestamp) | |

---

## 3. Builder/Template Integrations

- **Prefill from template:** When the wizard is opened with `initialTemplateId`, it calls `getTemplateAsBuilderPrefill(templateId)` and applies the result to basic, formSchemaStep, scoringStep, settlementStep, itemsStep, cmsStep, and selectedType (from competitionTypeId + types list). Dates are not stored in templates; the user fills them in the wizard.
- **Save as template:** On the review step (step 8), "שמור כתבנית" builds the same rulesJson/settlement/itemSets as for create and calls `createTemplateFromBuilder(...)` with a prompted template name. No tournament is created.
- **Create tournament from template:** `createTournamentFromTemplate(templateId, name, description?, dates?)` builds a `createTournament` payload from the template and optional dates, creates the tournament, then creates item sets from `itemTemplateJson`. Dates (opensAt, closesAt, drawCode, drawDate, drawTime) must be provided by the client when required by type.

---

## 4. Admin UI Added

- **Section "תבניות תחרות":** List of templates with name, legacyType, defaultEntryFee, description.
- **Actions per template:** "השתמש בתבנית" (opens create wizard with prefill), Edit (name/description), Duplicate (with new name), Delete.
- **Create flows:** "תבנית חדשה" (minimal create: name, description, default entry fee); "תבנית מתחרות קיימת" (select tournament + optional name → `createTemplateFromTournament`).
- **Wizard:** "שמור כתבנית" on the last step; opening the wizard with "Use template" passes `initialTemplateId` and shows prefilled steps.

---

## 5. Supported Creation Flows

| Flow | How |
|------|-----|
| Create template manually | Admin → Templates → "תבנית חדשה" → name, description, default entry fee. |
| Save current builder as template | In wizard, go to review step → "שמור כתבנית" → enter name → template created from current wizard state. |
| Create template from existing tournament | Admin → Templates → "תבנית מתחרות קיימת" → select tournament, optional name → `createTemplateFromTournament`. |
| Duplicate template | Templates list → Duplicate icon → enter new name → `duplicateCompetitionTemplate`. |
| Create tournament from template | (1) Templates → "השתמש בתבנית" → wizard opens prefilled; user completes dates and creates. (2) API `createTournamentFromTemplate(templateId, name, ...dates)` for one-shot create when client provides dates. |

---

## 6. Fallback Behavior

- **Missing template:** `getCompetitionTemplateById` / `getTemplateAsBuilderPrefill` / `createTournamentFromTemplate` return NOT_FOUND or throw; no silent failure.
- **Missing competition type:** Template may have `competitionTypeId` null; prefill uses legacyType and types list; if type is missing from list, selectedType may stay null and user can select manually.
- **Empty or invalid JSON in template:** Resolved at runtime by existing builder/schema resolution; invalid overrides fall back to type/legacy defaults per existing behavior.
- **SQLite only:** Template CRUD is gated with `USE_SQLITE`; other backends get empty list / no-op or throw as documented.

---

## 7. Future Extension Points

- **System templates:** Use `isSystem` to protect or hide built-in templates; seed default templates in migrations.
- **Versioning:** Add template version or updatedAt-based diff for "what changed" in admin.
- **More fields:** Store default dates or draw windows in template for even faster "create from template" with fewer required inputs.
- **Sharing/export:** Export template as JSON and import on another instance.
- **Templates per competition type:** Filter or suggest templates by competition type in the wizard.
