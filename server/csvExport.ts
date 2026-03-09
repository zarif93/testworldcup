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

function rowToExcelXml(cells: Array<string | number | null | undefined>): string {
  const cols = cells
    .map(
      (cell) =>
        `<Cell><Data ss:Type="${
          typeof cell === "number" ? "Number" : "String"
        }">${escapeXml(cell)}</Data></Cell>`
    )
    .join("");
  return `<Row>${cols}</Row>`;
}

function workbookToExcelXml(
  sheets: Array<{ name: string; rows: Array<Array<string | number | null | undefined>> }>
): string {
  const worksheets = sheets
    .map(
      (sheet) =>
        `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${sheet.rows
          .map((row) => rowToExcelXml(row))
          .join("")}</Table></Worksheet>`
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
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
  const lines: string[] = [];
  lines.push(rowToCsvLine(["Agent Report"]));
  lines.push(rowToCsvLine(["Generated At", report.meta.generatedAt]));
  lines.push(rowToCsvLine(["Report Period", report.meta.reportPeriod]));
  lines.push(rowToCsvLine(["Report Type", report.meta.reportType]));
  lines.push(rowToCsvLine(["Generated By", report.meta.generatedBy]));
  lines.push(rowToCsvLine(["Agent Username", report.agentUsername]));
  lines.push("");
  lines.push(rowToCsvLine(["Summary"]));
  lines.push(rowToCsvLine(["TOTAL BETS", report.summary.totalBets]));
  lines.push(rowToCsvLine(["TOTAL WINNINGS", report.summary.totalWinnings]));
  lines.push(rowToCsvLine(["TOTAL PROFIT/LOSS", report.summary.totalProfitLoss]));
  lines.push(rowToCsvLine(["TOTAL PROFIT", report.summary.totalProfit]));
  lines.push(rowToCsvLine(["TOTAL LOSS", report.summary.totalLoss]));
  lines.push(
    rowToCsvLine([
      "TOTAL PLATFORM COMMISSION",
      report.summary.totalPlatformCommission,
    ])
  );
  lines.push(
    rowToCsvLine(["TOTAL AGENT COMMISSION", report.summary.totalAgentCommission])
  );
  lines.push(rowToCsvLine(["AGENT NET RESULT", report.summary.agentNetResult]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "Username",
      "Phone Number",
      "Total Bets",
      "Total Winnings",
      "Profit / Loss",
      "Commission Generated",
      "Agent Commission Share",
      "Number of Bets",
      "Last Activity",
    ])
  );
  for (const row of report.players) {
    lines.push(
      rowToCsvLine([
        row.username,
        row.phoneNumber,
        row.totalBets,
        row.totalWinnings,
        row.profitLoss,
        row.commissionGenerated,
        row.agentCommissionShare,
        row.betsCount,
        row.lastActivity,
      ])
    );
  }
  return BOM + lines.join("\r\n");
}

export function playerFinancialReportToCsv(report: StructuredPlayerReport): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["Player Report"]));
  lines.push(rowToCsvLine(["Generated At", report.meta.generatedAt]));
  lines.push(rowToCsvLine(["Report Period", report.meta.reportPeriod]));
  lines.push(rowToCsvLine(["Report Type", report.meta.reportType]));
  lines.push(rowToCsvLine(["Generated By", report.meta.generatedBy]));
  lines.push(rowToCsvLine(["Username", report.username]));
  lines.push(rowToCsvLine(["Phone Number", report.phoneNumber]));
  lines.push("");
  lines.push(rowToCsvLine(["Summary"]));
  lines.push(rowToCsvLine(["Total Bets", report.summary.totalBets]));
  lines.push(rowToCsvLine(["Total Wins", report.summary.totalWins]));
  lines.push(rowToCsvLine(["Profit / Loss", report.summary.totalProfitLoss]));
  lines.push(
    rowToCsvLine([
      "Total Commission Generated",
      report.summary.totalCommissionGenerated,
    ])
  );
  lines.push(rowToCsvLine(["Number of Bets", report.summary.numberOfBets]));
  lines.push(rowToCsvLine(["Net Balance", report.summary.netBalance]));
  lines.push("");
  lines.push(
    rowToCsvLine([
      "Date",
      "Tournament",
      "Tournament Type",
      "Status",
      "Bet Amount",
      "Result",
      "Win Amount",
      "Commission",
      "Profit / Loss",
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

export function agentFinancialReportToExcel(report: StructuredAgentReport): string {
  return workbookToExcelXml([
    {
      name: "Summary",
      rows: [
        ["Generated At", report.meta.generatedAt],
        ["Report Period", report.meta.reportPeriod],
        ["Report Type", report.meta.reportType],
        ["Generated By", report.meta.generatedBy],
        ["Agent Username", report.agentUsername],
        [],
        ["TOTAL BETS", report.summary.totalBets],
        ["TOTAL WINNINGS", report.summary.totalWinnings],
        ["TOTAL PROFIT/LOSS", report.summary.totalProfitLoss],
        ["TOTAL PROFIT", report.summary.totalProfit],
        ["TOTAL LOSS", report.summary.totalLoss],
        ["TOTAL PLATFORM COMMISSION", report.summary.totalPlatformCommission],
        ["TOTAL AGENT COMMISSION", report.summary.totalAgentCommission],
        ["AGENT NET RESULT", report.summary.agentNetResult],
      ],
    },
    {
      name: "Players",
      rows: [
        [
          "Username",
          "Phone Number",
          "Total Bets",
          "Total Winnings",
          "Profit / Loss",
          "Commission Generated",
          "Agent Commission Share",
          "Number of Bets",
          "Last Activity",
        ],
        ...report.players.map((row) => [
          row.username,
          row.phoneNumber,
          row.totalBets,
          row.totalWinnings,
          row.profitLoss,
          row.commissionGenerated,
          row.agentCommissionShare,
          row.betsCount,
          row.lastActivity,
        ]),
      ],
    },
  ]);
}

export function playerFinancialReportToExcel(report: StructuredPlayerReport): string {
  return workbookToExcelXml([
    {
      name: "Summary",
      rows: [
        ["Generated At", report.meta.generatedAt],
        ["Report Period", report.meta.reportPeriod],
        ["Report Type", report.meta.reportType],
        ["Generated By", report.meta.generatedBy],
        ["Username", report.username],
        ["Phone Number", report.phoneNumber],
        [],
        ["Total Bets", report.summary.totalBets],
        ["Total Wins", report.summary.totalWins],
        ["Profit / Loss", report.summary.totalProfitLoss],
        ["Total Commission Generated", report.summary.totalCommissionGenerated],
        ["Number of Bets", report.summary.numberOfBets],
        ["Net Balance", report.summary.netBalance],
      ],
    },
    {
      name: "Entries",
      rows: [
        [
          "Date",
          "Tournament",
          "Tournament Type",
          "Status",
          "Bet Amount",
          "Result",
          "Win Amount",
          "Commission",
          "Profit / Loss",
        ],
        ...report.entries.map((entry) => [
          entry.date,
          entry.tournament,
          entry.tournamentType,
          entry.status,
          entry.betAmount,
          entry.result,
          entry.winAmount,
          entry.commission,
          entry.profitLoss,
        ]),
      ],
    },
  ]);
}
