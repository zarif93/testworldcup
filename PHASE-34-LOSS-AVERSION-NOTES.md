# Phase 34 Step 5: Loss Aversion / Don't Miss Out Engine – Implementation Notes

## Summary

This step adds a **Loss Aversion / FOMO Engine** that creates urgency and fear-of-missing-out messaging to motivate users to act before they lose the opportunity. Messages are shown **only** when the tournament is still joinable (OPEN or LOCKED) and the user has **not** yet submitted to this tournament. Additive only; no tournament or scoring logic changes.

---

## 1. Logic Implemented

| Condition | Type | Message |
|-----------|------|---------|
| Tournament not found or status not OPEN/LOCKED | `none` | (banner not shown) |
| User already has at least one submission for this tournament | `none` | (banner not shown) |
| closesAt in the past or missing | `none` | (banner not shown) |
| **A.** Time to close ≤ 1 hour | `closing_now` | "נשאר פחות משעה להיכנס" |
| **B.** Time to close ≤ 24 hours | `closing_today` | "התחרות נסגרת היום" |
| **C.** Participant count ≥ 15 | `social_fomo` | "אחרים כבר בפנים – אל תישאר בחוץ" |
| **D.** User has streak ≥ 2 (from getParticipationStreak) | `momentum_risk` | "אל תפספס את ההזדמנות שלך" |
| **E.** Else | `generic` | "אם לא תשלח עכשיו, התחרות תיסגר" or "אל תפספס את ההזדמנות שלך" |

**Priority:** A → B → C → D → E. First matching condition wins.

**Data used**

- Tournament: `getTournamentById` for status and `closesAt`.
- User participation: `getSubmissionsByUserAndTournament(userId, tournamentId)`; if length > 0 → none.
- Participant count: `getSubmissionsByTournament(tournamentId).length`.
- Streak: `getParticipationStreak(userId)` for momentum_risk when streakCount ≥ 2.

---

## 2. API and Component Added

| Item | Description |
|------|-------------|
| **Backend** | `getLossAversionMessage(userId, tournamentId)` in `server/db.ts`. Returns `{ message, type }`. |
| **API** | `tournaments.getLossAversionMessage` tRPC endpoint (protected), input `{ tournamentId: number }`. |
| **Frontend** | `<LossAversionBanner tournamentId={...} />` in `client/src/components/LossAversionBanner.tsx`. Renders only when `type !== "none"` and message present. Uses `staleTime: 30_000`. |

---

## 3. Where the Banner Appears

| Location | When shown |
|----------|------------|
| **Home** | Logged-in user when tournament context exists (`nearWinTournamentId`): below NearWin, Rival, Streak, PositionDrama. API returns none if user already participated, so banner hides automatically. |
| **Leaderboard** | Logged-in user when `leaderboardTournamentId` exists: in same block as NearWin, Rival, PositionDrama. Only when there is a FOMO message (user has not participated). |
| **Prediction page** | Logged-in user on `/predict/:id` when tournament is not locked: above form. Banner shows only when user has not yet submitted (API returns none after first submission). |
| **Tournament cards** | Not implemented in this step to avoid N parallel queries; one FOMO banner per context (Home/Leaderboard/predict) is used instead. |

---

## 4. UX (Colors and Copy)

| Type | Color | Copy |
|------|--------|------|
| `closing_now` | Red | "נשאר פחות משעה להיכנס" |
| `closing_today` | Amber | "התחרות נסגרת היום" |
| `social_fomo` | Violet | "אחרים כבר בפנים – אל תישאר בחוץ" |
| `momentum_risk` | Violet (darker) | "אל תפספס את ההזדמנות שלך" |
| `generic` | Amber | "אם לא תשלח עכשיו, התחרות תיסגר" / "אל תפספס את ההזדמנות שלך" |

Compact banner with AlertCircle icon; short Hebrew copy; mobile-friendly.

---

## 5. Cache and Performance

| Layer | Behavior |
|-------|----------|
| **Backend** | In-memory cache per `userId-tournamentId`, TTL 30s. Lightweight: one `getTournamentById`, one `getSubmissionsByUserAndTournament`, then optionally `getSubmissionsByTournament` (for count) and `getParticipationStreak` (for momentum_risk). |
| **Client** | `staleTime: 30_000` on `tournaments.getLossAversionMessage` query. |

---

## 6. Files Changed

| File | Changes |
|------|---------|
| **`server/db.ts`** | `getLossAversionMessage`, types `LossAversionType` / `LossAversionResult`, `lossAversionCache` (30s), `closesAtToMs` helper, constants ONE_HOUR_MS, ONE_DAY_MS, SOCIAL_FOMO_THRESHOLD (15). |
| **`server/routers.ts`** | Import `getLossAversionMessage`; `tournaments.getLossAversionMessage` protected procedure with `tournamentId` input. |
| **`client/src/components/LossAversionBanner.tsx`** | New: banner only when type is not none and message present; styles by type; AlertCircle icon. |
| **`client/src/pages/Home.tsx`** | Import LossAversionBanner; render below PositionDrama when `nearWinTournamentId` exists. |
| **`client/src/pages/Leaderboard.tsx`** | Import LossAversionBanner; render in same block as other banners when `leaderboardTournamentId` exists. |
| **`client/src/pages/PredictionForm.tsx`** | Import LossAversionBanner; render above form when authenticated, validId > 0, and tournament not locked. |
| **`PHASE-34-LOSS-AVERSION-NOTES.md`** | New: this documentation. |

---

## 7. Remaining Addiction-System Opportunities (Next Step)

- **Tournament cards:** Show a small FOMO line or badge on each card (e.g. "נסגר בעוד X שעות") with a single batched or per-card query; consider only for visible cards to limit requests.
- **Near-win + FOMO:** When user has near_win/top in another tournament and has not joined this one, combine messaging ("אתה קרוב לראש הדירוג – היכנס גם לתחרות הזו").
- **Countdown in banner:** Show remaining time in the closing_now / closing_today banner (e.g. "נשאר 45 דקות").
- **A/B copy:** Test "אל תפספס" vs "ההזדמנות נסגרת" vs "אחרונים נכנסים עכשיו".
- **Push/email:** Notify when a tournament the user viewed but did not join is closing in &lt; 1 hour (requires storing "viewed" or "dismissed").
- **Rate limit visibility:** Avoid showing FOMO on every page load; e.g. show at most once per session per tournament or cap frequency so it feels urgent but not spammy.
