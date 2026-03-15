# Phase 30: Payment Reporting / Finance Visibility Upgrade

This document describes the payment-focused reporting, visibility, and traceability added in Phase 30. All changes are additive and read-only for business logic; no accounting or approval flows were modified.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `server/db.ts` | **Phase 30:** Added `getPaymentReportSummary()` (SQLite only): returns counts and amounts by status, type, provider, and accountingType; totalCount and totalAmount. Added `getPaymentTransactionDetail(paymentId)`: returns payment row plus linked submission, tournament, and user. Extended `getPaymentTransactions` opts with `provider?: string` filter. |
| `server/routers.ts` | Added admin procedures `getPaymentReportSummary` and `getPaymentTransactionDetail`. Extended `listPaymentTransactions` input with optional `provider`. |
| `server/analytics/dashboard.ts` | **Phase 30:** Extended `DashboardOverview` with payment summary fields: paymentPendingCount, paymentPaidCount, paymentRefundedCount, paymentFailedCount, paymentPaidAmount, paymentRefundedAmount, paymentPointsDeductedCount, paymentExternalCount. `getDashboardOverview()` now calls `getPaymentReportSummary()` and maps into these fields. |
| `client/src/components/admin/AnalyticsDashboardSection.tsx` | **Phase 30:** Added "תשלומים (סיכום)" section with cards: ממתינים, שולמו (count + amount), הוחזרו (count + amount), נכשלו, בנקודות, חיצוני. |
| `client/src/components/admin/PaymentsSection.tsx` | **Phase 30:** Summary cards at top from `getPaymentReportSummary` (total count, pending, paid, refunded, failed, points/external breakdown). Added filters: provider (dropdown from summary), accountingType (all / points_deducted / external / none, client-side). Added detail modal: "פרטים" (Eye) button per row opens Dialog with `getPaymentTransactionDetail` showing payment JSON (incl. accounting), linked submission, tournament, user. Refetch summary on status update. List limit increased to 200. |
| **PHASE-30-PAYMENT-REPORTING-NOTES.md** | This document. |

---

## 2. New Payment Reporting APIs / Helpers

- **getPaymentReportSummary()** (db, SQLite only)  
  Returns:
  - `countByStatus` / `amountByStatus` (pending, paid, failed, refunded, cancelled)
  - `countByType` / `amountByType` (entry_fee, payout, etc.)
  - `countByProvider` / `amountByProvider` (e.g. manual, future gateways)
  - `countByAccountingType` / `amountByAccountingType` (points_deducted, external, none from metadata)
  - `totalCount` / `totalAmount`

- **getPaymentTransactionDetail(paymentId)** (db, SQLite only)  
  Returns `{ payment, submission, tournament, user }` for a single payment (submission/tournament/user may be null).

- **listPaymentTransactions**  
  Extended with optional `provider` filter; existing filters (status, type, tournamentId, userId, limit, offset) unchanged.

---

## 3. Payments UI Improvements

- **Summary cards (top of Payments section):** Total records, pending (count + amount), paid (count + amount), refunded (count + amount), failed (count), and points_deducted / external counts.
- **Filters:** Status, type, **provider** (from summary), **accountingType** (all / נקודות / חיצוני / ללא, applied client-side), tournament id, user id.
- **Detail modal:** "פרטים" (Eye) on each row opens a dialog with full payment object (including metadata.accounting), linked submission (id, status, paymentStatus, username), tournament (id, name), and user (id, username/name).
- **Refetch:** Summary is refetched after payment status update so cards stay in sync.

---

## 4. Analytics / Finance Visibility Changes

- **Dashboard overview (getDashboardOverview):** Now includes payment summary fields from `getPaymentReportSummary()`: paymentPendingCount, paymentPaidCount, paymentRefundedCount, paymentFailedCount, paymentPaidAmount, paymentRefundedAmount, paymentPointsDeductedCount, paymentExternalCount.
- **Analytics dashboard section:** New "תשלומים (סיכום)" block with six cards: ממתינים, שולמו (count + amount), הוחזרו (count + amount), נכשלו, בנקודות (points_deducted count), חיצוני (external count). Uses the same overview so no extra API call.

---

## 5. Traceability Improvements

- **Payment → submission:** `getPaymentTransactionDetail` returns the submission row when `submissionId` is set; detail modal shows submission id, status, paymentStatus, username.
- **Payment → tournament:** Detail includes tournament id and name.
- **Payment → user:** Detail includes user id and username/name.
- **Accounting metadata:** Detail modal shows `metadata.accounting` (accountedAt, accountingType, refundedAt) so admins can see how the payment was accounted and whether it was refunded.
- **Provider / externalRef / notes:** Shown in the payment JSON in the detail modal.

---

## 6. Backward Compatibility

- **Existing flows:** No changes to Phase 29 accounting, approval, or payment status update logic. All new code is read-only reporting and UI.
- **MySQL:** `getPaymentReportSummary` and `getPaymentTransactionDetail` are SQLite-only and return empty/default when not SQLite; dashboard overview gets zero payment fields; Payments section summary cards and detail modal still render (with zeros or empty detail).
- **Existing APIs:** `listPaymentTransactions` and `getPaymentTransaction` unchanged except for optional `provider` and new procedures; clients that don’t pass `provider` behave as before.

---

## 7. Remaining Limitations

- **SQLite only:** Payment report summary and payment detail with links are implemented only for SQLite.
- **AccountingType filter:** Applied client-side after fetching the list (up to limit 200); not a server-side filter. Very large lists may not show all matching rows when filtering by accounting type.
- **No deep links:** Detail modal does not link to admin submission/tournament/user pages; copy IDs to navigate if needed.
- **Reporting scope:** Summary aggregates all payment_transactions; no date range or pagination for the summary. For large volumes, consider adding optional date filters or sampling in a future phase.

---

Phase 30 payment reporting and finance visibility work is complete as specified: payment visibility, reporting, and traceability are improved for admins without changing existing payment or finance logic.
