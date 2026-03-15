import { useState, useCallback } from "react";
import { Loader2, Scale, Award, Clock, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface SchemaDebugModalProps {
  tournamentId: number | null;
  onClose: () => void;
}

/** Inner content: only mounted when tournamentId is a valid number to avoid query keys with null. */
function SchemaDebugModalContent({ tournamentId, onClose }: { tournamentId: number; onClose: () => void }) {
  const [submissionIdCompare, setSubmissionIdCompare] = useState<string>("");
  const [expandedItemSetId, setExpandedItemSetId] = useState<string | null>(null);
  const { data, isLoading, error } = trpc.admin.getTournamentResolvedSchemas.useQuery(
    { tournamentId },
    { enabled: true }
  );
  const submissionIdNum = submissionIdCompare.trim() ? parseInt(submissionIdCompare, 10) : 0;
  const { data: scoreCompare, isLoading: scoreCompareLoading, refetch: refetchScoreCompare } = trpc.admin.getScoreComparison.useQuery(
    { tournamentId, submissionId: submissionIdNum },
    { enabled: false }
  );
  const { data: settlementCompare, isLoading: settlementCompareLoading, refetch: refetchSettlementCompare } = trpc.admin.getSettlementComparison.useQuery(
    { tournamentId },
    { enabled: false }
  );
  const { data: resolvedItems } = trpc.admin.getResolvedTournamentItems.useQuery(
    { tournamentId },
    { enabled: true }
  );
  const { data: scheduledActions, isLoading: scheduledActionsLoading } = trpc.admin.getTournamentScheduledActions.useQuery(
    { tournamentId },
    { enabled: true }
  );
  const handleRefetchScore = useCallback(() => {
    refetchScoreCompare();
  }, [refetchScoreCompare]);
  const handleRefetchSettlement = useCallback(() => {
    refetchSettlementCompare();
  }, [refetchSettlementCompare]);

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700" onPointerDownOutside={onClose}>
      <DialogHeader>
        <DialogTitle className="text-white">Schema Debug — תחרות #{tournamentId}</DialogTitle>
        <DialogDescription className="text-slate-400">
          ערכי schema שמוחזרים עבור תחרות זו (לפי competition_type או ברירת מחדל legacy). לקריאה בלבד.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        )}
        {error && (
          <p className="text-red-400 text-sm">{error.message}</p>
        )}
        {data && (
          <>
            <div className="rounded-lg bg-slate-800/50 p-3 text-sm">
              <p className="text-slate-500 mb-1">Legacy type / Competition type</p>
              <p className="text-white font-mono">
                legacyType: {data.legacyType} | competitionTypeId: {data.competitionTypeId ?? "null"} | code: {data.competitionTypeCode ?? "—"}
              </p>
            </div>
            {(data.resolutionSource != null || (data.builderOverrides != null && Object.keys(data.builderOverrides).length > 0)) && (
              <div className="rounded-lg bg-slate-800/50 p-3 text-sm border border-amber-500/30">
                <p className="text-amber-200 mb-1">Phase 17: Resolution source / Builder overrides</p>
                {data.resolutionSource != null && (
                  <p className="text-slate-300 font-mono text-xs">
                    form: {data.resolutionSource.form} | scoring: {data.resolutionSource.scoring} | settlement: {data.resolutionSource.settlement}
                  </p>
                )}
                {data.builderOverrides != null && Object.keys(data.builderOverrides).length > 0 && (
                  <pre className="text-slate-400 font-mono text-xs mt-1 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(data.builderOverrides, null, 2)}
                  </pre>
                )}
              </div>
            )}
            {(data.formSchemaWarnings?.length ?? 0) > 0 && (
              <p className="text-amber-400 text-xs">Form warnings: {(data.formSchemaWarnings ?? []).join("; ")}</p>
            )}
            <div className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-slate-500 text-sm mb-2">Form schema (resolved)</p>
              <pre className="text-slate-300 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(data.formSchema, null, 2)}
              </pre>
            </div>
            {(data.scoringConfigWarnings?.length ?? 0) > 0 && (
              <p className="text-amber-400 text-xs">Scoring warnings: {(data.scoringConfigWarnings ?? []).join("; ")}</p>
            )}
            <div className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-slate-500 text-sm mb-2">Scoring config (resolved)</p>
              <pre className="text-slate-300 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(data.scoringConfig, null, 2)}
              </pre>
            </div>
            {(data.settlementConfigWarnings?.length ?? 0) > 0 && (
              <p className="text-amber-400 text-xs">Settlement warnings: {(data.settlementConfigWarnings ?? []).join("; ")}</p>
            )}
            <div className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-slate-500 text-sm mb-2">Settlement config (resolved)</p>
              <pre className="text-slate-300 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(data.settlementConfig, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-600">
              <p className="text-slate-400 text-sm mb-2">Phase 4: Score comparison (legacy vs schema)</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Input
                  type="number"
                  placeholder="Submission ID"
                  value={submissionIdCompare}
                  onChange={(e) => setSubmissionIdCompare(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white w-32"
                  min={1}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600"
                  disabled={!submissionIdNum || scoreCompareLoading}
                  onClick={handleRefetchScore}
                >
                  {scoreCompareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4 ml-1" />}
                  Compare score
                </Button>
              </div>
              {scoreCompare && (
                <div className="text-xs font-mono text-slate-300 space-y-1">
                  <p>Stored: {scoreCompare.storedPoints} | Legacy: {scoreCompare.legacyPoints} | Schema: {scoreCompare.schemaPoints ?? "—"}</p>
                  <p className={scoreCompare.match ? "text-emerald-400" : "text-amber-400"}>
                    {scoreCompare.match ? "✓ Match" : "✗ Mismatch"}
                  </p>
                  {scoreCompare.configMode != null && <p>Config mode: {scoreCompare.configMode}</p>}
                  {scoreCompare.schemaWarnings?.length > 0 && (
                    <p className="text-amber-400">Warnings: {scoreCompare.schemaWarnings.join("; ")}</p>
                  )}
                  {scoreCompare.schemaBreakdown != null && (
                    <pre className="mt-1 overflow-x-auto">{JSON.stringify(scoreCompare.schemaBreakdown, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-600">
              <p className="text-slate-400 text-sm mb-2">Phase 5: Settlement comparison (legacy vs schema)</p>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 mb-2"
                disabled={settlementCompareLoading}
                onClick={handleRefetchSettlement}
              >
                {settlementCompareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4 ml-1" />}
                Compare settlement
              </Button>
              {settlementCompare && (
                <div className="text-xs font-mono text-slate-300 space-y-2">
                  <p>Legacy: {settlementCompare.legacy.winnerCount} winners, prizePerWinner={settlementCompare.legacy.prizePerWinner}, distributed={settlementCompare.legacy.distributed}, pool={settlementCompare.legacy.prizePool}</p>
                  {settlementCompare.schema ? (
                    <>
                      <p>Schema: {settlementCompare.schema.winnerCount} winners, prizePerWinner={settlementCompare.schema.prizePerWinner}, distributed={settlementCompare.schema.distributed}, pool={settlementCompare.schema.prizePool}</p>
                      <p className={settlementCompare.match ? "text-emerald-400" : "text-amber-400"}>
                        {settlementCompare.match ? "✓ Match" : "✗ Mismatch"}
                      </p>
                      {settlementCompare.schema.tieGroups?.length > 0 && (
                        <p>Tie groups: {JSON.stringify(settlementCompare.schema.tieGroups)}</p>
                      )}
                      {settlementCompare.schema.warnings?.length > 0 && (
                        <p className="text-amber-400">Warnings: {settlementCompare.schema.warnings.join("; ")}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500">{settlementCompare.message ?? "Schema not available"}</p>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-600">
              <p className="text-slate-400 text-sm mb-2">Phase 18: Automation (read-only)</p>
              {scheduledActionsLoading && (
                <p className="text-slate-500 text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</p>
              )}
              {!scheduledActionsLoading && scheduledActions && (
                <div className="space-y-3 text-xs">
                  {"lifecyclePhase" in scheduledActions && (
                    <div>
                      <p className="text-slate-500 mb-1">Phase 23: Lifecycle</p>
                      <p className="text-slate-300 font-mono">
                        {scheduledActions.lifecyclePhaseLabel ?? scheduledActions.lifecyclePhase} ({scheduledActions.lifecyclePhase})
                      </p>
                      {"nextPossibleTransitions" in scheduledActions && Array.isArray(scheduledActions.nextPossibleTransitions) && scheduledActions.nextPossibleTransitions.length > 0 && (
                        <p className="text-slate-400 mt-1">מעברים אפשריים: {scheduledActions.nextPossibleTransitions.join("; ")}</p>
                      )}
                      {"retryState" in scheduledActions && scheduledActions.retryState != null && (
                        <p className="text-amber-400 mt-1">
                          Retry: attempt {(scheduledActions.retryState as { retryCount?: number }).retryCount ?? 0}
                          {(scheduledActions.retryState as { nextRetryAt?: Date | string | null }).nextRetryAt != null && `, next @ ${new Date((scheduledActions.retryState as { nextRetryAt: Date | string }).nextRetryAt).toISOString()}`}
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Next scheduled actions</p>
                    {scheduledActions.nextScheduledActions.length === 0 ? (
                      <p className="text-slate-500 font-mono">None (or no dates set)</p>
                    ) : (
                      <ul className="font-mono text-slate-300 space-y-1">
                        {scheduledActions.nextScheduledActions.map((a, i) => (
                          <li key={i}>{a.jobType} — {a.scheduledAt ? new Date(a.scheduledAt).toISOString() : "—"} — {a.reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1 flex items-center gap-1"><History className="w-3 h-3" /> Last automation runs</p>
                    {scheduledActions.recentJobs.length === 0 ? (
                      <p className="text-slate-500 font-mono">No jobs recorded</p>
                    ) : (
                      <ul className="font-mono text-slate-300 space-y-1">
                        {scheduledActions.recentJobs.slice(0, 10).map((j) => (
                          <li key={j.id}>
                            {j.jobType} — {j.status}
                            {j.executedAt != null ? ` @ ${new Date(j.executedAt).toISOString()}` : ""}
                            {(j as { retryCount?: number }).retryCount != null && (j as { retryCount: number }).retryCount > 0 && ` (retry #${(j as { retryCount: number }).retryCount})`}
                            {(j as { nextRetryAt?: Date | string | null }).nextRetryAt != null && ` next retry @ ${new Date((j as { nextRetryAt: Date | string }).nextRetryAt).toISOString()}`}
                            {j.lastError ? ` — ${j.lastError}` : ""}
                          </li>
                        ))}
                        {scheduledActions.recentJobs.length > 10 && (
                          <li className="text-slate-500">… and {scheduledActions.recentJobs.length - 10} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-600">
              <p className="text-slate-400 text-sm mb-2">Phase 7: Resolved competition items (universal / legacy)</p>
              {resolvedItems != null && resolvedItems.length === 0 && (
                <p className="text-slate-500 text-xs">No item sets for this tournament type or tournament not found.</p>
              )}
              {resolvedItems != null && resolvedItems.length > 0 && (
                <div className="text-xs font-mono text-slate-300 space-y-3">
                  {resolvedItems.map((set) => (
                    <div key={set.id} className="border border-slate-600 rounded p-2 bg-slate-900/50">
                      <p className="font-medium text-amber-200">{set.title}</p>
                      <p className="text-slate-500">source: {set.sourceLabel ?? set.sourceType} | itemType: {set.itemType} | items: {set.items.length}</p>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(set.items.slice(0, 3).map((i) => ({ id: i.id, title: i.title, itemKind: i.itemKind, sourceType: i.sourceType, legacyMatchId: i.legacyMatchId })), null, 2)}</pre>
                      {set.items.length > 3 && <p className="text-slate-500">… and {set.items.length - 3} more</p>}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 text-slate-400 hover:text-white"
                        onClick={() => setExpandedItemSetId(expandedItemSetId === set.id ? null : set.id)}
                      >
                        {expandedItemSetId === set.id ? "Hide item details" : "View all item details"}
                      </Button>
                      {expandedItemSetId === set.id && (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto border border-slate-600 rounded p-2 bg-slate-950">
                          {JSON.stringify(set.items.map((i) => ({ id: i.id, title: i.title, optionSchema: i.optionSchema, resultSchema: i.resultSchema, metadata: i.metadata, legacyMatchId: i.legacyMatchId })), null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DialogContent>
  );
}

export function SchemaDebugModal({ tournamentId, onClose }: SchemaDebugModalProps) {
  if (tournamentId == null || tournamentId <= 0) {
    return null;
  }
  return <SchemaDebugModalContent tournamentId={tournamentId} onClose={onClose} />;
}
