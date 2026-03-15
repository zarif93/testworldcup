# Phase 3: Dynamic Entry Form Renderer — Implementation Notes

This document describes the first real schema-driven user-facing feature: a dynamic entry form renderer with safe fallback to the legacy PredictionForm. **No scoring or settlement behavior was changed**; the backend submit contract is unchanged.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **server/routers.ts** | Import `resolveTournamentFormSchema`, `validateEntryAgainstFormSchema`. Added `tournaments.getResolvedFormSchema` (public, `tournamentId` → `{ formSchema, legacyType, warnings }`). Added `submissions.validateEntrySchema` (protected, `{ tournamentId, payload }` → `{ valid, errors }`). |
| **client/src/lib/trpc.ts** | Export `RouterOutputs` (inferred from AppRouter) for typed form schema on client. |
| **client/src/components/DynamicPredictionForm.tsx** | **New.** Schema-driven form component: renders football (1/X/2), lotto (N+strong), chance (4 suits) from resolved form schema; builds same payload shapes as legacy; runs schema validation before submit; shows validation errors and login/add-entry dialogs. |
| **client/src/pages/PredictionForm.tsx** | Fetches `getResolvedFormSchema` when tournament is loaded. Uses `useDynamicFormPath(resolved, tournamentType)` to decide dynamic vs legacy. When dynamic path: waits for schema (and for football, matches); renders `<DynamicPredictionForm ... />` and returns. Otherwise renders existing legacy form. Optional dev/admin `console.info` for form path. |

---

## 2. Dynamic Renderer Components and Helpers

- **DynamicPredictionForm** (`client/src/components/DynamicPredictionForm.tsx`)
  - **Props:** `tournament`, `formSchema`, `legacyType`, `matchesList`, optional `showRendererBadge`.
  - **State:** `predictions` (football), `chanceCards`, `lottoNumbers`, `lottoStrong`, `validationErrors`, login/add-entry modals.
  - **Behavior:** Renders by `formSchema.kind`: `football_match_predictions` → one 1/X/2 per match; `lotto` → N numbers (schema regularCount/Min/Max) + strong (strongMin/Max); `chance` → one select per suit (schema suits + cardValues). Submit builds payload, calls `submissions.validateEntrySchema.fetch`, then `submissions.submit.useMutation()` with the **same** payload shapes the backend expects.
- **useDynamicFormPath** (in PredictionForm.tsx)
  - Returns `true` only when resolved schema exists, `formSchema.kind` is `football_match_predictions` | `lotto` | `chance`, and `legacyType` is `football` | `football_custom` | `lotto` | `chance`.
- **MatchItem** (exported from DynamicPredictionForm)
  - `{ id, homeTeam, awayTeam, matchNumber?, matchDate?, matchTime? }` for passing match list into the dynamic form.

No separate adapter file was added; the component builds payloads directly from schema + state to keep Phase 3 minimal. Adapters (e.g. `buildFootballPredictionFormModel`) can be added later if needed.

---

## 3. Tournament Types Now Rendered Dynamically

| Type | Schema kind | Behavior |
|------|-------------|----------|
| **football** | `football_match_predictions` (matchSource: world_cup) | Match list from `matches.getAll`; one 1/X/2 per match; payload `predictions: Array<{ matchId, prediction }>`. |
| **football_custom** | `football_match_predictions` (matchSource: custom) | Match list from `tournaments.getCustomFootballMatches`; same payload shape. |
| **lotto** | `lotto` | regularCount/regularMin/Max and strongMin/Max from schema (defaults 6, 1–37, 1–7); payload `predictionsLotto: { numbers, strongNumber }`. |
| **chance** | `chance` | suits and cardValues from schema (defaults heart/club/diamond/spade, 7–A); payload `predictionsChance: { heart, club, diamond, spade }`. |

All other tournament types (and any tournament whose resolved form schema is `custom` or missing) use the **legacy** PredictionForm.

---

## 4. Fallback to Legacy PredictionForm

Fallback (legacy form) is used when **any** of the following is true:

- `getResolvedFormSchema` is not yet fetched (we wait for it only when tournament type is one of the four above).
- Resolved `formSchema.kind` is not one of: `football_match_predictions`, `lotto`, `chance` (e.g. `custom`).
- Resolved `legacyType` is not one of: `football`, `football_custom`, `lotto`, `chance`.
- For football/football_custom: match list is still loading (`isLoadingMatches`), so we don’t render dynamic form until matches are ready.

So: unknown types, malformed schema, or missing data → legacy form. No runtime error; no change to existing tournaments.

---

## 5. Payload Compatibility

The dynamic form produces **exactly** the same submit input shapes as the legacy form:

- **Football:** `predictions: Array<{ matchId: number, prediction: "1"|"X"|"2" }>` — one entry per match, same enum.
- **Lotto:** `predictionsLotto: { numbers: number[], strongNumber: number }` — length and ranges from schema (aligned with current backend: 6 numbers 1–37, strong 1–7 by default).
- **Chance:** `predictionsChance: { heart, club, diamond, spade }` with values from schema `cardValues` (same enum as backend: `"7"|"8"|"9"|"10"|"J"|"Q"|"K"|"A"`).

The existing `submissions.submit` mutation and its zod input were **not** changed. The dynamic path only calls the same mutation with these payloads.

---

## 6. Validation Approach

- **Before submit (dynamic path only):** The client calls `submissions.validateEntrySchema.fetch({ tournamentId, payload })`. The server resolves the tournament’s form schema and runs `validateEntryAgainstFormSchema(schema, payload)` (Phase 2C). Result `{ valid, errors }` is returned.
- **Client:** If `!valid`, validation errors are shown in a red block and via toast; submit is not sent. If valid, the same payload is sent with `submissions.submit.useMutation()`.
- **Backend:** The existing submit mutation still performs its own zod validation; schema validation is an **additional** check in the dynamic path and does not replace it.

---

## 7. Intentionally Left Legacy (No Changes This Phase)

- **Scoring:** All scoring logic remains as before; no schema-driven scoring yet.
- **Settlement:** No schema-driven settlement.
- **Submit mutation:** Input shape and behavior unchanged.
- **Legacy PredictionForm:** Still the default when the dynamic path is not used; fully intact.
- **Edit/update flow:** Dynamic form supports edit/duplicate via same `loadedSubmission` and `updateMutation` patterns; payload shapes stay compatible.

---

## 8. Debug / Admin Visibility

- **Admin badge:** When `showRendererBadge={true}` (set when `user?.role === "admin"`), the dynamic form shows a small “schema” badge next to the title.
- **Console:** In development or when user is admin, `PredictionForm` logs once per relevant mount: `[Phase 3] Prediction form path: dynamic | legacy`. No impact on normal users.

---

## 9. Known Limitations

- Only the four types above use the dynamic renderer; all others use legacy.
- Schema validation is called via a separate `validateEntrySchema` query before submit; there is no client-side mirror of the full schema validation (relying on server for correctness).
- Review/summary step before submit was not added; can be added in a later phase if desired.

---

## 10. Recommended Next Phase

- **Phase 4 (optional):** Use resolved **scoring** schema in the backend when calculating points (schema-driven scoring), while keeping submit contract and settlement behavior compatible.
- Broaden dynamic form to more competition types if/when new schema kinds are introduced.
- Add optional client-side validation mirror from schema to reduce round-trip for validation errors.
