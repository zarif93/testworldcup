/**
 * Phase 8: Safe validation/parsing for competition item JSON fields.
 * Invalid JSON must not crash admin; return structured errors.
 */

export type JsonValidationResult<T = Record<string, unknown>> =
  | { valid: true; data: T | null }
  | { valid: false; error: string };

/**
 * Parse a string as JSON object. Empty/whitespace becomes null (valid).
 * Invalid JSON returns { valid: false, error }.
 */
export function parseJsonField(
  value: string | null | undefined
): JsonValidationResult {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return { valid: true, data: null };
  }
  const str = typeof value === "string" ? value : String(value);
  try {
    const parsed = JSON.parse(str) as unknown;
    if (parsed !== null && typeof parsed !== "object") {
      return { valid: false, error: "Must be a JSON object or null" };
    }
    return { valid: true, data: parsed as Record<string, unknown> | null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { valid: false, error: `Invalid JSON: ${message}` };
  }
}

/**
 * Validate and normalize option_schema_json.
 */
export function validateOptionSchema(
  value: string | null | undefined
): JsonValidationResult {
  return parseJsonField(value);
}

/**
 * Validate and normalize result_schema_json.
 */
export function validateResultSchema(
  value: string | null | undefined
): JsonValidationResult {
  return parseJsonField(value);
}

/**
 * Validate and normalize metadata_json.
 */
export function validateMetadataJson(
  value: string | null | undefined
): JsonValidationResult {
  return parseJsonField(value);
}

/**
 * Pretty-print an object to JSON string for display/edit. Safe for admin UI.
 */
export function stringifyJson(obj: Record<string, unknown> | null | undefined): string {
  if (obj == null) return "";
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "{}";
  }
}
