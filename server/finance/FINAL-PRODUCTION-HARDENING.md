# Final Production Hardening – Commission System

Engineering-grade verification. Treat as financial core audit.

---

## 1. Modified Files

| File | Change |
|------|--------|
| `server/finance/commissionService.ts` | `getCommissionBasisPoints` throws `MissingCommissionError` when `commissionPercentBasisPoints` is null/undefined; structured log via `logError`; removed legacy fallback (commissionPercent, houseFeeRate, 12.5). Removed default parameter from `computePlatformCommission`, `computePrizePool`, `computeCommissionFromEntry`. |
| `server/finance/constants.ts` | No change to `DEFAULT_COMMISSION_BASIS_POINTS`; it is used only as schema default (migration backfill) and in tests that pass explicit bps. Not used in runtime commission resolution. |
| `server/settlement/settleTournamentBySchema.ts` | `commissionBasisPoints` required in options (no `?? DEFAULT`). `computePrizePool` signature requires bps. |
| `server/settlement/resolveSettlement.ts` | Removed `DEFAULT_COMMISSION_BASIS_POINTS` import; `getLegacySettlementResult` and `legacySettlement` require `commissionBasisPoints` (no default). |
| `server/db.ts` | Removed `DEFAULT_COMMISSION_BASIS_POINTS` import. Removed `commissionPercentBasisPoints` from optionalCols (no runtime ALTER). Added startup check: if `tournaments.commissionPercentBasisPoints` missing, throw with message to run migration. `calcAgentCommission` requires `commissionBasisPoints`. Leaderboards (`getChanceLeaderboard`, `getLottoLeaderboard`, `getCustomFootballLeaderboard`) require tournament and call `getCommissionBasisPoints(tournament)` (throw if missing). |
| `server/finance/playerReportService.ts` | When `totalCommission === 0 && entryFee > 0`, loads tournament and uses `getCommissionBasisPoints(tournament)`; no `DEFAULT_COMMISSION_BASIS_POINTS`. |
| `server/finance/playerFinanceService.ts` | For ENTRY_FEE without `payload.commissionAmount`, loads tournament and uses `getCommissionBasisPoints` + `computeCommissionFromEntry(amt, bps)`. If tournament not found, logs and treats commission for that entry as 0 (no throw for orphan events). |
| `server/finance/finance-commission.test.ts` | Removed legacy fallback tests; added throw tests for missing commission. All compute* tests pass explicit bps. |
| `server/finance/commission-numerical-proof.test.ts` | Added large-scale cases A (10k×137, 17.5%), B (25k×59, 33.3%), C (3k×999, 8.75%) and rounding-consistency describe block. |
| `server/finance/generalFinanceReportService.ts` | **New.** Implements `getGeneralFinanceReport` from `getPlayerFinancialProfile` + `getAllUsers` for finance-report-validation tests. |
| `server/finance/finance-report-validation.test.ts` | No code change; now passes (uses `generalFinanceReportService`). |
| `server/prize-distribution-verification.test.ts` | All `settleTournamentBySchema` calls given explicit `commissionBasisPoints: 1250`. |
| `drizzle/migrations/sqlite-commission-basis-points.sql` | Documented as reference; canonical path is `npm run migrate:sqlite`. |
| `scripts/migrate-sqlite-commission.ts` | **New.** Idempotent migration: add column if missing, backfill NULLs to 1250. |
| `package.json` | Added script `migrate:sqlite`. |

---

## 2. Confirmation

- **No hardcoded commission math:** Commission is taken only from `tournament.commissionPercentBasisPoints` (DB/schema). No literal 12.5 or 1250 in calculation paths.
- **No silent defaults:** If a competition has no commission defined, `getCommissionBasisPoints` throws and logs. Runtime calculation never assumes 12.5%.
- **No runtime schema mutation for commission:** The column `commissionPercentBasisPoints` is no longer added in the optionalCols loop. Application fails at startup if the column is missing, with instruction to run `npm run migrate:sqlite` or apply the migration SQL.

---

## 3. Migration Safety

- **Fresh install:** Run `npm run migrate:sqlite` before first start (or ensure migration is applied). Startup check ensures column exists.
- **Migrated DB:** Column already present from previous optionalCols or from migration; backfill in migration script sets NULL → 1250.
- **Production snapshot:** Same as migrated DB; no runtime ALTER; backfill is deterministic (UPDATE ... WHERE commissionPercentBasisPoints IS NULL).
- **No runtime DB schema mutation** for commission; startup throws if schema is outdated.

---

## 4. Rounding Consistency

- **Rule:** `floorPoints` (Math.floor) everywhere; residue stays with platform.
- **Entry-level:** `computeCommissionFromEntry(entryAmount, bps)` = floor(entryAmount * bps / 10_000).
- **Aggregate:** `computePlatformCommission(totalPool, bps)` = floor(totalPool * bps / 10_000). Settlement and reports use this for total commission.
- **Agent share:** `computeAgentShare(commission, agentShareBps)` = floor(commission * agentShareBps / 10_000); remainder to platform.
- **Consistency:** prizePool + commission = totalCollected (exact). agentShare + platformShare = totalCommission (exact). Sum of per-entry commissions ≤ aggregate (floor per entry then sum); difference is residue retained by platform. No cumulative drift.

---

## 5. Financial Calculation Integrity Statement

Commission and prize calculations are fully determined by:

1. **Source of truth:** `tournaments.commissionPercentBasisPoints` (integer basis points). Set by schema default (1250) or explicit value; no runtime default.
2. **Formulas:** All use integer-safe operations with floor: `floor((amount * bps) / 10_000)`. Basis points are integers; amounts are points (integers).
3. **Settlement:** Prize pool = total collected − platform commission (same floor rule). Payouts and commission events use these values; idempotency keys prevent double application.
4. **Reporting:** Player and agent reports use the same `getCommissionBasisPoints(tournament)` and `computeCommissionFromEntry` / `computeReportCommissionSplit`; no separate magic numbers.
5. **Fail-fast:** Missing commission on a competition causes a thrown error and structured log; no silent fallback.

The system is suitable for production use from a commission-calculation and schema-enforcement perspective, assuming migrations are run as required and all competitions have `commissionPercentBasisPoints` set (by default or explicitly).
