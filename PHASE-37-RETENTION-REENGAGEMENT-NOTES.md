# PHASE 37: Retention & Re-engagement Engine – Implementation Notes

This phase focuses on bringing users back after first participation and increasing repeat participation. No changes were made to admin, scoring, payment, automation core, or competition mechanics.

---

## 1. Files changed

| File | Change |
|------|--------|
| `server/routers.ts` | **user.getFirstParticipationStatus**: Now returns `approvedCount` (number of approved submissions) in addition to `hasApprovedSubmission`. Used for "continue momentum" vs "come back" copy. |
| `client/src/components/ReengagementBlock.tsx` | **New component.** Phase 37 re-engagement block: combines streak / near-win / rival into one compact card. Shows headline by `approvedCount` (2+ → "אל תעצור עכשיו – המשך את המומנטום", 1 → "חזרת? בוא תמשיך – יש לך עוד מה להשיג"), first available signal message, and one primary CTA to recommended tournament + "בחר תחרות אחרת" link. Uses existing trpc: getParticipationStreak, getNearWinMessage, getRivalStatus. Mobile-friendly (min-h 48px, touch-target). |
| `client/src/pages/Home.tsx` | Import **ReengagementBlock**. When authenticated and **returning user** (`firstParticipation.hasApprovedSubmission`) and tournaments exist, render **ReengagementBlock** with `nearWinTournamentId`, recommended tournament id/name, and `approvedCount`. Placed above ThreeStepsTrustStrip, mutually exclusive with first-participation block. |
| `client/src/pages/Leaderboard.tsx` | Use **setLocation** from useLocation. For **authenticated** users, after existing banners (NearWin, Rival, PositionDrama, LossAversion, Streak), add compact **Phase 37 strip**: "המשך את המומנטום –" + button "הצטרף לתחרות נוספת" → `/tournaments`. Single CTA, mobile tap target. |

---

## 2. Retention gaps identified

- **Returning users had no dedicated surface:** Home showed first-participation block only for new users; returning users saw the same grid and scattered banners (NearWin, Rival, Streak, etc.) with no single "come back" moment.  
  **Addressed:** ReengagementBlock for returning users with one combined message and one CTA.

- **No "next best" action for return visits:** No clear "join this tournament next" for users who had already participated.  
  **Addressed:** Same recommended tournament logic (first OPEN) used for re-engagement CTA; single primary button to `/predict/{id}`.

- **Streak / near-win / rival were separate:** Multiple banners could feel noisy and no single action.  
  **Addressed:** One block that surfaces the first available signal (streak → near-win → rival) and one CTA.

- **Leaderboard had no re-engagement CTA:** After viewing leaderboard, users were not prompted to join another competition.  
  **Addressed:** Compact "המשך את המומנטום – הצטרף לתחרות נוספת" strip with button to `/tournaments`.

- **No distinction between 1 vs 2+ participations:** Copy did not reinforce "don’t stop now" for repeat participants.  
  **Addressed:** `approvedCount` from API; headline and CTA label differ for 2+ ("אל תעצור עכשיו", "הצטרף לתחרות נוספת") vs 1 ("חזרת? בוא תמשיך", "הצטרף לתחרות").

---

## 3. Re-engagement mechanisms added

- **Returning-user detection:** Reuse of Phase 36 `getFirstParticipationStatus`; returning = `hasApprovedSubmission === true`. Extended with `approvedCount` for copy.
- **Single combined block on Home:** ReengagementBlock aggregates streak, near-win, and rival into one message and one primary CTA (recommended tournament).
- **Headline and CTA by participation count:** 2+ → "אל תעצור עכשיו – המשך את המומנטום" + "הצטרף לתחרות נוספת"; 1 → "חזרת? בוא תמשיך" + "הצטרף לתחרות".
- **Leaderboard reinforcement:** Logged-in users see a compact strip with one CTA to join another competition.
- **Safe fallbacks:** If no streak/near-win/rival message, block still shows headline + CTA. If no recommended tournament, block is not rendered (hasAny && recommendedTournament required).

---

## 4. Returning-user UX improvements

- **One clear action moment:** Returning users see one block (ReengagementBlock) with one primary button instead of five separate banners before the grid.
- **Personalized copy:** Headline and CTA text depend on `approvedCount` (momentum vs come-back).
- **Signal prioritization:** First non-empty message from streak, near-win, or rival is shown to avoid clutter.
- **Placement:** ReengagementBlock is above the tournament grid and above ThreeStepsTrustStrip, so it is visible without long scroll (above-the-fold where layout allows).
- **Existing banners unchanged:** NearWin, Rival, Streak, PositionDrama, LossAversion remain on Home and Leaderboard for users who scroll; re-engagement block adds a single, focused moment.

---

## 5. Mobile retention improvements

- **ReengagementBlock:** `min-h-[48px]` and `touch-target` on primary button; compact padding; single column.
- **Leaderboard strip:** `min-h-[40px]` and `touch-target` on "הצטרף לתחרות נוספת" button; flex-wrap for small screens.
- **One primary CTA:** No competing buttons in the block; secondary "בחר תחרות אחרת" is a text link.
- **Above-the-fold intent:** Block placed high on Home so returning mobile users see it without scrolling.

---

## 6. Remaining retention risks

- **No server-side re-engagement triggers:** No automated emails or push when a user has not joined current open tournaments or when streak is at risk. Phase 37 is in-app only.
- **Recommended tournament is generic:** Same logic as Phase 36 (first OPEN in list). No prioritization by "user has not joined this one" or by urgency/popularity for retention.
- **No explicit "users who joined before but not current open":** That segment is not computed; all returning users see the same block and same recommended tournament.
- **Refetch timing:** After a new submission, `approvedCount` may lag until refetch; copy could briefly show "חזרת?" instead of "אל תעצור" until cache updates.
- **Leaderboard CTA is generic:** Links to `/tournaments` only; no "recommended next" tournament on Leaderboard to avoid extra query and keep the page simple.

---

## Summary

Phase 37 is **additive only**. New/updated: `approvedCount` in `getFirstParticipationStatus`, new `ReengagementBlock` component, ReengagementBlock on Home for returning users, and a compact re-engagement strip on Leaderboard. Retention and re-engagement are improved via a single combined block, participation-based copy, and one clear CTA on Home and Leaderboard, with mobile-friendly targets and safe fallbacks.
