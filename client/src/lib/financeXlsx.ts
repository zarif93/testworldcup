/**
 * Client-side XLSX export for finance tabs (tournaments, agents, players).
 * Professional color styling; same data as CSV.
 */

import ExcelJS from "exceljs";

const COLORS = {
  headerBg: "FF1E3A5F",
  headerFg: "FFFFFFFF",
  summaryBg: "FFF1F5F9",
  profitFg: "FF15803D",
  lossFg: "FFDC2626",
  neutralFg: "FF6B7280",
  commissionGenerated: "FF4F46E5",
  agentShare: "FF0D9488",
  platformShare: "FFEA580C",
  winningsFg: "FF15803D",
  refundsFg: "FFD97706",
  badgeProfit: "FFDCFCE7",
  badgeLoss: "FFFEE2E2",
  badgeEven: "FFF3F4F6",
  lottoBg: "FFBAE6FD",
  chanceBg: "FFE9D5FF",
  footballBg: "FFBBF7D0",
  mondialBg: "FFFDE68A",
};

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
  const t = String(type ?? "").toLowerCase();
  if (t.includes("lotto")) return COLORS.lottoBg;
  if (t.includes("chance")) return COLORS.chanceBg;
  if (t.includes("football")) return COLORS.footballBg;
  if (t.includes("mondial") || t.includes("world")) return COLORS.mondialBg;
  return "FFFFFFFF";
}

function formatPct(bps: number): string {
  return bps != null ? `${(bps / 100).toFixed(2)}%` : "—";
}

type TournamentRow = {
  tournamentName?: string | null;
  participantCount?: number | null;
  totalPool?: number | null;
  commissionBasisPoints?: number | null;
  platformCommission?: number | null;
  agentCommissionTotal?: number | null;
  prizePool?: number | null;
  totalPrizesDistributed?: number | null;
  totalRefunded?: number | null;
  platformNetProfit?: number | null;
  status?: string | null;
  tournamentType?: string | null;
};

export async function buildTournamentsWorkbook(rows: TournamentRow[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("תחרויות", { views: [{ rightToLeft: true }] });
  let rowNum = 1;
  ws.getCell(rowNum, 1).value = "דוח כספים – תחרויות";
  ws.getCell(rowNum, 1).font = { bold: true, size: 16 };
  rowNum += 2;
  const headers = ["תחרות", "משתתפים", "סה״כ ברוטו", "עמלה %", "עמלת פלטפורמה", "עמלת סוכנים", "קופת פרסים", "פרסים שולמו", "החזרים", "רווח נטו", "סטטוס"];
  ws.addRow(headers);
  styleHeaderRow(ws, rowNum, headers.length);
  rowNum += 1;
  for (const t of rows) {
    const excelRow = ws.addRow([
      t.tournamentName ?? "",
      t.participantCount ?? "",
      t.totalPool ?? "",
      formatPct(t.commissionBasisPoints ?? 0),
      t.platformCommission ?? "",
      t.agentCommissionTotal ?? "",
      t.prizePool ?? "",
      t.totalPrizesDistributed ?? "",
      t.totalRefunded ?? "",
      t.platformNetProfit ?? "",
      t.status ?? "",
    ]);
    const rn = excelRow.number;
    if (t.tournamentType) ws.getCell(rn, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: tournamentTypeBg(t.tournamentType) } };
    ws.getCell(rn, 8).font = { color: { argb: COLORS.winningsFg } };
    ws.getCell(rn, 9).font = { color: { argb: COLORS.refundsFg } };
    styleProfitLossCell(ws.getCell(rn, 10), Number(t.platformNetProfit ?? 0));
    ws.getCell(rn, 5).font = { color: { argb: COLORS.commissionGenerated } };
    ws.getCell(rn, 6).font = { color: { argb: COLORS.agentShare } };
    const statusCell = ws.getCell(rn, 11);
    const profit = Number(t.platformNetProfit ?? 0);
    if (profit > 0) {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeProfit } };
      statusCell.font = { color: { argb: COLORS.profitFg }, bold: true };
    } else if (profit < 0) {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeLoss } };
      statusCell.font = { color: { argb: COLORS.lossFg }, bold: true };
    } else {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.badgeEven } };
      statusCell.font = { color: { argb: COLORS.neutralFg } };
    }
  }
  ws.columns.forEach((col) => { if (col) col.width = Math.min(Math.max(12, (col.width ?? 10) + 2), 28); });
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

type AgentRow = {
  agentId: number;
  agentName?: string | null;
  agentUsername?: string | null;
  numberOfPlayers?: number | null;
  totalPlayerEntryFees?: number | null;
  totalCommissionGenerated?: number | null;
  agentTotalCommissionEarned?: number | null;
  platformNetProfitFromAgent?: number | null;
  totalPlayerPrizes?: number | null;
};

export async function buildAgentsWorkbook(rows: AgentRow[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("סוכנים", { views: [{ rightToLeft: true }] });
  let rowNum = 1;
  ws.getCell(rowNum, 1).value = "דוח כספים – סוכנים";
  ws.getCell(rowNum, 1).font = { bold: true, size: 16 };
  rowNum += 2;
  const headers = ["סוכן", "שחקנים", "סה״כ השתתפויות", "עמלות שנוצרו", "עמלה לסוכן", "רווח פלטפורמה", "סה״כ פרסים"];
  ws.addRow(headers);
  styleHeaderRow(ws, rowNum, headers.length);
  rowNum += 1;
  for (const a of rows) {
    const excelRow = ws.addRow([
      a.agentName ?? a.agentUsername ?? `#${a.agentId}`,
      a.numberOfPlayers ?? "",
      a.totalPlayerEntryFees ?? "",
      a.totalCommissionGenerated ?? "",
      a.agentTotalCommissionEarned ?? "",
      a.platformNetProfitFromAgent ?? "",
      a.totalPlayerPrizes ?? "",
    ]);
    const rn = excelRow.number;
    ws.getCell(rn, 4).font = { color: { argb: COLORS.commissionGenerated } };
    ws.getCell(rn, 5).font = { color: { argb: COLORS.agentShare } };
    ws.getCell(rn, 6).font = { color: { argb: COLORS.platformShare } };
    ws.getCell(rn, 7).font = { color: { argb: COLORS.winningsFg } };
    styleProfitLossCell(ws.getCell(rn, 6), Number(a.platformNetProfitFromAgent ?? 0));
  }
  ws.columns.forEach((col) => { if (col) col.width = Math.min(Math.max(12, (col.width ?? 10) + 2), 28); });
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

type PlayerRow = {
  userId: number;
  username?: string | null;
  assignedAgentId?: number | null;
  totalEntryFees?: number;
  totalEntryFeeRefunds?: number | null;
  totalPrizesWon?: number | null;
  competitionNetPnL?: number;
  walletNetFlow?: number;
  totalCommissionGenerated?: number;
  platformProfitFromPlayer?: number;
};

export async function buildPlayersWorkbook(rows: PlayerRow[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("שחקנים", { views: [{ rightToLeft: true }] });
  let rowNum = 1;
  ws.getCell(rowNum, 1).value = "דוח כספים – שחקנים";
  ws.getCell(rowNum, 1).font = { bold: true, size: 16 };
  rowNum += 2;
  const headers = ["שם משתמש", "סוכן", "השתתפויות", "פרסים", "החזרים", "רווח/הפסד תחרות", "תזרים ארנק", "עמלות שנוצרו", "רווח פלטפורמה"];
  ws.addRow(headers);
  styleHeaderRow(ws, rowNum, headers.length);
  rowNum += 1;
  for (const p of rows) {
    const excelRow = ws.addRow([
      p.username ?? `#${p.userId}`,
      p.assignedAgentId != null ? `#${p.assignedAgentId}` : "—",
      (p.totalEntryFees ?? 0) - (p.totalEntryFeeRefunds ?? 0),
      p.totalPrizesWon ?? "",
      p.totalEntryFeeRefunds ?? "",
      p.competitionNetPnL ?? "",
      p.walletNetFlow ?? "",
      p.totalCommissionGenerated ?? "",
      p.platformProfitFromPlayer ?? "",
    ]);
    const rn = excelRow.number;
    ws.getCell(rn, 4).font = { color: { argb: COLORS.winningsFg } };
    ws.getCell(rn, 5).font = { color: { argb: COLORS.refundsFg } };
    styleProfitLossCell(ws.getCell(rn, 6), p.competitionNetPnL ?? 0);
    ws.getCell(rn, 8).font = { color: { argb: COLORS.commissionGenerated } };
    ws.getCell(rn, 9).font = { color: { argb: COLORS.platformShare } };
  }
  ws.columns.forEach((col) => { if (col) col.width = Math.min(Math.max(12, (col.width ?? 10) + 2), 28); });
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBase64Xlsx(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, filename);
}
