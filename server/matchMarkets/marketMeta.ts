import type { MatchMarketKind, MatchMarketMeta } from "./types";

/**
 * Single numeric key for matchResults / matchMarkets Maps.
 * JSON, SuperJSON, or drivers may yield string or bigint — plain Map.get(pred.matchId) misses when keys are number-only.
 */
export function normalizeMatchIdKey(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "bigint") {
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

/** DB / API may still send REGULAR_WINNER — treat as REGULAR_1X2 */
export function normalizeStoredMarketType(raw: string | null | undefined): MatchMarketKind {
  const s = (raw ?? "").trim();
  if (!s) return "REGULAR_1X2";
  const u = s.toUpperCase();
  if (u === "SPREAD") return "SPREAD";
  if (u === "MONEYLINE") return "MONEYLINE";
  if (u === "REGULAR_1X2" || u === "REGULAR_WINNER") return "REGULAR_1X2";
  return "REGULAR_1X2";
}

/** Persisted value for SQLite `custom_matches.marketType` (canonical). */
export function normalizeMarketTypeForStorage(raw: string | null | undefined): string {
  const k = normalizeStoredMarketType(raw);
  if (k === "SPREAD") return "SPREAD";
  if (k === "MONEYLINE") return "MONEYLINE";
  return "REGULAR_1X2";
}

export function rowToMeta(row: {
  marketType: string;
  homeSpread: number | null;
  awaySpread: number | null;
}): MatchMarketMeta {
  return {
    marketType: normalizeStoredMarketType(row.marketType),
    homeSpread: row.homeSpread,
    awaySpread: row.awaySpread,
  };
}

export function matchMarketsMapFromRows(
  rows: Array<{ id: number; marketType: string; homeSpread: number | null; awaySpread: number | null }>
): Map<number, MatchMarketMeta> {
  const map = new Map<number, MatchMarketMeta>();
  for (const r of rows) {
    const id = normalizeMatchIdKey((r as { id: unknown }).id);
    if (id == null) continue;
    map.set(id, rowToMeta(r));
  }
  return map;
}
