/**
 * Domain boundary: Team library belongs ONLY to football_custom (תחרויות ספורט).
 * Use this constant and guard in all team library routes to prevent misuse from
 * other competition types (mondial, lotto, chance, etc.).
 */

import { TRPCError } from "@trpc/server";

export const TEAM_LIBRARY_SCOPE = "football_custom" as const;
export type TeamLibraryScope = typeof TEAM_LIBRARY_SCOPE;

/** Throws TRPCError BAD_REQUEST if scope is not football_custom. Call at the start of every team library procedure. */
export function assertTeamLibraryScope(scope: string): asserts scope is TeamLibraryScope {
  if (scope !== TEAM_LIBRARY_SCOPE) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Team library is only available for competition type "${TEAM_LIBRARY_SCOPE}". Other types (mondial, lotto, chance) must not use it.`,
    });
  }
}
