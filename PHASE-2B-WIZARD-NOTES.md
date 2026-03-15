# Phase 2B: Competitions List + Create Competition Wizard — Implementation Notes

This document describes what was implemented in Phase 2B and how it fits with the existing system.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **server/db.ts** | `createTournament` accepts optional `competitionTypeId` and persists it on insert. |
| **server/routers.ts** | `createTournament` input extended with `competitionTypeId`; validation ensures type code matches legacy type; passes `competitionTypeId` to db. |
| **server/competitionTypeUtils.ts** | (No change; already had `getLegacyTypeFromCompetitionType` used by router.) |
| **client/src/lib/competitionTypeDisplay.ts** | **New.** `LEGACY_TYPE_LABELS`, `getCompetitionTypeDisplayName(tournament, typesFromApi)` for admin list. |
| **client/src/components/admin/CompetitionTypeSelector.tsx** | **New.** Loads types from API, shows cards, onSelect. |
| **client/src/components/admin/CompetitionWizardBasicStep.tsx** | **New.** Name, description, amount, dates, max participants. |
| **client/src/components/admin/CompetitionWizardTypeSettingsStep.tsx** | **New.** Type-specific fields (football: open/close datetime; lotto: drawCode, drawDate, drawTime; chance: drawDate, drawTime; customIdentifier). |
| **client/src/components/admin/CompetitionWizardReviewStep.tsx** | **New.** Summary of all inputs before create. |
| **client/src/components/admin/CreateCompetitionWizard.tsx** | **New.** 4-step wizard: type → basic → type settings → review; calls `createTournament` with `competitionTypeId` + legacy `type`. |
| **client/src/components/admin/CompetitionsTable.tsx** | **New.** Table: name, type (display from API/legacy), status, cost, participants count, date; filter by type from API; lock/delete actions. |
| **client/src/pages/AdminPanel.tsx** | Competitions section when `competitionSubType === null`: CompetitionsTable + "צור תחרות (אשף)" button; Dialog with CreateCompetitionWizard; legacy "ניהול לפי סוג תחרות" card with 4 buttons unchanged. |
| **PHASE-2B-WIZARD-NOTES.md** | **New.** This file. |

---

## 2. Wizard Flow Summary

1. **Step 1 — Choose competition type**  
   Options from `competitionTypes.list({ activeOnly: true })`. User selects one; we keep `selectedType` (id, code, name) and derive `legacyType` from code (football, football_custom, lotto, chance).

2. **Step 2 — Basic details**  
   Name (required), description, entry fee/amount (required), optional start/end date, optional max participants. Validation: name non-empty, amount positive integer.

3. **Step 3 — Type-specific settings**  
   - **Football / football_custom:** open date+time, close date+time (required).  
   - **Lotto:** drawCode (required), drawDate, drawTime (required; allowed times 20:00, 22:30, 23:00, 23:30, 00:00).  
   - **Chance:** drawDate, drawTime (required).  
   - All: optional customIdentifier.

4. **Step 4 — Review and create**  
   Summary of type name, basic details, and type-specific settings. "צור תחרות" submits with:
   - `name`, `amount`, `description`, `type` (legacy), `competitionTypeId` (selected type id), `startDate`, `endDate`, `maxParticipants`, `prizeDistribution`, `customIdentifier`;
   - for football/football_custom: `opensAt`, `closesAt`;
   - for lotto: `drawCode`, `drawDate`, `drawTime`;
   - for chance: `drawDate`, `drawTime`.

   The same payload is sent to the existing `admin.createTournament` mutation; no separate API.

---

## 3. How competitionTypeId and Legacy Type Are Synchronized

- **Creation (wizard):** User picks a competition type from the API (e.g. "לוטו"). We have `selectedType.id` and `selectedType.code`. We set `legacyType = CODE_TO_LEGACY[code]` (e.g. "lotto"). The mutation is called with both `competitionTypeId: selectedType.id` and `type: legacyType`.
- **Server validation:** If `competitionTypeId` is provided, the router loads the competition type by id and checks that `getLegacyTypeFromCompetitionType(ct.code) === input.type`. If not (e.g. type id points to lotto but client sent type "chance"), the server returns BAD_REQUEST. So the two cannot get out of sync on create.
- **Existing flows:** Old create forms (via "ניהול לפי סוג" → לוטו/צ'אנס/וכו') still call `createTournament` with only `type`; they do not send `competitionTypeId`. Those competitions get `competitionTypeId = NULL` and behave exactly as before. Scoring, submissions, PnL all rely on `tournament.type`, which is still set.

---

## 4. What Remains Hardcoded

- **Type-specific fields in the wizard** are still fixed per legacy type (football vs lotto vs chance). No dynamic schema from `formSchemaJson` yet.
- **Validation** (e.g. lotto draw times, chance draw times, football open/close) is the same as in the old create flow; it is not read from `competition_types` config.
- **Prize distribution** in the wizard uses the same defaults (first = 100%, top3 = 50/30/20); the UI for prize mode is not shown in the wizard steps (could be added in Step 2 or 3).
- **Legacy "ניהול לפי סוג"** views (chance list + result entry, lotto list + result entry, etc.) are unchanged; they still use hardcoded type filters and old create forms.
- **PnL and other admin filters** that use a hardcoded list of tournament types are unchanged (Phase 2B did not replace those; see ADMIN-PLATFORM-ROADMAP.md).

---

## 5. Known Limitations

- **Prize distribution:** The wizard does not expose prize mode (first vs top3) in the UI; it uses a default (e.g. first = 100%). To match the old form exactly, add prize mode and prize1/prize2/prize3 to Step 2 or 3.
- **Existing competitions:** All existing tournaments have `competitionTypeId = NULL`. They still display correctly in CompetitionsTable via `getCompetitionTypeDisplayName` (fallback to legacy label from `tournament.type`).
- **MySQL:** If the app uses MySQL, `competitionTypes.list()` returns [] and the wizard type step will show "לא נמצאו סוגי תחרות". The competitions table will still show tournaments with legacy type labels.

---

## 6. Recommended Next Step for Phase 2C

- **Option A — Dynamic form from schema:** Use `formSchemaJson` (and optionally `scoringConfigJson`) from `competition_types` to drive the type-specific step and/or the public prediction form. This is a larger change and should be done after stabilizing Phase 2B.
- **Option B — Backfill competitionTypeId:** Run a one-off script or admin action to set `competitionTypeId` on existing tournaments where `type` is football, football_custom, lotto, or chance (match by code). Then the table and any future type-based logic can rely on the FK.
- **Option C — Replace PnL/report type filters:** Use `competitionTypes.list()` for the PnL tournament-type dropdown (and any other admin type filters) so new types added in the DB appear without code change.
- **Option D — Prize distribution in wizard:** Add prize mode and prize1/2/3 to the wizard so new competitions can be created with top-3 distribution from the wizard.

---

## 7. Backward Compatibility

- **Existing competitions:** No data migration. Null `competitionTypeId` is supported; display uses legacy type label.
- **Old create path:** The 4 buttons "לוטו", "צ'אנס", and so on still open the same screens with the same inline create forms; they do not use the wizard and do not send `competitionTypeId`.
- **createTournament mutation:** All existing callers that omit `competitionTypeId` continue to work; the new parameter is optional.
- **Scoring / submissions / PnL:** No changes; they still use `tournament.type` and existing logic.

---

## 8. Risks / TODOs for Phase 2C

- **Mismatch if type is added in DB:** If a new row is added to `competition_types` with a code that does not map to the legacy enum (e.g. "quiz"), the wizard will show it, but the mutation only accepts type enum "football" | "football_custom" | "lotto" | "chance" | "custom". So either map "custom" for unknown codes or extend the enum when adding new types that should be creatable from the wizard.
- **Dialog and wizard key:** The wizard is remounted on each dialog open (via key increment) so state is fresh; if the dialog implementation keeps content mounted when closed, the key ensures a new instance when opened again.
- **TODO:** Add prize mode (first / top3) to the wizard if product requires it for new competitions.
