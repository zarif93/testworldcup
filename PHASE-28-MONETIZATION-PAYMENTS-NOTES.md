# Phase 28: Monetization / Payments / Business Launch Layer

This document describes the internal payment tracking layer added in Phase 28: structured payment transactions, admin payment management, and preparation for future gateway integrations. No external payment provider is integrated; all flows are manual/internal and production-usable.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `drizzle/schema-sqlite.ts` | Added `paymentTransactions` table: id, userId, tournamentId, submissionId, type, amount, currencyCode, status, provider, externalRef, notes, metadataJson, createdAt, updatedAt, paidAt. |
| `server/db.ts` | Raw SQL: `CREATE TABLE payment_transactions` in initSqlite. Registered `paymentTransactions` in getSchema. Added `createPaymentTransaction`, `getPaymentTransactions`, `getPaymentTransactionById`, `getPaymentBySubmissionId`, `updatePaymentTransactionStatus` (all SQLite-only). |
| `server/routers.ts` | Imports: createPaymentTransaction, getPaymentBySubmissionId, updatePaymentTransactionStatus, getPaymentTransactions, getPaymentTransactionById. On submit: when paymentStatus is pending, create payment_transaction (entry_fee, pending) after each runParticipationWithLock branch (chance, lotto, football_custom, default). On approveSubmission: after updateSubmissionPayment(completed), find payment by submission and set status paid. New admin procedures: listPaymentTransactions, getPaymentTransaction, updatePaymentTransactionStatus. |
| `client/src/components/admin/PaymentsSection.tsx` | **New.** Admin UI: list payment transactions, filters (status, type, tournamentId, userId), table with actions: Mark paid / Mark failed / Mark refunded. |
| `client/src/pages/AdminPanel.tsx` | Added `canViewSubmissions`, section "payments", nav item "תשלומים" (CreditCard icon), render PaymentsSection. |
| **PHASE-28-MONETIZATION-PAYMENTS-NOTES.md** | This document. |

---

## 2. Data Model Added

**Table: `payment_transactions` (SQLite)**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment. |
| userId | INTEGER NOT NULL | User who owns the payment. |
| tournamentId | INTEGER NOT NULL | Tournament (competition) context. |
| submissionId | INTEGER | Optional; links to submissions.id when payment is for an entry. |
| type | TEXT NOT NULL | entry_fee \| payout \| deposit \| withdrawal \| refund \| manual_adjustment. |
| amount | INTEGER NOT NULL | Amount in points (or currency units). |
| currencyCode | TEXT | Default "points". |
| status | TEXT NOT NULL | pending \| paid \| failed \| refunded \| cancelled. Default pending. |
| provider | TEXT | Default "manual"; reserved for future gateway name. |
| externalRef | TEXT | External reference (e.g. gateway transaction id). |
| notes | TEXT | Free-form notes. |
| metadataJson | TEXT (JSON) | Extra payload for extensions. |
| createdAt | INTEGER (timestamp) | Set on insert. |
| updatedAt | INTEGER (timestamp) | Set on update. |
| paidAt | INTEGER (timestamp) | Set when status becomes paid. |

- **Existing models unchanged:** `submissions.paymentStatus` (pending/completed/failed) and `point_transactions` / `financial_records` / `financial_transparency_log` are unchanged. Payment transactions are an additive audit/tracking layer.

---

## 3. Admin Payment UI Added

- **Location:** Admin → תשלומים (Payments). Visible to users with `submissions.view` (or super admin).
- **Features:**
  - List payment transactions with filters: status, type, tournament id, user id.
  - Table columns: id, userId, tournamentId, submissionId, type, amount, status, provider, createdAt, actions.
  - **Actions:** For status `pending`: buttons "שולם" (Mark paid) and "נכשל" (Mark failed). For status `paid`: button "החזר" (Mark refunded).
- **Behavior:** Mark paid/failed updates the payment record and, when the payment has a `submissionId`, syncs `submissions.paymentStatus` (paid → completed, failed → failed). Mark refunded only updates the payment record (submission stays completed).

---

## 4. Participation / Payment Flow Updates

- **Entry with pending payment:** When a user submits an entry and does not have enough points, the submission is created with `status: "pending"` and `paymentStatus: "pending"`. A `payment_transactions` row is created with `type: "entry_fee"`, `status: "pending"`, `provider: "manual"`, and `submissionId` set to the new submission id. This happens in all participation paths (chance, lotto, football_custom, default football).
- **Admin approve submission:** Existing flow unchanged. In addition, when the admin approves a submission, the server looks up a payment transaction by `submissionId`; if found, it sets that payment’s status to `paid` and `paidAt` to now. Submission `status` and `paymentStatus` are still set to approved and completed as before.
- **Admin marks payment (Payments section):** Admin can set a payment’s status to paid / failed / refunded / cancelled. For paid/failed, the linked submission’s `paymentStatus` is updated to completed/failed. Approval/rejection of the submission itself is unchanged; this only affects payment status and display.
- **Backward compatibility:** Submissions without a payment_transactions row (e.g. created before Phase 28 or when DB is not SQLite) are unchanged. Approve and markPayment(submission) still work; only the new payment table is updated when a matching row exists.

---

## 5. Reporting / PnL Integration

- **No formula or report logic changed.** PnL and finance reporting continue to use `point_transactions`, `financial_records`, and `financial_transparency_log` as before.
- **Additive tracking:** `payment_transactions` is used for payment lifecycle and admin visibility. It is not yet wired into PnL or financial report aggregates. Future work could cross-reference payment_transactions with point_transactions (e.g. by submissionId/tournamentId) for reconciliation.

---

## 6. Notification Integrations

- **Not added in this phase.** When payment is marked paid/failed/refunded from the Payments section, no new notification is sent. The existing “submission approved” flow still sends notifications when the admin uses Approve; that path also sets the related payment to paid. Optional future: notify user when payment is marked paid/failed/refunded (e.g. using existing notification types or a dedicated type) if it fits the product.

---

## 7. Future Payment Gateway Extension Points

- **Provider field:** `provider` is stored (default `"manual"`). A future integration can set e.g. `"stripe"` or `"paypal"` when creating/updating from a gateway.
- **External reference:** `externalRef` can store the gateway’s transaction or payment intent id for idempotency and reconciliation.
- **Status transitions:** Status flow is pending → paid | failed | refunded | cancelled. A gateway webhook can call a new procedure (e.g. `admin.recordPaymentGatewayResult`) that updates `payment_transactions` (and optionally `submissions.paymentStatus`) by `externalRef` or `id`.
- **Metadata:** `metadata_json` can hold gateway-specific payloads (e.g. receipt url, card last4) without schema change.
- **No gateway code:** No Stripe/PayPal/etc. is integrated; the design only reserves fields and flow for a later integration.

---

## 8. Backward Compatibility

- Existing tournaments and submissions behave as before. Existing manual approval and `markPayment` (submission-level) remain.
- With MySQL, payment_transactions table and procedures are not present; list/get/update return empty/false. No MySQL migration was added; Phase 28 is SQLite-only for payments.
- Submissions created before Phase 28 have no payment_transactions row; approve and markPayment still update only the submission.

---

## 9. Remaining Limitations

- **SQLite only:** Payment transactions table and all new db functions are implemented only for SQLite. On MySQL, admin Payments section will show no rows and status updates will no-op.
- **No automatic deduction on “mark paid”:** When an admin marks an entry_fee payment as paid, only the payment record and submission.paymentStatus are updated; points are not deducted. The current business rule is that approval/payment can be recorded without deducting points (e.g. external/cash payment). If you later want deduction on “mark paid,” it can be added in one place (e.g. in updatePaymentTransactionStatus or in the router).
- **Refunded:** Marking a payment as refunded does not create a point_transactions refund or adjust user balance; it only updates the payment record. Refund logic can be added later if needed.
- **No notifications** for payment status changes from the Payments section.
- **Reporting:** Payment_transactions are not yet aggregated in PnL or financial reports; they are for ops and future gateway use.

---

Phase 28 monetization/payments layer is complete as specified: internal payment tracking, admin payment management UI, and extension points for future gateways, without breaking existing competition, reporting, finance, or admin flows.
