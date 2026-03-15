# Deprecated: Old Finance Reports (replaced by settlement reports)

The **old** financial reports system (FinanceSection – tournaments/agents/players/global/general with full analytics) is **deprecated** but **not removed**.

## Current state

- **Admin panel**: The finance nav item now shows **"דוחות settlement"** and renders **SettlementReportsSection** – a simple settlement-based UI (Player / Agent / Global reports, Result = Wins − Bets − Commission, CSV export).
- **Old UI**: `FinanceSection.tsx` is no longer rendered; it remains in the codebase for reference.

## Why

A new reporting system will be designed and implemented from scratch. Hiding the old UI avoids breaking financial visibility during the transition. Once the new system is fully implemented and validated, the old one (this UI + backend) can be removed.

## Do not

- **Do not** delete `FinanceSection.tsx`, report procedures in `routers.ts`, or report services in `server/finance/` until the new system replaces them.
- **Do not** remove the deprecation notice or the hidden nav/section without a decision to either revert or complete the migration.

## Restoring the old UI (temporary)

To show the old reports again: in `AdminPanel.tsx`, uncomment the finance nav item and replace the `section === "finance"` block with `<FinanceSection onBack={...} />` again.
