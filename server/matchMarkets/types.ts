/**
 * Sport-agnostic match market kinds for custom tournament matches.
 */

/** Stored in DB `custom_matches.marketType` */
export type MatchMarketKind = "REGULAR_1X2" | "MONEYLINE" | "SPREAD";

/** Legacy DB value before rename — normalized at read time */
export type LegacyMarketTypeAlias = "REGULAR_WINNER";

/** Canonical pick strings (submissions.predictions[].prediction) */
export type Pick1X2 = "HOME" | "DRAW" | "AWAY";
export type PickMoneyline = "HOME" | "AWAY";
export type PickSpread = "HOME_SPREAD" | "AWAY_SPREAD";

/** Legacy 1/X/2 still accepted for REGULAR_1X2 only */
export type LegacyPick1X2 = "1" | "X" | "2";

export type CanonicalMatchPick = Pick1X2 | LegacyPick1X2 | PickMoneyline | PickSpread;

export interface MatchMarketMeta {
  marketType: MatchMarketKind;
  homeSpread: number | null;
  awaySpread: number | null;
}
