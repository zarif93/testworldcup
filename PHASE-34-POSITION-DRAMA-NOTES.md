# Phase 34 Step 4: Drama / Position Change Engine – Implementation Notes

## Summary

This step adds a **Position Drama Engine** that creates emotional movement based on leaderboard position changes. Users see short messages when their rank moves up, down, or when they enter/leave the top 3 or top 5 (e.g. "עלית למקום 2", "ירדת למקום 5", "נכנסת לטופ 3", "יצאת מהטופ 5", "מישהו עקף אותך"). Lightweight in-memory snapshot of last known rank only; no persistent history. Additive only; no scoring or leaderboard logic changes.

---

## 1. Drama Logic Implemented

| Condition | Type | Message |
|-----------|------|---------|
| Current ≤ 3 and previous > 3 | `entered_top` | "נכנסת לטופ 3" |
| Current ≤ 5 and previous > 5 (and not entered top 3) | `entered_top` | "נכנסת לטופ 5" |
| Current > 3 and previous ≤ 3 | `dropped_top` | "יצאת מהטופ 3" |
| Current > 5 and previous ≤ 5 (and not dropped top 3) | `dropped_top` | "יצאת מהטופ 5" |
| Delta > 0 (rank improved) | `move_up` | "עלית למקום X" |
| Delta < 0 and current ≤ 5 | `move_down` | "ירדת למקום X" |
| Delta < 0 and current > 5 | `move_down` | "מישהו עקף אותך" |
| Delta === 0 | `stable` | (banner not shown) |
| No previous snapshot | `none` | (banner not shown) |

**Definitions**

- **Current rank:** From same leaderboard as Rival/Near Win (`getLeaderboardRowsForRival`), index + 1 for the user.
- **Previous rank:** In-memory `lastKnownRankCache` keyed by `userId-tournamentId`. No persistent storage; first call for a user+tournament returns `none` and stores current rank for next time.
- **Delta:** `previousRank - currentRank` (positive = moved up).
- **Priority:** entered_top (top 3 then top 5) and dropped_top (top 3 then top 5) are evaluated first; then move_up / move_down.

---

## 2. API and Component Added

| Item | Description |
|------|-------------|
| **Backend** | `getPositionDrama(userId, tournamentId)` in `server/db.ts`. Returns `{ message, type, currentRank, previousRank, delta? }`. |
| **API** | `leaderboard.getPositionDrama` tRPC endpoint (protected), input `{ tournamentId: number }`. |
| **Frontend** | `<PositionDramaBanner tournamentId={...} />` in `client/src/components/PositionDramaBanner.tsx`. Renders **only** when `type` is `move_up` \| `move_down` \| `entered_top` \| `dropped_top`; hides for `stable` and `none`. Uses `staleTime: 30_000`. |

---

## 3. Where the Banner Appears

| Location | When shown |
|----------|------------|
| **Home** | Logged-in user when tournament context exists: below NearWin, Rival, Streak. Only when there is meaningful movement (component returns null for stable/none). |
| **Leaderboard** | Logged-in user when `leaderboardTournamentId` exists: in same block as NearWin and Rival, above Streak. Only when there is meaningful movement. |

---

## 4. UX (Colors and Copy)

| Type | Color | Copy |
|------|--------|------|
| `move_up` | Green (emerald) | "עלית למקום X" |
| `move_down` | Red/orange (amber) | "ירדת למקום X" or "מישהו עקף אותך" |
| `entered_top` | Violet | "נכנסת לטופ 3" / "נכנסת לטופ 5" |
| `dropped_top` | Gold/amber (darker) | "יצאת מהטופ 3" / "יצאת מהטופ 5" |

Compact banner with TrendingUp icon; mobile-friendly; short copy.

---

## 5. Cache and Performance

| Layer | Behavior |
|-------|----------|
| **Backend** | (1) **Result cache:** 30s TTL per `userId-tournamentId` so we don’t recompute or overwrite "previous" on every request. (2) **Last-known rank:** In-memory `lastKnownRankCache`; updated only when we compute drama (after cache miss). No DB writes; no persistent history. |
| **Client** | `staleTime: 30_000` on `leaderboard.getPositionDrama` query. |

Rank comes from existing `getLeaderboardRowsForRival` (same data as Rival/Near Win); no extra heavy leaderboard work.

---

## 6. Files Changed

| File | Changes |
|------|---------|
| **`server/db.ts`** | `getPositionDrama`, types `PositionDramaType` / `PositionDramaResult`, `positionDramaResultCache` (30s), `lastKnownRankCache` (persistent in-memory for snapshot), logic for move_up / move_down / entered_top / dropped_top / stable / none. |
| **`server/routers.ts`** | Import `getPositionDrama`; `leaderboard.getPositionDrama` protected procedure with `tournamentId` input. |
| **`client/src/components/PositionDramaBanner.tsx`** | New: banner only when type is move_up, move_down, entered_top, dropped_top; styles by type; TrendingUp icon. |
| **`client/src/pages/Home.tsx`** | Import PositionDramaBanner; render below Streak when `nearWinTournamentId` exists. |
| **`client/src/pages/Leaderboard.tsx`** | Import PositionDramaBanner; render in same block as NearWin/Rival when `leaderboardTournamentId` exists. |
| **`PHASE-34-POSITION-DRAMA-NOTES.md`** | New: this documentation. |

---

## 7. Remaining Addiction-System Opportunities (Next Step)

- **Persistent rank history:** Store last N ranks or timestamps in DB to detect "עלית 3 מקומות" or "חזרת לטופ 5 אחרי X ימים" and to survive server restarts.
- **Time-based drama:** "לא עלית מקום מזה X ימים" or "אתה במקום X כבר Y תחרויות" for habit reinforcement.
- **Combined copy:** When both drama and rival fire (e.g. "עלית למקום 2 – דוד123 רק נקודה מתחתיך").
- **Push/email:** Notify when someone overtakes you ("מישהו עקף אותך – השתתף כדי לחזור") or when you enter top 3.
- **A/B test:** "מישהו עקף אותך" vs "ירדת מקום" vs "תחזור לדירוג" for move_down.
- **Top 10 / top 1:** Optional "נכנסת למקום הראשון" or "יצאת מהמקום הראשון" for extra drama.
