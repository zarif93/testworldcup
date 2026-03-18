/**
 * Finance module – commission, agent, PnL types.
 * amountPoints in financial_events: always >= 0; eventType defines direction.
 */

export type FinancialEventType =
  | "ENTRY_FEE"
  | "JACKPOT_CONTRIBUTION"
  | "PRIZE_PAYOUT"
  | "PLATFORM_COMMISSION"
  | "AGENT_COMMISSION"
  | "REFUND"
  | "ADJUSTMENT";

export interface CommissionBreakdown {
  totalPool: number;
  commissionBasisPoints: number;
  platformCommission: number;
  prizePool: number;
  agentCommissionTotal: number;
  platformNetCommission: number;
}

/** Competition PnL: prizes - effective entries (entries - entry-fee refunds). Wallet flow is separate. */
export interface PlayerFinancialProfile {
  userId: number;
  username: string | null;
  assignedAgentId: number | null;
  /** Number of ENTRY_FEE events (participations) */
  totalParticipations: number;
  /** From financial_events ENTRY_FEE */
  totalEntryFees: number;
  /** From financial_events REFUND (entry-fee refunds) */
  totalEntryFeeRefunds: number;
  /** From financial_events PRIZE_PAYOUT */
  totalPrizesWon: number;
  /** competitionNetPnL = totalPrizesWon - totalEntryFees + totalEntryFeeRefunds */
  competitionNetPnL: number;
  /** From financial_events (PLATFORM_COMMISSION generated from this player's entries) */
  totalCommissionGenerated: number;
  /** From financial_events AGENT_COMMISSION for this player's entries */
  agentCommissionFromPlayer: number;
  platformProfitFromPlayer: number;
  /** Wallet flow: deposits + prizes + refunds - entries - withdrawals (refunds from point_transactions) */
  walletNetFlow: number;
  /** Legacy: total deposits (for wallet view) */
  totalDeposits: number;
}

export interface AgentDashboardMetrics {
  agentId: number;
  agentUsername: string | null;
  agentName: string | null;
  numberOfPlayers: number;
  totalPlayerEntryFees: number;
  totalCommissionGenerated: number;
  agentTotalCommissionEarned: number;
  platformNetProfitFromAgent: number;
  playerListWithPnL: Array<{
    userId: number;
    username: string | null;
    fullName: string | null;
    totalParticipations: number;
    totalEntryFees: number;
    totalEntryFeeRefunds: number;
    totalPrizesWon: number;
    competitionNetPnL: number;
    commissionGenerated: number;
    agentCommissionFromPlayer: number;
    platformShareFromPlayer: number;
  }>;
}

export interface TournamentFinancialSummary {
  tournamentId: number;
  tournamentName: string;
  totalPool: number;
  commissionBasisPoints: number;
  platformCommission: number;
  agentCommissionTotal: number;
  prizePool: number;
  totalPrizesDistributed: number;
  /** Entry-fee refunds (REFUND events) for this tournament */
  totalRefunded: number;
  platformNetProfit: number;
  participantCount: number;
  winnerCount: number;
  roi: number | null;
}

export type DashboardPeriod = "day" | "week" | "month";

export interface AdminGlobalDashboard {
  period: DashboardPeriod;
  from: Date;
  to: Date;
  totalProfit: number;
  profitByTournament: Array<{ tournamentId: number; name: string; profit: number; totalPool: number }>;
  profitByAgent: Array<{ agentId: number; username: string | null; platformNetProfit: number; agentCommission: number }>;
  topProfitablePlayers: Array<{ userId: number; username: string | null; competitionNetPnL: number }>;
  topLosingPlayers: Array<{ userId: number; username: string | null; competitionNetPnL: number }>;
  riskAlerts: string[];
}

/** Single insight item for top strip (real data only). */
export interface FinanceInsightItem {
  id: number;
  name: string;
  value: number;
  /** Optional subtitle e.g. "תחרות", "סוכן" */
  kind?: string;
}

/** Admin finance dashboard summary – period or custom range. */
export interface AdminFinanceDashboardSummary {
  from: Date;
  to: Date;
  period?: DashboardPeriod;
  totalPlatformProfit: number;
  totalCommissions: number;
  totalAgentCommissions: number;
  totalPrizePayouts: number;
  totalRefundedPoints: number;
  activeTournamentsCount: number;
  totalPlayersCount: number;
  totalAgentsCount: number;
  /** Top insights from same period (only when data exists). */
  mostProfitableTournament?: FinanceInsightItem | null;
  mostProfitableAgent?: FinanceInsightItem | null;
  topLosingPlayer?: FinanceInsightItem | null;
  topProfitablePlayer?: FinanceInsightItem | null;
}

/** Tournament row for admin finance table (summary + status). */
export interface TournamentFinanceRow extends TournamentFinancialSummary {
  status: string;
}

/** Agent row for admin finance table. */
export interface AgentFinanceRow {
  agentId: number;
  agentUsername: string | null;
  agentName: string | null;
  numberOfPlayers: number;
  totalPlayerEntryFees: number;
  totalCommissionGenerated: number;
  agentTotalCommissionEarned: number;
  platformNetProfitFromAgent: number;
  totalPlayerPrizes: number;
}

/** Financial event row for audit (serializable). */
export interface FinancialEventRow {
  id: number;
  eventType: string;
  amountPoints: number;
  tournamentId: number | null;
  userId: number | null;
  agentId: number | null;
  submissionId: number | null;
  idempotencyKey: string | null;
  createdAt: Date;
  payloadJson: Record<string, unknown> | null;
}
