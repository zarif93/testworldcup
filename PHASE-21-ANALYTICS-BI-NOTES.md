# Phase 21: Analytics / BI Dashboard – Implementation Notes

## Overview

Phase 21 adds a **read-only** business intelligence layer on top of the existing platform. It does not change any competition, scoring, settlement, or PnL business logic. Existing reporting and admin flows remain unchanged.

---

## Files Changed

| Area | File | Change |
|------|------|--------|
| DB | `server/db.ts` | Added `getAutomationJobCounts()`, `getNotificationUnreadCount()`, import `ne` from drizzle-orm |
| Analytics | `server/analytics/dashboard.ts` | **New.** Analytics query/model layer: overview, competition, revenue, template, agent, automation, notification |
| API | `server/routers.ts` | Added analytics procedures with RBAC; import `analyticsDashboard` |
| Admin UI | `client/src/components/admin/AnalyticsDashboardSection.tsx` | **New.** Analytics dashboard section (cards, charts, tables) |
| Admin UI | `client/src/pages/AdminPanel.tsx` | Added `analytics` section type, nav item (when `reports.view`), dashboard card, `AnalyticsDashboardSection` render; `canViewReports`; `BarChart3` icon |

---

## Analytics Model / APIs Added

All procedures are **admin-only** and **read-only**.

| Procedure | RBAC | Description |
|-----------|------|-------------|
| `getDashboardOverview` | `reports.view` | Platform overview: competitions (total, active, open, closed, settled), submissions, users, agents, revenue/payouts/net, this week/month counts, automation counts, unread notifications |
| `getCompetitionAnalytics` | `reports.view` | By status, by type, competitions this week/month |
| `getRevenueAnalytics` | `finance.view` | Optional `from`/`to`; totalRevenue, totalPayouts, totalRefunds, netProfit, totalAgentProfit, competitionsHeld/Cancelled |
| `getTemplateAnalytics` | `reports.view` | Total templates, list (id, name, legacyType, competitionTypeId, defaultEntryFee, isActive) |
| `getAgentAnalytics` | `reports.view` | Top agents from PnL summary (id, username, name, net, profit, loss) |
| `getAutomationAnalytics` | `reports.view` | executed / skipped / failed job counts |
| `getNotificationAnalytics` | `reports.view` | unreadCount |

---

## Dashboard Sections (UI)

- **סיכום פלטפורמה** – Cards: total competitions, open/active, submissions, users/agents, unread notifications  
- **כספים (סיכום)** – Revenue, payouts, net profit, refunds  
- **השבוע / החודש** – Competitions and submissions created this week/month  
- **תחרויות לפי סוג** – Bar chart by competition type  
- **תחרויות לפי סטטוס** – Badges by status  
- **אוטומציה – סיכום** – Executed / skipped / failed  
- **תבניות** – Table of templates (name, type, default fee, active)  
- **סוכנים (רווח/הפסד)** – Table of agents with profit/loss/net  

Empty state is shown when there are no competitions and no submissions.

---

## Metrics Included

- Total competitions, active/open/closed/settled counts  
- Total submissions, total users, total agents  
- Total revenue, total payouts, net profit, total refunds  
- Competitions created this week/month  
- Submissions created this week/month  
- Competition counts by status and by type (with optional revenue by type)  
- Template list and count (no “usage” field on templates; usage can be added later via tournament→template link)  
- Top agents by PnL (profit, loss, net)  
- Automation jobs: executed, skipped, failed  
- Unread notifications count  

---

## RBAC Guards

- **`reports.view`** – Required for: dashboard overview, competition analytics, template analytics, agent analytics, automation analytics, notification analytics.  
- **`finance.view`** – Required for: revenue analytics (date range optional).  
- Super-admin and users with the above permissions can access the analytics nav and dashboard card.

---

## Fallback Behavior

- **Analytics layer (`server/analytics/dashboard.ts`):** All functions are wrapped in try/catch. On error or missing DB they return empty/zero data (e.g. `{ totalCompetitions: 0, ... }`, `{ agents: [] }`).  
- **DB helpers:**  
  - `getAutomationJobCounts`: Returns `{ executed: 0, skipped: 0, failed: 0 }` when not SQLite or table/db missing.  
  - `getNotificationUnreadCount`: Returns `0` when not SQLite or table/db missing.  
- **Admin UI:** Loading spinner while data is fetched; empty state when overview has no competitions and no submissions. No crash on missing or partial data.

---

## Future BI Extension Points

1. **Date range filters** – Add optional date range to dashboard overview and competition/revenue analytics in the UI; APIs already support `from`/`to` for revenue.  
2. **Template usage** – If tournaments get a `templateId` (or similar) field, “top templates by usage” can be added.  
3. **Export** – CSV/Excel export for competition/revenue/agent analytics using existing export patterns and rate limits.  
4. **Charts** – More chart types (line over time, revenue by type) using existing `recharts` setup.  
5. **Caching** – Optional short-lived cache for overview/competition analytics if load grows.  
6. **Non-SQLite** – Extend `getAutomationJobCounts` and `getNotificationUnreadCount` (and any SQLite-only analytics paths) to other backends when needed.

---

## Backward Compatibility

- No changes to existing workflows, reporting screens, or business logic.  
- Analytics is additive and read-only.  
- Missing or partial data is handled safely; admin does not crash on missing fields or empty DB.
