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
