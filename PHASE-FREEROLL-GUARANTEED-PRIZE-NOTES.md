# Freeroll / Free Entry Guaranteed Prize – Implementation Notes

This document describes the implementation of **free-entry competitions with guaranteed prizes** (freerolls): entry fee = 0, guaranteed prize > 0, site-funded payouts.

---

## 1. Files Changed

### Server

| File | Changes |
|------|--------|
| `server/db.ts` | `createTournament`: allow `amount >= 0` (was `amount >= 1`). `doDistributePrizesBody`: pass `guaranteedPrizeAmount` into settlement; use `totalParticipation = 0`, `netProfit = -distributed` for freerolls in `insertFinancialRecord`. `getSettlementComparison`: pass `guaranteedPrizeAmount` to legacy/schema settlement. `getChanceLeaderboard`, `getLottoLeaderboard`, `getCustomFootballLeaderboard`: use `guaranteedPrizeAmount` as prize pool when > 0 (else calculated from entries). |
| `server/routers.ts` | Admin create competition input: `amount` validation changed from `z.number().int().min(1)` to `z.number().int().min(0)`. |
| `server/settlement/resolveSettlement.ts` | `TournamentRow` extended with `guaranteedPrizeAmount`. `resolveSettlement` reads `guaranteedPrizeAmount` from tournament; passes it to `legacySettlement` and `settleTournamentBySchema` options. `legacySettlement` and `getLegacySettlementResult` accept optional `guaranteedPrizeAmount`; when > 0, prize pool = guaranteed amount (not entry-based). |
| `server/settlement/settleTournamentBySchema.ts` | `settleTournamentBySchema` options extended with optional `guaranteedPrizeAmount`; when provided and > 0, `prizePoolTotal` = `guaranteedPrizeAmount` instead of `computePrizePool(participants, entryAmount)`. |

### Client

| File | Changes |
|------|--------|
| `client/src/pages/AdminPanel.tsx` | All competition create forms (chance, lotto, football, football_custom): amount input `min={0}`; `handleCreateTournament` allows `amount >= 0` and shows error "שם תחרות חובה; סכום חייב להיות 0 או יותר". When amount = 0 and guaranteed prize > 0, show admin text: "תחרות חינם עם פרס מובטח במימון האתר". |
| `client/src/components/admin/FreeCompetitionBuilder.tsx` | Amount input `min={0}`; validation allows `amountNum >= 0`; when amount = 0 and guaranteed > 0, show "תחרות חינם עם פרס מובטח במימון האתר". |
| `client/src/components/admin/CompetitionWizardBasicStep.tsx` | Entry cost input `min={0}` and title "0 = כניסה חינם (פרירול)". |
| `client/src/pages/Home.tsx` | Tournament cards: when `t.amount === 0` show "כניסה חינם"; when freeroll and prize > 0 show "פרס מובטח" next to prize. |
| `client/src/pages/TournamentSelect.tsx` | Same as Home: "כניסה חינם" when amount = 0; "פרס מובטח" when amount = 0 and prizePool > 0. |

**Note:** `PredictionForm.tsx` and `DynamicPredictionForm.tsx` already showed "חינם" when `entryCost === 0`; no change needed. Submission and payment flows already skip payment when cost is 0.

---

## 2. Where Free Entry (amount = 0) Is Allowed

- **DB:** `createTournament` accepts `amount` as a non-negative integer (`>= 0`). Rejects only `amount < 0` or non-integer.
- **API:** Admin `createTournament` input schema: `amount: z.number().int().min(0)`.
- **Admin UI:**
  - Chance create form
  - Lotto create form
  - Football (Mondial) create form
  - Football custom create form
  - Free Competition Builder (simple create dialog)
  - Competition Wizard basic step (entry cost field)
- **Validation:** No server or client validation requires `amount >= 1`. All relevant checks use `amount >= 0`.

---

## 3. How guaranteedPrizeAmount Is Used for Actual Payout (Not Just Display)

- **Display:** `getTournamentPublicStats` already used `guaranteedPrizeAmount` for `prizePool` when set; no change needed there.
- **Settlement / distribution:**
  1. **resolveSettlement** (in `server/settlement/resolveSettlement.ts`): Reads `guaranteedPrizeAmount` from the tournament object. Passes it into:
     - **legacySettlement:** When `guaranteedPrizeAmount > 0`, the legacy prize pool is set to that value instead of `submissions.length * entryAmount * 0.875`. So winner amounts and `distributed` are based on the guaranteed pool.
     - **settleTournamentBySchema** options: `guaranteedPrizeAmount` is passed in `options`.
  2. **settleTournamentBySchema:** If `options.guaranteedPrizeAmount` is present and > 0, `prizePoolTotal` = `guaranteedPrizeAmount`; otherwise `prizePoolTotal` = `computePrizePool(submissions.length, entryAmount)`. Distribution and winner prizes use this `prizePoolTotal`.
  3. **doDistributePrizesBody** (db): Loads tournament (including `guaranteedPrizeAmount`), passes it into `resolveSettlement`. Winners receive points via existing `addUserPoints`; the amount each winner gets is derived from the guaranteed pool when `guaranteedPrizeAmount > 0`.

So whenever a tournament has `guaranteedPrizeAmount > 0`, that value is the actual prize pool used for calculating per-winner amounts and total distributed, in both legacy and schema-based settlement.

---

## 4. Freeroll Finance / Accounting

- **Financial record (`insertFinancialRecord`):**
  - For freerolls (`totalParticipation === 0` and `distributed > 0`): `totalCollected` = 0, `totalParticipation` = 0, `siteFee` = 0, `totalPrizes` = distributed, `netProfit` = **-distributed** (site-funded). No entry revenue is recorded.
  - Participant snapshot still has `amountPaid: tAmount` (0 for freerolls) and `prizeWon` per winner.
- **Transparency:** Payouts are logged as usual; the financial record clearly shows zero entry revenue and negative net profit when the site funds the prize.
- **No fake entry revenue:** We do not create or imply entry-fee revenue when amount = 0.

---

## 5. Existing Paid Competition Behavior Unchanged

- **Paid competitions (`amount > 0`):** Validation, create flows, submission, deduction, settlement, and finance behave as before. When `guaranteedPrizeAmount` is not set or is 0, prize pool is still computed from entries (e.g. 87.5% of total entry amount in legacy).
- **Submission:** For cost > 0, payment/deduction and transactional participation logic unchanged. For cost = 0, existing behavior (no deduction, no payment transaction) is kept.
- **Refunds:** `refundTournamentParticipants` already returns early when `amount <= 0`; no change.
- **Leaderboards:** When `guaranteedPrizeAmount` is 0 or not set, prize pool is still `Math.round(subs.length * amount * 0.875)` for chance/lotto/custom football.

---

## 6. Remaining Limitations

- **Custom prize schemas:** If a competition uses a custom prize structure (e.g. fixed amounts per place), the integration with `guaranteedPrizeAmount` is through the same settlement path; custom schema logic must respect the passed `prizePoolTotal` (which is already set from guaranteed when applicable). No additional changes were required in the current codebase.
- **Reporting:** Any admin or agent reports that assume “total entry revenue = sum of entry fees” should treat freerolls as zero entry revenue; the financial record fields above support that.
- **Wizard validation:** The Competition Wizard may have other steps (e.g. settlement step) that assume a positive entry amount for display; if so, they might show 0 or “חינם” without further changes. No server-side wizard validation was changed beyond allowing amount ≥ 0 in the basic step.

---

## Summary

- **Free entry:** `amount = 0` is allowed in DB, API, and all listed admin/create flows.
- **Guaranteed prize:** When `guaranteedPrizeAmount > 0`, it is used as the **actual** prize pool for settlement and distribution, not only for display.
- **Freeroll safety:** No payment, no point deduction, no entry-fee refund logic for free-entry; submissions and approval flows unchanged.
- **Finance:** Freerolls are recorded with zero entry revenue and negative net profit (site-funded).
- **UX:** Admin sees "תחרות חינם עם פרס מובטח במימון האתר" when amount = 0 and guaranteed > 0; public sees "כניסה חינם" and "פרס מובטח" on cards and prediction hero where applicable.
