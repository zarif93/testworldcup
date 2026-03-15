# Competition Management Platform — Phase 1: System Audit & Architecture Plan

This document is **Phase 1 only**: system audit and architecture plan. No UI redesign or breaking changes are proposed here.

---

## 1. Current System Audit

### 1.1 Tech Stack & Structure

| Layer | Technology | Location |
|-------|------------|----------|
| Frontend | React (Vite), wouter, tRPC client | `client/src/` |
| Backend | Node.js, Express, tRPC | `server/` |
| DB / ORM | Drizzle (SQLite / MySQL) | `drizzle/` |
| Shared | Constants, match data | `shared/` |

- **Admin**: Single SPA at `/admin` → `client/src/pages/AdminPanel.tsx` (~3.9k+ lines).
- **Agent**: `/agent` → `client/src/pages/AgentDashboard.tsx`.
- **Auth**: Cookie-based session; admin code verification via `ADMIN_SECRET`; super-admin by username list in env/`shared/const.ts`.

### 1.2 Current Entities / Models

| Entity | Table | Purpose |
|--------|------|---------|
| **users** | `users` | Auth, roles (user/admin/agent), points, unlimitedPoints, agentId, referralCode, isBlocked, deletedAt |
| **leagues** | `leagues` | Enable/disable, soft delete; tournaments link via leagueId |
| **tournaments** | `tournaments` | Competitions: type (CHANCE/LOTTO/FOOTBALL/WORLDCUP/football_custom), amount, opensAt/closesAt, entryCostPoints, houseFeeRate, agentShareOfHouseFee, prizeDistribution, drawCode/drawDate/drawTime, status, visibility, financial snapshots |
| **matches** | `matches` | World Cup group-stage only: matchNumber, homeTeam, awayTeam, groupName, scores, status |
| **submissions** | `submissions` | User predictions per tournament: predictions (JSON), points, status, paymentStatus, agentId, strongHit (lotto) |
| **agent_commissions** | `agent_commissions` | Per-approved-submission: agentId, submissionId, entryAmount, commissionAmount |
| **site_settings** | `site_settings` | Key-value CMS (banners, texts) |
| **admin_audit_log** | `admin_audit_log` | Super-admin actions (performedBy, action, targetUserId, details) |
| **results** | `results` | Generic tournament results (resultsJson) |
| **settlement** | `settlement` | Settlement snapshot per tournament |
| **ledger_transactions** | `ledger_transactions` | All point movements (ENTRY_DEBIT, REFUND, PRIZE_CREDIT, SITE_FEE, AGENT_FEE, etc.) |
| **audit_logs** | `audit_logs` | General audit (actorId, action, entityType, entityId, diffJson) |
| **chance_draw_results** | `chance_draw_results` | Chance: heart/club/diamond/spade cards, drawDate, locked |
| **lotto_draw_results** | `lotto_draw_results` | Lotto: num1–num6 (1–37), strongNumber (1–7), drawDate, locked |
| **custom_football_matches** | `custom_football_matches` | Admin-defined matches per football_custom tournament |
| **point_transactions** | `point_transactions` | Point history (deposit, withdraw, participation, prize, etc.) |
| **point_transfer_log** | `point_transfer_log` | Transfers (DEPOSIT, WITHDRAW, TRANSFER, ADMIN_ADJUSTMENT) |
| **financial_records** | `financial_records` | Permanent financial snapshot per competition |
| **financial_transparency_log** | `financial_transparency_log` | Transparency log (Deposit, Prize, Commission, Refund, etc.) |

### 1.3 Admin Pages & Flows (Current)

- **Single AdminPanel** with section state: `dashboard | autoFill | submissions | competitions | agents | players | pnl | admins`.
- **Dashboard**: Cards linking to each section; pending submissions count; active tournaments count.
- **Competitions**: Sub-tabs by type (`lotto | chance | mondial | football_custom`). Per type: list tournaments, create form (shared `newTournament` state), lock/hide; for Chance/Lotto: draw result forms; for mondial: match result edit; for football_custom: custom matches CRUD.
- **Submissions**: Filter by tournament, search; approve/reject, mark payment, delete; view predictions.
- **Players**: Users list, role filter, block/reset password/delete, assign agent, deposit/withdraw points, points log, prize log by tournament.
- **Agents**: List agents, create agent, agent report, balances, export commission report.
- **PnL**: Date range, tournament type filter (football, lotto, chance, football_custom), agent/player filters; summary, report table, agent/player detail; CSV exports.
- **Admins** (super-admin): List admins, create/delete/update admin, system log (admin_audit_log).
- **AutoFill**: Select tournament, count (1–500), create random submissions.

All admin procedures use `adminProcedure` (role === "admin" + optional admin code). Super-admin uses `superAdminProcedure` (username in `ENV.superAdminUsernames`).

### 1.4 Competition-Related Logic

- **Tournament types** (backend): `football | football_custom | lotto | chance | custom`. Public normalization: WORLD_CUP (football/worldcup), FOOTBALL (football_custom), CHANCE, LOTTO.
- **Creation**: `createTournament` in `server/db.ts`; input via `admin.createTournament` (name, amount, type, dates, drawCode/drawDate/drawTime, prizeDistribution, etc.). Type-specific validation in `server/routers.ts` (e.g. lotto requires drawCode and allowed draw times).
- **World Cup matches**: Single hardcoded dataset `shared/matchesData.ts` — **WORLD_CUP_2026_MATCHES** (72 matches), seeded/used by db layer. No admin UI to create another “World Cup” edition; it’s one fixed competition.
- **Custom football**: Matches in `custom_football_matches`; admin adds/edits/result-updates per tournament; scoring uses same 1/X/2 logic as World Cup.

### 1.5 Forms

- **Entry/prediction**: `client/src/pages/PredictionForm.tsx`. Renders by tournament type:
  - **WORLD_CUP / FOOTBALL**: One 1/X/2 per match (from `matches` or `custom_football_matches`).
  - **CHANCE**: Four cards (heart, club, diamond, spade) from set `["7","8","9","10","J","Q","K","A"]`.
  - **LOTTO**: 6 numbers 1–37, strong number 1–7.
- **Registration**: `Register.tsx` — username, phone, password, confirmPassword, name, referralCode. Validation: client (min 3 username, 6 password) and server (min 8 password, etc.).
- No form builder; no dynamic field definitions. Form shape is fixed per type in client and in tRPC submit procedures.

### 1.6 Scoring Logic

- **Football (World Cup + custom)**: `server/services/scoringService.ts` — correct result (1/X/2) = **3 points**, else 0. `calcSubmissionPoints(predictions, matchResults)` sums over matches.
- **Lotto**: In `server/db.ts`: `totalPoints = regularMatches + (strongHit ? 1 : 0)` (regularMatches = count of predicted numbers in winning set). Numbers 1–37, strong 1–7.
- **Chance**: Logic in `server/db.ts`; compares user’s 4 cards to `chance_draw_results`; card set same as form (7–A).
- All scoring is **hardcoded** (3 points per football result; 1 per lotto number + 1 for strong; chance rules in db). No configurable rules per competition type.

### 1.7 Payment / Profit-Loss / Agent-Commission

- **House fee**: 12.5% — `calcHouseCommission(entryAmount, houseFeeRate)` in `server/db.ts`; default `houseFeeRate` 12.5. Also hardcoded `FEE_PERCENT = 12.5` in settlement paths.
- **Agent commission**: `calcAgentCommission(entryAmount, agentPercentOfFee)` — FEE = 12.5%, then agent gets `agentPercentOfFee`% of that (e.g. 50% → 6.25% of entry). Default `agentShareOfHouseFee` 50; env `AGENT_COMMISSION_PERCENT_OF_FEE` (default 50).
- **Flow**: On submit, points deducted; fee rounded `cost * 0.125`; agent commission recorded in `agent_commissions` and ledger. Admin can deposit/withdraw points; distribute prizes per tournament.
- **PnL**: getPlayerPnL, getAgentPnL, getAdminPnLSummary, getAdminPnLReportRows, getAgentPnLReportRows; financial records and transparency log. CSV exports for PnL summary, PnL report, agent/player PnL, commission report, points logs.

### 1.8 Reports / Export

- **Location**: `server/csvExport.ts` + tRPC in `server/routers.ts`.
- **Exports**: PnL summary, agent PnL, player PnL, admin PnL report, agent PnL report, commission report, points logs; agent/player financial reports (CSV and Excel). Rate limit: 15 exports per minute per user/IP.
- **Filters**: Date range, tournament type, agent Id, player Id. No generic “report builder”; each report is a dedicated procedure.

### 1.9 Content Management

- **site_settings**: Key-value store; admin get/set via `getSiteSettings`, `setSiteSetting`. No dedicated banner or static-page tables; no standard keys documented in client.
- **Static content**: HowItWorks, Transparency, Terms — content in components (e.g. Terms and withdrawal hours 09:00–13:00 in `App.tsx`). WhatsApp number hardcoded in `App.tsx` and `Register.tsx` (`972538099212`).

---

## 2. Hardcoded Elements & Where New Types Require Code

### 2.1 Hardcoded Competition Rules

| Item | Location | Current Value |
|------|----------|----------------|
| Football points per correct result | `server/services/scoringService.ts` | 3 |
| Lotto: numbers range / strong range | Routers + client | 1–37, strong 1–7 |
| Lotto scoring | `server/db.ts` | 1 point per number + 1 if strong hit |
| Chance card set | `PredictionForm.tsx`, `AdminPanel.tsx` | 7,8,9,10,J,Q,K,A |
| Chance draw times (validation) | Admin create flow | 09:00–21:00 (CHANCE_DRAW_TIMES) |
| Lotto draw times (validation) | `server/routers.ts` | 20:00, 22:30, 23:00, 23:30, 00:00 |
| House fee default | `server/db.ts`, schema | 12.5% |
| Agent share of house fee default | Schema, env | 50% of 12.5% |

### 2.2 Hardcoded Form Fields

- **Football**: Match list from DB (World Cup from `matches` or custom from `custom_football_matches`); each match one field 1/X/2. No configurable “which matches” or “which outcomes” per competition.
- **Chance**: Exactly 4 cards, 4 suits; options 7–A. No extra fields.
- **Lotto**: Exactly 6 numbers + 1 strong; ranges fixed. No “custom lotto” (e.g. 5 numbers 1–50).
- **Registration**: Fixed fields; no custom profile fields.

### 2.3 Hardcoded Scoring Calculations

- Football: 3 points per correct in `scoringService.ts`; no “2 points for correct winner, 1 for draw” etc.
- Lotto: Formula in db (match count + strong bonus); not stored as config.
- Chance: Logic in db; not in scoringService and not configurable.

### 2.4 Hardcoded Admin Flows

- **Create tournament**: One form with type dropdown; fields and validation branch on type (football/lotto/chance/football_custom). Adding a new type (e.g. “quiz”) requires: new option in type enum, new branch in createTournament, new branch in AdminPanel form, new entry form and submit procedure.
- **Draw result entry**: Separate UI blocks for Chance (4 cards) and Lotto (6+1 numbers). No generic “result schema per type.”
- **PnL tournament type filter**: `PNL_TOURNAMENT_TYPE_OPTIONS` = football, lotto, chance, football_custom. New type = code change here and in backend filters.

### 2.5 Places Where New Competition Types Require Code Changes

1. **Backend**: `server/routers.ts` — createTournament input enum; type-specific validation; submit procedures (submitFootball, submitChance, submitLotto); getById normalization; leaderboard/scoring per type.
2. **Backend**: `server/db.ts` — createTournament; scoring/result logic per type; leaderboard queries; settlement per type.
3. **Frontend**: `AdminPanel.tsx` — CompetitionSubType; create form branches; draw result forms; PNL_TOURNAMENT_TYPE_OPTIONS.
4. **Frontend**: `PredictionForm.tsx` — type switch for form layout and validation; CHANCE_CARDS, SUITS, 1/X/2.
5. **Frontend**: `TournamentSelect.tsx` / tournament list — type display and routing.
6. **Shared**: Tournament type constants; `matchesData.ts` for any new “fixed” match set.

---

## 3. Recommended Target Architecture (Dynamic Platform)

### 3.1 Core Modules

| Module | Purpose |
|--------|--------|
| **Competitions** | CRUD competitions; link to type/template; status/visibility/lifecycle |
| **Competition Types / Templates** | Reusable definitions: form schema, result schema, scoring rules, fee defaults |
| **Dynamic Entry Forms** | Form definition (fields, validation) stored per type or per competition; renderer consumes schema |
| **Rules Engine** | Configurable rules (e.g. “correct result = 3 points”) per type or per competition; no 3 or 1 hardcoded in code |
| **Scoring Engine** | Generic scorer: inputs = submission payload + result payload + rules; output = points; pluggable per type |
| **Matches / Events / Draw Items** | Unified “draw items”: football matches, lotto draws, chance draws, or custom events; link to competition |
| **Users / Participants** | Existing users; extend with roles/permissions and optional profile fields |
| **Agents / Commissions** | Existing agent_commissions and env; optional per-competition or per-type commission rules |
| **Payments / Profit-Loss** | Keep ledger + transparency; reports driven by competition type and filters (no hardcoded type list) |
| **Reports / Exports** | Same exports; filters and types read from DB (competition types / tags) |
| **CMS / Banners / Static** | Optional: structured banners (slot, image, link, dates); static pages (slug, title, body); keep site_settings for key-value |
| **Admin Roles / Permissions** | Roles beyond admin/agent/user; permissions per resource (e.g. competitions.create, reports.export) |
| **Activity Logs / Audit Trail** | Extend audit_logs and admin_audit_log; ensure all critical actions logged with entity type/id |

### 3.2 High-Level Data Flow (Target)

- **Competition** belongs to a **Competition Type** (or template). Type defines: entry form schema, result schema, scoring rule set, default fees.
- **Draw items** (matches, draw results, etc.) belong to competition; structure defined by type’s result schema.
- **Submission** stores JSON payload matching type’s form schema; **Scoring Engine** uses type’s rules + result data to compute points.
- **New competition type** = new type record + form schema + rules + optional result schema; no new submit procedures or form components for simple variants.

---

## 4. Required Database Entities

### 4.1 New Tables (Proposed)

| Table | Purpose |
|-------|--------|
| **competition_types** | id, code (e.g. football_12x, lotto_6_37, chance_4), name, form_schema (JSON), result_schema (JSON), scoring_config (JSON), default_house_fee_rate, default_agent_share, created_at, updated_at |
| **draw_items** (or **competition_events**) | id, tournament_id, type (match | lotto_draw | chance_draw | custom), external_id (e.g. match_number), payload (JSON: teams, date, time for match; numbers for lotto; cards for chance), display_order, created_at, updated_at |
| **form_definitions** (optional, if not embedded in type) | id, competition_type_id, version, schema (JSON), created_at |
| **scoring_rules** (optional, if not embedded in type) | id, competition_type_id, rule_key, config (JSON), created_at |
| **admin_roles** | id, code, name, permissions (JSON array or relation) |
| **admin_role_assignments** | user_id, role_id (for admins) |
| **banners** (optional) | id, slot, title, image_url, link_url, start_at, end_at, active, sort_order |
| **static_pages** (optional) | id, slug, title, body (or rich text ref), updated_at |

### 4.2 Existing Tables to Extend (Backward Compatible)

| Table | Change |
|-------|--------|
| **tournaments** | Add `competition_type_id` (nullable FK to competition_types); keep `type` for backward compatibility; optionally add `form_schema_override`, `scoring_config_override` (JSON) for per-competition overrides |
| **submissions** | Keep `predictions` JSON; ensure it can satisfy any form_schema from type |
| **results** | Keep resultsJson; can store result per draw_item or legacy structure |
| **users** | Optional: add `admin_role_id` or use role_assignments; keep role enum during transition |

### 4.3 Migration Strategy

- Add new tables and nullable columns first; backfill `competition_types` from current types (football, football_custom, lotto, chance). Existing tournaments keep `type`; new ones can set `competition_type_id` and optionally `type` for legacy code paths.
- Run old and new code paths in parallel: if `competition_type_id` is set, use scoring/forms from type; else use current hardcoded behavior. No big-bang rewrite.

---

## 5. Required Admin Screens (Summary)

- **Dashboard** — Keep; add widgets for competition types and recent activity.
- **Competitions list** — Filter by type (from DB), status, date; bulk actions.
- **Create competition wizard** — Step 1: choose type (from competition_types). Step 2: name, amount, dates, draw params (type-specific). Step 3: optional overrides (fees, form). No more single form with type dropdown and branched fields.
- **Competition type templates** — CRUD for competition_types (code, name, form_schema, result_schema, scoring_config). At least list + edit; create can be “clone from existing.”
- **Dynamic forms builder** — UI to edit form_schema (and optionally result_schema) for a type: add/remove fields, set validation. Stored in competition_types or form_definitions.
- **Rules / scoring settings** — UI to edit scoring_config / scoring_rules for a type (e.g. points per correct result; lotto formula). No 3 or 1 in code for that type.
- **Matches / events / draw items** — Per competition: list draw items; add/edit/delete. For “world cup” type, bulk import or link to external set. For custom football, current custom_football_matches flow can become one use case of draw_items.
- **Entries / submissions manager** — Current submissions list; filters by competition, type (from DB), status; approve/reject/payment; view payload against form_schema.
- **Users manager** — Current players list; add role/permission display and assignment.
- **Agents manager** — Keep; optional per-type commission overrides later.
- **Finance / reports** — Keep; filters use competition type from DB; add “competition type” filter if useful.
- **CMS / content** — Optional: banners list, static pages list; edit content; site_settings kept for key-value.
- **Settings** — Global: default fees, rate limits, WhatsApp number, withdrawal hours; move from code to settings/site_settings where possible.
- **Roles / permissions** — List roles; assign permissions; assign roles to admins. Super-admin remains for bootstrap.
- **Logs** — Audit log viewer; filter by actor, action, entity type, date.

Detailed screen specs (purpose, widgets, filters, columns, actions, permissions) are in **ADMIN-SCREENS-BLUEPRINT.md**.

---

## 6. Step-by-Step Implementation Roadmap

### Phase 2a — Foundation (no UI breakage)

1. **DB migrations**: Add `competition_types` table; add `competition_type_id` (nullable) to `tournaments`. Add `draw_items` (or `competition_events`) if you want to unify matches/draws later.
2. **Seed competition_types**: Insert rows for football, football_custom, lotto, chance with current behavior encoded (form_schema and scoring_config as JSON). Keep existing `type` on tournaments.
3. **Backend**: Add read APIs for competition_types; createTournament can accept optional `competition_type_id` and still use current validation when type is set from enum. No change to submission or scoring yet.

### Phase 2b — Admin: Types and wizard

4. **Admin: Competition types list** — New section or page listing competition_types; view/edit name and code; edit form_schema and scoring_config as JSON (or simple builder later).
5. **Admin: Create competition wizard** — Step 1: select competition_type from DB. Step 2: type-specific fields (reuse current logic but driven by type). Save with `competition_type_id` set. Existing create form can remain for backward compatibility or be replaced by wizard.

### Phase 2c — Scoring and forms (internal)

6. **Scoring engine abstraction**: Introduce a single entry point, e.g. `computePoints(competitionTypeId, submissionPayload, resultPayload)`. For types that have scoring_config, use it; otherwise fall back to current hardcoded logic (football 3 pts, lotto formula, chance in db).
7. **Form schema in frontend**: For one type (e.g. lotto), render PredictionForm from form_schema from API instead of hardcoded fields. Keep existing form as fallback when form_schema is missing.

### Phase 2d — Draw items and results

8. **Draw items**: Migrate custom_football_matches into draw_items (or keep custom_football_matches and add a view that treats them as draw items). World Cup: either keep matches table and a “world_cup_2026” type that references it, or seed draw_items from matchesData once.
9. **Result entry**: Generic “result entry” by competition: load result_schema for type; admin fills result; store in results + type-specific tables (chance_draw_results, lotto_draw_results) or in a unified result store keyed by draw_item.

### Phase 2e — Permissions and CMS (optional)

10. **Roles/permissions**: Add admin_roles and admin_role_assignments; check permission in adminProcedure for sensitive operations; super_admin retains full access.
11. **CMS**: Add banners and/or static_pages if needed; admin UI to manage them; client reads from API. Move WhatsApp and withdrawal hours to site_settings or settings table.

### Phase 3 — Cleanup and scaling

12. **Deprecate hardcoded types**: New competitions must use competition_type_id; gradually stop adding branches for new types in code. Document that new types are added via admin.
13. **Reports**: Ensure all report filters use competition type from DB (competition_types) so new types appear without code change.

---

## 7. What Should Remain Backward Compatible

- **Existing tournaments and submissions**: No data migration that changes meaning of `predictions` or `points`. Old competitions keep working with current scoring.
- **Existing API contracts**: getById, getAll, submit* procedures keep working; add optional parameters or new procedures for type-driven flow.
- **Current admin sections**: Until wizard and type list are ready, keep current competition create form and PnL filters working.
- **Auth**: Cookie, admin code, super-admin list; new roles are additive.

---

## 8. Risks / Warnings

| Risk | Mitigation |
|------|------------|
| **Schema drift** | Keep `type` and competition_type_id in sync when creating from wizard; backfill type from competition_type code where possible. |
| **Scoring regression** | Scoring engine must be tested against current results for football, lotto, chance; run both old and new scorer in parallel for a while and compare. |
| **Form schema breaking submissions** | Never change form_schema in a way that invalidates existing submissions; version form_schema if needed. |
| **Single AdminPanel file** | Refactor AdminPanel into smaller components/views as you add wizard and type screens; avoid adding more branches to the same 3.9k-line file. |
| **World Cup 2026 hardcoded** | Until draw_items is generic, adding “World Cup 2030” would still require code (new matches set). Plan a “match set” or “draw item set” that can be selected per competition. |

---

## 9. Quick Wins vs Deep Refactor

### Quick wins (low risk, high value)

- **Move constants to DB/settings**: WhatsApp number, withdrawal hours, default fee rates → site_settings or a settings table; read in app. Stops hardcoded edits in code.
- **Competition type filter from API**: PnL and reports get “competition types” list from DB (competition_types or distinct type from tournaments); AdminPanel no longer uses PNL_TOURNAMENT_TYPE_OPTIONS hardcoded array.
- **Add competition_types table and seed**: No behavior change; enables future wizard and type-driven logic.
- **Audit log for all critical admin actions**: Ensure createTournament, lock, delete, approve/reject, deposit/withdraw, role changes write to audit_logs or admin_audit_log with entity type/id.

### Deep refactor (later, planned)

- **Single PredictionForm driven by form_schema**: Replace type switch with generic form renderer; requires robust schema format and validation.
- **Unified scoring engine**: All types go through computePoints(type, submission, result); remove duplicated logic from db.ts and scoringService.
- **Unified draw items**: One table and UI for matches, lotto draws, chance draws; type describes structure.
- **Full roles/permissions**: Replace “admin vs super_admin” with role-based permissions for every admin action.
- **Dynamic create wizard**: All competition types created from wizard + type config; remove branched create form.

---

## 10. Document History

- **Phase 1**: System audit and architecture plan only. No code refactor or UI redesign. Next step: review this roadmap and ADMIN-SCREENS-BLUEPRINT.md, then proceed to Phase 2a (DB + competition_types).
