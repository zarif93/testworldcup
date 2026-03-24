/** Display helpers for handicap / spread lines (basketball). */

import { normalizeMarketKind } from "./marketDisplay";

export function formatSpreadLine(n: number): string {
  if (n > 0) return `+${n}`;
  if (Object.is(n, -0)) return "0";
  return String(n);
}

/** True when UI should show spreads next to team names (SPREAD market with valid mirrored lines). */
export function isSpreadDisplayMatch(match: {
  marketType?: string | null;
  homeSpread?: number | null;
  awaySpread?: number | null;
}): boolean {
  if (normalizeMarketKind(match.marketType) !== "SPREAD") return false;
  const hs = match.homeSpread;
  const as = match.awaySpread;
  return hs != null && as != null && Number.isFinite(hs) && Number.isFinite(as);
}

/**
 * Append formatted spread next to the team name for SPREAD markets only.
 * Uses configured spreads; + for positive, − for negative; decimals preserved via formatSpreadLine.
 */
export function formatTeamWithSpread(
  teamName: string,
  spread: number | null | undefined,
  marketType?: string | null
): string {
  if (normalizeMarketKind(marketType) !== "SPREAD") return teamName;
  if (spread == null || !Number.isFinite(spread)) return teamName;
  return `${teamName} ${formatSpreadLine(spread)}`;
}

export type MatchPairingDisplayInput = {
  homeTeam: string;
  awayTeam: string;
  marketType?: string | null;
  homeSpread?: number | null;
  awaySpread?: number | null;
};

/**
 * Single-line pairing for headers: "Home -10 vs Away +10" for SPREAD; plain "Home vs Away" otherwise.
 */
export function formatMatchPairingTitle(match: MatchPairingDisplayInput, separator: string = " vs "): string {
  if (!isSpreadDisplayMatch(match)) {
    return `${match.homeTeam}${separator}${match.awayTeam}`;
  }
  return `${formatTeamWithSpread(match.homeTeam, match.homeSpread, match.marketType)}${separator}${formatTeamWithSpread(match.awayTeam, match.awaySpread, match.marketType)}`;
}
