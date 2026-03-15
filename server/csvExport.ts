/**
 * ייצוא דוחות רווח/הפסד ועמלות ל-CSV (UTF-8 עם BOM לתאימות Excel בעברית).
 */

const BOM = "\uFEFF";

/** מניעת CSV Injection: שדה שמתחיל ב-=+@\t\r מקבל prefix גרש כדי שב-Excel לא יופעלו נוסחאות */
function escapeCsvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  const quoted = s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r");
  const safe = quoted ? `"${s.replace(/"/g, '""')}"` : s;
  if (/^[=+\-@\t\r]/.test(s)) return `'${safe}`;
  return safe;
}

function rowToCsvLine(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsvCell).join(",");
}

export type PnLSummary = {
  totalPlayersProfit: number;
  totalPlayersLoss: number;
  totalAgentsProfit: number;
  totalAgentsLoss: number;
  totalNet: number;
  agents: Array<{ id: number; username: string | null; name: string | null; profit: number; loss: number; net: number }>;
  playersByAgent: Array<{
    agentId: number;
    agentName: string;
    players: Array<{ playerId: number; username: string | null; name: string | null; profit: number; loss: number; net: number }>;
  }>;
};

export function pnLSummaryToCsv(data: PnLSummary): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["סיכום דוח רווח והפסד"]));
  lines.push(rowToCsvLine(["סה\"כ רווח שחקנים", data.totalPlayersProfit]));
  lines.push(rowToCsvLine(["סה\"כ הפסד שחקנים", data.totalPlayersLoss]));
  lines.push(rowToCsvLine(["סה\"כ רווח סוכנים", data.totalAgentsProfit]));
  lines.push(rowToCsvLine(["סה\"כ הפסד סוכנים", data.totalAgentsLoss]));
  lines.push(rowToCsvLine(["סה\"כ נטו", data.totalNet]));
  lines.push("");
  lines.push(rowToCsvLine(["מזהה", "שם משתמש", "שם", "רווח", "הפסד", "נטו"]));
  for (const a of data.agents) {
    lines.push(rowToCsvLine([a.id, a.username ?? "", a.name ?? "", a.profit, a.loss, a.net]));
  }
  lines.push("");
  lines.push(rowToCsvLine(["שחקנים לפי סוכן", "מזהה סוכן", "שם סוכן", "מזהה שחקן", "שם משתמש", "שם", "רווח", "הפסד", "נטו"]));
  for (const g of data.playersByAgent) {
    for (const p of g.players) {
      lines.push(rowToCsvLine([g.agentId, g.agentName, p.playerId, p.username ?? "", p.name ?? "", p.profit, p.loss, p.net]));
    }
  }
  return BOM + lines.join("\r\n");
}

export type AgentPnLTransaction = {
  id: number;
  date: Date | null;
  type: "COMMISSION" | "DEPOSIT" | "PRIZE";
  amount: number;
  description?: string;
  submissionId?: number;
  userId?: number;
  playerName: string | null;
  tournamentName: string | null;
  tournamentId?: number;
  balanceAfter: number;
};

export function agentPnLToCsv(transactions: AgentPnLTransaction[], profit: number, loss: number, net: number): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח רווח והפסד סוכן"]));
  lines.push(rowToCsvLine(["רווח", profit]));
  lines.push(rowToCsvLine(["הפסד", loss]));
  lines.push(rowToCsvLine(["נטו", net]));
  lines.push("");
  lines.push(rowToCsvLine(["תאריך", "סוג", "סכום", "תיאור", "שחקן", "תחרות", "מאזן לאחר"]));
  for (const t of transactions) {
    const dateStr = t.date ? t.date.toISOString().slice(0, 19).replace("T", " ") : "";
    lines.push(rowToCsvLine([dateStr, t.type, t.amount, t.description ?? "", t.playerName ?? "", t.tournamentName ?? "", t.balanceAfter]));
  }
  return BOM + lines.join("\r\n");
}

export type PlayerPnLTransaction = {
  id: number;
  createdAt: Date | null;
  actionType: string;
  amount: number;
  balanceAfter: number;
  kind: "profit" | "loss";
  referenceId?: number | null;
};

export type AdminPnLReportRow = {
  id: number;
  createdAt: Date | null;
  actionType: string;
  playerName: string | null;
  agentName: string | null;
  tournamentType: string | null;
  participationAmount: number;
  prizeAmount: number;
  siteCommission: number;
  agentCommission: number;
  pointsDelta: number;
  balanceAfter: number;
};

export function adminPnLReportToCsv(rows: AdminPnLReportRow[]): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח רווח והפסד – תנועות מלאות (מנהל)"]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "תאריך ושעה",
      "סוג פעולה",
      "שם שחקן",
      "שם סוכן",
      "סוג תחרות",
      "סכום השתתפות",
      "זכייה",
      "עמלת אתר",
      "עמלת סוכן",
      "שינוי נקודות",
      "יתרה לאחר פעולה",
      "מזהה רשומה",
    ])
  );
  for (const r of rows) {
    const dateStr = r.createdAt ? r.createdAt.toISOString().slice(0, 19).replace("T", " ") : "";
    lines.push(
      rowToCsvLine([
        dateStr,
        r.actionType,
        r.playerName ?? "",
        r.agentName ?? "",
        r.tournamentType ?? "",
        r.participationAmount || "",
        r.prizeAmount || "",
        r.siteCommission || "",
        r.agentCommission || "",
        r.pointsDelta,
        r.balanceAfter,
        r.id,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

export type AgentPnLReportRow = {
  id: number;
  createdAt: Date | null;
  playerName: string | null;
  tournamentType: string | null;
  participationAmount: number;
  agentCommission: number;
  pointsDelta: number;
  agentBalanceAfter: number;
};

export function agentPnLReportToCsv(rows: AgentPnLReportRow[]): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח רווח והפסד – סוכן (תנועות + עמלות)"]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "תאריך",
      "שם שחקן",
      "סוג תחרות",
      "סכום השתתפות",
      "עמלת סוכן",
      "שינוי נקודות",
      "יתרת סוכן",
      "מזהה רשומה",
    ])
  );
  for (const r of rows) {
    const dateStr = r.createdAt ? r.createdAt.toISOString().slice(0, 19).replace("T", " ") : "";
    lines.push(
      rowToCsvLine([
        dateStr,
        r.playerName ?? "",
        r.tournamentType ?? "",
        r.participationAmount || "",
        r.agentCommission || "",
        r.pointsDelta || "",
        r.agentBalanceAfter,
        r.id,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

export function playerPnLToCsv(
  transactions: PlayerPnLTransaction[],
  profit: number,
  loss: number,
  net: number
): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח רווח והפסד שחקן"]));
  lines.push(rowToCsvLine(["רווח", profit]));
  lines.push(rowToCsvLine(["הפסד", loss]));
  lines.push(rowToCsvLine(["נטו", net]));
  lines.push("");
  lines.push(rowToCsvLine(["תאריך", "סוג פעולה", "סכום", "סוג (רווח/הפסד)", "מאזן לאחר", "מזהה תחרות"]));
  for (const t of transactions) {
    const dateStr = t.createdAt ? t.createdAt.toISOString().slice(0, 19).replace("T", " ") : "";
    lines.push(rowToCsvLine([dateStr, t.actionType, t.amount, t.kind, t.balanceAfter, t.referenceId ?? ""]));
  }
  return BOM + lines.join("\r\n");
}

export type CommissionRow = {
  id: number;
  submissionId: number;
  userId: number;
  username: string | null;
  name: string | null;
  entryAmount: number;
  commissionAmount: number;
  createdAt: Date | null;
  tournamentId?: number;
  tournamentName?: string | null;
};

export function commissionReportToCsv(rows: CommissionRow[], totalCommission: number): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח עמלות סוכן"]));
  lines.push(rowToCsvLine(["סה\"כ עמלות", totalCommission]));
  lines.push("");
  lines.push(rowToCsvLine(["תאריך", "מזהה טופס", "מזהה שחקן", "שם משתמש", "שם", "סכום כניסה", "עמלה", "תחרות"]));
  for (const r of rows) {
    const dateStr = r.createdAt ? r.createdAt.toISOString().slice(0, 19).replace("T", " ") : "";
    lines.push(rowToCsvLine([dateStr, r.submissionId, r.userId, r.username ?? "", r.name ?? "", r.entryAmount, r.commissionAmount, r.tournamentName ?? ""]));
  }
  return BOM + lines.join("\r\n");
}

/** דוח סוכן מפורט – סיכום + טבלת שחקנים (מקור: financial_events) */
export function agentReportDetailedToCsv(report: {
  summary: {
    totalEntriesCollected: number;
    totalWinningsPaid: number;
    totalRefunds: number;
    netProfitLoss: number;
    totalCommission: number;
    agentCommissionShare: number;
    platformCommissionShare: number;
    numberOfPlayers: number;
    numberOfSubmissions: number;
  };
  players: Array<{
    userId: number;
    fullName: string | null;
    username: string | null;
    participations: number;
    totalEntryFees: number;
    totalWinnings: number;
    totalRefunds: number;
    netProfitLoss: number;
    totalCommissionGenerated: number;
    agentShareFromPlayer: number;
    platformShareFromPlayer: number;
    status: string;
  }>;
  agentUsername: string | null;
  agentName: string | null;
}): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח עמלות ורווח/הפסד סוכן"]));
  lines.push(rowToCsvLine(["סוכן", report.agentName ?? report.agentUsername ?? ""]));
  lines.push("");
  lines.push(rowToCsvLine(["סיכום"]));
  lines.push(rowToCsvLine(["סך הכנסות מהשתתפויות", report.summary.totalEntriesCollected]));
  lines.push(rowToCsvLine(["סך פרסים ששולמו", report.summary.totalWinningsPaid]));
  lines.push(rowToCsvLine(["סך החזרים", report.summary.totalRefunds]));
  lines.push(rowToCsvLine(["רווח/הפסד נטו", report.summary.netProfitLoss]));
  lines.push(rowToCsvLine(["סה\"כ עמלה", report.summary.totalCommission]));
  lines.push(rowToCsvLine(["חלק סוכן", report.summary.agentCommissionShare]));
  lines.push(rowToCsvLine(["חלק פלטפורמה", report.summary.platformCommissionShare]));
  lines.push(rowToCsvLine(["מספר שחקנים", report.summary.numberOfPlayers]));
  lines.push(rowToCsvLine(["מספר השתתפויות", report.summary.numberOfSubmissions]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "שם מלא",
      "שם משתמש",
      "השתתפויות",
      "סך דמי כניסה",
      "סך זכיות",
      "סך החזרים",
      "רווח/הפסד נטו",
      "עמלה שנוצרה",
      "חלק סוכן",
      "חלק פלטפורמה",
      "סטטוס",
    ])
  );
  for (const p of report.players) {
    const statusHe = p.status === "profit" ? "רווח" : p.status === "loss" ? "הפסד" : "מאוזן";
    lines.push(
      rowToCsvLine([
        p.fullName ?? "",
        p.username ?? "",
        p.participations,
        p.totalEntryFees,
        p.totalWinnings,
        p.totalRefunds,
        p.netProfitLoss,
        p.totalCommissionGenerated,
        p.agentShareFromPlayer,
        p.platformShareFromPlayer,
        statusHe,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

/** דוח שחקן מפורט – סיכום + טבלת השתתפויות (מקור: financial_events) */
export function playerReportDetailedToCsv(report: {
  summary: {
    totalParticipations: number;
    totalEntryFees: number;
    totalWinningsPaid: number;
    totalRefunds: number;
    netProfitLoss: number;
    totalCommissionGenerated: number;
    agentShare: number;
    platformShare: number;
  };
  rows: Array<{
    tournamentName: string;
    tournamentType: string;
    date: Date | null;
    entryFee: number;
    winnings: number;
    refund: number;
    netResult: number;
    totalCommission: number;
    agentShare: number;
    platformShare: number;
    status: string;
  }>;
  username: string | null;
  fullName: string | null;
}): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח שחקן מפורט – עמלות ורווח/הפסד"]));
  lines.push(rowToCsvLine(["שחקן", report.fullName ?? report.username ?? ""]));
  lines.push("");
  lines.push(rowToCsvLine(["סיכום"]));
  lines.push(rowToCsvLine(["מספר השתתפויות", report.summary.totalParticipations]));
  lines.push(rowToCsvLine(["סך דמי כניסה", report.summary.totalEntryFees]));
  lines.push(rowToCsvLine(["סך זכיות ששולמו", report.summary.totalWinningsPaid]));
  lines.push(rowToCsvLine(["סך החזרים", report.summary.totalRefunds]));
  lines.push(rowToCsvLine(["רווח/הפסד נטו", report.summary.netProfitLoss]));
  lines.push(rowToCsvLine(["סה\"כ עמלה שנוצרה", report.summary.totalCommissionGenerated]));
  lines.push(rowToCsvLine(["חלק סוכן", report.summary.agentShare]));
  lines.push(rowToCsvLine(["חלק פלטפורמה", report.summary.platformShare]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "תחרות",
      "סוג תחרות",
      "תאריך",
      "דמי כניסה",
      "זכיות",
      "החזר",
      "תוצאה נטו",
      "עמלה",
      "חלק סוכן",
      "חלק פלטפורמה",
      "סטטוס",
    ])
  );
  for (const r of report.rows) {
    const dateStr = r.date ? new Date(r.date).toLocaleDateString("he-IL") : "";
    const statusHe = r.status === "profit" ? "רווח" : r.status === "loss" ? "הפסד" : "מאוזן";
    lines.push(
      rowToCsvLine([
        r.tournamentName,
        r.tournamentType,
        dateStr,
        r.entryFee,
        r.winnings,
        r.refund,
        r.netResult,
        r.totalCommission,
        r.agentShare,
        r.platformShare,
        statusHe,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

/** דוח כספי גלובלי – סיכום + לפי תחרות / סוכן / שחקן */
export function globalFinanceReportToCsv(report: {
  summary: {
    totalParticipations: number;
    totalEntryFeesCollected: number;
    totalWinningsPaid: number;
    totalRefunds: number;
    netPlatformProfitLoss: number;
    totalCommissionGenerated: number;
    totalAgentCommission: number;
    totalPlatformCommission: number;
    numberOfTournaments: number;
    numberOfActivePlayers: number;
    numberOfActiveAgents: number;
  };
  byTournament: Array<{
    tournamentName: string;
    tournamentType: string;
    participations: number;
    entryFees: number;
    winningsPaid: number;
    refunds: number;
    netResult: number;
    totalCommission: number;
    agentCommission: number;
    platformCommission: number;
  }>;
  byAgent: Array<{
    agentName: string | null;
    agentUsername: string | null;
    numberOfPlayers: number;
    participations: number;
    entryFees: number;
    winningsPaid: number;
    refunds: number;
    totalCommissionGenerated: number;
    agentCommission: number;
    platformShare: number;
  }>;
  byPlayer: Array<{
    username: string | null;
    fullName: string | null;
    participations: number;
    entryFees: number;
    winningsPaid: number;
    refunds: number;
    netProfitLoss: number;
    totalCommissionGenerated: number;
    agentShare: number;
    platformShare: number;
  }>;
  from: string | null;
  to: string | null;
}): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח כספי גלובלי"]));
  lines.push(rowToCsvLine(["תקופה", report.from ? `${report.from} - ${report.to ?? ""}` : "כל התקופה"]));
  lines.push("");
  lines.push(rowToCsvLine(["סיכום"]));
  lines.push(rowToCsvLine(["סה\"כ השתתפויות", report.summary.totalParticipations]));
  lines.push(rowToCsvLine(["סך דמי כניסה שגבינו", report.summary.totalEntryFeesCollected]));
  lines.push(rowToCsvLine(["סך זכיות ששולמו", report.summary.totalWinningsPaid]));
  lines.push(rowToCsvLine(["סך החזרים", report.summary.totalRefunds]));
  lines.push(rowToCsvLine(["רווח/הפסד נטו פלטפורמה", report.summary.netPlatformProfitLoss]));
  lines.push(rowToCsvLine(["סה\"כ עמלה שנוצרה", report.summary.totalCommissionGenerated]));
  lines.push(rowToCsvLine(["סה\"כ עמלת סוכנים", report.summary.totalAgentCommission]));
  lines.push(rowToCsvLine(["סה\"כ עמלת פלטפורמה", report.summary.totalPlatformCommission]));
  lines.push(rowToCsvLine(["מספר תחרויות", report.summary.numberOfTournaments]));
  lines.push(rowToCsvLine(["מספר שחקנים פעילים", report.summary.numberOfActivePlayers]));
  lines.push(rowToCsvLine(["מספר סוכנים פעילים", report.summary.numberOfActiveAgents]));
  lines.push("");
  lines.push(rowToCsvLine(["לפי תחרות"]));
  lines.push(
    rowToCsvLine([
      "תחרות",
      "סוג",
      "השתתפויות",
      "דמי כניסה",
      "זכיות ששולמו",
      "החזרים",
      "תוצאה נטו",
      "עמלה",
      "עמלת סוכן",
      "עמלת פלטפורמה",
    ])
  );
  for (const r of report.byTournament) {
    lines.push(
      rowToCsvLine([
        r.tournamentName,
        r.tournamentType,
        r.participations,
        r.entryFees,
        r.winningsPaid,
        r.refunds,
        r.netResult,
        r.totalCommission,
        r.agentCommission,
        r.platformCommission,
      ])
    );
  }
  lines.push("");
  lines.push(rowToCsvLine(["לפי סוכן"]));
  lines.push(
    rowToCsvLine([
      "סוכן",
      "שם משתמש",
      "מספר שחקנים",
      "השתתפויות",
      "דמי כניסה",
      "זכיות ששולמו",
      "החזרים",
      "עמלה שנוצרה",
      "עמלת סוכן",
      "חלק פלטפורמה",
    ])
  );
  for (const r of report.byAgent) {
    lines.push(
      rowToCsvLine([
        r.agentName ?? "",
        r.agentUsername ?? "",
        r.numberOfPlayers,
        r.participations,
        r.entryFees,
        r.winningsPaid,
        r.refunds,
        r.totalCommissionGenerated,
        r.agentCommission,
        r.platformShare,
      ])
    );
  }
  lines.push("");
  lines.push(rowToCsvLine(["לפי שחקן"]));
  lines.push(
    rowToCsvLine([
      "שם מלא",
      "שם משתמש",
      "השתתפויות",
      "דמי כניסה",
      "זכיות ששולמו",
      "החזרים",
      "רווח/הפסד נטו",
      "עמלה שנוצרה",
      "חלק סוכן",
      "חלק פלטפורמה",
    ])
  );
  for (const r of report.byPlayer) {
    lines.push(
      rowToCsvLine([
        r.fullName ?? "",
        r.username ?? "",
        r.participations,
        r.entryFees,
        r.winningsPaid,
        r.refunds,
        r.netProfitLoss,
        r.totalCommissionGenerated,
        r.agentShare,
        r.platformShare,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

/** שורות לוג תנועות נקודות (למנהל) – עם שמות משתמש וסוכן */
export type PointsLogRow = {
  id: number;
  userId: number;
  amount: number;
  balanceAfter: number;
  actionType: string;
  performedBy: number | null;
  referenceId: number | null;
  description: string | null;
  commissionAgent: number | null;
  commissionSite: number | null;
  agentId: number | null;
  createdAt: Date | null;
};

export function pointsLogsToCsv(
  rows: PointsLogRow[],
  userDisplay: (userId: number) => string,
  agentDisplay: (agentId: number) => string
): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["לוג תנועות נקודות – כל התנועות"]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "מזהה",
      "תאריך",
      "מזהה שחקן",
      "שם שחקן",
      "סוג פעולה",
      "סכום",
      "מאזן לאחר",
      "עמלה אתר",
      "עמלה סוכן",
      "מזהה סוכן",
      "שם סוכן",
      "תיאור",
      "מזהה תחרות",
    ])
  );
  for (const r of rows) {
    const dateStr = r.createdAt ? (typeof r.createdAt === "object" && "toISOString" in r.createdAt ? r.createdAt.toISOString().slice(0, 19).replace("T", " ") : String(r.createdAt)) : "";
    lines.push(
      rowToCsvLine([
        r.id,
        dateStr,
        r.userId,
        userDisplay(r.userId),
        r.actionType,
        r.amount,
        r.balanceAfter,
        r.commissionSite ?? "",
        r.commissionAgent ?? "",
        r.agentId ?? "",
        r.agentId != null ? agentDisplay(r.agentId) : "",
        r.description ?? "",
        r.referenceId ?? "",
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

export type ReportExportFormat = "csv" | "excel" | "json";

export type ReportExportMeta = {
  generatedAt: string;
  reportPeriod: string;
  reportType: string;
  generatedBy: string;
};

export type StructuredAgentPlayerRow = {
  username: string;
  phoneNumber: string;
  totalBets: number;
  totalWinnings: number;
  profitLoss: number;
  commissionGenerated: number;
  agentCommissionShare: number;
  betsCount: number;
  lastActivity: string;
};

export type StructuredAgentReport = {
  meta: ReportExportMeta;
  agentUsername: string;
  summary: {
    totalBets: number;
    totalWinnings: number;
    totalProfit: number;
    totalLoss: number;
    totalProfitLoss: number;
    totalPlatformCommission: number;
    totalAgentCommission: number;
    agentNetResult: number;
  };
  players: StructuredAgentPlayerRow[];
};

export type StructuredPlayerEntry = {
  date: string;
  tournament: string;
  tournamentType: string;
  status: string;
  betAmount: number;
  result: string;
  winAmount: number;
  commission: number;
  profitLoss: number;
};

export type StructuredPlayerReport = {
  meta: ReportExportMeta;
  username: string;
  phoneNumber: string;
  summary: {
    totalBets: number;
    totalWins: number;
    totalProfitLoss: number;
    totalCommissionGenerated: number;
    numberOfBets: number;
    totalProfit: number;
    totalLoss: number;
    netBalance: number;
  };
  entries: StructuredPlayerEntry[];
};

function escapeXml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Cell for Excel: raw value or { v, s? } for styled cell */
type ExcelCell = string | number | null | undefined | { v: string | number | null | undefined; s?: string };

function isStyledCell(c: ExcelCell): c is { v: string | number | null | undefined; s?: string } {
  return typeof c === "object" && c !== null && "v" in c;
}

function rowToExcelXml(cells: ExcelCell[]): string {
  const cols = cells
    .map((cell) => {
      const value = isStyledCell(cell) ? cell.v : cell;
      const styleAttr = isStyledCell(cell) && cell.s ? ` ss:StyleID="${escapeXml(cell.s)}"` : "";
      const type = typeof value === "number" ? "Number" : "String";
      return `<Cell${styleAttr}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
    })
    .join("");
  return `<Row>${cols}</Row>`;
}

/** Style definition for Excel SpreadsheetML */
const EXCEL_STYLES = `
<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
    <Alignment ss:Vertical="Bottom"/>
    <Borders/><Font/><Interior/><NumberFormat/><Protection/>
  </Style>
  <Style ss:ID="Header">
    <Font ss:Bold="1" ss:Color="#FFFFFF"/>
    <Interior ss:Color="#2F5496" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="SummarySection">
    <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Bets">
    <Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="Winnings">
    <Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="ProfitLoss">
    <Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="PlatformCommission">
    <Interior ss:Color="#FCE4D6" ss:Pattern="Solid"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="AgentCommission">
    <Interior ss:Color="#E4DFEC" ss:Pattern="Solid"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="FinalBalancePositive">
    <Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/>
    <Font ss:Bold="1"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="FinalBalanceNegative">
    <Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/>
    <Font ss:Bold="1"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="FinalBalanceZero">
    <Interior ss:Color="#D9D9D9" ss:Pattern="Solid"/>
    <Font ss:Bold="1"/>
    <NumberFormat ss:Format="Standard"/>
  </Style>
  <Style ss:ID="TableRowAlt">
    <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
  </Style>
</Styles>`;

/** Default column width (character units). */
const EXCEL_COL_WIDTH = 14;

/** Build Table with optional column count and optional freeze at row (1-based). */
function tableToExcelXml(
  rows: ExcelCell[][],
  columnCount: number,
  freezeHeaderAtRow?: number
): string {
  const colEls = Array.from({ length: columnCount }, () => `<Column ss:Width="${EXCEL_COL_WIDTH}"/>`).join("");
  const tableContent = colEls + rows.map((row) => rowToExcelXml(row)).join("");
  const freezeXml =
    freezeHeaderAtRow != null && freezeHeaderAtRow > 0
      ? `
  <x:WorksheetOptions>
    <x:FreezePanes/>
    <x:FrozenNoScroll/>
    <x:SplitHorizontal>${freezeHeaderAtRow}</x:SplitHorizontal>
    <x:TopRowBottomPane>${freezeHeaderAtRow}</x:TopRowBottomPane>
    <x:ActivePane>2</x:ActivePane>
  </x:WorksheetOptions>`
      : "";
  return `<Table>${tableContent}</Table>${freezeXml}`;
}

interface ExcelSheetInput {
  name: string;
  rows: ExcelCell[][];
  columnCount?: number;
  freezeHeaderAtRow?: number;
}

function workbookToExcelXml(sheets: ExcelSheetInput[]): string {
  const worksheets = sheets
    .map((sheet) => {
      const colCount = sheet.columnCount ?? Math.max(...sheet.rows.map((r) => r.length), 1);
      const tableAndOptions = tableToExcelXml(
        sheet.rows,
        colCount,
        sheet.freezeHeaderAtRow
      );
      return `<Worksheet ss:Name="${escapeXml(sheet.name)}">${tableAndOptions}</Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${EXCEL_STYLES}
${worksheets}
</Workbook>`;
}

export function buildReportPeriod(from?: string, to?: string): string {
  if (from && to) return `${from} — ${to}`;
  if (from) return `${from} —`;
  if (to) return `— ${to}`;
  return "All Time";
}

export function agentFinancialReportToCsv(report: StructuredAgentReport): string {
  const finalAgentBalance = report.summary.totalProfitLoss + report.summary.totalAgentCommission;
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח סוכן"]));
  lines.push(rowToCsvLine(["נוצר בתאריך", report.meta.generatedAt]));
  lines.push(rowToCsvLine(["תקופת הדוח", report.meta.reportPeriod]));
  lines.push(rowToCsvLine(["סוג דוח", report.meta.reportType]));
  lines.push(rowToCsvLine(["נוצר על ידי", report.meta.generatedBy]));
  lines.push(rowToCsvLine(["שם משתמש סוכן", report.agentUsername]));
  lines.push("");
  lines.push(rowToCsvLine(["סיכום"]));
  lines.push(rowToCsvLine(["סך כל ההימורים", report.summary.totalBets]));
  lines.push(rowToCsvLine(["סך כל הזכיות", report.summary.totalWinnings]));
  lines.push(rowToCsvLine(["רווח / הפסד כולל", report.summary.totalProfitLoss]));
  lines.push(rowToCsvLine(["סך רווח", report.summary.totalProfit]));
  lines.push(rowToCsvLine(["סך הפסד", report.summary.totalLoss]));
  lines.push(rowToCsvLine(["עמלת אתר", report.summary.totalPlatformCommission]));
  lines.push(rowToCsvLine(["עמלת סוכן", report.summary.totalAgentCommission]));
  lines.push(rowToCsvLine(["יתרה סופית מול הסוכן", finalAgentBalance]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "שם משתמש",
      "טלפון",
      "מספר הימורים",
      "סך הימורים",
      "סך זכיות",
      "רווח / הפסד",
      "עמלת סוכן",
      "פעילות אחרונה",
    ])
  );
  for (const row of report.players) {
    lines.push(
      rowToCsvLine([
        row.username,
        row.phoneNumber,
        row.betsCount,
        row.totalBets,
        row.totalWinnings,
        row.profitLoss,
        row.agentCommissionShare,
        row.lastActivity,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

export function playerFinancialReportToCsv(report: StructuredPlayerReport): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח שחקן"]));
  lines.push(rowToCsvLine(["נוצר בתאריך", report.meta.generatedAt]));
  lines.push(rowToCsvLine(["תקופת הדוח", report.meta.reportPeriod]));
  lines.push(rowToCsvLine(["סוג דוח", report.meta.reportType]));
  lines.push(rowToCsvLine(["נוצר על ידי", report.meta.generatedBy]));
  lines.push(rowToCsvLine(["שם משתמש", report.username]));
  lines.push(rowToCsvLine(["טלפון", report.phoneNumber ?? ""]));
  lines.push("");
  lines.push(rowToCsvLine(["סיכום"]));
  lines.push(rowToCsvLine(["סך כל ההימורים", report.summary.totalBets]));
  lines.push(rowToCsvLine(["סך זכיות", report.summary.totalWins]));
  lines.push(rowToCsvLine(["רווח / הפסד כולל", report.summary.totalProfitLoss]));
  lines.push(rowToCsvLine(["סה\"כ עמלה", report.summary.totalCommissionGenerated]));
  lines.push(rowToCsvLine(["מספר הימורים", report.summary.numberOfBets]));
  lines.push(rowToCsvLine(["יתרה סופית שחקן", report.summary.totalProfitLoss]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "תאריך",
      "תחרות",
      "סוג תחרות",
      "סטטוס",
      "סכום הימור",
      "תוצאה",
      "סכום זכייה",
      "עמלה",
      "רווח / הפסד",
    ])
  );
  for (const entry of report.entries) {
    lines.push(
      rowToCsvLine([
        entry.date,
        entry.tournament,
        entry.tournamentType,
        entry.status,
        entry.betAmount,
        entry.result,
        entry.winAmount,
        entry.commission,
        entry.profitLoss,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

/** יתרה סופית מול הסוכן = TOTAL_PROFIT_LOSS + TOTAL_AGENT_COMMISSION */
function getFinalAgentBalance(report: StructuredAgentReport): number {
  return report.summary.totalProfitLoss + report.summary.totalAgentCommission;
}

export function agentFinancialReportToExcel(report: StructuredAgentReport): string {
  const finalAgentBalance = getFinalAgentBalance(report);
  const finalBalanceStyle =
    finalAgentBalance > 0 ? "FinalBalancePositive" : finalAgentBalance < 0 ? "FinalBalanceNegative" : "FinalBalanceZero";

  const summaryRows: ExcelCell[][] = [
    [{ v: "דוח סוכן", s: "Header" }, { v: "", s: "Header" }],
    ["נוצר בתאריך", report.meta.generatedAt],
    ["תקופת הדוח", report.meta.reportPeriod],
    ["סוג דוח", report.meta.reportType],
    ["נוצר על ידי", report.meta.generatedBy],
    ["שם משתמש סוכן", report.agentUsername],
    [],
    [{ v: "סיכום", s: "Header" }, { v: "", s: "Header" }],
    [{ v: "סך כל ההימורים", s: "SummarySection" }, { v: report.summary.totalBets, s: "Bets" }],
    [{ v: "סך כל הזכיות", s: "SummarySection" }, { v: report.summary.totalWinnings, s: "Winnings" }],
    [
      { v: "רווח / הפסד כולל", s: "SummarySection" },
      { v: report.summary.totalProfitLoss, s: "ProfitLoss" },
    ],
    [{ v: "סך רווח", s: "SummarySection" }, { v: report.summary.totalProfit, s: "ProfitLoss" }],
    [{ v: "סך הפסד", s: "SummarySection" }, { v: report.summary.totalLoss, s: "ProfitLoss" }],
    [
      { v: "עמלת אתר", s: "SummarySection" },
      { v: report.summary.totalPlatformCommission, s: "PlatformCommission" },
    ],
    [
      { v: "עמלת סוכן", s: "SummarySection" },
      { v: report.summary.totalAgentCommission, s: "AgentCommission" },
    ],
    [
      { v: "יתרה סופית מול הסוכן", s: "SummarySection" },
      { v: finalAgentBalance, s: finalBalanceStyle },
    ],
  ];

  const playerHeaderRow: ExcelCell[] = [
    { v: "שם משתמש", s: "Header" },
    { v: "טלפון", s: "Header" },
    { v: "מספר הימורים", s: "Header" },
    { v: "סך הימורים", s: "Header" },
    { v: "סך זכיות", s: "Header" },
    { v: "רווח / הפסד", s: "Header" },
    { v: "עמלת סוכן", s: "Header" },
    { v: "פעילות אחרונה", s: "Header" },
  ];

  const playerDataRows: ExcelCell[][] = report.players.map((row, idx) => {
    const rowStyle = idx % 2 === 1 ? "TableRowAlt" : undefined;
    const cell = (v: string | number | null | undefined): ExcelCell =>
      rowStyle ? { v, s: rowStyle } : v;
    return [
      cell(row.username),
      cell(row.phoneNumber),
      cell(row.betsCount),
      cell(row.totalBets),
      cell(row.totalWinnings),
      cell(row.profitLoss),
      cell(row.agentCommissionShare),
      cell(row.lastActivity),
    ];
  });

  const allRows = [...summaryRows, [], playerHeaderRow, ...playerDataRows];
  const columnCount = 8;
  const freezeAtRow = summaryRows.length + 2; // after summary + blank + header

  return workbookToExcelXml([
    {
      name: "דוח סוכן",
      rows: allRows,
      columnCount,
      freezeHeaderAtRow: freezeAtRow,
    },
  ]);
}

/** יתרה סופית שחקן = TOTAL_PROFIT_LOSS (אם שלילי – השחקן הפסיד, אם חיובי – השחקן הרוויח) */
function getFinalPlayerBalance(report: StructuredPlayerReport): number {
  return report.summary.totalProfitLoss;
}

export function playerFinancialReportToExcel(report: StructuredPlayerReport): string {
  const finalPlayerBalance = getFinalPlayerBalance(report);
  const finalBalanceStyle =
    finalPlayerBalance > 0 ? "FinalBalancePositive" : finalPlayerBalance < 0 ? "FinalBalanceNegative" : "FinalBalanceZero";

  const summaryRows: ExcelCell[][] = [
    [{ v: "דוח שחקן", s: "Header" }, { v: "", s: "Header" }],
    ["נוצר בתאריך", report.meta.generatedAt],
    ["תקופת הדוח", report.meta.reportPeriod],
    ["סוג דוח", report.meta.reportType],
    ["נוצר על ידי", report.meta.generatedBy],
    ["שם משתמש", report.username],
    ["טלפון", report.phoneNumber ?? ""],
    [],
    [{ v: "סיכום", s: "Header" }, { v: "", s: "Header" }],
    [{ v: "סך כל ההימורים", s: "SummarySection" }, { v: report.summary.totalBets, s: "Bets" }],
    [{ v: "סך זכיות", s: "SummarySection" }, { v: report.summary.totalWins, s: "Winnings" }],
    [
      { v: "רווח / הפסד כולל", s: "SummarySection" },
      { v: report.summary.totalProfitLoss, s: "ProfitLoss" },
    ],
    [
      { v: "סה\"כ עמלה", s: "SummarySection" },
      { v: report.summary.totalCommissionGenerated, s: "PlatformCommission" },
    ],
    [
      { v: "מספר הימורים", s: "SummarySection" },
      { v: report.summary.numberOfBets, s: "Bets" },
    ],
    [
      { v: "יתרה סופית שחקן", s: "SummarySection" },
      { v: finalPlayerBalance, s: finalBalanceStyle },
    ],
  ];

  const entryHeaderRow: ExcelCell[] = [
    { v: "תאריך", s: "Header" },
    { v: "תחרות", s: "Header" },
    { v: "סוג תחרות", s: "Header" },
    { v: "סטטוס", s: "Header" },
    { v: "סכום הימור", s: "Header" },
    { v: "תוצאה", s: "Header" },
    { v: "סכום זכייה", s: "Header" },
    { v: "עמלה", s: "Header" },
    { v: "רווח / הפסד", s: "Header" },
  ];

  const entryDataRows: ExcelCell[][] = report.entries.map((entry, idx) => {
    const rowStyle = idx % 2 === 1 ? "TableRowAlt" : undefined;
    const cell = (v: string | number | null | undefined): ExcelCell =>
      rowStyle ? { v, s: rowStyle } : v;
    return [
      cell(entry.date),
      cell(entry.tournament),
      cell(entry.tournamentType),
      cell(entry.status),
      cell(entry.betAmount),
      cell(entry.result),
      cell(entry.winAmount),
      cell(entry.commission),
      cell(entry.profitLoss),
    ];
  });

  const allRows = [...summaryRows, [], entryHeaderRow, ...entryDataRows];
  const columnCount = 9;
  const freezeAtRow = summaryRows.length + 2;

  return workbookToExcelXml([
    {
      name: "דוח שחקן",
      rows: allRows,
      columnCount,
      freezeHeaderAtRow: freezeAtRow,
    },
  ]);
}
