import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookie } from "cookie";
import { ADMIN_VERIFIED_COOKIE } from "@shared/const";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** הוגדר רק אם ADMIN_SECRET מוגדר – אז גישה ל-admin דורשת גם cookie זה */
  adminCodeVerified: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null;
  try {
    user = await sdk.authenticateRequest(opts.req, opts.res);
  } catch {
    user = null;
  }

  if (user && ((user as { deletedAt?: Date | null }).deletedAt || (user as { isBlocked?: boolean }).isBlocked)) {
    user = null;
  }

  let adminCodeVerified: boolean;
  if (ENV.adminSecret) {
    const cookieHeader = opts.req.headers.cookie;
    const parsed = cookieHeader ? parseCookie(cookieHeader) : {};
    adminCodeVerified = parsed[ADMIN_VERIFIED_COOKIE] === "1";
  } else {
    adminCodeVerified = true;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    adminCodeVerified,
  };
}
