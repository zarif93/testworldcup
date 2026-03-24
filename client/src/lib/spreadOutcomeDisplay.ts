/**
 * Display-only spread / moneyline grading (aligned with server spread math).
 */

import { formatSpreadLine, formatTeamWithSpread } from "./spreadDisplay";

const EPS = 1e-9;

export type SideOutcome = "win" | "loss" | "push";

export function spreadCoverSide(
  homeScore: number,
  awayScore: number,
  homeSpread: number,
  awaySpread: number
): "HOME_COVER" | "AWAY_COVER" | "PUSH" {
  const adjH = homeScore + homeSpread;
  const adjA = awayScore + awaySpread;
  if (Math.abs(adjH - adjA) < EPS) return "PUSH";
  return adjH > adjA ? "HOME_COVER" : "AWAY_COVER";
}

export function spreadUserOutcome(
  pick: "HOME_SPREAD" | "AWAY_SPREAD",
  homeScore: number,
  awayScore: number,
  homeSpread: number,
  awaySpread: number
): SideOutcome {
  const cover = spreadCoverSide(homeScore, awayScore, homeSpread, awaySpread);
  if (cover === "PUSH") return "push";
  if (pick === "HOME_SPREAD" && cover === "HOME_COVER") return "win";
  if (pick === "AWAY_SPREAD" && cover === "AWAY_COVER") return "win";
  return "loss";
}

export function moneylineUserOutcome(pick: "HOME" | "AWAY", homeScore: number, awayScore: number): SideOutcome {
  if (homeScore === awayScore) return "push";
  const w: "HOME" | "AWAY" = homeScore > awayScore ? "HOME" : "AWAY";
  return pick === w ? "win" : "loss";
}

export function formatSpreadResultLine(
  homeScore: number,
  awayScore: number,
  homeSpread: number,
  awaySpread: number,
  homeName: string,
  awayName: string
): string {
  const adjH = homeScore + homeSpread;
  const adjA = awayScore + awaySpread;
  const cover = spreadCoverSide(homeScore, awayScore, homeSpread, awaySpread);
  const coverLabel =
    cover === "PUSH" ? "דחייה (Push)" : cover === "HOME_COVER" ? "כיסוי בית" : "כיסוי חוץ";
  return `תוצאה ${homeScore}–${awayScore} · קו ${formatTeamWithSpread(homeName, homeSpread, "SPREAD")} / ${formatTeamWithSpread(awayName, awaySpread, "SPREAD")} · מול הקו ${formatSpreadLine(adjH)}–${formatSpreadLine(adjA)} · ${coverLabel}`;
}
