# Phase 34 Step 2: Rival System – Implementation Notes

## Summary

This step adds a **Rival System** that gives each user a sense of direct competition against nearby leaderboard rivals. Messages are emotional and short (e.g. "אתה רק נקודה מתחת ל־דוד123", "יוסי רק 2 נקודות מתחתיך", "אתה נאבק עכשיו על מקום 3"). No changes to scoring or existing leaderboard logic; additive only.

---

## 1. Rival Logic Implemented

| Condition | Type | Message examples |
|-----------|------|-------------------|
| User directly above is close (gap ≤ 3) | `rival_above` | "אתה רק X נקודות מתחת ל־[username]" (opportunity – green) |
| User directly below is close (gap ≤ 3) | `rival_below` | "[username] רק X נקודות מתחתיך" (pressure – red/orange) |
| Both above and below close | `battle_zone` | "אתה נאבק עכשיו על מקום N" (purple/amber) |
| No close rival | `generic` | "כל ניחוש טוב מקרב אותך בדירוג" |

**Logic details**

- Leaderboard is built the same way as Near Win (chance / lotto / football_custom / mondial); best points per user, sorted descending.
- **Above:** rank = current user rank − 1, gap = points of user above − current user points.
- **Below:** rank = current user rank + 1, gap = current user points − points of user below.
- "Close" = gap ≤ 3. When both above and below are close, we show `battle_zone`. When only one is close we show `rival_above` or `rival_below`; when rival below is very close (gap ≤ 1) we prefer pressure message.
- Return includes optional `rival: { id, username, rank, gap, direction: "above" \| "below" }`; only public info (username/rank/gap) is exposed.

---

## 2. API and Component Added

| Item | Description |
|------|-------------|
| **Backend** | `getRivalStatus(userId, tournamentId)` in `server/db.ts`. Returns `{ message, type, rival? } \| null`. |
| **API** | `leaderboard.getRivalStatus` tRPC endpoint (protected), input `{ tournamentId: number }`. |
| **Frontend** | `<RivalStatusBanner tournamentId={...} />` in `client/src/components/RivalStatusBanner.tsx`. Uses `trpc.leaderboard.getRivalStatus.useQuery` with `staleTime: 30_000`. |

---

## 3. Where the Banner Appears

| Location | When shown |
|----------|------------|
| **Home** | Logged-in user, when a tournament context exists (from URL `tournamentId` or first tournament in list). Rendered below NearWinBanner. |
| **Leaderboard** | Logged-in user, for first tournament in the active tab. Rendered below NearWinBanner in a `space-y-2` block. |
| **Prediction success** | Covered by redirect to Home with `?submitted=1&tournamentId=...`; both NearWin and Rival banners show on Home with that tournament. No separate success-only screen. |

---

## 4. UX (Colors and Copy)

| Type | Color | Copy style |
|------|--------|------------|
| `rival_above` | Green (emerald) | Opportunity: "אתה רק X נקודות מתחת ל־[name]" |
| `rival_below` | Orange (amber) | Pressure: "[name] רק X נקודות מתחתיך" |
| `battle_zone` | Purple (violet) | "אתה נאבק עכשיו על מקום N" |
| `generic` | Blue (sky) | "כל ניחוש טוב מקרב אותך בדירוג" |

Banner is compact (rounded border, padding, Swords icon), mobile-friendly, and uses `aria-live="polite"` for accessibility.

---

## 5. Cache and Performance

| Layer | Behavior |
|-------|----------|
| **Backend** | In-memory cache keyed by `rival-${userId}-${tournamentId}`, TTL 30 seconds. Same leaderboard data sources as `getNearWinMessage` (no extra heavy recomputation). |
| **Client** | `staleTime: 30_000` on `getRivalStatus` query so the banner does not refetch for 30s. |
| **Safety** | No private data beyond public username / rank / gap; no changes to scoring or leaderboard calculation. |

---

## 6. Files Changed

| File | Changes |
|------|---------|
| **`server/db.ts`** | `getLeaderboardRowsForRival`, `sortedRivalRowsFromRows`, `getRivalStatus`, types `RivalStatusType`, `RivalStatusResult`, rival cache (30s). |
| **`server/routers.ts`** | Import `getRivalStatus`; `leaderboard.getRivalStatus` protected procedure. |
| **`client/src/components/RivalStatusBanner.tsx`** | New: RivalStatusBanner component, styles by type, `getRivalStatus` query. |
| **`client/src/pages/Home.tsx`** | Import RivalStatusBanner; render below NearWinBanner when authenticated and tournamentId set. |
| **`client/src/pages/Leaderboard.tsx`** | Import RivalStatusBanner; render below NearWinBanner in `space-y-2` block. |
| **`PHASE-34-RIVAL-SYSTEM-NOTES.md`** | New: this documentation. |

---

## 7. Remaining Psychology Opportunities (Next Step)

- **"יוסי עקף אותך" (past tense):** Would require storing previous rank/position and comparing after each update; could be a small "last change" indicator (e.g. "עלית מקום!" / "יורד מקום") in a future step.
- **Personalization:** Use rival username more in CTAs (e.g. "עקוף את [name]" on prediction page) when `rival_above` is active.
- **Notifications:** Optional push/email when a rival overtakes you (e.g. "יוסי עקף אותך בדירוג – השתתף שוב!").
- **Streaks and near-win history:** Combine with Near Win engine (e.g. "פעמיים היית נקודה אחת מהמקום הראשון") for stronger engagement.
- **A/B copy:** Test alternative Hebrew phrases for pressure vs opportunity to optimize engagement.
