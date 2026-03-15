import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb, getDbInitError } from "../db";
import { getMetricsSnapshot } from "./metrics";
import { getTournamentsWithStatusSettling } from "../db";
import { getPendingNotificationsForDelivery } from "../db";
import { runRecoverSettlements } from "../db";
import { runFinancialReconciliationJob } from "../jobs/reconciliationJob";

export const systemRouter = router({
  getServerTime: publicProcedure.query(() => ({ now: new Date().toISOString() })),

  health: publicProcedure
    .input(z.object({ timestamp: z.number().min(0).optional() }).optional())
    .query(async () => {
      const db = await getDb();
      const dbOk = !!db;
      const err = getDbInitError();
      return {
        ok: dbOk,
        db: dbOk ? "ok" : "error",
        dbError: dbOk ? undefined : (err != null ? String(err) : "unknown"),
        metrics: getMetricsSnapshot(),
        timestamp: new Date().toISOString(),
      };
    }),

  /** Phase 15: Operational – metrics snapshot (admin). */
  getMetrics: adminProcedure.query(() => getMetricsSnapshot()),

  /** Phase 15: Operational – list tournament IDs stuck in SETTLING. */
  getStuckSettlementTournaments: adminProcedure.query(async () => {
    const rows = await getTournamentsWithStatusSettling();
    return rows.map((r) => r.id);
  }),

  /** Phase 15: Operational – count of notifications pending delivery (email/sms/whatsapp). */
  getPendingNotificationsCount: adminProcedure.query(async () => {
    const list = await getPendingNotificationsForDelivery(10_000);
    return list.length;
  }),

  /** Phase 15: Operational – manually trigger settlement recovery for stuck SETTLING tournaments. */
  triggerSettlementRecovery: adminProcedure
    .input(z.object({ onlyTournamentIds: z.array(z.number()).optional() }).optional())
    .mutation(async ({ input }) => {
      const result = await runRecoverSettlements({ onlyTournamentIds: input?.onlyTournamentIds });
      return result;
    }),

  /** Phase 15: Operational – manually run financial reconciliation (anomaly check). */
  runReconciliation: adminProcedure
    .input(z.object({ sinceDays: z.number().min(1).max(365).optional() }).optional())
    .mutation(async ({ input }) => {
      const sinceMs = input?.sinceDays ? input.sinceDays * 24 * 60 * 60 * 1000 : undefined;
      const result = await runFinancialReconciliationJob({ sinceMs });
      return result;
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
