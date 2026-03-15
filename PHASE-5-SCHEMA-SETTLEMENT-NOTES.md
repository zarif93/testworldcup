# Phase 5: Schema-Driven Settlement Engine — Implementation Notes

This document describes the schema-driven settlement path with safe fallback to legacy winner selection and prize distribution. **Finance, PnL, commissions, and payout/ledger logic are unchanged.** Only the **winner selection and prize-per-winner calculation** can use resolved settlement config when applicable.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **server/settlement/types.ts** | **New.** Shared types: `ScoredSubmission`, `TieGroup`, `WinnerEntry`, `SchemaSettlementResult`, `SettlementSource`, `SETTLEMENT_ENGINE_VERSION`. |
| **server/settlement/selectWinnersBySchema.ts** | **New.** `rankSubmissions` (by points; lotto uses strongHit tie-break for ordering), `buildTieGroups`, `selectWinnersBySchema` (tieHandling "split" = all rank-1, "first_wins" = single winner). |
| **server/settlement/distributePrizesBySchema.ts** | **New.** `distributePrizesBySchema`: uses `prizeDistributionDefault["1"]` percent of pool, split equally among winners (single-tier; matches legacy). |
| **server/settlement/settleTournamentBySchema.ts** | **New.** `computePrizePool` (87.5% of participants × entry), `settleTournamentBySchema(config, submissions, options)` → full `SchemaSettlementResult` (no side effects). |
| **server/settlement/resolveSettlement.ts** | **New.** `resolveSettlement(tournament, submissions)` → try schema when supported and config valid, else legacy; returns `winnerSubmissions`, `prizePerWinner`, `distributed`, `settlementSource`, `warnings`. `getLegacySettlementResult` for admin compare. |
| **server/settlement/index.ts** | **New.** Re-exports settlement engine and resolver. |
| **server/db.ts** | `doDistributePrizesBody`: gets approved subs, calls `resolveSettlement(tournament, submissionRows)`, uses `resolved.winnerSubmissions`, `resolved.prizePerWinner`, `resolved.distributed` for all subsequent steps (addUserPoints, transparency, financial record, etc.). Added `getSettlementComparison(tournamentId)` for admin debug (legacy vs schema, no side effects). |
| **server/routers.ts** | Import `getSettlementComparison`. Added `admin.getSettlementComparison({ tournamentId })` query. |
| **client/src/components/admin/SchemaDebugModal.tsx** | Phase 5 section: "Compare settlement" button, calls `admin.getSettlementComparison`, shows legacy vs schema winner count/prizePerWinner/distributed/pool, match/mismatch, tie groups, warnings. |

---

## 2. Settlement Engine Modules and Helpers

- **rankSubmissions(submissions, tournamentType)** — Sort by points desc; for lotto, tie-break by strongHit (true first). Assign rank (1, 2, …) by distinct point levels.
- **buildTieGroups(ranked)** — Group by rank → `{ rank, points, submissionIds }[]`.
- **selectWinnersBySchema(config, ranked)** — Rank-1 only; if `tieHandling === "first_wins"` return first submission only; else return all rank-1 (split).
- **distributePrizesBySchema(config, winners, prizePoolTotal)** — Single tier: `prizeDistributionDefault["1"]`% of pool, `prizePerWinner = floor(poolForRank1 / winners.length)`, `totalDistributed = prizePerWinner * winners.length`.
- **computePrizePool(participantCount, entryAmount)** — `Math.round(participantCount * entryAmount * 0.875)` (matches legacy).
- **settleTournamentBySchema(config, submissions, options)** — Rank → select winners → distribute; returns `SchemaSettlementResult` (winners, rankedSubmissions, tieGroups, prizePoolTotal, totalPrizeDistributed, prizePerWinner, winnerCount, warnings).
- **resolveSettlement(tournament, submissions)** — Resolves settlement config; if supported type and valid config, runs schema settlement and returns result; on failure or unsupported falls back to legacy (same winner/prize logic as pre-Phase 5).
- **getLegacySettlementResult(submissions, tournamentType, entryAmount)** — Legacy-only winner selection and prize math for admin compare.

---

## 3. Tournament / Prize Modes Supported by Schema Settlement

| Mode | Behavior |
|------|----------|
| **top_n** (default) | Single tier: all rank-1 (max points) are winners; pool split equally. `prizeDistributionDefault["1"]` (default 100) used. |
| **tieHandling: "split"** | All tied-for-first win and share pool (current production behavior). |
| **tieHandling: "first_wins"** | Only first submission in rank-1 wins (single winner). |

Supported tournament types: **football**, **football_custom**, **lotto**, **chance**. For **lotto**, ranking uses points then strongHit for display/order; winner set is still all max-points (schema mirrors legacy). Custom prize mode or unsupported type → legacy only.

---

## 4. Where Schema Settlement Is Used in the Live Flow

- **distributePrizes (admin)** — Triggers `distributePrizesForTournament(tournamentId)`, which calls `doDistributePrizesBody`. Inside `doDistributePrizesBody`, after loading approved submissions, `resolveSettlement(tournament, submissionRows)` is called. Its result (`winnerSubmissions`, `prizePerWinner`, `distributed`) is used for all payouts, transparency log, financial record, and tournament status update. No change to when distribution is triggered or to the rest of the finance/payout pipeline.

---

## 5. When Fallback to Legacy Settlement Happens

- Tournament type is not one of football, football_custom, lotto, chance.
- Resolved settlement config has `prizeMode: "custom"`.
- Submission count &lt; config `minParticipants`.
- `resolveTournamentSettlementConfig` throws or returns invalid config.
- `settleTournamentBySchema` or schema path throws (caught in `resolveSettlement`; legacy used and warning logged).

On fallback, the same winner selection and prize math as before Phase 5 are used (max points → all tied winners, prizePool 87.5%, floor split).

---

## 6. Debug / Compare Tooling

- **Admin API:** `admin.getSettlementComparison({ tournamentId })`  
  Returns: `legacy` (winnerCount, prizePerWinner, distributed, winnerSubmissionIds, prizePool), `schema` (same plus tieGroups, warnings) or null if schema path not available, `match` (true if same winner set and same prizePerWinner/distributed), optional `message`.

- **Schema Debug Modal (Phase 5 section):**  
  "Compare settlement" button calls `getSettlementComparison`, shows legacy vs schema counts and amounts, match/mismatch, tie groups, and schema warnings.

---

## 7. Backward Compatibility

- **Persistence:** No new tables or columns. Winners and amounts are still applied via existing `addUserPoints`, `insertTransparencyLog`, `insertFinancialRecord`, and tournament status updates.
- **Admin workflow:** `distributePrizes` is unchanged from the outside; only the internal source of winner list and prizePerWinner can be schema or legacy.
- **Legacy path:** Unchanged; used whenever `resolveSettlement` chooses fallback.
- **Finance/commissions:** Not modified; house fee (12.5%), financial records, and PnL/export logic are unchanged.

---

## 8. Intentionally Left Unchanged (for Later)

- **House fee / agent commissions** — No changes to fee or commission calculation or reporting.
- **PnL / exports / ledger** — No changes to business rules or report formats.
- **Multi-tier prize distribution** — Only single tier (rank 1 = 100%) is implemented; future work can use `prizeDistributionDefault["2"]`, `["3"]`, etc. for top-3 or other tiers.
- **Settlement result storage** — No new persistence of settlement metadata; only the existing financial and tournament state are updated.

---

## 9. Known Limitations

- Schema settlement uses the same prize pool formula (87.5%) and single-tier split as legacy; no configurable pool percent or multi-rank distribution yet.
- Tie groups and schema result are available for debug/comparison only; they are not stored.
- Comparison API requires approved submissions and filtered (unlimited-excluded) list to match actual distribution behavior.

---

## 10. Recommended Next Phase

- **Phase 6 (optional):** Multi-tier prize distribution from `prizeDistributionDefault` (e.g. 50% / 30% / 20% for ranks 1–3) when configured.
- Optional persistence of settlement metadata (e.g. settlementSource, tie groups) for auditing.
- Integration with finance/reporting layers using the same settlement result shape for consistent attribution.
