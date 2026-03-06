/**
 * Rate limit for login attempts per IP – נגד brute force.
 * 5 ניסיונות לדקה ל-IP.
 */

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const attemptsByIp = new Map<string, number[]>();

function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
}

export function checkLoginRateLimit(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  let list = attemptsByIp.get(ip) ?? [];
  list = list.filter((t) => t > windowStart);
  if (list.length >= MAX_ATTEMPTS) return false;
  list.push(now);
  attemptsByIp.set(ip, list);
  return true;
}

/** קוראים אחרי ניסיון התחברות כושל – כדי לספור רק כישלונות (אופציונלי). כרגיל סופרים כל ניסיון. */
