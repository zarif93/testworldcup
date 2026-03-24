/**
 * Compatibility: World Cup / older submissions use "1" | "X" | "2".
 * Custom matches may store HOME / DRAW / AWAY for 1X2 markets.
 */

import type { LegacyPick1X2 } from "./types";

/** Map canonical HOME/DRAW/AWAY and legacy 1/X/2 to internal 1X2 key for result comparison. */
export function normalizeToLegacy1X2Key(pred: string): LegacyPick1X2 | null {
  const p = pred.trim();
  if (p === "1" || p === "HOME") return "1";
  if (p === "X" || p === "DRAW") return "X";
  if (p === "2" || p === "AWAY") return "2";
  return null;
}

export function actual1X2Key(homeScore: number, awayScore: number): LegacyPick1X2 {
  if (homeScore > awayScore) return "1";
  if (awayScore > homeScore) return "2";
  return "X";
}
