/**
 * Phase 18: Derive next scheduled automation actions for a tournament (read-only).
 * Used for admin visibility; does not write to automation_jobs.
 */

import { AUTOMATION_JOB_TYPES } from "./jobTypes";

type TournamentRow = {
  id: number;
  status?: string | null;
  type?: string | null;
  closesAt?: Date | number | null;
  resultsFinalizedAt?: Date | number | null;
  settledAt?: Date | number | null;
  drawDate?: string | null;
  drawTime?: string | null;
};

export type NextScheduledAction = {
  jobType: string;
  scheduledAt: Date | null;
  reason: string;
};

function toDate(v: Date | number | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const n = Number(v);
  return Number.isNaN(n) ? null : new Date(n);
}

/**
 * Returns the next scheduled actions for this tournament based on status and dates.
 * Does not consider already-scheduled jobs; purely derived from tournament state.
 */
export function getNextScheduledActions(tournament: TournamentRow): NextScheduledAction[] {
  const out: NextScheduledAction[] = [];
  const status = tournament.status ?? "OPEN";
  const type = tournament.type ?? "football";

  // Close submissions: OPEN and closesAt set
  if (status === "OPEN") {
    const closesAt = toDate(tournament.closesAt);
    if (closesAt) {
      out.push({
        jobType: AUTOMATION_JOB_TYPES.TOURNAMENT_CLOSE_SUBMISSIONS,
        scheduledAt: closesAt,
        reason: "Close submissions when closesAt is reached",
      });
    }
  }

  // Finalize results: when LOCKED or CLOSED, use draw date for lotto/chance to schedule finalize
  if (status === "LOCKED" || status === "CLOSED") {
    if (type === "lotto" || type === "chance") {
      const drawDate = tournament.drawDate?.trim();
      const drawTime = tournament.drawTime?.trim();
      if (drawDate && drawTime) {
        try {
          const s = drawDate + "T" + drawTime + ":00+02:00";
          const d = new Date(s);
          if (!Number.isNaN(d.getTime())) {
            out.push({
              jobType: AUTOMATION_JOB_TYPES.TOURNAMENT_FINALIZE_RESULTS,
              scheduledAt: d,
              reason: "After draw date/time (draw must be locked first)",
            });
          }
        } catch {
          // skip invalid date
        }
      }
    }
    // Football: no single scheduled date for finalization; admin enters results then finalizes
  }

  // Settle: not yet settled, settledAt set (interpret as target settlement time)
  const notSettled = status !== "ARCHIVED" && status !== "PRIZES_DISTRIBUTED" && status !== "SETTLING";
  if (notSettled && (status === "RESULTS_UPDATED" || status === "LOCKED" || status === "CLOSED")) {
    const settledAt = toDate(tournament.settledAt);
    if (settledAt) {
      out.push({
        jobType: AUTOMATION_JOB_TYPES.TOURNAMENT_SETTLE,
        scheduledAt: settledAt,
        reason: "Settlement scheduled at settledAt",
      });
    }
  }

  return out;
}
