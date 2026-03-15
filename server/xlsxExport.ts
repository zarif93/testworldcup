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

// Legacy XLSX exports (agent/player/global/general finance reports) removed – settlement uses CSV only.
