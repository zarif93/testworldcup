# PHASE 38: Smart Tournament Recommendation Engine – Implementation Notes

This phase improves tournament recommendations so users are guided to the best next competition using urgency, popularity, and user state. No changes were made to scoring, payment, admin, automation, or competition mechanics.

---

## 1. Files changed

| File | Change |
|------|--------|
| `server/db.ts` | **getRecommendedTournamentForUser(userId)** – New helper. Returns `RecommendedTournamentResult` (tournamentId, reason, message, name, amount, type) or null. Filters to OPEN, not locked, user has not joined. Scoring order: (1) closing within 24h → reason `closing_soon`, (2) participants ≥ 10 → `popular`, (3) first participation (approvedCount === 0) → lowest amount → `first_easy_entry`, (4) else highest prizePool → `continue_momentum` (if returning) or `best_prize`, (5) fallback → `generic`. Cache 45s per user. **REASON_MESSAGES** map for Hebrew copy. |
| `server/routers.ts` | Import **getRecommendedTournamentForUser**. **tournaments.getRecommendedTournamentForUser** – protectedProcedure, returns result of getRecommendedTournamentForUser(ctx.user.id). |
| `client/src/pages/Home.tsx` | **Recommendation query** – trpc.tournaments.getRecommendedTournamentForUser (enabled when authenticated and tournaments exist, staleTime 45s). **recommendedId / recommendedDisplayName / recommendedMessage** – from API when present, else fallback to first OPEN in list and getTournamentDisplayName. **First-participation block** – uses recommendedId, recommendedDisplayName; subtitle = recommendedMessage or default "זה ההשתתפות הראשונה שלך?…". **Re-engagement block** – passes recommendedId, recommendedDisplayName, reasonMessage (recommendedMessage). typeLabel moved above recommendation block for display name from API. |
| `client/src/components/ReengagementBlock.tsx` | **reasonMessage** optional prop. Subtitle = reasonMessage ?? streak ?? nearWin ?? rival (recommendation reason takes precedence). |
| `client/src/pages/Leaderboard.tsx` | **Recommendation query** – getRecommendedTournamentForUser when authenticated (staleTime 45s). **CTA** – "הצטרף לתחרות נוספת" button goes to `/predict/${recommendation.tournamentId}` when recommendation exists, else `/tournaments`. Strip label shows recommendation.message when available. |
| `PHASE-38-RECOMMENDATION-ENGINE-NOTES.md` | This file. |

---

## 2. Recommendation logic implemented

- **Inputs:** userId; from DB: getTournamentPublicStats(true), getSubmissionsByUserId(userId). Approved count = number of approved submissions.
- **Joinable set:** status === "OPEN", !isLocked, tournament id not in user’s approved submission tournament IDs.
- **Priority (deterministic):**
  1. **closing_soon** – Any joinable tournament with closesAt in the next 24h; pick the one closing soonest.
  2. **popular** – If any has participants ≥ 10, pick the one with max participants.
  3. **first_easy_entry** – If approvedCount === 0, pick joinable with minimum amount (easiest entry).
  4. **continue_momentum / best_prize** – Pick joinable with max prizePool; reason = `continue_momentum` if approvedCount ≥ 1, else `best_prize`.
  5. **generic** – First joinable in list order.
- **Cache:** 45s per userId; no change to scoring/DB writes.

---

## 3. API added

- **tournaments.getRecommendedTournamentForUser** – protectedProcedure, no input. Returns:
  - `{ tournamentId, reason, message, name?, amount?, type? }` or `null`.
- **Reasons:** `closing_soon` | `popular` | `best_prize` | `continue_momentum` | `first_easy_entry` | `generic`.
- **message** – Hebrew string from REASON_MESSAGES for UI.

---

## 4. UI integrations updated

- **Home first-participation block:** Uses recommendedId and recommendedDisplayName for the CTA; subtitle is recommendedMessage when present, otherwise the previous default first-participation line.
- **Home re-engagement block:** Uses recommendedId, recommendedDisplayName, and reasonMessage; ReengagementBlock shows reasonMessage as the subtitle when provided.
- **Leaderboard:** Logged-in users get recommendation; CTA goes to recommended tournament when available, otherwise `/tournaments`; strip text uses recommendation.message when available.

---

## 5. Reason-based UX copy

| Reason | Message (Hebrew) |
|--------|------------------|
| closing_soon | נסגרת בקרוב – כדאי להצטרף עכשיו |
| popular | הרבה משתתפים כבר בפנים |
| best_prize | אחלה פרס – הצטרף עכשיו |
| continue_momentum | המשך את המומנטום שלך כאן |
| first_easy_entry | אחלה הזדמנות להשתתפות ראשונה |
| generic | הצטרף לתחרות |

One recommendation, one reason, one primary CTA in each surface; fallback to list-based recommendation when API returns null.

---

## 6. Remaining recommendation limitations

- **24h closing window** – "Closing soon" is fixed at 24h; no configurable threshold or "last hour" tier.
- **Popular threshold** – participants ≥ 10 is fixed; not tuned by tournament type or site size.
- **No "streak risk" tie-break** – User streak state is not passed into the recommender; we don’t explicitly prefer a tournament when the user is at streak risk.
- **Cache duration** – 45s is a single global; no per-reason or A/B tuning.
- **Hidden from homepage** – Recommendation uses getTournamentPublicStats (which uses getActiveTournaments), so hidden-from-homepage tournaments are already excluded; no separate "featured" list.
- **No A/B or analytics** – Recommendation and reason are not logged for conversion analysis.
- **First-load race** – If recommendation loads after the first-participation block renders, we may show list fallback first then switch to API recommendation (acceptable).

---

## Summary

Phase 38 is additive: new DB helper and cache, new protected API, and Home + Leaderboard + ReengagementBlock updated to use one smart recommendation with reason-based copy. Fallbacks preserve existing behavior when the API returns null or before it loads.
