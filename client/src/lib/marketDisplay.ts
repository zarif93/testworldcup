/** Align with server `matchMarkets/marketMeta.normalizeStoredMarketType`. */

export type ClientMarketKind = "REGULAR_1X2" | "MONEYLINE" | "SPREAD";

export function normalizeMarketKind(raw: string | null | undefined): ClientMarketKind {
  const s = (raw ?? "").trim();
  if (s === "SPREAD") return "SPREAD";
  if (s === "MONEYLINE") return "MONEYLINE";
  return "REGULAR_1X2";
}

export function marketKindLabel(kind: ClientMarketKind): string {
  if (kind === "SPREAD") return "פר ספרד";
  if (kind === "MONEYLINE") return "מונייליין";
  return "1X2";
}
