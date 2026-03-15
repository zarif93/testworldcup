# Phase 34 Step 6: Winner / Activity Social Proof Engine – Implementation Notes

## Summary

This step adds a **Social Proof Engine** that shows real aggregate stats to increase trust and conversion (e.g. "124 משתתפים השבוע", "3 זוכים קיבלו פרסים לאחרונה", "הטבלה מתעדכנת בזמן אמת", "הצטרפו היום 18 משתתפים"). Only real, public-safe data; no fabrication. Lightweight query with 45s cache. Additive only.

---

## 1. Logic Implemented

**When `tournamentId` is provided (tournament-level):**

| Data | Source | Message / use |
|------|--------|----------------|
| participantCount | Approved submissions for tournament | Shown as "X משתתפים" if not redundant with message |
| joinedToday | Submissions with createdAt in last 24h | Drives message "הצטרפו היום X משתתפים" when no weekly message |
| weeklyParticipants | Submissions with createdAt in last 7 days | Message "X השתתפו השבוע" or "הטבלה מתעדכנת בזמן אמת" |
| freshLeaderboard | Any submission updated in last 5 min or resultsFinalizedAt in last 24h | Exposed in summary (optional for future copy) |

**When `tournamentId` is omitted (global):**

| Data | Source | Message / use |
|------|--------|----------------|
| activeCompetitions | getActiveTournaments().length | "X תחרויות פעילות" |
| recentWinners | getFinancialRecords(from, to) sum of winnersCount, last 14 days | "X זוכים קיבלו פרסים לאחרונה" |
| message | Single combined message | One of the above or combined |

**Message priority (tournament):** If participantCount > 0 and weeklyParticipants > 0 → "X השתתפו השבוע" (or "הטבלה מתעדכנת בזמן אמת" if weeklyParticipants < 2). Else if participantCount > 0 → "הטבלה מתעדכנת בזמן אמת". Else if joinedToday > 0 → "הצטרפו היום X משתתפים".

**Message priority (global):** If activeCompetitions > 0 and recentWinners > 0 → "X זוכים קיבלו פרסים לאחרונה". Else if activeCompetitions > 0 → "X תחרויות פעילות". Else if recentWinners > 0 → "X זוכים קיבלו פרסים לאחרונה".

---

## 2. API and Component Added

| Item | Description |
|------|-------------|
| **Backend** | `getSocialProofSummary(tournamentId?: number \| null)` in `server/db.ts`. Returns `SocialProofSummary`: participantCount?, joinedToday?, weeklyParticipants?, recentWinners?, activeCompetitions?, freshLeaderboard?, message?. |
| **API** | `tournaments.getSocialProofSummary` public procedure, optional input `{ tournamentId?: number }`. |
| **Frontend** | `<SocialProofStrip tournamentId? className? />` in `client/src/components/SocialProofStrip.tsx`. Shows up to 3 proof points (message + numeric stats without duplicating numbers). Uses `staleTime: 45_000`. Renders nothing if no points. |

---

## 3. Where It Appears

| Location | When shown |
|----------|------------|
| **Home** | When there are tournaments (`hasAny`): global summary strip above the leaderboard teaser and tournament grid. |
| **Prediction page** | Tournament-level summary in header area (above the main form). |
| **TournamentSelect** | Global summary below the subtitle, above "איך זה עובד". |

---

## 4. UX

- Compact strip: rounded border, slate background, Users icon, 2–3 proof points joined by " · ".
- Hebrew copy only; no fabricated numbers.
- Mobile-friendly; trust-oriented.

---

## 5. Cache and Performance

| Layer | Behavior |
|-------|----------|
| **Backend** | In-memory cache per key: `social-${tournamentId}` or `social-global`, TTL 45s. Tournament-level: one getTournamentById, one getSubmissionsByTournament, in-memory filters. Global: getActiveTournaments(), getFinancialRecords({ from, to }) for last 14 days. |
| **Client** | `staleTime: 45_000` on `tournaments.getSocialProofSummary`. |

---

## 6. Files Changed

| File | Changes |
|------|---------|
| **`server/db.ts`** | `getSocialProofSummary(tournamentId?)`, type `SocialProofSummary`, `socialProofCache` (45s), `tsOf`, constants FRESH_LEADERBOARD_MS, ONE_DAY_MS, ONE_WEEK_MS, RECENT_WINNERS_DAYS_MS. |
| **`server/routers.ts`** | Import `getSocialProofSummary`; `tournaments.getSocialProofSummary` public procedure with optional `tournamentId`. |
| **`client/src/components/SocialProofStrip.tsx`** | New: strip with message + up to 2 more numeric points, dedupe by number, nothing if no data. |
| **`client/src/pages/Home.tsx`** | Import SocialProofStrip; render global strip above leaderboard teaser when hasAny. |
| **`client/src/pages/PredictionForm.tsx`** | Import SocialProofStrip; render tournament-level strip in header. |
| **`client/src/pages/TournamentSelect.tsx`** | Import SocialProofStrip; render global strip below subtitle. |
| **`PHASE-34-SOCIAL-PROOF-NOTES.md`** | New: this documentation. |

---

## 7. Remaining Addiction / Growth Opportunities (Next Step)

- **"מישהו בדיוק עלה למקום הראשון":** Would require real-time or recent leaderboard change events; could be approximated with a short-lived "last rank change" cache and a generic message when freshLeaderboard is true.
- **Weekly participation count (global):** Add a lightweight count of approved submissions in last 7 days (e.g. single aggregate query or background job) and expose "X משתתפים השבוע" globally.
- **Per-tournament recent winners:** If a tournament has recent financial record, show "X זוכים בתחרות הזו" on prediction page.
- **Live ticker:** Optional "הצטרפו עכשיו" style ticker when a new submission is created (would need subscription or short polling).
- **A/B copy:** Test "הטבלה מתעדכנת בזמן אמת" vs "דירוג חי" vs "משתתפים כעת".
- **Aria and trust:** Add optional `aria-label` summarizing the proof for screen readers.
