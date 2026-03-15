/**
 * Phase 21: Analytics / BI Dashboard – read-only aggregation layer.
 * Composes existing DB getters; no business logic changes.
 * Fail-safe: returns empty/zero when DB or data is missing.
 * Phase 27: getSystemStatus for ops/support visibility.
 */

import fs from "fs";
import path from "path";
import * as db from "../db";
import { USE_SQLITE } from "../db";

/** Date helpers for "this week" / "this month" (start of period, UTC). */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = x.getUTCDate() - day + (day === 0 ? -6 : 1);
  x.setUTCDate(diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setUTCDate(1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export type DashboardOverview = {
  totalCompetitions: number;
  activeCompetitions: number;
  openCompetitions: number;
  closedCompetitions: number;
  settledCompetitions: number;
  totalSubmissions: number;
  totalUsers: number;
  totalAgents: number;
  totalRevenue: number;
  totalPayouts: number;
  netProfit: number;
  competitionsThisWeek: number;
  competitionsThisMonth: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  automationExecuted: number;
  automationSkipped: number;
  automationFailed: number;
  unreadNotifications: number;
  /** Phase 30: Payment reporting summary */
  paymentPendingCount: number;
  paymentPaidCount: number;
  paymentRefundedCount: number;
  paymentFailedCount: number;
  paymentPaidAmount: number;
  paymentRefundedAmount: number;
  paymentPointsDeductedCount: number;
  paymentExternalCount: number;
};

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const fallback: DashboardOverview = {
    totalCompetitions: 0,
    activeCompetitions: 0,
    openCompetitions: 0,
    closedCompetitions: 0,
    settledCompetitions: 0,
    totalSubmissions: 0,
    totalUsers: 0,
    totalAgents: 0,
    totalRevenue: 0,
    totalPayouts: 0,
    netProfit: 0,
    competitionsThisWeek: 0,
    competitionsThisMonth: 0,
    submissionsThisWeek: 0,
    submissionsThisMonth: 0,
    automationExecuted: 0,
    automationSkipped: 0,
    automationFailed: 0,
    unreadNotifications: 0,
    paymentPendingCount: 0,
    paymentPaidCount: 0,
    paymentRefundedCount: 0,
    paymentFailedCount: 0,
    paymentPaidAmount: 0,
    paymentRefundedAmount: 0,
    paymentPointsDeductedCount: 0,
    paymentExternalCount: 0,
  };

  try {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const [tournaments, submissions, usersList, agents, financialSummary, transparencySummary, automationCounts, unreadCount, paymentSummary] = await Promise.all([
      db.getTournaments(),
      db.getAllSubmissions(),
      db.getUsersList({ role: "user" }).catch(() => []),
      db.getAgents().catch(() => []),
      db.getFinancialSummary().catch(() => ({ totalIncome: 0, totalRefunds: 0, netProfit: 0 })),
      db.getTransparencySummary().catch(() => ({
        totalIncome: 0,
        totalPrizes: 0,
        totalRefunds: 0,
        netSiteProfit: 0,
        totalAgentProfit: 0,
        competitionsHeld: 0,
        competitionsCancelled: 0,
      })),
      db.getAutomationJobCounts().catch(() => ({ executed: 0, skipped: 0, failed: 0 })),
      db.getNotificationUnreadCount().catch(() => 0),
      db.getPaymentReportSummary().catch(() => null),
    ]);

    const totalCompetitions = Array.isArray(tournaments) ? tournaments.length : 0;
    const totalSubmissions = Array.isArray(submissions) ? submissions.length : 0;
    const totalUsers = Array.isArray(usersList) ? usersList.length : 0;
    const totalAgents = Array.isArray(agents) ? agents.length : 0;

    let openCompetitions = 0,
      closedCompetitions = 0,
      settledCompetitions = 0;
    let competitionsThisWeek = 0,
      competitionsThisMonth = 0;
    for (const t of tournaments ?? []) {
      const status = (t as { status?: string }).status ?? "";
      const createdAt = (t as { createdAt?: Date | null }).createdAt;
      if (status === "OPEN") openCompetitions++;
      if (status === "CLOSED" || status === "LOCKED") closedCompetitions++;
      if (status === "SETTLED") settledCompetitions++;
      if (createdAt) {
        const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
        if (ts >= weekStart.getTime()) competitionsThisWeek++;
        if (ts >= monthStart.getTime()) competitionsThisMonth++;
      }
    }
    const activeCompetitions = openCompetitions + (tournaments ?? []).filter((t) => ((t as { status?: string }).status ?? "") === "LOCKED").length;

    let submissionsThisWeek = 0,
      submissionsThisMonth = 0;
    for (const s of submissions ?? []) {
      const createdAt = (s as { createdAt?: Date | null }).createdAt;
      if (createdAt) {
        const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
        if (ts >= weekStart.getTime()) submissionsThisWeek++;
        if (ts >= monthStart.getTime()) submissionsThisMonth++;
      }
    }

    const totalRevenue = transparencySummary.totalIncome ?? financialSummary.totalIncome ?? 0;
    const totalPayouts = transparencySummary.totalPrizes ?? 0;
    const netProfit = transparencySummary.netSiteProfit ?? financialSummary.netProfit ?? 0;

    return {
      totalCompetitions,
      activeCompetitions,
      openCompetitions,
      closedCompetitions,
      settledCompetitions,
      totalSubmissions,
      totalUsers,
      totalAgents,
      totalRevenue,
      totalPayouts,
      netProfit,
      competitionsThisWeek,
      competitionsThisMonth,
      submissionsThisWeek,
      submissionsThisMonth,
      automationExecuted: automationCounts.executed ?? 0,
      automationSkipped: automationCounts.skipped ?? 0,
      automationFailed: automationCounts.failed ?? 0,
      unreadNotifications: unreadCount ?? 0,
      paymentPendingCount: paymentSummary?.countByStatus?.pending ?? 0,
      paymentPaidCount: paymentSummary?.countByStatus?.paid ?? 0,
      paymentRefundedCount: paymentSummary?.countByStatus?.refunded ?? 0,
      paymentFailedCount: paymentSummary?.countByStatus?.failed ?? 0,
      paymentPaidAmount: paymentSummary?.amountByStatus?.paid ?? 0,
      paymentRefundedAmount: paymentSummary?.amountByStatus?.refunded ?? 0,
      paymentPointsDeductedCount: paymentSummary?.countByAccountingType?.points_deducted ?? 0,
      paymentExternalCount: paymentSummary?.countByAccountingType?.external ?? 0,
    };
  } catch {
    return fallback;
  }
}

export type CompetitionAnalytics = {
  byStatus: Array<{ status: string; count: number }>;
  byType: Array<{ type: string; count: number; revenue?: number }>;
  competitionsThisWeek: number;
  competitionsThisMonth: number;
};

export async function getCompetitionAnalytics(): Promise<CompetitionAnalytics> {
  const fallback: CompetitionAnalytics = { byStatus: [], byType: [], competitionsThisWeek: 0, competitionsThisMonth: 0 };
  try {
    const [tournaments, report] = await Promise.all([
      db.getTournaments(),
      db.getAdminFinancialReport().catch(() => []),
    ]);
    const weekStart = startOfWeek(new Date());
    const monthStart = startOfMonth(new Date());

    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const typeRevenue: Record<string, number> = {};
    let competitionsThisWeek = 0,
      competitionsThisMonth = 0;

    for (const t of tournaments ?? []) {
      const status = (t as { status?: string }).status ?? "UNKNOWN";
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      const type = (t as { type?: string }).type ?? "football";
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      const createdAt = (t as { createdAt?: Date | null }).createdAt;
      if (createdAt) {
        const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
        if (ts >= weekStart.getTime()) competitionsThisWeek++;
        if (ts >= monthStart.getTime()) competitionsThisMonth++;
      }
    }
    for (const r of report ?? []) {
      const type = (r as { type?: string }).type ?? "football";
      typeRevenue[type] = (typeRevenue[type] ?? 0) + ((r as { totalParticipation?: number }).totalParticipation ?? 0);
    }

    const byStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
    const byType = Object.keys(typeCounts).map((type) => ({
      type,
      count: typeCounts[type] ?? 0,
      revenue: typeRevenue[type],
    }));

    return { byStatus, byType, competitionsThisWeek, competitionsThisMonth };
  } catch {
    return fallback;
  }
}

export type RevenueAnalytics = {
  totalRevenue: number;
  totalPayouts: number;
  totalRefunds: number;
  netProfit: number;
  totalAgentProfit: number;
  competitionsHeld: number;
  competitionsCancelled: number;
};

export async function getRevenueAnalytics(opts?: { from?: string; to?: string }): Promise<RevenueAnalytics> {
  const fallback: RevenueAnalytics = {
    totalRevenue: 0,
    totalPayouts: 0,
    totalRefunds: 0,
    netProfit: 0,
    totalAgentProfit: 0,
    competitionsHeld: 0,
    competitionsCancelled: 0,
  };
  try {
    const from = opts?.from ? new Date(opts.from) : undefined;
    const to = opts?.to ? new Date(opts.to) : undefined;
    const [financialSummary, transparencySummary] = await Promise.all([
      db.getFinancialSummary({ from, to }).catch(() => ({ totalIncome: 0, totalRefunds: 0, netProfit: 0 })),
      db.getTransparencySummary({ from, to }).catch(() => ({
        totalIncome: 0,
        totalPrizes: 0,
        totalRefunds: 0,
        netSiteProfit: 0,
        totalAgentProfit: 0,
        competitionsHeld: 0,
        competitionsCancelled: 0,
      })),
    ]);
    return {
      totalRevenue: transparencySummary.totalIncome ?? financialSummary.totalIncome ?? 0,
      totalPayouts: transparencySummary.totalPrizes ?? 0,
      totalRefunds: transparencySummary.totalRefunds ?? financialSummary.totalRefunds ?? 0,
      netProfit: transparencySummary.netSiteProfit ?? financialSummary.netProfit ?? 0,
      totalAgentProfit: transparencySummary.totalAgentProfit ?? 0,
      competitionsHeld: transparencySummary.competitionsHeld ?? 0,
      competitionsCancelled: transparencySummary.competitionsCancelled ?? 0,
    };
  } catch {
    return fallback;
  }
}

export type TemplateAnalyticsRow = {
  id: number;
  name: string;
  legacyType: string;
  competitionTypeId: number | null;
  defaultEntryFee: number;
  isActive: boolean;
};

export type TemplateAnalytics = {
  totalTemplates: number;
  templates: TemplateAnalyticsRow[];
};

export async function getTemplateAnalytics(): Promise<TemplateAnalytics> {
  try {
    const list = await db.listCompetitionTemplates({ activeOnly: false }).catch(() => []);
    const templates = (list ?? []).slice(0, 50).map((t) => ({
      id: (t as { id: number }).id,
      name: (t as { name?: string }).name ?? "",
      legacyType: (t as { legacyType?: string }).legacyType ?? "football",
      competitionTypeId: (t as { competitionTypeId?: number | null }).competitionTypeId ?? null,
      defaultEntryFee: (t as { defaultEntryFee?: number }).defaultEntryFee ?? 0,
      isActive: Boolean((t as { isActive?: boolean }).isActive),
    }));
    return { totalTemplates: list?.length ?? 0, templates };
  } catch {
    return { totalTemplates: 0, templates: [] };
  }
}

export type AgentAnalyticsRow = {
  id: number;
  username: string | null;
  name: string | null;
  net: number;
  profit: number;
  loss: number;
  participantsCount?: number;
};

export type AgentAnalytics = {
  agents: AgentAnalyticsRow[];
};

export async function getAgentAnalytics(): Promise<AgentAnalytics> {
  try {
    const agentsList = await db.getAgents().catch(() => []);
    const agents = agentsList.slice(0, 50).map((a) => ({
      id: (a as { id: number }).id,
      username: (a as { username?: string | null }).username ?? null,
      name: (a as { name?: string | null }).name ?? null,
      net: 0,
      profit: 0,
      loss: 0,
    }));
    return { agents };
  } catch {
    return { agents: [] };
  }
}

export type AutomationAnalytics = {
  executed: number;
  skipped: number;
  failed: number;
  /** Phase 23: health metrics */
  failedLast24h: number;
  totalRetries: number;
  longPendingCount: number;
  stuckSettlingCount: number;
};

export async function getAutomationAnalytics(): Promise<AutomationAnalytics> {
  try {
    const [counts, failed24h, totalRetries, longPending, stuckIds] = await Promise.all([
      db.getAutomationJobCounts(),
      db.getAutomationFailedCountSince(Date.now() - 24 * 60 * 60 * 1000).catch(() => 0),
      db.getAutomationTotalRetryCount().catch(() => 0),
      db.getLongPendingTournamentsCount(7).catch(() => 0),
      db.getStuckSettlingTournamentIds().catch(() => []),
    ]);
    return {
      executed: counts.executed ?? 0,
      skipped: counts.skipped ?? 0,
      failed: counts.failed ?? 0,
      failedLast24h: failed24h ?? 0,
      totalRetries: totalRetries ?? 0,
      longPendingCount: longPending ?? 0,
      stuckSettlingCount: Array.isArray(stuckIds) ? stuckIds.length : 0,
    };
  } catch {
    return {
      executed: 0,
      skipped: 0,
      failed: 0,
      failedLast24h: 0,
      totalRetries: 0,
      longPendingCount: 0,
      stuckSettlingCount: 0,
    };
  }
}

export type NotificationAnalytics = {
  unreadCount: number;
};

export async function getNotificationAnalytics(): Promise<NotificationAnalytics> {
  try {
    const unreadCount = await db.getNotificationUnreadCount();
    return { unreadCount: unreadCount ?? 0 };
  } catch {
    return { unreadCount: 0 };
  }
}

/** Phase 27: Read-only system status for admin ops/support visibility. */
export type SystemStatus = {
  mode: string;
  db: "sqlite" | "mysql";
  uploadsExists: boolean;
  automationFailed: number;
  unreadNotifications: number;
  version: string;
};

export async function getSystemStatus(): Promise<SystemStatus> {
  const mode = process.env.NODE_ENV ?? "development";
  const dbKind: "sqlite" | "mysql" = USE_SQLITE ? "sqlite" : "mysql";
  let uploadsExists = false;
  try {
    uploadsExists = fs.existsSync(path.join(process.cwd(), "uploads"));
  } catch {
    // ignore
  }
  let automationFailed = 0;
  let unreadNotifications = 0;
  try {
    const [counts, unread] = await Promise.all([
      db.getAutomationJobCounts(),
      db.getNotificationUnreadCount(),
    ]);
    automationFailed = counts?.failed ?? 0;
    unreadNotifications = unread ?? 0;
  } catch {
    // leave zeros
  }
  let version = "0.0.0";
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as { version?: string };
      if (typeof pkg.version === "string") version = pkg.version;
    }
  } catch {
    // leave default
  }
  return {
    mode,
    db: dbKind,
    uploadsExists,
    automationFailed,
    unreadNotifications,
    version,
  };
}
