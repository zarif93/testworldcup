# Phase: Free Competition Builder – Implementation Notes

This document describes the admin competition creation changes: wizard removal, guaranteed prize support, and the new free competition builder.

---

## 1. Files changed

| File | Change |
|------|--------|
| **client/src/pages/AdminPanel.tsx** | `SHOW_CREATE_WIZARD = false`: wizard Dialog and "צור תחרות (אשף)" button are shown only when true. New "צור תחרות" button opens `FreeCompetitionBuilder`. State: `freeBuilderOpen`, `FreeCompetitionBuilder` dialog. `newTournament` state extended with `guaranteedPrizeAmount`; passed to `createTournamentMut`. "פרס מובטח (נקודות)" input added to chance, lotto, mondial, and football_custom create forms. |
| **client/src/components/admin/FreeCompetitionBuilder.tsx** | **New.** Single-dialog form: basic details (name, description, entry fee, guaranteed prize, max participants, open/close datetime, visibility), structure type (match/numbers/cards/custom), input type (choose_one/choose_many/1X2), and item list (title, subtitle, option labels). Creates tournament via `admin.createTournament` with `type: "custom"` and `rulesJson.freeCompetition` (structureType, inputType, items, scoringModel: "manual"). |
| **drizzle/schema-sqlite.ts** | `tournaments` table: new column `guaranteedPrizeAmount` (integer, nullable). |
| **server/db.ts** | `createTournament`: accepts `guaranteedPrizeAmount`, writes to row when > 0. `getTournamentPublicStats`: prize display uses `guaranteedPrizeAmount` when set and > 0, else calculated prize pool. |
| **server/routers.ts** | `admin.createTournament` input: `guaranteedPrizeAmount` (z.number().int().min(0).nullable().optional()). Passed to `createTournament`. |

---

## 2. Wizard removal/hiding

- **Constant:** `SHOW_CREATE_WIZARD = false` at top of `AdminPanel.tsx`.
- **Dialog:** The "אשף יצירת תחרות" dialog that wraps `CreateCompetitionWizard` is rendered only when `SHOW_CREATE_WIZARD` is true (`{SHOW_CREATE_WIZARD && (<Dialog>...</Dialog>)}`).
- **Button:** On the competitions screen, when `SHOW_CREATE_WIZARD` is true the button shows "צור תחרות (אשף)" and opens the wizard; when false it shows "צור תחרות" and opens `FreeCompetitionBuilder`.
- **Code:** `CreateCompetitionWizard` and all wizard step components are unchanged and remain in the codebase; they are simply not mounted when the dialog is hidden. Re-enabling the wizard is done by setting `SHOW_CREATE_WIZARD = true`.
- **Templates:** "Use template" in TemplatesSection still sets `createWizardTemplateId` and `setCreateWizardOpen(true)`; with the dialog hidden nothing appears. Template-based creation can be wired to the new builder later if desired.

---

## 3. Guaranteed prize implementation

- **Schema:** `tournaments.guaranteedPrizeAmount` (integer, nullable). Add column with `npm run db:push` (or your migration flow).
- **Create:** `createTournament` in db.ts accepts `guaranteedPrizeAmount`; only sets it when `!= null && > 0`. Router `admin.createTournament` accepts and forwards it.
- **Display:** `getTournamentPublicStats` returns a `prizePool` per tournament: if `guaranteedPrizeAmount` is set and > 0, that value is used; otherwise `calculatedPrize` (participants * amount - fee) is used. Public cards/lists that use `prizePool` from this API therefore show the guaranteed prize when set.
- **Admin forms:** Chance, Lotto, Mondial, and Football custom create forms include "פרס מובטח (נקודות)" (optional). Value is stored in `newTournament.guaranteedPrizeAmount` and sent in the create payload only when a valid positive number is entered.
- **Settlement:** Existing settlement/points logic is unchanged. Guaranteed prize is an override for **display** and for any future settlement logic that reads it; current distribution logic still uses existing prize pool fields where applicable. No removal of calculated prize logic; guaranteed is additive.

---

## 4. Free competition builder

- **Entry:** "צור תחרות" on the admin competitions screen opens the `FreeCompetitionBuilder` dialog (when wizard is hidden).
- **Flow:** Single form: (1) Basic details at top, (2) Structure selection and item list, (3) Submit.
- **Basic details:** Name *, description, entry fee (amount) *, guaranteed prize (optional), max participants (optional), open datetime, close datetime, visibility (VISIBLE/HIDDEN).
- **Structure:** Dropdown for structure type: match/versus, numbers, cards, custom. Dropdown for player input type: choose one, choose many, 1/X/2. Items list: each row has title, subtitle, option labels (comma/semicolon separated). Add/remove rows. Stored in `rulesJson.freeCompetition`: `{ structureType, inputType, items: [{ title, subtitle?, optionLabels: string[] }], scoringModel: "manual" }`.
- **Creation:** Calls `admin.createTournament` with `type: "custom"`, the basic fields, `guaranteedPrizeAmount` when set, and `rulesJson` containing the freeCompetition payload. Tournament appears in the list like other types.
- **Prediction form:** Type `custom` tournaments are created and listed. The current prediction/form resolution may not render a custom form from `rulesJson.freeCompetition`; that can be added in a later phase so that "custom" competitions show a dynamic form based on items/inputType. Until then, opening a custom tournament on the prediction page may use a fallback or generic form depending on existing `getResolvedFormSchema` behavior.
- **Scoring:** `scoringModel: "manual"` is stored; no automatic scoring for custom type in this phase. Manual result entry or a future extension can use the same `rulesJson` and items.

---

## 5. Backward compatibility

- **Existing competitions:** No schema or data changes that break existing rows. `guaranteedPrizeAmount` is nullable; existing tournaments have it null and continue to use calculated prize pool.
- **Existing types:** Football, football_custom, lotto, chance flows and scoring are unchanged. Only the admin create payload and public stats display were extended.
- **Wizard:** Still present; toggling `SHOW_CREATE_WIZARD` back to true restores the previous wizard flow.

---

## 6. Future extension points

- **Custom prediction form:** Resolve `getResolvedFormSchema` (or equivalent) for `type: "custom"` from `rulesJson.freeCompetition` and render fields per items/inputType.
- **Settlement for custom:** Use `guaranteedPrizeAmount` when distributing prizes for custom (or any) type; implement manual result entry and correct-option scoring using stored items.
- **Templates:** Wire "Use template" to prefill the free builder (or open wizard when re-enabled) with template data.
- **Edit tournament:** Expose `guaranteedPrizeAmount` and, for custom, `rulesJson.freeCompetition` in an edit flow so admins can change guaranteed prize or structure after creation.

---

## 7. DB migration

After pulling these changes, run:

```bash
npm run db:push
```

so that the `guaranteedPrizeAmount` column is added to the `tournaments` table. If you use a different migration process, add a step that adds `guaranteedPrizeAmount INTEGER` to `tournaments`.
