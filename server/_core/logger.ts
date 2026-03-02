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
    const line = `${new Date().toISOString()}\t[${level.toUpperCase()}]\t${message}${meta ? "\t" + JSON.stringify(meta) : ""}\n`;
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

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
