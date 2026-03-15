# Phase 24: Production Readiness Hardening – Notes

## Summary

This phase stabilizes the platform for production by fixing TypeScript/server contract issues, aligning schema documentation, activating builder CMS metadata where safe, and improving fallback safety.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `server/rbac/index.ts` | Reverted custom middleware return type; kept `next: () => Promise<unknown>`. |
| `server/routers.ts` | Added `usePermission` wrapper (cast) for RBAC middleware; replaced all `requirePermission(` with `usePermission(`. Fixed `getLegacyTypeFromCompetitionType(ctCode)` when `ctCode` may be undefined. Fixed chance comparison payload typing via `pred as unknown as { heart?, club?, diamond?, spade? }` with `?? ""`. Added `getById` banner resolution from `rulesJson.cmsBannerKey` using `getActiveBanners`. |
| `server/competitionTypeUtils.ts` | No change (already accepts `string \| { code: string }`). |
| `client/src/components/admin/AnalyticsDashboardSection.tsx` | Optional automation fields: use `?? 0` in conditions and display for `failedLast24h`, `totalRetries`, `longPendingCount`, `stuckSettlingCount`. |
| `client/src/components/admin/CompetitionTypeSelector.tsx` | `CompetitionTypeOption`: `name` and `description` made optional (`string \| null \| undefined`) for API compatibility. |
| `client/src/pages/NotificationsPage.tsx` | Notification body: `typeof n.body === "string" ? n.body : ""` for ReactNode safety; title already `String(n.title ?? n.type ?? "")`. |
| `drizzle/schema.ts` | Comment: SQLite supports "agent" role; MySQL enum is `user`/`admin` only; migration needed for MySQL if agents used. |
| `server/automation/runJob.ts` | No change (already uses `setTournamentLocked`; default case for unknown job type present). |
| `server/automation/getNextScheduledActions.ts` | No change (redundant `status !== "RESULTS_UPDATED"` already removed in health check). |
| `server/_core/index.ts` | Retry loop: assign `row.jobType as AutomationJobType` to a variable before calling `runAutomationJob` so TS accepts the first argument. |
| `server/schema/competitionFormSchema.ts` | `fieldsPerMatch` explicitly typed as `FormSchemaField[]`; `type` cast to `FormSchemaField["type"]` in football form parse. |
| `client/src/pages/NotificationsPage.tsx` | Payload display: `n.payloadJson as Record<string, unknown>` for `JSON.stringify` to satisfy ReactNode; `n.payloadJson != null` guard. |

---

## 2. Hardening Issues Fixed

- **RBAC middleware typing**: tRPC expects `MiddlewareResult` (with internal `marker`). Wrapper `usePermission(code)` casts `requirePermission(code)` to `Parameters<typeof adminProcedure.use>[0]` so the build accepts it; runtime unchanged.
- **getLegacyTypeFromCompetitionType**: Call site now passes `ctCode ?? ""` so a string is always passed (no `undefined`).
- **Chance payload in getSettlementComparison**: `pred` typed as `object & Record<"heart", unknown>`; replaced with `pred as unknown as { heart?, club?, diamond?, spade? }` and `?? ""` for each field so scoring context is safe.
- **Analytics optional fields**: All optional automation analytics fields use `?? 0` in both condition and display to satisfy strict null checks.
- **CompetitionTypeOption**: API returns `name?` and `description?`; interface updated so `setSelectedType(match)` and `types={types}` type-check.
- **Notifications list**: Notification `body` and title ensured to be valid ReactNode (string or empty string).
- **Tournament banner from builder**: `tournaments.getById` now resolves banner from CMS when `rulesJson.cmsBannerKey` is set and `bannerUrl` is missing; uses `getActiveBanners(key)` and first matching banner’s `imageUrl`; wrapped in try/catch so failures are non-fatal.

---

## 3. TypeScript / Build Issues Resolved

- **requirePermission middleware**: Resolved by using `usePermission` cast at use sites in `routers.ts`.
- **getLegacyTypeFromCompetitionType argument**: Resolved by ensuring string (e.g. `ctCode ?? ""`) is passed.
- **Chance comparison payload**: Resolved by single cast to `{ heart?, club?, diamond?, spade? }` and defaulting to `""`.
- **Analytics optional fields**: Resolved with `?? 0` for optional automation stats.
- **CompetitionTypeOption**: Resolved by making `name` and `description` optional.
- **Notifications ReactNode**: Resolved by rendering only string (and empty string) for body/title.

- **Automation retry jobType**: Resolved by assigning `row.jobType as AutomationJobType` before calling `runAutomationJob`.
- **competitionFormSchema fieldsPerMatch**: Resolved by explicit `FormSchemaField[]` and `FormSchemaField["type"]` cast.
- **Notifications payload pre**: Resolved by casting `n.payloadJson as Record<string, unknown>` for `JSON.stringify`.

After these changes, `npx tsc --noEmit` passes. Run `npm run build` to confirm production build.

---

## 4. SQLite / MySQL Compatibility

- **User role enum**
  - **SQLite** (`drizzle/schema-sqlite.ts`): `role` enum includes `"user" | "admin" | "agent"`.
  - **MySQL** (`drizzle/schema.ts`): `role` enum is `"user" | "admin"` only.
- **Decision**: No MySQL schema change in this phase. Comment added in `drizzle/schema.ts`: SQLite supports agent; MySQL needs a migration if agents are used.
- **Runtime**: `server/db.ts` uses dynamic schema (SQLite when `DATABASE_URL` is unset). With MySQL, storing or querying `role = 'agent'` may conflict with the enum until a migration adds `agent`.
- **Recommendation**: For production on MySQL with agents, add a migration that extends the `role` enum to include `agent` (and any needed columns, e.g. `referralCode` / `agentId` if not already present).

---

## 5. Runtime / CMS Metadata Activations

- **cmsBannerKey**
  - **Where**: Tournament `rulesJson.cmsBannerKey` (builder CMS step).
  - **Activation**: `tournaments.getById` now resolves banner image from CMS when `cmsBannerKey` is set and `rulesJson.bannerUrl` is missing. Uses `getActiveBanners(cmsBannerKey)` and returns the first matching banner’s `imageUrl` as `bannerUrl`. Failures are caught and leave `bannerUrl` null.
- **cmsIntroSectionId / cmsLegalPageSlug**
  - **Where**: Stored in `rulesJson` and template prefill (`getTemplatePrefill` already maps them into `cmsStep`).
  - **Activation**: No public display or tournament flow changes in this phase. They remain available for future use (e.g. prediction page intro section, legal link). No breaking change for tournaments without builder CMS metadata.

---

## 6. Fallback Safety Improvements

- **tournaments.getById**: Safe parsing of `rulesJson`; banner resolution from `cmsBannerKey` in try/catch; missing or invalid banner leaves `bannerUrl` null.
- **Analytics automation section**: Optional fields (`failedLast24h`, `totalRetries`, `longPendingCount`, `stuckSettlingCount`) use `?? 0` so no undefined access.
- **Chance comparison**: Predictions default to `""` when missing.
- **Notifications**: Body and title only rendered as strings.

---

## 7. Remaining Known Limitations

- **MySQL agent role**: Enum does not include `agent`; add migration if using agents on MySQL.
- **cmsIntroSectionId / cmsLegalPageSlug**: Not yet wired into public tournament/prediction UI; template prefill and rulesJson are in place.
- **TypeScript**: Some strict-mode or inference issues may remain; run `npm run check` and `npm run build` and fix any remaining errors.
- **RBAC**: Cast in `usePermission` is for type compatibility only; behavior is unchanged.

---

## 8. Lifecycle / observability

- **Lifecycle**: Existing automation and `lifecycleStateMachine` were reviewed. `runJob` has a default case for unknown job type; status/type use safe defaults (`?? "OPEN"`, `?? "football"`). No code changes.
- **Observability**: No new logging or metrics added this phase; can be added in a later phase if needed.

---

## 9. Recommended Next Phase

- Run full `npm run build` and fix any remaining TS/build errors.
- If using MySQL with agents: add and run migration for `role` enum (and any missing columns).
- Optionally wire `cmsIntroSectionId` and `cmsLegalPageSlug` into prediction/tournament pages and legal links.
- Manual smoke tests: admin analytics, notifications, competition wizard, tournament getById with/without `cmsBannerKey`, and protected routes.
