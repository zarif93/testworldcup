# Phase 19: Notifications Center — Implementation Notes

## Overview

Phase 19 adds a **notifications center** with a structured internal model, admin visibility, and hooks from key lifecycle events. External delivery channels (email, WhatsApp, SMS) are prepared in the schema but not implemented; only **in_app / internal** is used so that business logic never depends on notification success.

---

## 1. Files Changed

| Area | File | Change |
|------|------|--------|
| Schema | `drizzle/schema-sqlite.ts` | Added `notifications` table. |
| DB | `server/db.ts` | CREATE TABLE `notifications`; `insertNotification`, `listNotifications`, `getNotificationById`, `markNotificationRead`; `getTournamentsClosingSoon`, `hasRecentNotificationForTournament`. |
| Notifications | `server/notifications/types.ts` | **New.** Notification type and channel constants. |
| Notifications | `server/notifications/createNotification.ts` | **New.** Safe `createNotification` and `notifyLater` (never throw). |
| Routers | `server/routers.ts` | After createTournament, distributePrizes, approveSubmission, rejectSubmission: `notifyLater(...)`. Admin procedures: `listNotifications`, `getNotificationById`, `markNotificationRead`. |
| Automation | `server/automation/runJob.ts` | After `logAndRecord`: on failed → `notifyLater(automation_failed)`; on skipped → `notifyLater(automation_skipped)`. On successful close → `notifyLater(competition_closed)`. On successful settle → `notifyLater(tournament_settled)`. |
| Core | `server/_core/index.ts` | New interval (hourly): `getTournamentsClosingSoon(24h)`, dedupe with `hasRecentNotificationForTournament`, then `notifyLater(competition_closing_soon)`. |
| Admin UI | `client/src/components/admin/NotificationsSection.tsx` | **New.** List, filter by recipient/type/status, mark as read, expand payload/details. |
| Admin UI | `client/src/pages/AdminPanel.tsx` | New section "התראות" (notifications), nav item, render `NotificationsSection`. |
| Docs | `PHASE-19-NOTIFICATIONS-NOTES.md` | **New.** This file. |

---

## 2. Notification Model

**Table `notifications`**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment. |
| recipientType | TEXT | `admin` \| `user` \| `agent` \| `system`. |
| recipientId | INTEGER | Nullable; null for admin/system broadcast. |
| channel | TEXT | `in_app` \| `email` \| `whatsapp` \| `sms` \| `internal`. Default `in_app`. |
| type | TEXT | Notification type (e.g. competition_created, tournament_settled). |
| title | TEXT | Optional title. |
| body | TEXT | Optional body. |
| payloadJson | TEXT (JSON) | Optional payload for detail/debug. |
| status | TEXT | `created` \| `sent` \| `failed` \| `read`. Default `created`. |
| readAt | INTEGER (timestamp) | When marked read (admin UI). |
| createdAt | INTEGER (timestamp) | When created. |
| sentAt | INTEGER (timestamp) | For future external send. |
| lastError | TEXT | For future send failures. |

---

## 3. Events Now Producing Notifications

| Event | Type | When | Recipient |
|-------|------|------|-----------|
| Competition created | `competition_created` | Admin creates tournament (routers) | admin |
| Competition closing soon | `competition_closing_soon` | Hourly tick: OPEN tournament with closesAt in next 24h (dedupe: at most one per tournament per 24h) | admin |
| Competition closed | `competition_closed` | Automation successfully closed submissions (runJob) | admin |
| Tournament settled | `tournament_settled` | Admin distributes prizes (routers) or automation settles (runJob) | admin |
| Automation failed | `automation_failed` | Any automation job ends with status failed (runJob) | admin |
| Automation skipped | `automation_skipped` | Any automation job ends with status skipped (runJob) | admin |
| Submission approved | `submission_approved` | Admin approves submission (routers) | admin |
| Submission rejected | `submission_rejected` | Admin rejects submission (routers) | admin |

---

## 4. Admin UI Added

- **Section "התראות" (Notifications)** in admin sidebar.
- **List** recent notifications (default limit 50).
- **Filters:** recipient type (admin/user/agent/system), notification type, status (created/read/sent/failed).
- **Mark as read** per notification (button).
- **Expand** to inspect `payloadJson` and `lastError` (read-only).

---

## 5. Channels Supported Now

- **in_app / internal:** All notifications are stored with `channel = "in_app"`. No external delivery; no email/WhatsApp/SMS sending. Schema and code support future channels; no provider integration yet.

---

## 6. Failure Safety Behavior

- **createNotification** and **notifyLater** never throw. Errors are caught and logged (logger.warn); business flows are unchanged.
- Notification creation is **additive**: if insert fails, the tournament/submission/automation flow still succeeds.
- Automation and router hooks use **notifyLater** (fire-and-forget) so that notification logic never blocks or fails the main path.

---

## 7. Future Extension Points

- **User/agent notifications:** Model already supports `recipientType` and `recipientId`. Add UI/API for users/agents to list and mark read their notifications.
- **External channels:** Implement senders for `email`, `whatsapp`, `sms`; set `sentAt` / `lastError` and update `status` on send attempt.
- **Templates:** Map notification types to title/body templates (e.g. by locale).
- **Batching / digest:** Optional daily or weekly digest for admins.
- **Preferences:** Per-user/agent preferences for which events to receive and via which channel.

---

## 8. Backward Compatibility

- No changes to existing competition/admin flows other than adding optional `notifyLater` calls after success.
- No required external provider; no new env vars for Phase 19.
- Existing auth, RBAC, submission, settlement, and automation behavior unchanged.

---

## 9. Known Limitations

- **SQLite only:** Notification DB helpers are gated with `USE_SQLITE`; other backends get empty list / no-op insert until extended.
- **No user-facing UI:** Notifications are admin-only for now; user/agent inbox can be added later.
- **Closing soon dedupe:** One notification per tournament per 24h for `competition_closing_soon`; hourly tick may still create many notifications for many tournaments.
- **Payload JSON query:** `hasRecentNotificationForTournament` uses `json_extract` on SQLite; other DBs need an equivalent or a separate index column.
