/**
 * Phase 2C: Typed form schema contract and parsing for competition entry forms.
 * Aligned with current football (1/X/2), lotto (6+1), chance (4 suits) patterns.
 */

export type LegacyCompetitionType = "football" | "football_custom" | "lotto" | "chance" | "custom";

/** Form kind discriminator. */
export type FormSchemaKind =
  | "football_match_predictions"
  | "lotto"
  | "chance"
  | "custom";

/** Single field in a form (e.g. one prediction slot). */
export interface FormSchemaField {
  key: string;
  type: "select" | "number" | "text";
  label?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  /** For match predictions: which outcome set. */
  outcomeType?: "1X2";
}

/** Item source for match-based forms. */
export type MatchSource = "world_cup" | "custom" | "draw_items";

/** Form schema for football-style match predictions. */
export interface FootballMatchFormSchema {
  kind: "football_match_predictions";
  matchSource: MatchSource;
  outcomeType: "1X2";
  fieldsPerMatch: FormSchemaField[];
  /** Optional: reference to draw_items or match set. */
  itemSourceRef?: string;
}

/** Form schema for lotto (N numbers + strong). */
export interface LottoFormSchema {
  kind: "lotto";
  regularCount: number;
  regularMin: number;
  regularMax: number;
  strongMin: number;
  strongMax: number;
}

/** Form schema for chance (suits + card values). */
export interface ChanceFormSchema {
  kind: "chance";
  suits: string[];
  cardValues: string[];
}

export type CompetitionFormSchema =
  | FootballMatchFormSchema
  | LottoFormSchema
  | ChanceFormSchema
  | { kind: "custom"; fields?: FormSchemaField[] };

const DEFAULT_FOOTBALL_FORM: FootballMatchFormSchema = {
  kind: "football_match_predictions",
  matchSource: "world_cup",
  outcomeType: "1X2",
  fieldsPerMatch: [{ key: "prediction", type: "select", options: ["1", "X", "2"], required: true, outcomeType: "1X2" }],
};

const DEFAULT_FOOTBALL_CUSTOM_FORM: FootballMatchFormSchema = {
  kind: "football_match_predictions",
  matchSource: "custom",
  outcomeType: "1X2",
  fieldsPerMatch: [{ key: "prediction", type: "select", options: ["1", "X", "2"], required: true, outcomeType: "1X2" }],
};

const DEFAULT_LOTTO_FORM: LottoFormSchema = {
  kind: "lotto",
  regularCount: 6,
  regularMin: 1,
  regularMax: 37,
  strongMin: 1,
  strongMax: 7,
};

const DEFAULT_CHANCE_FORM: ChanceFormSchema = {
  kind: "chance",
  suits: ["heart", "club", "diamond", "spade"],
  cardValues: ["7", "8", "9", "10", "J", "Q", "K", "A"],
};

export function getDefaultFormSchemaForLegacyType(
  legacyType: LegacyCompetitionType
): CompetitionFormSchema {
  switch (legacyType) {
    case "football":
      return DEFAULT_FOOTBALL_FORM;
    case "football_custom":
      return DEFAULT_FOOTBALL_CUSTOM_FORM;
    case "lotto":
      return DEFAULT_LOTTO_FORM;
    case "chance":
      return DEFAULT_CHANCE_FORM;
    default:
      return { kind: "custom", fields: [] };
  }
}

/** Parse and normalize formSchemaJson from competition_types. Invalid/missing returns legacy default. */
export function parseCompetitionFormSchema(
  json: unknown,
  legacyType: LegacyCompetitionType
): { schema: CompetitionFormSchema; warnings: string[] } {
  const warnings: string[] = [];
  if (json == null || json === "") {
    return { schema: getDefaultFormSchemaForLegacyType(legacyType), warnings: ["Missing formSchemaJson, using legacy default"] };
  }
  let raw: unknown;
  try {
    raw = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    warnings.push("Invalid formSchemaJson JSON, using legacy default");
    return { schema: getDefaultFormSchemaForLegacyType(legacyType), warnings };
  }
  if (!raw || typeof raw !== "object") {
    return { schema: getDefaultFormSchemaForLegacyType(legacyType), warnings: ["formSchemaJson is not an object"] };
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind as string | undefined;

  if (kind === "football_match_predictions") {
    const matchSource = (o.matchSource === "world_cup" || o.matchSource === "custom" || o.matchSource === "draw_items")
      ? o.matchSource
      : (o.matchSource as string) === "custom" ? "custom" : "world_cup";
    const outcomeType = o.outcomeType === "1X2" ? "1X2" : "1X2";
    const fieldsPerMatch: FormSchemaField[] = Array.isArray(o.fieldsPerMatch) && o.fieldsPerMatch.length > 0
      ? (o.fieldsPerMatch as Record<string, unknown>[]).map((f) => ({
          key: String(f.key ?? "prediction"),
          type: (f.type === "select" || f.type === "number" || f.type === "text" ? f.type : "select") as FormSchemaField["type"],
          label: f.label != null ? String(f.label) : undefined,
          required: Boolean(f.required),
          options: Array.isArray(f.options) ? (f.options as unknown[]).map(String) : ["1", "X", "2"],
          min: typeof f.min === "number" ? f.min : undefined,
          max: typeof f.max === "number" ? f.max : undefined,
          outcomeType: f.outcomeType === "1X2" ? "1X2" : undefined,
        }))
      : DEFAULT_FOOTBALL_FORM.fieldsPerMatch;
    return {
      schema: { kind: "football_match_predictions", matchSource, outcomeType, fieldsPerMatch, itemSourceRef: o.itemSourceRef != null ? String(o.itemSourceRef) : undefined },
      warnings,
    };
  }

  if (kind === "lotto") {
    const regularCount = typeof o.regularCount === "number" && o.regularCount >= 1 && o.regularCount <= 20 ? o.regularCount : 6;
    const regularMin = typeof o.regularMin === "number" ? o.regularMin : 1;
    const regularMax = typeof o.regularMax === "number" ? o.regularMax : 37;
    const strongMin = typeof o.strongMin === "number" ? o.strongMin : 1;
    const strongMax = typeof o.strongMax === "number" ? o.strongMax : 7;
    return {
      schema: { kind: "lotto", regularCount, regularMin, regularMax, strongMin, strongMax },
      warnings,
    };
  }

  if (kind === "chance") {
    const suits = Array.isArray(o.suits) && o.suits.length > 0
      ? (o.suits as unknown[]).map(String)
      : DEFAULT_CHANCE_FORM.suits;
    const cardValues = Array.isArray(o.cardValues) && o.cardValues.length > 0
      ? (o.cardValues as unknown[]).map(String)
      : DEFAULT_CHANCE_FORM.cardValues;
    return { schema: { kind: "chance", suits, cardValues }, warnings };
  }

  warnings.push("Unknown form schema kind, using legacy default");
  return { schema: getDefaultFormSchemaForLegacyType(legacyType), warnings };
}
