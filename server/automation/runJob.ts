/**
 * Phase 18: Idempotent automation job runner.
 * Safe: skip if already done or conditions unmet; log and record job result.
 */

import { logger } from "../_core/logger";
import { incrementSettlementRun, incrementSettlementFailure } from "../_core/metrics";
import {
  getTournamentById,
  getTournamentsToAutoClose,
  runAutoCloseSingleTournament,
  setTournamentResultsFinalized,
  insertAutomationJob,
  getLottoDrawResult,
  getChanceDrawResult,
  getMatches,
  getCustomMatches,
  getParticipantUserIdsForTournament,
} from "../db";
import { AUTOMATION_JOB_TYPES, type AutomationJobType } from "./jobTypes";

export type JobResult = { executed: boolean; status: "executed" | "skipped" | "failed"; message?: string };

/** Run a single automation job. Idempotent; never throws. */
const DEFAULT_MAX_RETRIES = 3;

export async function runAutomationJob(
  jobType: AutomationJobType,
  tournamentId: number,
  options?: { scheduledAt?: Date | number | null; retryCount?: number }
): Promise<JobResult> {
  const scheduledAt = options?.scheduledAt != null ? (options.scheduledAt instanceof Date ? options.scheduledAt : new Date(options.scheduledAt)) : new Date();
  const now = new Date();
  const attemptNumber = options?.retryCount ?? 0;

  const logAndRecord = async (status: "executed" | "skipped" | "failed", message?: string, err?: unknown) => {
    const lastError = err != null ? String(err) : message && status === "failed" ? message : null;
    try {
      await insertAutomationJob({
        jobType,
        entityType: "tournament",
        entityId: tournamentId,
        scheduledAt,
        executedAt: now,
        status,
        lastError: lastError ?? null,
        retryCount: attemptNumber,
        maxRetries: DEFAULT_MAX_RETRIES,
      });
    } catch (e) {
      logger.warn("Automation: failed to insert job log", { jobType, tournamentId, error: String(e) });
    }
    if (status === "executed") logger.info("Automation: job executed", { jobType, tournamentId });
    else if (status === "skipped") logger.debug?.("Automation: job skipped", { jobType, tournamentId, reason: message });
    else logger.warn("Automation: job failed", { jobType, tournamentId, message: lastError });
    try {
      if (status === "failed") {
        const { notifyLater } = await import("../notifications/createNotification");
        const { NOTIFICATION_TYPES } = await import("../notifications/types");
        notifyLater({
          type: NOTIFICATION_TYPES.AUTOMATION_FAILED,
          recipientType: "admin",
          title: "אוטומציה נכשלה",
          body: message ?? lastError ?? jobType,
          payload: { jobType, tournamentId, message: message ?? null, lastError: lastError ?? null },
        });
      } else if (status === "skipped") {
        const { notifyLater } = await import("../notifications/createNotification");
        const { NOTIFICATION_TYPES } = await import("../notifications/types");
        notifyLater({
          type: NOTIFICATION_TYPES.AUTOMATION_SKIPPED,
          recipientType: "admin",
          title: "אוטומציה דולגה",
          body: message ?? jobType,
          payload: { jobType, tournamentId, message: message ?? null },
        });
      }
    } catch (_) {
      // never fail main flow
    }
  };

  try {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) {
      await logAndRecord("skipped", "Tournament not found");
      return { executed: false, status: "skipped", message: "Tournament not found" };
    }
    const status = (tournament as { status?: string }).status ?? "OPEN";
    const type = (tournament as { type?: string }).type ?? "football";

    switch (jobType) {
      case AUTOMATION_JOB_TYPES.TOURNAMENT_CLOSE_SUBMISSIONS: {
        if (status !== "OPEN") {
          await logAndRecord("skipped", "Tournament not OPEN");
          return { executed: false, status: "skipped", message: "Tournament not OPEN" };
        }
        const list = await getTournamentsToAutoClose();
        const found = list.some((t) => t.id === tournamentId);
        if (!found) {
          await logAndRecord("skipped", "closesAt not passed or not set");
          return { executed: false, status: "skipped", message: "closesAt not passed or not set" };
        }
        const didRun = await runAutoCloseSingleTournament(tournamentId);
        await logAndRecord(didRun ? "executed" : "skipped", didRun ? undefined : "Not updated");
        if (didRun) {
          try {
            const { notifyLater } = await import("../notifications/createNotification");
            const { NOTIFICATION_TYPES } = await import("../notifications/types");
            const name = (tournament as { name?: string }).name ?? String(tournamentId);
            notifyLater({
              type: NOTIFICATION_TYPES.COMPETITION_CLOSED,
              recipientType: "admin",
              title: "תחרות ננעלה",
              body: name ? `תחרות "${name}" ננעלה אוטומטית` : `תחרות #${tournamentId} ננעלה`,
              payload: { tournamentId, name },
            });
            const participantIds = await getParticipantUserIdsForTournament(tournamentId);
            for (const userId of participantIds) {
              notifyLater({
                type: NOTIFICATION_TYPES.COMPETITION_CLOSED,
                recipientType: "user",
                recipientId: userId,
                title: "תחרות ננעלה",
                body: name ? `התחרות "${name}" ננעלה. התוצאות יפורסמו בהמשך.` : `תחרות #${tournamentId} ננעלה.`,
                payload: { tournamentId, name, userId },
              });
            }
          } catch { /* ignore per-user notify */ }
        }
        return { executed: didRun, status: didRun ? "executed" : "skipped" };
      }

      case AUTOMATION_JOB_TYPES.TOURNAMENT_LOCK: {
        if (status !== "OPEN") {
          await logAndRecord("skipped", "Tournament not OPEN");
          return { executed: false, status: "skipped", message: "Tournament not OPEN" };
        }
        const { setTournamentLocked } = await import("../db");
        await setTournamentLocked(tournamentId, true);
        await logAndRecord("executed");
        return { executed: true, status: "executed" };
      }

      case AUTOMATION_JOB_TYPES.TOURNAMENT_FINALIZE_RESULTS: {
        if (status === "RESULTS_UPDATED" || status === "SETTLING" || status === "ARCHIVED" || status === "PRIZES_DISTRIBUTED") {
          await logAndRecord("skipped", "Already finalized or later");
          return { executed: false, status: "skipped", message: "Already finalized or later" };
        }
        if (type === "lotto") {
          const draw = await getLottoDrawResult(tournamentId);
          if (!draw || !(draw as { locked?: boolean }).locked) {
            await logAndRecord("skipped", "Lotto draw result not locked");
            return { executed: false, status: "skipped", message: "Lotto draw result not locked" };
          }
        } else if (type === "chance") {
          const draw = await getChanceDrawResult(tournamentId);
          if (!draw || !(draw as { locked?: boolean }).locked) {
            await logAndRecord("skipped", "Chance draw result not locked");
            return { executed: false, status: "skipped", message: "Chance draw result not locked" };
          }
        } else if (type === "football" || type === "football_custom") {
          const matches = type === "football" ? await getMatches() : await getCustomMatches(tournamentId);
          const hasResults = matches.some((m) => (m as { homeScore?: number | null; awayScore?: number | null }).homeScore != null && (m as { awayScore?: number | null }).awayScore != null);
          if (!hasResults) {
            await logAndRecord("skipped", "Match results not in");
            return { executed: false, status: "skipped", message: "Match results not in" };
          }
        }
        await setTournamentResultsFinalized(tournamentId);
        await logAndRecord("executed");
        return { executed: true, status: "executed" };
      }

      case AUTOMATION_JOB_TYPES.TOURNAMENT_SETTLE: {
        if (status === "ARCHIVED" || status === "PRIZES_DISTRIBUTED" || status === "SETTLING") {
          await logAndRecord("skipped", "Already settled or settling");
          return { executed: false, status: "skipped", message: "Already settled or settling" };
        }
        if (status !== "RESULTS_UPDATED" && status !== "LOCKED" && status !== "CLOSED") {
          await logAndRecord("skipped", "Tournament not ready for settlement");
          return { executed: false, status: "skipped", message: "Tournament not ready for settlement" };
        }
        const { distributePrizesForTournament } = await import("../db");
        try {
          const result = await distributePrizesForTournament(tournamentId);
          incrementSettlementRun();
          await logAndRecord("executed");
          try {
            const { notifyLater } = await import("../notifications/createNotification");
            const { NOTIFICATION_TYPES } = await import("../notifications/types");
            const name = (tournament as { name?: string }).name ?? String(tournamentId);
            notifyLater({
              type: NOTIFICATION_TYPES.TOURNAMENT_SETTLED,
              recipientType: "admin",
              title: "תחרות הוסדרה (אוטומטי)",
              body: name ? `תחרות "${name}" הוסדרה אוטומטית` : `תחרות #${tournamentId} הוסדרה`,
              payload: { tournamentId, name },
            });
            const winnerIds = result.winnerIds ?? [];
            const prizePerWinner = result.prizePerWinner ?? 0;
            for (const userId of winnerIds) {
              notifyLater({
                type: NOTIFICATION_TYPES.TOURNAMENT_SETTLED,
                recipientType: "user",
                recipientId: userId,
                title: "זכית בתחרות!",
                body: name ? `בתחרות "${name}" חולקו פרסים. זכית ב־${prizePerWinner} נקודות.` : `תחרות #${tournamentId} – זכית ב־${prizePerWinner} נקודות.`,
                payload: { tournamentId, name, userId, prizePerWinner, winnerCount: result.winnerCount },
              });
            }
          } catch { /* ignore per-winner notify */ }
          return { executed: true, status: "executed" };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const alreadySettled = msg.includes("פרסים כבר חולקו") || msg.includes("already distributed");
          if (alreadySettled) {
            await logAndRecord("skipped", "Prizes already distributed");
            return { executed: false, status: "skipped", message: "Prizes already distributed" };
          }
          incrementSettlementFailure();
          await logAndRecord("failed", undefined, e);
          return { executed: false, status: "failed", message: msg };
        }
      }

      case AUTOMATION_JOB_TYPES.TOURNAMENT_PUBLISH: {
        await logAndRecord("skipped", "tournament_publish not implemented");
        return { executed: false, status: "skipped", message: "Not implemented" };
      }

      default: {
        await logAndRecord("skipped", "Unknown job type");
        return { executed: false, status: "skipped", message: "Unknown job type" };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logAndRecord("failed", msg, err);
    return { executed: false, status: "failed", message: msg };
  }
}
