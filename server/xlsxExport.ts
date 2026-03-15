/**
 * XLSX export for finance reports – professional color styling.
 * Uses same data source as CSV; styling only.
 */

import ExcelJS from "exceljs";

// ─── Colors (ARGB) ───────────────────────────────────────────────────────────
const COLORS = {
  headerBg: "FF1E3A5F" as const,   // navy / dark blue
  headerFg: "FFFFFFFF" as const,
  summaryBg: "FFF1F5F9" as const,  // light gray
  profitFg: "FF15803D" as const,   // green
  lossFg: "FFDC2626" as const,      // red
  neutralFg: "FF6B7280" as const,  // gray
  commissionGenerated: "FF4F46E5" as const,  // purple/blue
  agentShare: "FF0D9488" as const, // teal
  platformShare: "FFEA580C" as const, // orange
  winningsFg: "FF15803D" as const,
  refundsFg: "FFD97706" as const,   // amber
  badgeProfit: "FFDCFCE7" as const,
  badgeLoss: "FFFEE2E2" as const,
  badgeEven: "FFF3F4F6" as const,
  // Tournament type backgrounds
  lottoBg: "FFBAE6FD" as const,
  chanceBg: "FFE9D5FF" as const,
  footballBg: "FFBBF7D0" as const,
  mondialBg: "FFFDE68A" as const,
} as const;

function styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, colCount: number) {
  const row = ws.getRow(rowNum);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, size: 12, color: { argb: COLORS.headerFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  }
}

function styleProfitLossCell(cell: ExcelJS.Cell, value: number) {
  if (value > 0) {
    cell.font = { color: { argb: COLORS.profitFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeProfit } };
  } else if (value < 0) {
    cell.font = { color: { argb: COLORS.lossFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeLoss } };
  } else {
    cell.font = { color: { argb: COLORS.neutralFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeEven } };
  }
}

function tournamentTypeBg(type: string): string {
  const t = String(type || "").toLowerCase();
  if (t.includes("lotto")) return COLORS.lottoBg;
  if (t.includes("chance")) return COLORS.chanceBg;
  if (t.includes("football")) return COLORS.footballBg;
  if (t.includes("mondial") || t.includes("world")) return COLORS.mondialBg;
  return "FFFFFFFF";
}

/** Agent report detailed → XLSX buffer */
export async function agentReportDetailedToXlsx(report: {
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
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("דוח סוכן", { views: [{ rightToLeft: true }] });

  let rowNum = 1;
  ws.getCell(rowNum, 1).value = "דוח עמלות ורווח/הפסד סוכן";
  ws.getCell(rowNum, 1).font = { bold: true, size: 16 };
  rowNum += 1;
  ws.getCell(rowNum, 1).value = "סוכן";
  ws.getCell(rowNum, 2).value = report.agentName ?? report.agentUsername ?? "";
  ws.getCell(rowNum, 1).font = { bold: true };
  rowNum += 2;

  // Summary block
  ws.getCell(rowNum, 1).value = "סיכום";
  ws.getCell(rowNum, 1).font = { bold: true };
  ws.getCell(rowNum, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.summaryBg } };
  rowNum += 1;
  const summaryLabels = [
    "סך הכנסות מהשתתפויות",
    "סך פרסים ששולמו",
    "סך החזרים",
    "רווח/הפסד נטו",
    "סה״כ עמלה",
    "חלק סוכן",
    "חלק פלטפורמה",
    "מספר שחקנים",
    "מספר השתתפויות",
  ];
  const summaryValues = [
    report.summary.totalEntriesCollected,
    report.summary.totalWinningsPaid,
    report.summary.totalRefunds,
    report.summary.netProfitLoss,
    report.summary.totalCommission,
    report.summary.agentCommissionShare,
    report.summary.platformCommissionShare,
    report.summary.numberOfPlayers,
    report.summary.numberOfSubmissions,
  ];
  for (let i = 0; i < summaryLabels.length; i++) {
    ws.getCell(rowNum, 1).value = summaryLabels[i];
    ws.getCell(rowNum, 2).value = summaryValues[i];
    ws.getCell(rowNum, 1).font = { bold: true };
    ws.getCell(rowNum, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.summaryBg } };
    if (i === 3) styleProfitLossCell(ws.getCell(rowNum, 2), summaryValues[i]);
    if (i === 4) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.commissionGenerated } };
    if (i === 5) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.agentShare } };
    if (i === 6) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.platformShare } };
    if (i === 1) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.winningsFg } };
    if (i === 2) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.refundsFg } };
    rowNum += 1;
  }
  rowNum += 1;

  // Table headers
  const headers = ["שם מלא", "שם משתמש", "השתתפויות", "סך דמי כניסה", "סך זכיות", "סך החזרים", "רווח/הפסד נטו", "עמלה שנוצרה", "חלק סוכן", "חלק פלטפורמה", "סטטוס"];
  ws.addRow(headers);
  styleHeaderRow(ws, rowNum, headers.length);
  rowNum += 1;

  for (const p of report.players) {
    const statusHe = p.status === "profit" ? "רווח" : p.status === "loss" ? "הפסד" : "מאוזן";
    const row = ws.addRow([
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
    ]);
    const r = row.number;
    ws.getCell(r, 5).font = { color: { argb: COLORS.winningsFg } };
    ws.getCell(r, 6).font = { color: { argb: COLORS.refundsFg } };
    styleProfitLossCell(ws.getCell(r, 7), p.netProfitLoss);
    ws.getCell(r, 8).font = { color: { argb: COLORS.commissionGenerated } };
    ws.getCell(r, 9).font = { color: { argb: COLORS.agentShare } };
    ws.getCell(r, 10).font = { color: { argb: COLORS.platformShare } };
    const statusCell = ws.getCell(r, 11);
    if (p.status === "profit") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeProfit } };
      statusCell.font = { color: { argb: COLORS.profitFg }, bold: true };
    } else if (p.status === "loss") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeLoss } };
      statusCell.font = { color: { argb: COLORS.lossFg }, bold: true };
    } else {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeEven } };
      statusCell.font = { color: { argb: COLORS.neutralFg } };
    }
  }

  ws.columns.forEach((col, i) => {
    if (col) col.width = Math.min(Math.max(12, (col.width ?? 10) + 2), 28);
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Player report detailed → XLSX buffer */
export async function playerReportDetailedToXlsx(report: {
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
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("דוח שחקן", { views: [{ rightToLeft: true }] });

  let rowNum = 1;
  ws.getCell(rowNum, 1).value = "דוח שחקן מפורט – עמלות ורווח/הפסד";
  ws.getCell(rowNum, 1).font = { bold: true, size: 16 };
  rowNum += 1;
  ws.getCell(rowNum, 1).value = "שחקן";
  ws.getCell(rowNum, 2).value = report.fullName ?? report.username ?? "";
  ws.getCell(rowNum, 1).font = { bold: true };
  rowNum += 2;

  const s = report.summary;
  const summaryLabels = [
    "מספר השתתפויות",
    "סך דמי כניסה",
    "סך זכיות ששולמו",
    "סך החזרים",
    "רווח/הפסד נטו",
    "סה״כ עמלה שנוצרה",
    "חלק סוכן",
    "חלק פלטפורמה",
  ];
  const summaryValues = [s.totalParticipations, s.totalEntryFees, s.totalWinningsPaid, s.totalRefunds, s.netProfitLoss, s.totalCommissionGenerated, s.agentShare, s.platformShare];
  ws.getCell(rowNum, 1).value = "סיכום";
  ws.getCell(rowNum, 1).font = { bold: true };
  ws.getCell(rowNum, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.summaryBg } };
  rowNum += 1;
  for (let i = 0; i < summaryLabels.length; i++) {
    ws.getCell(rowNum, 1).value = summaryLabels[i];
    ws.getCell(rowNum, 2).value = summaryValues[i];
    ws.getCell(rowNum, 1).font = { bold: true };
    ws.getCell(rowNum, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.summaryBg } };
    if (i === 4) styleProfitLossCell(ws.getCell(rowNum, 2), summaryValues[i]);
    if (i === 5) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.commissionGenerated } };
    if (i === 6) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.agentShare } };
    if (i === 7) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.platformShare } };
    if (i === 2) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.winningsFg } };
    if (i === 3) ws.getCell(rowNum, 2).font = { color: { argb: COLORS.refundsFg } };
    rowNum += 1;
  }
  rowNum += 1;

  const headers = ["תחרות", "סוג תחרות", "תאריך", "דמי כניסה", "זכיות", "החזר", "תוצאה נטו", "עמלה", "חלק סוכן", "חלק פלטפורמה", "סטטוס"];
  ws.addRow(headers);
  styleHeaderRow(ws, rowNum, headers.length);
  rowNum += 1;

  for (const r of report.rows) {
    const dateStr = r.date ? new Date(r.date).toLocaleDateString("he-IL") : "";
    const statusHe = r.status === "profit" ? "רווח" : r.status === "loss" ? "הפסד" : "מאוזן";
    const row = ws.addRow([
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
    ]);
    const rn = row.number;
    ws.getCell(rn, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: tournamentTypeBg(r.tournamentType) } };
    ws.getCell(rn, 5).font = { color: { argb: COLORS.winningsFg } };
    ws.getCell(rn, 6).font = { color: { argb: COLORS.refundsFg } };
    styleProfitLossCell(ws.getCell(rn, 7), r.netResult);
    ws.getCell(rn, 8).font = { color: { argb: COLORS.commissionGenerated } };
    ws.getCell(rn, 9).font = { color: { argb: COLORS.agentShare } };
    ws.getCell(rn, 10).font = { color: { argb: COLORS.platformShare } };
    const statusCell = ws.getCell(rn, 11);
    if (r.status === "profit") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeProfit } };
      statusCell.font = { color: { argb: COLORS.profitFg }, bold: true };
    } else if (r.status === "loss") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeLoss } };
      statusCell.font = { color: { argb: COLORS.lossFg }, bold: true };
    } else {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeEven } };
      statusCell.font = { color: { argb: COLORS.neutralFg } };
    }
  }

  ws.columns.forEach((col, i) => {
    if (col) col.width = Math.min(Math.max(12, (col.width ?? 10) + 2), 28);
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Global finance report → XLSX buffer (summary + by tournament / agent / player) */
export async function globalFinanceReportToXlsx(report: {
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
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // ─── Summary sheet ───────────────────────────────────────────────────────
  const summarySheet = wb.addWorksheet("סיכום", { views: [{ rightToLeft: true }] });
  let r = 1;
  summarySheet.getCell(r, 1).value = "דוח כספי גלובלי";
  summarySheet.getCell(r, 1).font = { bold: true, size: 16 };
  r += 1;
  summarySheet.getCell(r, 1).value = "תקופה";
  summarySheet.getCell(r, 2).value = report.from ? `${report.from} - ${report.to ?? ""}` : "כל התקופה";
  r += 2;

  summarySheet.getCell(r, 1).value = "סיכום";
  summarySheet.getCell(r, 1).font = { bold: true };
  summarySheet.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.summaryBg } };
  r += 1;
  const sumLabels = [
    "סה״כ השתתפויות",
    "סך דמי כניסה שגבינו",
    "סך זכיות ששולמו",
    "סך החזרים",
    "רווח/הפסד נטו פלטפורמה",
    "סה״כ עמלה שנוצרה",
    "סה״כ עמלת סוכנים",
    "סה״כ עמלת פלטפורמה",
    "מספר תחרויות",
    "מספר שחקנים פעילים",
    "מספר סוכנים פעילים",
  ];
  const sumVals = [
    report.summary.totalParticipations,
    report.summary.totalEntryFeesCollected,
    report.summary.totalWinningsPaid,
    report.summary.totalRefunds,
    report.summary.netPlatformProfitLoss,
    report.summary.totalCommissionGenerated,
    report.summary.totalAgentCommission,
    report.summary.totalPlatformCommission,
    report.summary.numberOfTournaments,
    report.summary.numberOfActivePlayers,
    report.summary.numberOfActiveAgents,
  ];
  for (let i = 0; i < sumLabels.length; i++) {
    summarySheet.getCell(r, 1).value = sumLabels[i];
    summarySheet.getCell(r, 2).value = sumVals[i];
    summarySheet.getCell(r, 1).font = { bold: true };
    summarySheet.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.summaryBg } };
    if (i === 4) styleProfitLossCell(summarySheet.getCell(r, 2), sumVals[i]);
    if (i === 5) summarySheet.getCell(r, 2).font = { color: { argb: COLORS.commissionGenerated } };
    if (i === 6) summarySheet.getCell(r, 2).font = { color: { argb: COLORS.agentShare } };
    if (i === 7) summarySheet.getCell(r, 2).font = { color: { argb: COLORS.platformShare } };
    if (i === 2) summarySheet.getCell(r, 2).font = { color: { argb: COLORS.winningsFg } };
    if (i === 3) summarySheet.getCell(r, 2).font = { color: { argb: COLORS.refundsFg } };
    r += 1;
  }

  // ─── By Tournament ─────────────────────────────────────────────────────────
  const tourSheet = wb.addWorksheet("לפי תחרות", { views: [{ rightToLeft: true }] });
  r = 1;
  tourSheet.getCell(r, 1).value = "לפי תחרות";
  tourSheet.getCell(r, 1).font = { bold: true, size: 14 };
  r += 1;
  const tourHeaders = ["תחרות", "סוג", "השתתפויות", "דמי כניסה", "זכיות ששולמו", "החזרים", "תוצאה נטו", "עמלה", "עמלת סוכן", "עמלת פלטפורמה"];
  tourSheet.addRow(tourHeaders);
  styleHeaderRow(tourSheet, r, tourHeaders.length);
  r += 1;
  for (const row of report.byTournament) {
    const excelRow = tourSheet.addRow([
      row.tournamentName,
      row.tournamentType,
      row.participations,
      row.entryFees,
      row.winningsPaid,
      row.refunds,
      row.netResult,
      row.totalCommission,
      row.agentCommission,
      row.platformCommission,
    ]);
    const rn = excelRow.number;
    tourSheet.getCell(rn, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: tournamentTypeBg(row.tournamentType) } };
    tourSheet.getCell(rn, 5).font = { color: { argb: COLORS.winningsFg } };
    tourSheet.getCell(rn, 6).font = { color: { argb: COLORS.refundsFg } };
    styleProfitLossCell(tourSheet.getCell(rn, 7), row.netResult);
    tourSheet.getCell(rn, 8).font = { color: { argb: COLORS.commissionGenerated } };
    tourSheet.getCell(rn, 9).font = { color: { argb: COLORS.agentShare } };
    tourSheet.getCell(rn, 10).font = { color: { argb: COLORS.platformShare } };
  }

  // ─── By Agent ─────────────────────────────────────────────────────────────
  const agentSheet = wb.addWorksheet("לפי סוכן", { views: [{ rightToLeft: true }] });
  r = 1;
  agentSheet.getCell(r, 1).value = "לפי סוכן";
  agentSheet.getCell(r, 1).font = { bold: true, size: 14 };
  r += 1;
  const agentHeaders = ["סוכן", "שם משתמש", "מספר שחקנים", "השתתפויות", "דמי כניסה", "זכיות ששולמו", "החזרים", "עמלה שנוצרה", "עמלת סוכן", "חלק פלטפורמה"];
  agentSheet.addRow(agentHeaders);
  styleHeaderRow(agentSheet, r, agentHeaders.length);
  r += 1;
  for (const row of report.byAgent) {
    const excelRow = agentSheet.addRow([
      row.agentName ?? "",
      row.agentUsername ?? "",
      row.numberOfPlayers,
      row.participations,
      row.entryFees,
      row.winningsPaid,
      row.refunds,
      row.totalCommissionGenerated,
      row.agentCommission,
      row.platformShare,
    ]);
    const rn = excelRow.number;
    agentSheet.getCell(rn, 6).font = { color: { argb: COLORS.winningsFg } };
    agentSheet.getCell(rn, 7).font = { color: { argb: COLORS.refundsFg } };
    agentSheet.getCell(rn, 8).font = { color: { argb: COLORS.commissionGenerated } };
    agentSheet.getCell(rn, 9).font = { color: { argb: COLORS.agentShare } };
    agentSheet.getCell(rn, 10).font = { color: { argb: COLORS.platformShare } };
  }

  // ─── By Player ────────────────────────────────────────────────────────────
  const playerSheet = wb.addWorksheet("לפי שחקן", { views: [{ rightToLeft: true }] });
  r = 1;
  playerSheet.getCell(r, 1).value = "לפי שחקן";
  playerSheet.getCell(r, 1).font = { bold: true, size: 14 };
  r += 1;
  const playerHeaders = ["שם מלא", "שם משתמש", "השתתפויות", "דמי כניסה", "זכיות ששולמו", "החזרים", "רווח/הפסד נטו", "עמלה שנוצרה", "חלק סוכן", "חלק פלטפורמה"];
  playerSheet.addRow(playerHeaders);
  styleHeaderRow(playerSheet, r, playerHeaders.length);
  r += 1;
  for (const row of report.byPlayer) {
    const excelRow = playerSheet.addRow([
      row.fullName ?? "",
      row.username ?? "",
      row.participations,
      row.entryFees,
      row.winningsPaid,
      row.refunds,
      row.netProfitLoss,
      row.totalCommissionGenerated,
      row.agentShare,
      row.platformShare,
    ]);
    const rn = excelRow.number;
    playerSheet.getCell(rn, 5).font = { color: { argb: COLORS.winningsFg } };
    playerSheet.getCell(rn, 6).font = { color: { argb: COLORS.refundsFg } };
    styleProfitLossCell(playerSheet.getCell(rn, 7), row.netProfitLoss);
    playerSheet.getCell(rn, 8).font = { color: { argb: COLORS.commissionGenerated } };
    playerSheet.getCell(rn, 9).font = { color: { argb: COLORS.agentShare } };
    playerSheet.getCell(rn, 10).font = { color: { argb: COLORS.platformShare } };
  }

  for (const ws of wb.worksheets) {
    ws.columns.forEach((col) => {
      if (col) col.width = Math.min(Math.max(12, (col.width ?? 10) + 2), 28);
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
