/**
 * Phase 12: Centralized rate limiting – submissions, login, leaderboard.
 * Phase 15: Metrics for rate limit hits.
 * In-memory; for production consider Redis-backed limits.
 */

import { incrementRateLimitHit } from "./metrics";

const WINDOW_MS = 60 * 1000;
const SUBMISSIONS_PER_MINUTE = 10;
const LOGIN_ATTEMPTS_PER_MINUTE = 5;
const LEADERBOARD_REQUESTS_PER_MINUTE = 60;

const submissionByUser = new Map<number, number[]>();
const leaderboardByKey = new Map<string, number[]>();

function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : (typeof forwarded === "string" ? forwarded.split(",")[0] : "");
    return first?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
}

function pruneAndCheck(
  store: Map<string | number, number[]>,
  key: string | number,
  limit: number
): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  let list = store.get(key) ?? [];
  list = list.filter((t) => t > windowStart);
  if (list.length >= limit) return false;
  list.push(now);
  store.set(key, list);
  return true;
}

/** Submissions per user per minute. */
export function checkSubmissionRateLimit(userId: number): boolean {
  const ok = pruneAndCheck(submissionByUser, userId, SUBMISSIONS_PER_MINUTE);
  if (!ok) incrementRateLimitHit();
  return ok;
}

/** Leaderboard requests per IP (or per user if authenticated). Key = "ip:" + ip or "u:" + userId. */
export function checkLeaderboardRateLimit(ctx: { user?: { id?: number } | null; req?: { ip?: string; headers?: Record<string, string | string[] | undefined> } }): boolean {
  const key = ctx.user?.id != null ? `u:${ctx.user.id}` : `ip:${getClientIp(ctx.req ?? {})}`;
  const ok = pruneAndCheck(leaderboardByKey, key, LEADERBOARD_REQUESTS_PER_MINUTE);
  if (!ok) incrementRateLimitHit();
  return ok;
}

/** Re-export login rate limit (defined in loginRateLimit.ts). */
export { checkLoginRateLimit, recordFailedLogin } from "./loginRateLimit";

const REGISTRATION_PER_MINUTE = 3;
const USERNAME_CHECK_PER_MINUTE = 30;
const registrationByIp = new Map<string, number[]>();
const usernameCheckByIp = new Map<string, number[]>();

function getClientIpSafe(req: { ip?: string; headers?: Record<string, string | string[] | undefined> } | undefined): string {
  if (!req) return "unknown";
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : (typeof forwarded === "string" ? forwarded.split(",")[0] : "");
    return first?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
}

/** Registration: max 3 per IP per minute to prevent mass account creation. */
export function checkRegistrationRateLimit(req: { ip?: string; headers?: Record<string, string | string[] | undefined> } | undefined): boolean {
  const ip = getClientIpSafe(req);
  const ok = pruneAndCheck(registrationByIp, ip, REGISTRATION_PER_MINUTE);
  if (!ok) incrementRateLimitHit();
  return ok;
}

/** Username availability check: limit to reduce enumeration. */
export function checkUsernameCheckRateLimit(req: { ip?: string; headers?: Record<string, string | string[] | undefined> } | undefined): boolean {
  const ip = getClientIpSafe(req);
  const ok = pruneAndCheck(usernameCheckByIp, ip, USERNAME_CHECK_PER_MINUTE);
  if (!ok) incrementRateLimitHit();
  return ok;
}
