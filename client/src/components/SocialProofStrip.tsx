/**
 * Phase 34 Step 6: Social Proof – compact strip with 2–3 proof points max.
 * Only real data; no fabrication. Renders nothing if no meaningful proof.
 */

import { trpc } from "@/lib/trpc";
import { Users } from "lucide-react";

export function SocialProofStrip({ tournamentId, className = "" }: { tournamentId?: number | null; className?: string }) {
  const { data, isLoading } = trpc.tournaments.getSocialProofSummary.useQuery(
    { tournamentId: tournamentId ?? undefined },
    { staleTime: 45_000 }
  );

  if (isLoading || !data) return null;

  const points: string[] = [];
  if (data.message) points.push(data.message);
  const alreadyHas = (n: number) => points.some((p) => p.includes(String(n)));
  if (data.participantCount != null && data.participantCount > 0 && points.length < 3 && !alreadyHas(data.participantCount)) {
    points.push(`${data.participantCount} משתתפים`);
  }
  if (data.activeCompetitions != null && data.activeCompetitions > 0 && points.length < 3 && !alreadyHas(data.activeCompetitions)) {
    points.push(`${data.activeCompetitions} תחרויות פעילות`);
  }
  if (data.recentWinners != null && data.recentWinners > 0 && points.length < 3 && !alreadyHas(data.recentWinners)) {
    points.push(`${data.recentWinners} זוכים לאחרונה`);
  }

  if (points.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-slate-600/60 bg-slate-800/40 px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Users className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />
      <span className="font-medium text-slate-200">{points.slice(0, 3).join(" · ")}</span>
    </div>
  );
}
