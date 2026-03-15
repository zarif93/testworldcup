# Admin Panel — Screens Blueprint (Future State)

This document defines the target structure of the admin panel for the dynamic competition management platform. Each screen is specified with purpose, widgets, filters, columns, actions, permissions, and scaling notes.

---

## 1. Dashboard

**Purpose**: Single entry point for admins; at-a-glance status and quick navigation to main areas.

**Main widgets**

- **Summary cards**: Pending submissions count (with link to Submissions); active competitions count (with link to Competitions); total users; total agents; optional “open competitions by type” breakdown.
- **Recent activity**: Last 10–20 audit events (submission approved, competition locked, deposit, etc.) with timestamp, actor, action, entity link.
- **Shortcuts**: Buttons/cards to “Create competition,” “Pending submissions,” “Points deposit,” “Reports,” “Competition types,” “Logs.”
- **Optional**: Simple charts (submissions per day, revenue per competition type) — can be Phase 2.

**Filters**

- None on dashboard itself; “Recent activity” can have a small filter: action type, date range (e.g. last 24h / 7d).

**Table columns**

- N/A (activity list: columns = time, actor, action, entity type, entity id/link, details summary).

**Actions**

- Navigate to any section; optional “Dismiss” or “Mark as read” for notifications if you add in-app notifications later.

**Permissions**

- Any authenticated admin can see dashboard. Optional: hide “Competition types” or “Roles” for non–super-admin.

**Notes for scaling**

- Make widgets configurable per role later (e.g. agents see only their stats). Consider caching summary counts and refreshing on interval or after key actions.

---

## 2. Competitions List

**Purpose**: View, search, and manage all competitions; open lock/hide/delete; go to draw results or matches.

**Main widgets**

- **Competitions table**: Main data grid.
- **Toolbar**: “Create competition” button; bulk actions (e.g. lock selected, hide from homepage) if needed later.
- **Detail drawer/modal** (optional): Quick view of competition settings, submission count, status timeline.

**Filters**

- **Status**: UPCOMING | OPEN | LOCKED | CLOSED | SETTLED | ARCHIVED (from DB).
- **Competition type**: From `competition_types` or legacy `type` (football, football_custom, lotto, chance, etc.). Load options from API.
- **Date range**: opensAt / closesAt (e.g. “opens after”, “closes before”).
- **Search**: By name, drawCode, customIdentifier.
- **Visibility**: Visible / Hidden from homepage.

**Table columns**

- Id (optional, for support).
- Name.
- Type (label from competition_types or type).
- Amount / entry cost.
- Status.
- Opens at / Closes at.
- Submission count (approved).
- Locked (yes/no).
- Hidden from homepage (yes/no).
- Actions (dropdown or buttons).

**Actions**

- **View/Edit**: Open competition detail or wizard in edit mode (read-only fields where locked).
- **Lock / Unlock**: Toggle isLocked (only when allowed by lifecycle).
- **Hide / Restore**: Hide from homepage or restore.
- **Enter results**: Navigate to result entry for this competition (Chance/Lotto/Football).
- **Manage draw items**: For football_custom or when using draw_items — open matches/events manager for this competition.
- **Delete** (soft): Only when allowed (e.g. no approved submissions or refund first); confirm; log.

**Permissions**

- `competitions.view` — see list and detail.
- `competitions.create` — see “Create competition” and use wizard.
- `competitions.edit` — lock/unlock, hide/restore, edit draft fields.
- `competitions.delete` — delete (soft).
- `competitions.enter_results` — enter/update draw results and match results.
- Super-admin can do all.

**Notes for scaling**

- Paginate table (e.g. 25/50/100); optional export list to CSV. Add “Duplicate competition” action to clone settings for a new one.

---

## 3. Create Competition Wizard

**Purpose**: Guide admin through creating a new competition using a type-driven flow so new types don’t require new code.

**Main widgets**

- **Stepper**: Step 1 — Choose type; Step 2 — Main settings (name, amount, dates, type-specific params); Step 3 — Optional overrides (fees, form, limits); Step 4 — Review and create.
- **Type selector**: List or cards of `competition_types` (from API); show name, code, short description.
- **Dynamic step 2**: Fields depend on selected type (e.g. football: open/close datetime; lotto: drawCode, drawDate, drawTime; chance: drawDate, drawTime). Validation rules from type or global.
- **Step 3**: Optional overrides for house fee rate, agent share, max participants, prize distribution; optional form_schema override for advanced use.
- **Step 4**: Summary of all inputs; “Create” button.

**Filters**

- N/A (wizard flow).

**Table columns**

- N/A.

**Actions**

- Next / Back between steps; Create (submit); Cancel (return to list with confirm if data entered).

**Permissions**

- `competitions.create`. Super-admin can create any type.

**Notes for scaling**

- Allow “Save as draft” in step 2/3 so competitions can be created with status UPCOMING and edited later. Wizard can later support “Copy from existing competition.”

---

## 4. Competition Type Templates

**Purpose**: CRUD for competition types so new kinds of competitions can be added from admin without code deploy.

**Main widgets**

- **Types table**: code, name, description, form_schema (summary or “view”), result_schema summary, scoring_config summary, default fees, “is_system” (read-only) flag.
- **Create / Edit form**: Code (unique), name, description; form_schema (JSON editor or simple builder); result_schema (JSON); scoring_config (JSON or structured form); default_house_fee_rate, default_agent_share.

**Filters**

- Search by code or name; filter “system” vs “custom” if you mark built-in types.

**Table columns**

- Code, Name, Description, Default house fee %, Default agent share %, Form schema (e.g. “6 fields”), Updated at, Actions.

**Actions**

- **New type**: Open create form (or “Clone from” existing type).
- **Edit**: Open edit form (system types may have restricted edits to avoid breaking existing competitions).
- **View**: Read-only detail with full JSON.
- **Delete**: Only if no competitions use this type; confirm.

**Permissions**

- `competition_types.view` — list and view.
- `competition_types.create` — create (and clone).
- `competition_types.edit` — edit custom types; maybe restrict system types to super_admin.
- `competition_types.delete` — delete unused types.
- Super-admin full.

**Notes for scaling**

- Version form_schema and scoring_config so existing competitions keep using the version they were created with. Add “Preview form” to render form_schema in a modal.

---

## 5. Dynamic Forms Builder

**Purpose**: Visual (or structured) editor for form_schema and optionally result_schema of a competition type, so entry forms and result forms are data-driven.

**Main widgets**

- **Form list** (if form_definitions are separate): List forms by competition type; select one to edit.
- **Schema editor**: Either JSON editor or simple builder: add/remove fields; set field type (number, select, text, etc.), label, validation (min, max, required, allowed values). For result schema: same idea for “result” shape.
- **Preview**: Live preview of how the form will look (or link to “Preview” in type detail).

**Filters**

- By competition type.

**Table columns**

- If standalone table: Form name, Competition type, Version, Updated at, Actions.

**Actions**

- Add field; remove field; reorder; edit validation; save; preview; publish (set as current for type).

**Permissions**

- Same as competition type edit: `competition_types.edit` or `forms.edit`. Super-admin full.

**Notes for scaling**

- Store schema version per competition or per type version; support A/B or draft vs live. For complex forms, consider a form builder library (e.g. JSON Schema + react-jsonschema-form) and store JSON Schema.

---

## 6. Rules / Scoring Settings

**Purpose**: Configure how points are computed per competition type (no hardcoded 3 or 1 in code for that type).

**Main widgets**

- **Per-type scoring config**: List competition types; for each, show current scoring_config (e.g. “football: 3 points per correct result”; “lotto: 1 per number + 1 strong”). Edit in structured form or JSON.
- **Rule presets** (optional): “1/X/2 — 3 points”, “Lotto 6+1”, “Chance 4 cards” as named presets that fill config.

**Filters**

- By competition type.

**Table columns**

- Type code, Type name, Rule summary, Last updated, Actions (Edit).

**Actions**

- Edit scoring config for a type; save; test (optional: “Test with sample submission and result”).

**Permissions**

- `competition_types.edit` or `scoring.edit`. Super-admin full.

**Notes for scaling**

- Scoring engine must interpret config (e.g. formula or rule keys). Document config format; add validation so invalid config cannot be saved. Optional: version scoring_config and run regression tests per type.

---

## 7. Matches / Events / Draw Items Manager

**Purpose**: Manage the “draw items” for a competition: football matches, lotto draw (one per competition), chance draw (one per competition), or custom events.

**Main widgets**

- **Competition selector**: Dropdown or link from competition detail to “Manage draw items” for that competition.
- **Draw items table**: For football: match number or id, home team, away team, date, time, result (home/away score), status. For lotto/chance: single “draw” row; edit result in separate result-entry flow. For custom events: list with payload summary.
- **Add / Edit match (or event)**: Modal or inline: home team, away team, date, time; for custom, optional payload JSON. For World Cup type: may be read-only and loaded from predefined set.

**Filters**

- By competition (required); by status (upcoming/live/finished) for matches.

**Table columns**

- Id / Order, Type (match / draw), Identifier (match number or draw label), Details (teams or summary), Date/Time, Result (if applicable), Status, Actions.

**Actions**

- Add match (custom football); Edit match (teams, date, time); Edit result (scores); Delete match (if no submissions depend on it); Reorder (display_order). For lotto/chance: “Enter result” links to result-entry screen.

**Permissions**

- `competitions.enter_results` or `draw_items.edit`. Super-admin full.

**Notes for scaling**

- Unify with `draw_items` table so one UI can handle “matches” and “draws.” World Cup 2026 can be a predefined set; “World Cup 2030” could be a new set or same structure with different data. Bulk import (CSV) for matches is useful.

---

## 8. Entries / Submissions Manager

**Purpose**: List, filter, approve/reject submissions; mark payment; view predictions; delete when allowed.

**Main widgets**

- **Submissions table**: Main grid.
- **Filters bar**: Tournament (dropdown), status (pending/approved/rejected), payment status, date range, search (username, submission id, tournament id).
- **Detail drawer/modal**: View full predictions (rendered from form_schema when available); payment status; agent; points (after scoring); approve/reject/payment buttons.

**Filters**

- Tournament (required or optional); Status; Payment status; Date range; Search (username, id).
- Optional: Competition type (from tournament’s type).

**Table columns**

- Id, Submission #, Username, Tournament (name), Type, Status, Payment status, Points, Agent, Created at, Actions.

**Actions**

- **Approve** (pending → approved; deduct points, record commission).
- **Reject** (pending → rejected).
- **Mark payment** (pending → completed / failed).
- **View** (predictions detail).
- **Delete** (with confirm; only when policy allows).

**Permissions**

- `submissions.view` — list and view.
- `submissions.approve` — approve/reject.
- `submissions.payment` — mark payment.
- `submissions.delete` — delete. Super-admin full.

**Notes for scaling**

- Bulk approve/reject; export filtered list to CSV. Show “prediction schema” version if you version form_schema so support can compare payload to schema.

---

## 9. Users Manager

**Purpose**: List users (players); manage block, password reset, assign agent; deposit/withdraw points; view points and transaction history.

**Main widgets**

- **Users table**: List with key columns.
- **Filters**: Role (user/agent/admin); Blocked (yes/no); Agent (filter by agentId); Search (username, id, phone).
- **User detail drawer**: Points balance, unlimitedPoints flag, agent, referral code; points log; actions: block, reset password, assign agent, deposit, withdraw.
- **Points deposit/withdraw**: Modal with amount, optional note; call existing depositPoints/withdrawPoints.

**Filters**

- Role; Blocked; Agent; Search; optional date range for “created”.

**Table columns**

- Id, Username, Name, Phone, Role, Points, Agent, Blocked, Created at, Last sign-in, Actions.

**Actions**

- **Block / Unblock**: Set isBlocked.
- **Reset password**: Open modal; set new password (super_admin or permission).
- **Assign agent**: Select agent from list; update agentId.
- **Deposit / Withdraw points**: Open modal; amount; submit.
- **View points log**: Open drawer or navigate to points history for this user.
- **Delete user** (soft): Set deletedAt; only with permission and confirm.

**Permissions**

- `users.view` — list and view.
- `users.edit` — block, assign agent.
- `users.points` — deposit/withdraw.
- `users.reset_password` — reset password (often restricted to super_admin).
- `users.delete` — soft delete. Super-admin full.

**Notes for scaling**

- Pagination; export users to CSV. Optional: custom profile fields and tags for segmentation. Role filter should include “agent” and “admin” for full user list.

---

## 10. Agents Manager

**Purpose**: List agents; create agent; view balances and commission report; manage agent-specific settings.

**Main widgets**

- **Agents table**: Username, referral code, balance summary, player count, total commission (or link to report).
- **Create agent**: Modal or form — create user with role=agent, set referral code.
- **Agent detail**: Balance, players list (with balances), commission report summary, transfer log (deposits to players, withdrawals).

**Filters**

- Search by username or referral code; optional “has balance” filter.

**Table columns**

- Id, Username, Referral code, Players count, Balance, Total commission (period), Created at, Actions.

**Actions**

- **Create agent**: Open form; create user + referral code.
- **View / Edit**: Open detail; optional edit referral code or profile.
- **View report**: Navigate to commission report filtered by agent.
- **Deposit to agent** (admin): Transfer points to agent balance (if you support agent wallet). **View players**: List players with agentId = this agent.

**Permissions**

- `agents.view` — list and view.
- `agents.create` — create agent.
- `agents.edit` — edit agent (e.g. referral code).
- `agents.finance` — deposit to agent, view financial details. Super-admin full.

**Notes for scaling**

- Per-agent commission overrides (e.g. 60% of house fee for one agent) can be added later; store in agent profile or agent_commissions config. Export agent list and commission report to CSV/Excel (already present; keep in this screen).

---

## 11. Finance / Reports

**Purpose**: PnL summary and detailed reports; balance summary; transparency log; exports (CSV/Excel).

**Main widgets**

- **PnL summary**: By date range; by competition type (from DB); totals and breakdown (site, agents, players). Optional: by agent, by player.
- **PnL report table**: Rows = competitions or transactions; columns = type, date, competition, amount, fee, prize, etc. Filters: date range, competition type, agent, player.
- **Balance summary**: Total points in circulation; by agent; optional by user segment.
- **Transparency log**: Read-only table of financial_transparency_log; filters by type, date, competition, user.
- **Export buttons**: PnL summary CSV, PnL report CSV, Agent PnL CSV, Player PnL CSV, Commission report CSV, Points logs CSV; optional Excel for financial reports. Respect rate limit (e.g. 15/min).

**Filters**

- **Date range**: From / To (required for most reports).
- **Competition type**: From API (competition_types or distinct type); no hardcoded list.
- **Agent**: Dropdown (optional).
- **Player**: Search/select (optional).
- **Report type**: Summary vs detailed vs transparency.

**Table columns**

- Depends on report: e.g. Competition name, Type, Date, Participants, Pool, Fee, Prizes, Site PnL, Agent PnL; or Transaction type, User, Amount, Balance after, Date.

**Actions**

- Run report (apply filters); Export CSV / Excel; Open agent or player detail from row (drill-down).

**Permissions**

- `reports.view` — see summary and tables.
- `reports.export` — trigger exports. Optionally restrict sensitive exports (e.g. full PnL) to super_admin. Super-admin full.

**Notes for scaling**

- Cache heavy aggregations; consider async “generate report” and download when ready. Add more report types (e.g. by league, by period comparison) without new code by filtering on stored data.

---

## 12. CMS / Content Manager

**Purpose**: Manage banners and static content (and optionally keep site_settings key-value for globals).

**Main widgets**

- **Banners** (if table exists): List slots (e.g. homepage_top); for each slot: image, link, start/end date, active, order. Add/Edit/Delete.
- **Static pages** (if table exists): List by slug; edit title and body (rich text or markdown); preview.
- **Site settings**: Key-value list (current getSiteSettings); edit value for known keys (e.g. contact_whatsapp, withdrawal_hours_text, terms_url). Add “new key” for advanced use.

**Filters**

- Banners: by slot, active (yes/no). Static pages: by slug search.

**Table columns**

- **Banners**: Slot, Title, Image preview, Link, Start, End, Active, Order, Actions.
- **Static pages**: Slug, Title, Updated at, Actions.
- **Site settings**: Key, Value (truncated), Updated at, Actions.

**Actions**

- **Banners**: Add, Edit, Delete, Toggle active, Reorder.
- **Static pages**: Add, Edit, Delete, Preview.
- **Site settings**: Edit value; Add key (optional).

**Permissions**

- `cms.view` — list and view.
- `cms.edit` — create/update/delete banners and pages; edit site settings. Super-admin full.

**Notes for scaling**

- Use slots and scheduling so multiple banners can rotate. Static pages can have “draft” vs “published” and versioning later. Move hardcoded WhatsApp and withdrawal hours into site_settings and read in App/Register.

---

## 13. Settings

**Purpose**: Global application and business settings in one place (instead of env-only or scattered constants).

**Main widgets**

- **Sections**: e.g. “Business” (default house fee %, default agent share %, withdrawal hours text, contact WhatsApp), “Security” (admin code required yes/no, super-admin usernames read-only display), “Limits” (submissions per minute, exports per minute, idempotency TTL), “Branding” (site name, logo URL). Each field editable where allowed; sensitive ones (e.g. secrets) show “••••” and “Change” only for super_admin.

**Filters**

- N/A.

**Table columns**

- N/A (form-based).

**Actions**

- Save per section or “Save all”; “Reset to default” for non-sensitive defaults.

**Permissions**

- `settings.view` — see all (sensitive masked).
- `settings.edit` — edit non-sensitive (e.g. fee defaults, withdrawal hours, WhatsApp number). Sensitive (admin secret, super-admin list) only super_admin. Super-admin full.

**Notes for scaling**

- Store in site_settings or a dedicated `app_settings` table; env can still override for deployment (e.g. DATABASE_URL). Document which settings are overridable by env.

---

## 14. Roles / Permissions

**Purpose**: Define admin roles and assign permissions; assign roles to users (admins). Super-admin remains bootstrap for first user and critical actions.

**Main widgets**

- **Roles table**: Code, Name, Permissions (summary count or list), Assigned users count, Actions.
- **Role form**: Name; permission checklist by resource (competitions.*, submissions.*, users.*, agents.*, reports.*, cms.*, settings.*, competition_types.*, admins) and action (view, create, edit, delete, approve, export, etc.). “Super admin” role = all permissions; maybe one system role that cannot be deleted.
- **User assignments**: Per user (admin list): select role(s); or in user detail, “Admin role” dropdown.

**Filters**

- Roles: search by name/code. Users: filter by role.

**Table columns**

- **Roles**: Code, Name, Permissions summary, Users count, Updated at, Actions.
- **Assignments**: User, Username, Role(s), Assigned at, Actions.

**Actions**

- **Roles**: Create, Edit, Delete (if no users assigned and not system role).
- **Assignments**: Assign role to user; Remove role.

**Permissions**

- Only super_admin can access this screen and change roles/permissions. Other admins see at most their own role (read-only).

**Notes for scaling**

- Permissions stored as array of strings (e.g. `["competitions.view","competitions.create"]`) or in a permission_grants table. Check permission in adminProcedure per procedure. Add “Custom role” that clones a preset and then edit permissions.

---

## 15. Logs

**Purpose**: View audit trail for security and support; filter by actor, action, entity, date.

**Main widgets**

- **Log table**: Timestamp, Actor (user id + username), Role, Action, Entity type, Entity id, Diff summary or link, IP, User-Agent (optional). Data from audit_logs and optionally admin_audit_log (unified or separate tabs).
- **Filters**: Actor (user id or username), Action (e.g. “submission.approve”, “tournament.create”), Entity type (tournament, submission, user, …), Date range.

**Filters**

- Actor; Action; Entity type; Entity id; Date range.

**Table columns**

- Time, Actor, Action, Entity type, Entity id (link if possible), Details (diff or summary), IP, User-Agent.

**Actions**

- View full diff (modal); Export filtered log to CSV (optional, rate-limited). No edit/delete.

**Permissions**

- `logs.view` — view logs. Optionally restrict to super_admin for full history; other admins see only their own actions or a limited set. Super-admin full.

**Notes for scaling**

- Paginate; consider retention policy and archive old logs. Structured action names (e.g. `submission.approved`, `tournament.locked`) make filtering and reporting easier. Optional: real-time tail for support.

---

## Summary: Screen vs Permission Matrix (Target)

| Screen | View | Create | Edit | Delete | Special |
|--------|------|--------|------|--------|--------|
| Dashboard | admin | — | — | — | — |
| Competitions list | competitions.view | competitions.create | competitions.edit | competitions.delete | enter_results |
| Create wizard | — | competitions.create | — | — | — |
| Competition types | competition_types.view | competition_types.create | competition_types.edit | competition_types.delete | — |
| Forms builder | competition_types.view | — | competition_types.edit | — | — |
| Scoring settings | competition_types.view | — | competition_types.edit | — | — |
| Matches/Events | draw_items.view | draw_items.create | draw_items.edit | draw_items.delete | — |
| Submissions | submissions.view | — | submissions.approve, submissions.payment | submissions.delete | — |
| Users | users.view | — | users.edit, users.points | users.delete | users.reset_password |
| Agents | agents.view | agents.create | agents.edit | — | agents.finance |
| Finance/Reports | reports.view | — | — | — | reports.export |
| CMS | cms.view | cms.edit | cms.edit | cms.edit | — |
| Settings | settings.view | — | settings.edit | — | super_admin for sensitive |
| Roles | super_admin | super_admin | super_admin | super_admin | — |
| Logs | logs.view | — | — | — | — |

This blueprint should be used together with **ADMIN-PLATFORM-ROADMAP.md** for implementation order and backward compatibility.
