/**
 * Phase 2C: Validate a submission payload against a resolved form schema.
 * Does NOT replace current submit validation; ready for future schema-driven submit.
 */

import type { CompetitionFormSchema } from "./competitionFormSchema";

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate payload against form schema. Returns { valid, errors }.
 * Handles football (array of { matchId, prediction }), lotto ({ numbers, strongNumber }), chance (suits).
 */
export function validateEntryAgainstFormSchema(
  schema: CompetitionFormSchema,
  payload: unknown
): ValidationResult {
  const errors: ValidationError[] = [];

  if (schema.kind === "football_match_predictions") {
    if (!Array.isArray(payload)) {
      errors.push({ path: "", message: "Predictions must be an array for football/custom football" });
      return { valid: false, errors };
    }
    const options = schema.fieldsPerMatch[0]?.options ?? ["1", "X", "2"];
    for (let i = 0; i < payload.length; i++) {
      const p = payload[i];
      if (!p || typeof p !== "object") {
        errors.push({ path: `[${i}]`, message: "Each prediction must be an object with matchId and prediction" });
        continue;
      }
      const o = p as Record<string, unknown>;
      if (typeof o.matchId !== "number" && typeof o.matchId !== "string") {
        errors.push({ path: `[${i}].matchId`, message: "matchId must be a number" });
      }
      const pred = o.prediction;
      const predStr = String(pred);
      const extraMarketOk =
        predStr === "HOME_SPREAD" ||
        predStr === "AWAY_SPREAD" ||
        predStr === "HOME" ||
        predStr === "AWAY" ||
        predStr === "DRAW";
      if (!options.includes(predStr) && !extraMarketOk) {
        errors.push({
          path: `[${i}].prediction`,
          message: `prediction must be one of: ${options.join(", ")} (or HOME/DRAW/AWAY, HOME/AWAY, or HOME_SPREAD/AWAY_SPREAD for other markets)`,
        });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  if (schema.kind === "lotto") {
    if (!payload || typeof payload !== "object") {
      errors.push({ path: "", message: "Lotto payload must be an object with numbers and strongNumber" });
      return { valid: false, errors };
    }
    const o = payload as Record<string, unknown>;
    const numbers = o.numbers;
    if (!Array.isArray(numbers) || numbers.length !== schema.regularCount) {
      errors.push({ path: "numbers", message: `numbers must be an array of ${schema.regularCount} unique numbers` });
    } else {
      const set = new Set<number>();
      for (let i = 0; i < numbers.length; i++) {
        const n = Number(numbers[i]);
        if (!Number.isInteger(n) || n < schema.regularMin || n > schema.regularMax) {
          errors.push({ path: `numbers[${i}]`, message: `Each number must be integer ${schema.regularMin}-${schema.regularMax}` });
        } else if (set.has(n)) {
          errors.push({ path: `numbers[${i}]`, message: "Numbers must be unique" });
        } else set.add(n);
      }
    }
    const strong = o.strongNumber;
    if (typeof strong !== "number" || !Number.isInteger(strong) || strong < schema.strongMin || strong > schema.strongMax) {
      errors.push({ path: "strongNumber", message: `strongNumber must be integer ${schema.strongMin}-${schema.strongMax}` });
    }
    return { valid: errors.length === 0, errors };
  }

  if (schema.kind === "chance") {
    if (!payload || typeof payload !== "object") {
      errors.push({ path: "", message: "Chance payload must be an object with suit keys" });
      return { valid: false, errors };
    }
    const o = payload as Record<string, unknown>;
    for (const suit of schema.suits) {
      const val = o[suit];
      if (val === undefined || val === null) {
        errors.push({ path: suit, message: `Missing card for suit: ${suit}` });
      } else if (!schema.cardValues.includes(String(val))) {
        errors.push({ path: suit, message: `Invalid card value for ${suit}; must be one of: ${schema.cardValues.join(", ")}` });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  return { valid: true, errors: [] };
}
