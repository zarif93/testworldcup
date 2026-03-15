/**
 * Phase 2C: Typed settlement config contract and parsing.
 * Prize distribution, min participants, fee model hooks.
 */

export type LegacyCompetitionType = "football" | "football_custom" | "lotto" | "chance" | "custom";

export type PrizeMode = "top_n" | "exact_match" | "custom";

/** Settlement config: prize distribution and participation rules. */
export interface CompetitionSettlementConfig {
  prizeMode: PrizeMode;
  minParticipants: number;
  /** Default prize distribution: rank -> percent (e.g. { "1": 100 } or { "1": 50, "2": 30, "3": 20 }). */
  prizeDistributionDefault: Record<string, number>;
  /** Optional: tie handling hint. */
  tieHandling?: "split" | "first_wins";
}

const DEFAULT_SETTLEMENT: CompetitionSettlementConfig = {
  prizeMode: "top_n",
  minParticipants: 1,
  prizeDistributionDefault: { "1": 100 },
  tieHandling: "split",
};

export function getDefaultSettlementConfigForLegacyType(
  _legacyType: LegacyCompetitionType
): CompetitionSettlementConfig {
  return { ...DEFAULT_SETTLEMENT };
}

/** Parse and normalize settlementConfigJson. Invalid/missing returns default. */
export function parseCompetitionSettlementConfig(
  json: unknown,
  legacyType: LegacyCompetitionType
): { config: CompetitionSettlementConfig; warnings: string[] } {
  const warnings: string[] = [];
  if (json == null || json === "") {
    return { config: getDefaultSettlementConfigForLegacyType(legacyType), warnings: ["Missing settlementConfigJson, using default"] };
  }
  let raw: unknown;
  try {
    raw = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    warnings.push("Invalid settlementConfigJson JSON, using default");
    return { config: getDefaultSettlementConfigForLegacyType(legacyType), warnings };
  }
  if (!raw || typeof raw !== "object") {
    return { config: getDefaultSettlementConfigForLegacyType(legacyType), warnings: ["settlementConfigJson is not an object"] };
  }
  const o = raw as Record<string, unknown>;

  const minParticipants = typeof o.minParticipants === "number" && o.minParticipants >= 0
    ? o.minParticipants
    : 1;

  let prizeDistributionDefault: Record<string, number> = { "1": 100 };
  if (o.prizeDistributionDefault != null && typeof o.prizeDistributionDefault === "object" && !Array.isArray(o.prizeDistributionDefault)) {
    const pd = o.prizeDistributionDefault as Record<string, unknown>;
    prizeDistributionDefault = {};
    for (const [k, v] of Object.entries(pd)) {
      if (typeof v === "number" && v >= 0) prizeDistributionDefault[k] = v;
    }
    if (Object.keys(prizeDistributionDefault).length === 0) prizeDistributionDefault = { "1": 100 };
  }

  const tieHandling = o.tieHandling === "first_wins" ? "first_wins" : "split";

  return {
    config: {
      prizeMode: "top_n",
      minParticipants,
      prizeDistributionDefault,
      tieHandling,
    },
    warnings,
  };
}
