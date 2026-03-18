# Jackpot – Manual QA Checklist

Use this after any Jackpot-related change to confirm trust, clarity, and conversion.

## 1. Enabled / disabled toggle
- [ ] Admin: Jackpot section has "ג׳קפוט פעיל" checkbox; toggling off saves and disables.
- [ ] Homepage: When disabled, main Jackpot banner and "איך עובד הג׳קפוט" are hidden; "הג׳קפוט כרגע מושבת" is shown.
- [ ] When disabled, logged-in users see short "הג׳קפוט כרגע מושבת" instead of progress widget.

## 2. Registration total breakdown
- [ ] Prediction/registration flow shows entry fee + (when enabled) jackpot contribution; total matches backend.
- [ ] When jackpot disabled, only entry fee is shown and charged.
- [ ] Displayed amounts match `getEntryCostBreakdown` (entryFee, jackpotContribution, total).

## 3. Refund display correctness
- [ ] Refund flow (e.g. cancel competition) shows/credits only entry fee amount (not jackpot contribution).
- [ ] User balance after refund matches expected (entry fee back; jackpot portion not refunded).

## 4. Homepage banner
- [ ] When enabled: banner shows pool amount, next draw countdown, ticket rule (e.g. ₪1000 = 1 ticket), contribution % if set.
- [ ] When draws exist: "הגרלה אחרונה" with date, winner, payout; optional previous winners line.
- [ ] "איך זה עובד" scrolls to details section.

## 5. Progress widget (logged-in, jackpot enabled)
- [ ] Ticket count is prominent (large number + "כרטיסים בהגרלה").
- [ ] "עוד X ₪" line is clear and motivating ("וכרטיס נוסף שלך בהגרלה" when close).
- [ ] Progress bar fills correctly toward next ticket (based on 7-day volume and ticket step).
- [ ] 7-day volume and next draw countdown match backend (`getJackpotProgress`).

## 6. Display values match backend
- [ ] All shown amounts (pool, payout, entry, jackpot contribution, 7-day volume, amount until next ticket) come from API; no hardcoded numbers that can drift from backend logic.

---

*Last updated: Jackpot trust/conversion phase.*
