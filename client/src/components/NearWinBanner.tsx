/**
 * Phase 34: Near Win Engine – motivational banner by leaderboard position.
 * Green: near_win, top. Orange: danger_drop. Blue: encouragement.
 */

import { trpc } from "@/lib/trpc";
import { Sparkles } from "lucide-react";

const BANNER_STYLES = {
  near_win: "bg-emerald-600/90 border-emerald-500/50 text-white",
  top: "bg-emerald-600/90 border-emerald-500/50 text-white",
  danger_drop: "bg-amber-600/90 border-amber-500/50 text-white",
  encouragement: "bg-sky-600/90 border-sky-500/50 text-white",
} as const;

export function NearWinBanner({ tournamentId, className = "" }: { tournamentId: number | null; className?: string }) {
  const { data, isLoading } = trpc.leaderboard.getNearWinMessage.useQuery(
    { tournamentId: tournamentId! },
    { enabled: tournamentId != null && tournamentId > 0, staleTime: 30_000 }
  );

  if (!tournamentId || isLoading || !data?.message) return null;

  const style = BANNER_STYLES[data.type] ?? BANNER_STYLES.encouragement;

  return (
    <div
      className={`rounded-xl border px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${style} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
      <span>{data.message}</span>
    </div>
  );
}
