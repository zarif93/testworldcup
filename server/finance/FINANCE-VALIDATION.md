# Financial Report Validation

## Formulas (canonical)

### Player / competition PnL
- **competitionNetPnL** = totalPrizesWon − totalEntryFees + totalEntryFeeRefunds  
  (All from `financial_events`: ENTRY_FEE, PRIZE_PAYOUT, REFUND.)
- **netProfitLoss** (Player report summary) = totalWinningsPaid − totalEntryFees + totalRefunds  
  Same identity; totalRefunds is the sum of refunds allocated to rows.

### Commission
- **totalCommissionGenerated** = sum of commission from each entry (from event payload or computed).
- **agentShare** + **platformShare** = totalCommissionGenerated (no double counting).

### General report
- **Row**: totalBets = totalEntryFees, totalWins = totalPrizesWon, commission = agentCommissionFromPlayer, profitLoss = competitionNetPnL, **finalBalance = user.points** (current wallet).
- **Summary**: totalBets/totalWins/totalCommission/totalOpenBalance = sum(rows). totalSiteProfit = sum of (−profitLoss) for profitLoss < 0; totalSiteLoss = sum of profitLoss for profitLoss > 0; sum(rows.profitLoss) = totalSiteLoss − totalSiteProfit.

### Agent report
- **totalPlayerEntryFees** = sum(profile.totalEntryFees) over players under agent.
- **totalCommissionGenerated** = sum(profile.totalCommissionGenerated).
- **platformNetProfitFromAgent** = totalCommissionGenerated − agentTotalCommissionEarned.
- **Summary vs list**: sum(playerListWithPnL.totalEntryFees) = totalPlayerEntryFees; same for commission and platform share.

### Final Balance
- **In General report**: “Final Balance” (יתרה סופית) = **current wallet balance** (`user.points`), not a derived formula. It is the actual balance the site holds for the user.
- **Activity-based identity** (for reconciliation): competition PnL = winnings + refunds − bets. Commission is already part of the entry (rake); it is not subtracted again from the player’s balance. So “winnings − bets − commissions” is not used as the wallet balance; the wallet is persisted separately (points, deposits, withdrawals).

## Runtime checks
- **General report**: On build, we assert summary = sum(rows) for totalBets, totalWins, commission, totalOpenBalance, and sum(profitLoss) = totalSiteLoss − totalSiteProfit.
- **Player report**: We assert sum(rows.netResult) = netProfitLoss and agentShare + platformShare = totalCommissionGenerated.
- **Agent report**: We assert sum(playerListWithPnL) matches agent totals for entryFees, commissionGenerated, agentCommission, and platform share.

## Tests
- `finance-report-validation.test.ts`: General/Player/Agent consistency, no double counting, zero-activity users.
