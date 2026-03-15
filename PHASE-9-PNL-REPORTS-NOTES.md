# Phase 9: PnL & Reports Engine Refactor – Implementation Notes

## Overview

Phase 9 refactors the PnL and reporting layer to be **architecture-driven** instead of legacy-type-driven. The platform already has competition_types, schema-driven scoring/settlement, universal competition items, and RBAC; reporting now uses competition type lists for filters, supports item-source filters (legacy vs universal), and introduces a typed **ReportContext** and **TournamentReportingModel** for future extension. **No business logic or formulas were changed**; existing financial calculations remain identical.

---

## Files Changed

### New files
- **`server/reporting/types.ts`** – `ReportContext`, `TournamentReportingModel` types
- **`server/reporting/context.ts`** – `resolveReportContextForTournament(tournamentId)`, `resolveTournamentReportingModel(tournamentId)`
- **`server/reporting/index.ts`** – Public API exports
- **`PHASE-9-PNL-REPORTS-NOTES.md`** – This file

### Modified files
- **`server/db.ts`** – `getTournamentIdsByItemSource("legacy" | "universal")`, `getReportFilterTournamentIds({ tournamentType?, sourceLabel? })`; PnL opts extended with `sourceLabel?: "legacy" | "universal"` in `getAdminPnLSummary`, `getAdminPnLReportRows`, `getAgentPnLReportRows`, `getPlayerPnL`, `getAgentPnL`, `getAgentPlayersPnL`, `getSubmissionFinancialRows`. Filtering by type now uses `getReportFilterTournamentIds` when `tournamentType` or `sourceLabel` is set.
- **`server/routers.ts`** – All PnL-related procedures (admin and agent) accept optional `sourceLabel: z.enum(["legacy", "universal"])` and pass it through to DB.
- **`client/src/pages/AdminPanel.tsx`** – PnL type filter built from `trpc.competitionTypes.list.useQuery()` with fallback to legacy list; new "מקור פריטים" dropdown (כל המקורות / Legacy / Universal (DB)); `pnlSourceLabel` state and passed into all PnL queries and exports.

---

## New Reporting Abstractions

### ReportContext (per tournament)
- **tournamentId**, **tournamentName**
- **competitionTypeId**, **competitionTypeCode**, **competitionTypeName** – from competition_types or legacy type
- **settlementConfig**, **scoringConfig** – resolved schema configs (for future schema-aware summaries)
- **itemSourceLabel** – `"universal_db"` when tournament has DB item sets; otherwise legacy label (e.g. `legacy_worldcup`, `legacy_lotto`)

### TournamentReportingModel
- **context**: ReportContext
- **itemSets**: resolved competition item sets (from `resolveTournamentItems`)
- **totalItemCount**: sum of item counts across sets  

Use for grouping by set/round and per-event stats in future reports.

### Resolver helpers
- **resolveReportContextForTournament(tournamentId)** – Returns `ReportContext | null`. Uses `getTournamentById`, `resolveTournamentSchemas`, `getCompetitionItemSetsByTournament`, `resolveTournamentItems` to determine item source and type info.
- **resolveTournamentReportingModel(tournamentId)** – Returns `TournamentReportingModel | null`. Builds context and item sets for the tournament.

---

## Filters Replaced / Added

### Type filter (refactored)
- **Before:** Hardcoded `PNL_TOURNAMENT_TYPE_OPTIONS` (football, lotto, chance, football_custom).
- **After:** Options come from `competitionTypes.list()` (value = `code`, label = `name`). Fallback to the same legacy list if API returns empty so behavior is unchanged when competition_types is missing.

### Source label filter (new)
- **"מקור פריטים"** dropdown: כל המקורות | Legacy | Universal (DB).
- **Legacy** – Only tournaments with no rows in `competition_item_sets` (items come from matches/lotto/chance tables).
- **Universal** – Only tournaments that have at least one row in `competition_item_sets`.
- Implemented via `getTournamentIdsByItemSource("legacy" | "universal")` and `getReportFilterTournamentIds({ tournamentType, sourceLabel })`; when both type and source are set, allowed IDs are the intersection.

---

## Exports Updated

- All PnL CSV/Excel exports accept optional **sourceLabel** and pass it to the same DB layer. No change to CSV structure or column semantics.
- **exportPnLSummaryCSV**, **exportPnLReportCSV**, **exportAgentPnLCSV**, **exportPlayerPnLCSV** (admin and agent) – input schemas include `sourceLabel`; exports remain valid for all competition types and for legacy/universal filtering.

---

## Compatibility Strategy

- **Backward compatibility:** Existing tournaments and reports behave the same. Filter by `tournamentType` alone is unchanged (still filters by `tournaments.type` via `getReportFilterTournamentIds` when only `tournamentType` is set).
- **No data migration.** No schema changes to tournaments or point_transactions.
- **Legacy fallback:** If `competitionTypes.list()` is empty or fails, admin PnL type dropdown falls back to the previous hardcoded list (football, lotto, chance, football_custom).
- **Formulas unchanged:** Profit/loss/commission/settlement logic is untouched; only the way we **restrict which tournaments** are included in the report is extended (type + source).
- **MySQL:** `getTournamentIdsByItemSource` and `getReportFilterTournamentIds` use `competition_item_sets`, which is SQLite-only in this project. On MySQL, `getTournamentIdsByItemSource` returns `[]`, so `getReportFilterTournamentIds` with `sourceLabel` set returns `[]` and no tournaments match the source filter (only type filter applies when using MySQL).

---

## Remaining Legacy Areas (intentional)

- **Public leaderboard / tournament list** – Still use `tournamentType` (WORLD_CUP, FOOTBALL, CHANCE, LOTTO) and `tournaments.getByType`; not refactored in Phase 9.
- **Scoring / settlement** – Still use legacy type and schema resolution; no change in Phase 9.
- **Financial report (getAdminFinancialReport)** – Still uses `tournaments.type` for display; no filter by competition type or source (could be extended later using ReportContext).
- **Agent dashboard PnL** – Uses the same APIs; type/source filters are available through the same router inputs. UI for agent-facing PnL filters can be updated in a follow-up to show competition types list and source filter if desired.

---

## Future Extension Points

- **Schema-aware financial summaries** – Use `ReportContext.settlementConfig` / `scoringConfig` in aggregations (e.g. label by settlement mode) without changing formulas.
- **Per-event / per-set reporting** – Use `resolveTournamentReportingModel()` to group participation or results by item set or round.
- **Admin “Report context” view** – Expose `resolveReportContextForTournament(tournamentId)` via an admin procedure and show it in Schema Debug or a dedicated tab.
- **Competition type in financial report** – Add optional filter by `competitionTypeId` or type code to `getAdminFinancialReport` and use `ReportContext` for display names.

---

## Summary Checklist

| Item | Status |
|------|--------|
| ReportContext + TournamentReportingModel types | Done |
| resolveReportContextForTournament / resolveTournamentReportingModel | Done |
| getTournamentIdsByItemSource, getReportFilterTournamentIds | Done |
| PnL filters use getReportFilterTournamentIds (type + source) | Done |
| Admin UI: type filter from competitionTypes.list() | Done |
| Admin UI: source label filter (כל / Legacy / Universal) | Done |
| All PnL APIs and exports accept sourceLabel | Done |
| Backward compatibility (no migration, legacy fallback) | Done |
| PHASE-9-PNL-REPORTS-NOTES.md | Done |
