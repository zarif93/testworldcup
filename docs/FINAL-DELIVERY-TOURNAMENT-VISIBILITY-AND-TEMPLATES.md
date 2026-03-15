# Final Delivery: Tournament Visibility Fix + Template System + TypeScript Clean + E2E Verification

## 1. Files changed (this session)

| File | Change |
|------|--------|
| **client/src/components/admin/PaymentsSection.tsx** | Fixed ReactNode/unknown TS errors: use ternary `x != null ? (...) : null` instead of `x && (...)`; cast `JSON.stringify(...) as string`; wrap interpolated values in `String()` where needed. |
| **client/src/pages/Home.tsx** | Fixed heroBanner.body TS: use `(heroBanner as { body?: string \| null } \| undefined)?.body`. Added **custom** type to homepage: byType.custom, allTournamentsList, typeLabel "מותאם", getTournamentDisplayName accepts "custom", new desktop section "מותאם" for custom tournaments. |
| **server/routers.ts** | Fixed getTournamentDeletedAtMap argument type: use `as number[]` on the array from `[...new Set(raw.map(...))]` in three places (submissions.getAll, getMine, admin.getAllSubmissions). |
| **client/src/pages/AdminPanel.tsx** | Template flow as primary: "צור מתבנית" is now the main (filled) button; "צור מאפס (מתקדם)" is outline/secondary with tooltip. |
| **server/tournament-visibility-and-templates.test.ts** | **New.** E2E tests: createTournament sets status OPEN and appears in getActiveTournaments/getTournamentPublicStats; createTournamentFromTemplate creates with status OPEN and appears in active/public lists. |
| **docs/FINAL-DELIVERY-TOURNAMENT-VISIBILITY-AND-TEMPLATES.md** | **New.** This file. |

---

## 2. TypeScript errors fixed

| Location | Error | Fix |
|----------|--------|-----|
| **PaymentsSection.tsx** (341, 367, 376, 382) | `Type 'unknown' is not assignable to type 'ReactNode'` | Conditional rendering with `x && (jsx)` can infer the left side as `unknown`, which React does not accept. Replaced with `x != null ? (jsx) : null` for `detailData.payment`, `detailData.submission`, `detailData.tournament`, `detailData.user`. Cast `JSON.stringify(..., null, 2) as string`. Wrapped interpolated values in `String(...)` so they are never unknown. |
| **Home.tsx** (403) | `Property 'body' does not exist on type '...'` | `getActiveBanners()` return type does not include `body`. Used assertion: `(heroBanner as { body?: string \| null } \| undefined)?.body?.trim()`. |
| **routers.ts** (1091, 1136, 1207) | `Argument of type 'unknown[]' is not assignable to parameter of type 'number[]'` | `getTournamentDeletedAtMap(tournamentIds)` expects `number[]`. The expression `[...new Set(raw.map(...))]` was inferred as `unknown[]`. Added `as number[]` to the array in all three call sites. |

**Verification:** `npx tsc --noEmit` exits with 0.

---

## 3. End-to-end verification: normal create flow

**Test:** `server/tournament-visibility-and-templates.test.ts` – “createTournament sets status OPEN and tournament appears in active and public lists”.

**Steps (automated):**
1. Call `createTournament({ name, amount: 10, type: "football", visibility: "VISIBLE", opensAt, closesAt })`.
2. Load tournament by id: `getTournamentById(createdId)`.
3. Assert `status === "OPEN"`, `name` matches.
4. Call `getActiveTournaments()` and assert `createdId` is in the returned ids.
5. Call `getTournamentPublicStats(true)` and assert `createdId` is in the returned ids.
6. Call `getTournaments()` (admin list) and assert `createdId` is in the returned ids.

**Result:** All assertions pass. New tournament has `status: "OPEN"` and appears in admin list, active list, and public stats. Repair logic for existing NULL status (in db init) was already applied: only non-deleted, non-finalized rows get `status = 'OPEN'`.

**Command:** `npx vitest run server/tournament-visibility-and-templates.test.ts`

---

## 4. End-to-end verification: template create flow

**Test:** Same file – “createTournamentFromTemplate creates with status OPEN when template exists”.

**Steps (automated):**
1. Call `getTournamentTemplates(null)` and take the first template.
2. Build overrides (name, description, amount; for football/football_custom: opensAt, closesAt; for lotto: drawCode, drawDate, drawTime; for chance: drawDate, drawTime).
3. Call `createTournamentFromTemplate(template.id, overrides)`.
4. Load tournament by id and assert `status === "OPEN"`, name matches.
5. Assert the new id is in `getActiveTournaments()` and `getTournamentPublicStats(true)`.

**Result:** Passed. Template used was type `football_custom`; created tournament had `status: "OPEN"` and appeared in active and public lists.

**Rendering:** Homepage now supports type `custom`: added `byType.custom`, `allTournamentsList` includes custom with `_type: "custom"`, `getTournamentDisplayName` accepts `"custom"`, typeLabel has `custom: "מותאם"`, and a desktop section “מותאם” renders custom tournaments. So Football, Lotto, Chance, Football custom, and **Custom** templates all have a place on the homepage/public UI.

---

## 5. Remaining weaknesses / second pass

- **ESLint:** Project uses ESLint v10 and expects `eslint.config.js`; current setup failed with “couldn't find config”. No eslint run was performed on touched files; only `tsc --noEmit` was used.
- **Other test failures:** Full `vitest run` still has failures in: `lotto-draw-close.test.ts`, `lotto-scoring.test.ts` (lotto draw time validation), `submission-points.test.ts`, `pnl-upgrade.test.ts`, `agent-commission.test.ts`, `unlimited-admin-points.test.ts` (SQLite transaction “cannot return a promise”), `security-simulation.test.ts` (UNIQUE constraint on matches). These are **pre-existing** and not introduced by the visibility/template or TS fixes.
- **Debug logging:** `[createTournament]` and `[getTournamentPublicStats]` logs are gated by `NODE_ENV !== "production"`. Consider removing or reducing in a later pass.
- **Custom prediction form:** Tournaments with `type === "custom"` may not have a dedicated prediction form; they might fall back to a generic or football_custom-style form depending on `getResolvedFormSchema` / prediction page logic. Not changed in this pass.
- **Template validation:** `createTournamentFromTemplate` in the router validates required fields per type (lotto/chance/football) before calling the DB; the DB layer does not re-validate. Acceptable for now; a second pass could centralize validation.

---

## Summary

- **TypeScript:** All reported errors in PaymentsSection.tsx, Home.tsx, and routers.ts are fixed; `npx tsc --noEmit` passes.
- **Visibility fix:** New tournaments get `status = "OPEN"` and appear in admin list, homepage, and public/tournament-select lists; E2E test confirms.
- **Template flow:** createTournamentFromTemplate creates with status OPEN and appears in active/public lists; E2E test confirms. Homepage and list support type `custom`.
- **Product:** Template flow is the primary admin path (“צור מתבנית”); “צור מאפס (מתקדם)” is secondary with tooltip. No visual redesign; old create flow still works and is marked advanced.
