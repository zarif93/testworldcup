/**
 * Client-side validation for custom match picks (must mirror server `matchMarkets/marketGrading`).
 */

import { normalizeMarketKind, type ClientMarketKind } from "./marketDisplay";

export function defaultPickForMarketKind(kind: ClientMarketKind): string {
  if (kind === "SPREAD") return "HOME_SPREAD";
  if (kind === "MONEYLINE") return "HOME";
  return "1";
}

/** Whether the stored pick string is allowed for this match row. */
export function isValidPickForMatchRow(
  row: { marketType?: string | null },
  pick: string
): boolean {
  const kind = normalizeMarketKind(row.marketType);
  const p = String(pick).trim();
  if (kind === "SPREAD") return p === "HOME_SPREAD" || p === "AWAY_SPREAD";
  if (kind === "MONEYLINE") return p === "HOME" || p === "AWAY";
  return p === "1" || p === "X" || p === "2" || p === "HOME" || p === "DRAW" || p === "AWAY";
}

export function sanitizePickForMatchRow(
  row: { marketType?: string | null },
  pick: string
): string {
  if (isValidPickForMatchRow(row, pick)) return String(pick).trim();
  return defaultPickForMarketKind(normalizeMarketKind(row.marketType));
}

/** Returns Hebrew error or null if every prediction matches its match row. */
export function validatePredictionsPayloadAgainstMatches(
  matches: Array<{ id: number; marketType?: string | null }>,
  predictions: Array<{ matchId: number; prediction: string }>
): string | null {
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const p of predictions) {
    const row = byId.get(p.matchId);
    if (!row) return `משחק לא תקין: ${p.matchId}`;
    if (!isValidPickForMatchRow(row, p.prediction)) {
      const kind = normalizeMarketKind(row.marketType);
      if (kind === "SPREAD")
        return `משחק ${p.matchId}: נדרש לבחור כיסוי בית או כיסוי חוץ מול הקו (לא ניצחון משחק בלבד)`;
      if (kind === "MONEYLINE") return `משחק ${p.matchId}: במונייליין יש לבחור ניצחון בית או ניצחון חוץ בלבד`;
      return `משחק ${p.matchId}: ב־1X2 יש לבחור 1, X, 2 (או בית / תיקו / חוץ)`;
    }
  }
  return null;
}
