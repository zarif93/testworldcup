/**
 * Rate limit for login – brute force protection.
 * Only FAILED attempts count toward the limit (successful login does not consume quota).
 * 5 failed attempts per IP per minute → block for remainder of window.
 */

const WINDOW_MS = 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const failedAttemptsByIp = new Map<string, number[]>();

export function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
}

/** Call when login FAILS (wrong password or user not found). Returns false if under limit (allowed to try again). */
export function recordFailedLogin(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  let list = failedAttemptsByIp.get(ip) ?? [];
  list = list.filter((t) => t > windowStart);
  list.push(now);
  failedAttemptsByIp.set(ip, list);
}

/** Returns true if this IP is still allowed to attempt login (under limit). Call before attempting login. */
export function checkLoginRateLimit(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const list = failedAttemptsByIp.get(ip) ?? [];
  const recent = list.filter((t) => t > windowStart);
  return recent.length < MAX_FAILED_ATTEMPTS;
}
