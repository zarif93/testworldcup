# Phase 22: User Notifications & Lifecycle Messaging – Implementation Notes

## Overview

Phase 22 extends the existing notification system to **players (user)** and **agents** with lifecycle-triggered, in-app notifications. Admin/system notifications are unchanged. All delivery is **in_app** only; external channels remain optional placeholders.

---

## Files Changed

| Area | File | Change |
|------|------|--------|
| Types | `server/notifications/types.ts` | Added `AGENT_NEW_PLAYER`, `PLAYER_JOINED_COMPETITION` |
| DB | `server/db.ts` | Added `getParticipantUserIdsForTournament(tournamentId)`, `getNotificationUnreadCountForRecipient(recipientType, recipientId)` |
| Router | `server/routers.ts` | approveSubmission: notify **player** + **agent** (when agentId); rejectSubmission: notify **player**; distributePrizes: notify **winners**; new `notifications` router: listMine, getMyUnreadCount, getMineById, markMineRead |
| Automation | `server/automation/runJob.ts` | COMPETITION_CLOSED: notify each **participant**; TOURNAMENT_SETTLE: notify each **winner**; import `getParticipantUserIdsForTournament` |
| Core | `server/_core/index.ts` | closing-soon cron: notify each **participant** (user) per tournament; import `getParticipantUserIdsForTournament` |
| Client | `client/src/components/UserNotificationsBell.tsx` | **New.** Bell + unread badge, links to /notifications |
| Client | `client/src/pages/NotificationsPage.tsx` | **New.** List my notifications, mark read, expand details |
| Client | `client/src/App.tsx` | Route `/notifications`, UserNotificationsBell in header (user/agent), NavLinks "התראות" for user/agent |

---

## New Notification Flows

| Event | Recipient | When | payloadJson (typical) |
|-------|-----------|------|------------------------|
| **submission_approved** | admin | (existing) | submissionId, userId, tournamentId |
| **submission_approved** | **user** (player) | After admin approves submission | submissionId, userId, tournamentId, tournamentName |
| **agent_new_player** | **agent** | When submission approved and submission has agentId | submissionId, userId, username, tournamentId, tournamentName, agentId |
| **submission_rejected** | admin | (existing) | submissionId, userId, tournamentId |
| **submission_rejected** | **user** (player) | After admin rejects submission | submissionId, userId, tournamentId, tournamentName |
| **competition_closing_soon** | admin | (existing) cron | tournamentId, name, closesAt |
| **competition_closing_soon** | **user** (each participant) | Same cron, per participant | tournamentId, name, closesAt, userId |
| **competition_closed** | admin | (existing) on auto-close | tournamentId, name |
| **competition_closed** | **user** (each participant) | On auto-close, per participant | tournamentId, name, userId |
| **tournament_settled** | admin | (existing) manual + auto | tournamentId, winnerCount, prizePerWinner / name |
| **tournament_settled** | **user** (each winner) | After distribute prizes (manual or auto) | tournamentId, tournamentName, userId, prizePerWinner, winnerCount |

---

## UI Changes

- **Header (desktop & mobile):** For logged-in **user** or **agent**, a bell icon with unread count badge; click navigates to `/notifications`.
- **Nav menu:** "התראות" link for user/agent to `/notifications`.
- **Page `/notifications`:** List of current user’s notifications; unread styling; mark-as-read button; expand to show payload details and created date. Back to home. Accessible only to role **user** or **agent** (admins get message to use admin panel).
- **Admin:** Existing admin notifications section unchanged; can still filter by recipientType (admin / user / agent) to inspect user/agent notifications.

---

## RBAC Logic

- **notifications.listMine / getMyUnreadCount / getMineById / markMineRead:** Use `protectedProcedure`. Resolve `recipientType` from `ctx.user.role`: `agent` → `"agent"`, otherwise `"user"`. Query/update only rows with `recipientType` + `recipientId = ctx.user.id`. No admin override in this router; admins use admin panel.
- **getMineById / markMineRead:** After loading notification by id, enforce ownership: `n.recipientType === recipientType && n.recipientId === ctx.user.id`; otherwise `FORBIDDEN`.
- **Admin:** `admin.listNotifications` can list all or filter by `recipientType` (and optionally `recipientId`); no change to existing behavior. User notifications are separated by recipientType/recipientId; admins can inspect all.

---

## Fallback Behavior

- **createNotification / notifyLater:** Existing behavior: never throw; log and swallow errors so business flows (approve, reject, settle, close) are unaffected.
- **getParticipantUserIdsForTournament:** Returns unique userIds from submissions for the tournament; returns `[]` if DB unavailable or no submissions.
- **Closing-soon / competition_closed / tournament_settled:** Participant/winner notifications are sent in try/catch or fire-and-forget; failure does not affect admin notification or main flow.
- **Unread count / listMine:** If DB or notifications table unavailable, count is 0 and list is empty. No crash.
- **UI:** Notifications page shows loading then list or empty state; invalid/forbidden id returns error or empty; mark read refetches list.

---

## Future Delivery Channels

- **Email / WhatsApp / SMS:** Placeholders exist in types (`CHANNELS`). To add:
  - Add channel to `insertNotification` / schema if needed.
  - Implement a delivery worker that reads `status=created` and `channel=email` (etc.), sends via provider, then updates `status` and `sentAt` / `lastError`.
  - Keep in_app as default; opt-in or site settings for external channels.
- **Preferences:** Per-user/agent preferences (e.g. “email on submission_approved”) and respect them when creating notifications.
- **Deduplication:** Optional dedupe for high-frequency events (e.g. one “closing_soon” per user per tournament per 24h) using existing or new helpers.
