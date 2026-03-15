# Phase 8: Universal Item Management + Admin CRUD – Implementation Notes

## Overview

Phase 8 extends the Phase 7 universal competition items foundation into a **real admin-managed CRUD system**. Admins can create, edit, and delete competition item sets and items stored in the DB. Legacy tournament types continue to work unchanged; DB-backed universal items are additive. No forced migration; production form/scoring/settlement remain on legacy paths.

---

## Files Changed

### New files
- **`server/competitionItems/validation.ts`** – Safe JSON parsers: `parseJsonField`, `validateOptionSchema`, `validateResultSchema`, `validateMetadataJson`, `stringifyJson`
- **`client/src/components/admin/CompetitionItemsManageModal.tsx`** – Admin UI: list DB sets (create/edit/delete), list items in a set (create/edit/delete), read-only legacy resolved sets with source labels
- **`PHASE-8-UNIVERSAL-ITEM-CRUD-NOTES.md`** – This file

### Modified files
- **`server/db.ts`** – CRUD: `createCompetitionItemSet`, `updateCompetitionItemSet`, `deleteCompetitionItemSet`, `createCompetitionItem`, `updateCompetitionItem`, `deleteCompetitionItem`, `reorderCompetitionItems`; all SQLite-only, clear error when MySQL
- **`server/competitionItems/types.ts`** – Added `SourceLabel` type and `sourceLabel` on `CompetitionItemSetResolved` and `CompetitionItemResolved`
- **`server/competitionItems/resolve.ts`** – Set `sourceLabel` on all legacy sets: `legacy_worldcup`, `legacy_custom_matches`, `legacy_lotto`, `legacy_chance`
- **`server/competitionItems/index.ts`** – Re-exports validation helpers and `JsonValidationResult`
- **`server/routers.ts`** – New admin procedures (guarded with `requirePermission("competitions.edit")`): `createCompetitionItemSet`, `updateCompetitionItemSet`, `deleteCompetitionItemSet`, `createCompetitionItem`, `updateCompetitionItem`, `deleteCompetitionItem`, `reorderCompetitionItems`; JSON input validated via validation module
- **`client/src/components/admin/SchemaDebugModal.tsx`** – Phase 7 section shows `sourceLabel ?? sourceType` for each set
- **`client/src/components/admin/CompetitionsTable.tsx`** – New prop `onViewItems(tournamentId, tournamentName)` and button "ניהול פריטי תחרות" (ListChecks icon)
- **`client/src/pages/AdminPanel.tsx`** – State `itemsManageTournament`, render `CompetitionItemsManageModal`, pass `onViewItems` to `CompetitionsTable`

---

## APIs Added

| Procedure | Method | Guard | Description |
|-----------|--------|-------|-------------|
| **createCompetitionItemSet** | mutation | competitions.edit | Create a competition item set (tournamentId, title, description, itemType, sourceType?, stage?, round?, groupKey?, sortOrder?, metadataJson?). Returns new set id. |
| **updateCompetitionItemSet** | mutation | competitions.edit | Update set by id (title?, description?, itemType?, stage?, round?, groupKey?, sortOrder?, metadataJson?). |
| **deleteCompetitionItemSet** | mutation | competitions.edit | Delete set by id (cascade deletes items). |
| **createCompetitionItem** | mutation | competitions.edit | Create item (itemSetId, externalKey?, title, subtitle?, itemKind, startsAt?, closesAt?, sortOrder?, optionSchemaJson?, resultSchemaJson?, status?, metadataJson?). Returns new item id. |
| **updateCompetitionItem** | mutation | competitions.edit | Update item by id (same fields optional). |
| **deleteCompetitionItem** | mutation | competitions.edit | Delete item by id. |
| **reorderCompetitionItems** | mutation | competitions.edit | Bulk set sortOrder: input `{ itemSetId, order: number[] }` (order = array of item ids in desired order). |

Existing read-only: `getCompetitionItemSets`, `getCompetitionItemsBySet`, `getResolvedTournamentItems` (unchanged).

---

## Admin UI Added/Changed

- **Competition items management modal**  
  Opened from the competitions table via the "פריטי תחרות" (ListChecks) button per tournament.
  - **Left:** "סטים ב-DB (עריכה)" – list of DB-backed sets for this tournament; create set, edit set, delete set; click a set to select it.
  - **Right:** "מקורות Legacy (לקריאה)" – list of resolved legacy sets with source label (e.g. "לוטו (legacy)", "משחקים מותאמים (legacy)").
  - **Below (when a set is selected):** "פריטים" – list items in the set; create item, edit item, delete item.
  - **Set form:** title, description, itemType, sortOrder, metadata (JSON).
  - **Item form:** title, subtitle, itemKind, status, sortOrder, optionSchemaJson, resultSchemaJson, metadataJson (JSON textareas). Invalid JSON is rejected by the API with a clear error (toast).

- **Competitions table**  
  New button per row: icon ListChecks, title "ניהול פריטי תחרות (Phase 8)", opens the modal for that tournament.

- **Schema Debug modal**  
  Phase 7 section now shows `sourceLabel ?? sourceType` so admins can see e.g. `legacy_worldcup` vs `universal_db`.

---

## Validation Strategy

- **Option / result / metadata JSON:** All three are validated with `validateOptionSchema`, `validateResultSchema`, `validateMetadataJson` (in `server/competitionItems/validation.ts`).
- **Behavior:** Empty or whitespace string → treated as `null` (valid). Non-empty string → `JSON.parse`; if parsing fails or result is not an object/null, return `{ valid: false, error: "..." }`. No crash; errors returned as BAD_REQUEST with message e.g. `optionSchemaJson: Invalid JSON: ...`.
- **Routers:** Before create/update, the relevant JSON inputs are passed through these validators; on invalid, `TRPCError` is thrown with a clear message. Admin UI shows toast with the error.

---

## Source Resolution Strategy

- **Labels:** Every resolved set and item now has an optional `sourceLabel`: `universal_db` | `legacy_worldcup` | `legacy_custom_matches` | `legacy_lotto` | `legacy_chance`.
- **Legacy resolution:** Unchanged. `resolveTournamentItems(tournamentId)` still returns only legacy-built sets (no DB reads). Each legacy set has the appropriate `sourceLabel` so admin/debug can tell the source.
- **DB vs legacy in admin:** Admin UI calls both `getCompetitionItemSets(tournamentId)` (DB) and `getResolvedTournamentItems(tournamentId)` (legacy). DB sets are editable; legacy section is read-only and labeled. No merge in resolver; coexistence is in the UI.
- **Production:** Form and scoring still use legacy only. No change to `resolveTournamentItems` to prefer DB for any tournament type; that can be added in a later phase when migrating a given type to universal items.

---

## Backward Compatibility Strategy

- **Existing tournaments:** No migration. All current football / football_custom / lotto / chance tournaments keep resolving via legacy mapping.
- **Existing forms / scoring / settlement:** Unchanged; they do not use the new CRUD or DB-stored items.
- **Universal DB items:** Additive. New sets/items are stored in `competition_item_sets` and `competition_items` and are visible and editable only in admin. When a future phase wants form/scoring to use universal items, the resolver can be extended to return DB sets for a tournament (e.g. when type is a future "custom" or when explicitly configured).
- **MySQL:** CRUD and list functions for universal items are SQLite-only. On MySQL, `getCompetitionItemSetsByTournament` / `getCompetitionItemsBySetId` return empty; create/update/delete/reorder throw a clear error that universal items are only supported with SQLite in this phase.

---

## Known Limitations

- **SQLite only:** Universal item CRUD and storage are implemented only for SQLite. MySQL support would require schema migration and the same CRUD in MySQL.
- **No resolver merge:** Resolver does not yet return DB-backed sets for any tournament; admin sees DB and legacy side-by-side. Future phase can add "if tournament has DB sets, return them (and optionally merge with legacy)."
- **Reorder UI:** `reorderCompetitionItems` API exists but the modal does not expose drag-and-drop reorder; items can be reordered by editing `sortOrder` or by a future UI change.
- **starts_at / closes_at:** Item form in the modal does not include datetime inputs for startsAt/closesAt; they can be added later or set via API with timestamps.

---

## Recommended Next Phase

1. **Optional:** Add datetime inputs for item `starts_at` / `closes_at` in the admin item form, or document that they can be set via API.
2. **Optional:** Add reorder UI (e.g. drag-and-drop or up/down buttons) that calls `reorderCompetitionItems`.
3. **When ready:** Extend `resolveTournamentItems` (or a separate resolver) to return DB-backed sets for tournaments that have them (e.g. by tournament type or a flag), and wire form/scoring to use resolved items for those tournaments while keeping legacy for the rest.
4. **If needed:** Add MySQL schema and CRUD for `competition_item_sets` and `competition_items` when universal items are required on MySQL.

---

## Summary Checklist

| Item | Status |
|------|--------|
| CRUD for item sets (create, update, delete, list) | Done |
| CRUD for items (create, update, delete, list, reorder API) | Done |
| RBAC (competitions.edit) on all write procedures | Done |
| JSON validation for option/result/metadata | Done |
| Source labels (universal_db, legacy_*) | Done |
| Admin modal: DB sets + legacy read-only | Done |
| Admin button on competitions table | Done |
| Backward compatibility (no migration, legacy first) | Done |
| SQLite-only behavior documented and clear error on MySQL | Done |
