/**
 * Phase 15: Startup configuration validation – fail fast on invalid critical config.
 */

import { getDb, getDbInitError } from "../db";
import { ENV } from "./env";
import { logger } from "./logger";

export type ConfigValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateCriticalConfig(): ConfigValidationResult {
  const errors: string[] = [];

  if (ENV.isProduction) {
    if (!ENV.cookieSecret || String(ENV.cookieSecret).trim() === "") {
      errors.push("JWT_SECRET (auth) is required in production.");
    }
    if (ENV.adminSecret && String(ENV.adminSecret).trim() === "") {
      errors.push("ADMIN_SECRET must be non-empty if set.");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

/** Call after getDb() in startup – ensures DB is usable. Throws if critical and DB unavailable. */
export async function validateDatabaseConnectivity(): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) {
      const err = getDbInitError();
      return { ok: false, error: err != null ? String(err) : "Database not available" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Run all validations and exit(1) on failure in production. */
export async function validateConfigAndExitIfInvalid(): Promise<void> {
  const critical = validateCriticalConfig();
  if (!critical.ok) {
    critical.errors.forEach((e) => logger.error(e));
    logger.error("Critical config invalid. Exiting.");
    process.exit(1);
  }

  if (ENV.isProduction) {
    const db = await validateDatabaseConnectivity();
    if (!db.ok) {
      logger.error("Database connectivity check failed.", { error: db.error });
      logger.error("Exiting – database is required in production.");
      process.exit(1);
    }
  }
}
