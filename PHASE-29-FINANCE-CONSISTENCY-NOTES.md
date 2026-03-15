# Phase 29: Finance Consistency / Payment-to-Accounting Integration

This document describes how the payment transaction layer is connected to the existing finance/accounting logic: business rules, idempotency, reporting implications, and backward compatibility.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `server/db.ts` | **Phase 29:** Added `updatePaymentMetadata(paymentId, metadataPatch)` to merge metadata (including `accounting` sub-object). Added `applyPaymentAccountingWhenPaid(paymentId, performedBy?)` (idempotent): when entry_fee is marked paid, if not yet accounted then deduct points (or record as external), create transparency log Deposit, agent commission if applicable, set metadata `accounting.accountedAt` and `accountingType` (points_deducted \| external). Added `applyRefundAccountingWhenRefunded(paymentId, performedBy?)` (idempotent): when payment is marked refunded, if not yet refunded then credit points when accountingType was points_deducted, create transparency log Refund, set metadata `accounting.refundedAt`. Extended `updatePaymentTransactionStatus` to accept `options?: { paidAt?: Date; performedBy?: number }`, and to call `applyPaymentAccountingWhenPaid` when status becomes paid and `applyRefundAccountingWhenRefunded` when status becomes refunded. `getPaymentTransactions` now returns `metadataJson` for each row. |
| `server/routers.ts` | `approveSubmission`: pass `{ performedBy: ctx.user!.id }` when calling `updatePaymentTransactionStatus(..., "paid")`. `updatePaymentTransactionStatus` mutation: pass `{ performedBy: ctx.user!.id }`; after success, when status is paid or refunded, send notifications (admin + user) via `PAYMENT_MARKED_PAID` / `PAYMENT_REFUNDED`. |
| `server/notifications/types.ts` | Added `PAYMENT_MARKED_PAID`, `PAYMENT_REFUNDED` to `NOTIFICATION_TYPES`. |
| `client/src/components/admin/PaymentsSection.tsx` | Added column "חשבונאות" (accounting) showing `points_deducted` as "נקודות", `external` as "חיצוני", or "—". Uses `metadataJson.accounting.accountingType` from list response. |
| **PHASE-29-FINANCE-CONSISTENCY-NOTES.md** | This document. |

---

## 2. Business Rules Implemented

- **Entry fee marked paid**
  - **If not yet accounted** (no `metadata.accounting.accountedAt`):
    - Try to **deduct** user points (participation) for the payment amount. If deduction succeeds:
      - Create **point_transaction** (actionType `participation`) and ledger entry.
      - Create **financial_transparency_log** row (type `Deposit`) with site/agent profit split.
      - If submission has an agent and no commission yet: **record agent commission** and log `Commission` in transparency log.
      - Set payment metadata `accounting.accountedAt` (ISO timestamp) and `accounting.accountingType = "points_deducted"`.
    - If deduction **fails** (insufficient balance):
      - Still create **financial_transparency_log** row (type `Deposit`) so income is visible in reporting (external/cash payment).
      - Set `accounting.accountedAt` and `accounting.accountingType = "external"`. No point movement.
  - **If already accounted** (`metadata.accounting.accountedAt` present): do nothing (idempotent).

- **Payment marked failed**
  - Only submission `paymentStatus` is set to `failed`. No point or transparency changes. No accounting metadata.

- **Payment marked refunded**
  - **If not yet refunded** (no `metadata.accounting.refundedAt`):
    - If `accountingType === "points_deducted"`: **add** user points (actionType `refund`), create point_transaction and ledger.
    - Always create **financial_transparency_log** row (type `Refund`) for traceability.
    - Set payment metadata `accounting.refundedAt` (merge with existing accounting).
  - **If already refunded**: do nothing (idempotent).

- **Approve submission (existing flow)**
  - When a submission with a linked payment is approved, the payment is set to paid with `performedBy`; the same accounting logic runs once (idempotent if already accounted).

- **Only entry_fee**
  - Accounting (deduct, transparency, commission) runs only for payment type `entry_fee`. Other types (payout, deposit, withdrawal, refund, manual_adjustment) are not auto-accounted on status change.

---

## 3. Finance / Payment Integration Points

- **Mark paid (Payments section or Approve):** `updatePaymentTransactionStatus(id, "paid", { performedBy })` → updates payment and submission → `applyPaymentAccountingWhenPaid` → deduct (or external) + transparency + optional commission + metadata.
- **Mark refunded:** `updatePaymentTransactionStatus(id, "refunded", { performedBy })` → `applyRefundAccountingWhenRefunded` → credit points when applicable + transparency Refund + metadata.refundedAt.
- **Transparency log:** All paid entry_fees produce a `Deposit` row; all refunds produce a `Refund` row. Existing reporting (e.g. `getTransparencySummary`) sums these; no formula changes.
- **Point transactions:** Participation (debit) and refund (credit) use existing `deductUserPoints` / `addUserPoints` and ledger; PnL/reporting that uses point_transactions and transparency log stays consistent.

---

## 4. Idempotency Protections

- **Payment marked paid:** Guarded by `metadata.accounting.accountedAt`. If present, `applyPaymentAccountingWhenPaid` returns without creating any transaction or log. Re-running "mark paid" does not double-deduct or double-log.
- **Payment marked refunded:** Guarded by `metadata.accounting.refundedAt`. If present, `applyRefundAccountingWhenRefunded` returns without crediting or adding another Refund log.
- **Metadata merge:** `updatePaymentMetadata` merges the `accounting` object so existing `accountedAt` / `accountingType` are preserved when adding `refundedAt`.

---

## 5. Reporting / PnL Implications

- **No changes to report formulas.** PnL and finance reports continue to use `point_transactions`, `financial_records`, and `financial_transparency_log` as before.
- **Additive effect:** When an entry_fee is marked paid, a `Deposit` is added to the transparency log (and optionally a participation point_transaction). When a payment is marked refunded, a `Refund` is added (and optionally a refund point_transaction). So:
  - Income and refund totals in transparency summary include these flows.
  - Participation- and refund-based PnL stay consistent with actual point movements and log entries.
- **Traceability:** Payment records carry `metadata.accounting.accountingType` (points_deducted vs external) and `refundedAt` so admins can see how each payment was accounted for.

---

## 6. Backward Compatibility

- **Existing submissions/tournaments:** Unchanged. Submissions without a payment_transactions row are unaffected; approval still only updates submission and (if a payment row exists) payment status and accounting.
- **Existing approval flow:** Unchanged; only added passing `performedBy` and the same accounting path when the linked payment is set to paid.
- **MySQL:** Payment and accounting helpers are SQLite-only (USE_SQLITE guards). On MySQL, no payment_transactions table or accounting runs; behavior is unchanged from Phase 28.
- **Old payment rows:** Payments created before Phase 29 have no `accounting` metadata. When marked paid, they are accounted once and get metadata. When marked refunded, `accountingType` is treated as `external` (transparency Refund only, no point credit) unless metadata was set by a prior paid run.

---

## 7. Remaining Limitations

- **SQLite only:** Accounting and metadata updates run only when USE_SQLITE; no MySQL implementation.
- **Single payment per submission:** Logic assumes at most one payment row per submission (current design). If multiple payment rows were linked to the same submission, each would be accounted independently; business rules should avoid that.
- **External refunds:** Refunds for payments that were recorded as `external` do not credit points (by design). Reversing an external payment is only reflected in the transparency log.
- **No reversal of commission on refund:** When a refund is issued, user balance is credited but agent commission is not automatically reversed. Future work could add commission reversal if required.
- **Notifications:** Sent only when status is updated via the admin `updatePaymentTransactionStatus` mutation (Payments section). Approve flow does not send PAYMENT_MARKED_PAID (it sends SUBMISSION_APPROVED as before).

---

Phase 29 finance consistency and payment-to-accounting integration is complete as specified: payment status changes are aligned with financial records, refunds and paid states are financially meaningful, and PnL/reporting remain consistent with additive, idempotent behavior.
