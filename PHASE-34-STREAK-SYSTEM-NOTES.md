# Phase 34 Step 3: Streak System – Implementation Notes

## Summary

This step adds a **Streak System** to create momentum, habit, and emotional attachment. Users see short motivational messages based on consecutive competition participations (e.g. "יש לך רצף של 3 השתתפויות", "עוד השתתפות אחת ואתה מגיע לרצף 5", "אל תשבור את הרצף שלך", "אתה בכושר – 4 תחרויות ברצף"). Additive only; no scoring or business logic changes.

---

## 1. Streak Logic Implemented

| Condition | Type | Message |
|-----------|------|---------|
| streakCount ≥ 2 and one participation away from next milestone | `milestone_close` | "עוד השתתפות אחת ואתה מגיע לרצף Y" |
| streakCount ≥ 2 | `active_streak` | "יש לך רצף של X השתתפויות" or "אתה בכושר – X תחרויות ברצף" (for X ≥ 4) |
| streakCount === 1 and participated in last 7 days | `streak_warning` | "אל תשבור את הרצף שלך" |
| No useful streak (0 participations or no message) | `none` | Banner not shown |

**Definitions**

- **Participation:** One approved submission per tournament; per tournament we use the latest of `approvedAt` or `updatedAt`.
- **Consecutive:** Tournaments ordered by that date descending (most recent first). Streak = number of tournaments in a row from the most recent backward with gap ≤ 14 days between consecutive participation dates.
- **Milestones:** 3, 5, 7, 10, 15, 20. `nextMilestone` = smallest milestone > streakCount.
- **Recently participated:** Last participation within 7 days → eligible for `streak_warning` when streak is 1.

---

## 2. API and Component Added

| Item | Description |
|------|-------------|
| **Backend** | `getParticipationStreak(userId)` in `server/db.ts`. Returns `{ streakCount, nextMilestone?, message, type }`. |
| **API** | `user.getParticipationStreak` tRPC endpoint (protected), no input. |
| **Frontend** | `<StreakBanner className? />` in `client/src/components/StreakBanner.tsx`. Uses `trpc.user.getParticipationStreak.useQuery(undefined, { staleTime: 30_000 })`. Renders nothing when `type === "none"` or no message. |

---

## 3. Where the Banner Appears

| Location | When shown |
|----------|------------|
| **Home** | Logged-in user: below NearWin + Rival when tournament context exists; when no tournament context, StreakBanner only. |
| **Leaderboard** | Logged-in user: below NearWin + Rival (same block); StreakBanner always when authenticated. |
| **After submit** | Redirect to Home with `?submitted=1&tournamentId=...`; all three banners (NearWin, Rival, Streak) show on Home. |

---

## 4. UX (Colors and Copy)

| Type | Color | Copy |
|------|--------|------|
| `active_streak` | Amber | "יש לך רצף של X השתתפויות" / "אתה בכושר – X תחרויות ברצף" |
| `milestone_close` | Amber (lighter) | "עוד השתתפות אחת ואתה מגיע לרצף Y" |
| `streak_warning` | Orange | "אל תשבור את הרצף שלך" |
| `none` | — | Not rendered |

Compact banner with Flame icon; mobile-friendly; short copy.

---

## 5. Cache and Performance

| Layer | Behavior |
|-------|----------|
| **Backend** | In-memory cache per `userId`, TTL 30 seconds. Single lightweight query: `getSubmissionsByUserId`, then in-memory grouping/sort. |
| **Client** | `staleTime: 30_000` on `user.getParticipationStreak` query. |

---

## 6. Files Changed

| File | Changes |
|------|---------|
| **`server/db.ts`** | `getParticipationStreak`, types `ParticipationStreakType` / `ParticipationStreakResult`, streak cache (30s), constants for milestones (3,5,7,10,15,20), gap 14 days, warning window 7 days. |
| **`server/routers.ts`** | Import `getParticipationStreak`; new router `user` with `getParticipationStreak` protected procedure. |
| **`client/src/components/StreakBanner.tsx`** | New: StreakBanner component, styles by type, Flame icon, hide when type `none` or no message. |
| **`client/src/pages/Home.tsx`** | Import StreakBanner; render below Rival when tournament context exists; render StreakBanner alone when authenticated but no tournament context. |
| **`client/src/pages/Leaderboard.tsx`** | Import StreakBanner; render in same block as NearWin/Rival for logged-in users. |
| **`PHASE-34-STREAK-SYSTEM-NOTES.md`** | New: this documentation. |

---

## 7. Remaining Addiction-System Opportunities (Next Step)

- **Streak decay / break:** Explicit "your streak broke" message when user had a streak and then went 14+ days without participating; could trigger re-engagement notification.
- **Larger milestones:** 25, 50, 100 for power users; optional badges or one-time rewards.
- **Cross-tournament vs per-tournament:** Current streak is global (all tournaments). Per-tournament or per-type streaks could add variety (e.g. "3 לוטו ברצף").
- **Integration with Near Win / Rival:** Combine copy when multiple engines fire (e.g. "רצף 4 + אתה רק נקודה מהמקום הראשון").
- **A/B test messaging:** Test "אל תשבור את הרצף" vs "שמור על הרצף" vs "עוד השתתפות אחת לרצף 5" emphasis.
- **Notifications:** Optional push/email when user is 1 away from next milestone or when streak might break (e.g. "לא השתתפת 10 ימים – הרצף שלך עלול להישבר").
