/**
 * ייצוא דוחות רווח/הפסד ועמלות ל-CSV (UTF-8 עם BOM לתאימות Excel בעברית).
 */

const BOM = "\uFEFF";

/** Format number as signed for display: +XXX or -XXX (always show sign). */
function signedDisplay(value: number): string {
  if (value >= 0) return `+${value}`;
  return `${value}`;
}

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

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Player report: settled only. Competition | Entry | Winnings | Commission | Result. Final signed balance. */
export function settlementPlayerReportToCsv(report: {
  username: string | null;
  rows: Array<{ competition: string; entry: number; winnings: number; commission: number; result: number }>;
  summary: { finalResult: number };
  from: string | null;
  to: string | null;
}): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח שחקן (תחרויות שהוסדרו בלבד)", report.username ?? ""]));
  lines.push(rowToCsvLine(["תקופה", report.from && report.to ? `${report.from} — ${report.to}` : "כל התקופה"]));
  lines.push("");
  lines.push(rowToCsvLine(["תוצאה סופית", signed(report.summary.finalResult)]));
  lines.push("");
  lines.push(rowToCsvLine(["תחרות", "השתתפות", "זכיות", "עמלה", "תוצאה"]));
  for (const r of report.rows) {
    lines.push(rowToCsvLine([r.competition, r.entry, r.winnings, r.commission, signed(r.result)]));
  }
  return BOM + lines.join("\r\n");
}

/** Agent: Player | Total Entries | Agent Commission | Player Result. Summary: Total Agent Commission, Total Players Result. */
export function settlementAgentReportToCsv(report: {
  agentName: string | null;
  rows: Array<{ player: string; entries: number; agentCommission: number; result: number }>;
  summary: { totalAgentCommission: number; totalPlayersResult: number; agentFinalBalanceVsSite: number };
  from: string | null;
  to: string | null;
}): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח הסדר – סוכן", report.agentName ?? ""]));
  lines.push(rowToCsvLine(["תקופה", report.from && report.to ? `${report.from} — ${report.to}` : "כל התקופה"]));
  lines.push("");
  lines.push(rowToCsvLine(["סה״כ עמלת סוכן", report.summary.totalAgentCommission]));
  lines.push(rowToCsvLine(["סה״כ תוצאה שחקנים", signed(report.summary.totalPlayersResult)]));
  lines.push(rowToCsvLine(["יתרת סוכן מול אתר", signed(report.summary.agentFinalBalanceVsSite)]));
  lines.push("");
  lines.push(rowToCsvLine(["שחקן", "סה״כ השתתפויות", "עמלת סוכן", "תוצאה שחקן"]));
  for (const r of report.rows) {
    lines.push(rowToCsvLine([r.player, r.entries, r.agentCommission, signed(r.result)]));
  }
  return BOM + lines.join("\r\n");
}

/** Global report: user-based. Player | Agent | Total Entries | Winnings | Site Commission | Result. */
export function settlementGlobalReportToCsv(report: {
  rows: Array<{ player: string; agent: string | null; entries: number; winnings: number; siteCommission: number; result: number }>;
  summary: { totalSiteProfit: number };
  from: string | null;
  to: string | null;
}): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח גלובלי (תחרויות שהוסדרו בלבד)"]));
  lines.push(rowToCsvLine(["תקופה", report.from && report.to ? `${report.from} — ${report.to}` : "כל התקופה"]));
  lines.push("");
  lines.push(rowToCsvLine(["סה״כ רווח אתר", signed(report.summary.totalSiteProfit)]));
  lines.push("");
  lines.push(rowToCsvLine(["שחקן", "סוכן", "סה״כ השתתפויות", "זכיות", "עמלת אתר", "תוצאה"]));
  for (const r of report.rows) {
    lines.push(rowToCsvLine([r.player, r.agent ?? "—", r.entries, r.winnings, r.siteCommission, signed(r.result)]));
  }
  return BOM + lines.join("\r\n");
}

/** Freeroll Expense Report: settled freerolls only. Competition | Prize Paid | Site Expense. Total at bottom. */
export function settlementFreerollReportToCsv(report: {
  rows: Array<{ competition: string; prizePaid: number; siteExpense: number }>;
  summary: { totalSiteExpense: number };
  from: string | null;
  to: string | null;
}): string {
  const lines: string[] = [];
  lines.push(rowToCsvLine(["דוח הוצאות פרירול (תחרויות חינם שהוסדרו)"]));
  lines.push(rowToCsvLine(["תקופה", report.from && report.to ? `${report.from} — ${report.to}` : "כל התקופה"]));
  lines.push("");
  lines.push(rowToCsvLine(["תחרות", "פרסים ששולמו", "הוצאה אתר"]));
  for (const r of report.rows) {
    lines.push(rowToCsvLine([r.competition, r.prizePaid, r.siteExpense]));
  }
  lines.push(rowToCsvLine(["סה״כ הוצאה פרירול", "", report.summary.totalSiteExpense]));
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

