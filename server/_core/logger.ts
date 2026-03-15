/**
 * לוגר פשוט – ב-Production כותב גם לקובץ (logs/app.log), בפיתוח רק ל-console.
 */
import { existsSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { ENV } from "./env";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

let logDir: string | null = null;

function ensureLogDir(): string | null {
  if (logDir !== null) return logDir;
  if (!ENV.isProduction) return null;
  try {
    const dir = join(process.cwd(), "logs");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    logDir = dir;
    return dir;
  } catch {
    return null;
  }
}

function writeToFile(level: string, message: string, meta?: Record<string, unknown>) {
  const dir = ensureLogDir();
  if (!dir) return;
  try {
    const payload: Record<string, unknown> = { level, message, timestamp: new Date().toISOString() };
    if (meta && Object.keys(meta).length > 0) payload.meta = meta;
    const line = JSON.stringify(payload) + "\n";
    appendFileSync(join(dir, "app.log"), line);
  } catch (_) {
    // ignore
  }
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const prefix = `[${level.toUpperCase()}]`;
  if (level === "error") console.error(prefix, message, meta ?? "");
  else if (level === "warn") console.warn(prefix, message, meta ?? "");
  else console.log(prefix, message, meta ?? "");
  if (ENV.isProduction) writeToFile(level, message, meta);
}

/** Phase 11: Structured log for critical flow monitoring. Use in catch blocks and critical paths. */
export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`${context}: ${err.message}`, { stack: err.stack, ...meta });
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};

/** Audit log for financial actions (entry fee, refund, settlement). Always written in production; structured for search. */
export function auditFinance(
  action: "ENTRY_FEE" | "REFUND" | "SETTLEMENT" | "ADJUSTMENT",
  meta: {
    tournamentId?: number;
    userId?: number;
    agentId?: number | null;
    submissionId?: number;
    amountPoints: number;
    idempotencyKey?: string | null;
    [key: string]: unknown;
  }
) {
  logger.info(`[FINANCE_AUDIT] ${action}`, { action, ...meta, timestamp: new Date().toISOString() });
}

/** Security audit – failed logins, role/permission changes, permission denied. Do not log passwords or tokens. */
export function securityAudit(
  event: "failed_login" | "role_assign" | "role_remove" | "permission_denied" | "export_request",
  meta: { ip?: string; userId?: number; username?: string; targetUserId?: number; roleId?: number; permission?: string; [key: string]: unknown }
) {
  logger.warn(`[SECURITY_AUDIT] ${event}`, { event, ...meta, timestamp: new Date().toISOString() });
}
