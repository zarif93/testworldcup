# Phase 33: Growth & Viral Mechanics – Implementation Notes

## Summary

This phase added **engagement, participation, and organic growth** mechanics: live activity indicators, leaderboard teasers, post-submit shareable moments, and invite/referral flows. No changes to core business logic, payments, admin, or scoring.

---

## 1. Growth UX Gaps Addressed

- **No live feel:** Tournament data refetched every 10s with no “live” or “fresh” signal; users could not tell if counts were current.
- **Leaderboard under-exposed:** Leaderboard was in nav and footer but not surfaced in the main journey; no teaser on homepage or tournament list.
- **No shareable moment after submit:** After successful submission users were sent to home with only a toast; no CTA to view leaderboard or share.
- **Invite/referral underused:** Register accepted `referralCode` but there was no way for users to get an invite link; no “הזמן חברים” in nav.
- **No urgency beyond time:** We had countdown (Phase 32) but no “spots left” (would require API); no post-submit reinforcement.

---

## 2. Viral Opportunities Implemented

| Opportunity | Implementation |
|-------------|----------------|
| **Live activity** | Refetch tournament stats every 15s; show “חי” (live) indicator when data is &lt;20s old; pulse dot next to section title and in strip. |
| **Leaderboard teasers** | Home: strip “דירוג עכשיו – צפה בטבלה” above tournament grid. TournamentSelect: “צפה בטבלת הדירוג” link in “איך זה עובד” box. |
| **Shareable moment** | After submit success redirect to `/?submitted=1`; green banner “ההשתתפות נספרה!” with [צפה בדירוג] [שתף קישור] [סגור]. “צפה בדירוג” goes to `/leaderboard?justSubmitted=1`; Leaderboard shows dismissible “ההשתתפות נספרה – אתה בדירוג!”. |
| **Invite link** | Nav “הזמן חברים” (users/agents): copy `origin/register?ref={userId}` to clipboard and toast “קישור ההזמנה הועתק”. Register: on load read `ref` from URL and prefill referral code. |
| **Urgency** | Kept existing countdown and “closing soon” (Phase 32). “Spots left” not added (would need public API for maxParticipants). |

---

## 3. Files Changed

| File | Changes |
|------|---------|
| **`client/src/pages/Home.tsx`** | `refetchInterval` 15s; `dataUpdatedAt` / `isDataFresh`; “חי” when fresh; leaderboard strip “דירוג עכשיו – צפה בטבלה”; `?submitted=1` banner with [צפה בדירוג] [שתף קישור] [סגור]; `dismissSubmittedBanner` and `shareUrl`. |
| **`client/src/pages/PredictionForm.tsx`** | On submit success: `setLocation("/?submitted=1")` and toast “צפה בדירוג” (3 places: lotto, chance, football). |
| **`client/src/components/DynamicPredictionForm.tsx`** | On submit success: `setLocation("/?submitted=1")` and toast “צפה בדירוג”. |
| **`client/src/pages/Leaderboard.tsx`** | Read `justSubmitted=1` from URL; dismissible banner “ההשתתפות נספרה – אתה בדירוג!”. |
| **`client/src/pages/Register.tsx`** | `useEffect` to read `ref` from query and `setReferralCode(ref)`. |
| **`client/src/pages/TournamentSelect.tsx`** | “צפה בטבלת הדירוג” link in איך זה עובד box. |
| **`client/src/App.tsx`** | NavLinks: `user` type includes `id`; “הזמן חברים” button (Share2 icon) copies `origin/register?ref={user.id}` and toasts; `toast` import. |
| **`PHASE-33-GROWTH-VIRAL-NOTES.md`** | New: gaps, opportunities, files, triggers, mobile, risks. |

---

## 4. Psychological Triggers Added

- **Social proof / live:** “חי” and frequent refetch suggest others are active; leaderboard strip reinforces that ranking exists and is current.
- **Commitment + reward:** “ההשתתפות נספרה!” reinforces that the action counted; “אתה בדירוג” on Leaderboard reinforces inclusion.
- **Share / viral loop:** “שתף קישור” and “הזמן חברים” lower friction to share; invite link with `ref` enables attribution (backend may already use referralCode).
- **Scarcity/urgency:** Unchanged from Phase 32 (countdown, “נסגר בקרוב”). “Spots left” deferred (needs API).

---

## 5. Mobile Growth Improvements

- **Banner and buttons:** Submitted banner and [צפה בדירוג] [שתף קישור] are touch-friendly and wrap on small screens.
- **Leaderboard strip:** Full-width tap target “דירוג עכשיו – צפה בטבלה” above tournament grid.
- **Invite:** “הזמן חברים” in nav (and in mobile menu via same NavLinks); copy link works on mobile (clipboard API).
- **Register ref:** Prefill from URL works on mobile; share link can be opened in WhatsApp or other apps after copy.

---

## 6. Risks and Next Steps

**Risks**

- **Referral attribution:** Backend may treat `referralCode` as agent code only; passing `ref=userId` prefills the field but attribution logic is unchanged. Confirm with product whether ref should be agent code or any user id.
- **Clipboard on HTTP:** Some browsers restrict `navigator.clipboard` to secure context; fallback (e.g. prompt with URL) not implemented.
- **URL params persistence:** `?submitted=1` remains until user navigates or dismisses; if they refresh they see the banner again. Acceptable for Phase 33; could clear on next navigation if desired.
- **Live indicator accuracy:** “חי” is based on client `dataUpdatedAt`; refetch interval 15s so data can be up to 15s stale.

**Next steps (recommended)**

- **Phase 34 (candidate):** Add “spots left” when public API exposes `maxParticipants` and current participant count; optional “X הצטרפו השבוע” from analytics if available; A/B test invite link (ref=userId vs ref=code); add `prefers-reduced-motion` for live pulse if needed.

---

## What Was Not Changed

- Core business logic, payments, admin, scoring.
- Leaderboard data or calculation.
- Register/backend referral validation (only prefill and invite link copy on client).
