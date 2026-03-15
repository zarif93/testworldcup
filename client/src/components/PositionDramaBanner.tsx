/**
 * Phase 34 Step 4: Drama / Position Change Engine – banner only when meaningful movement.
 * Green: move_up. Red/orange: move_down. Gold/violet: entered_top / dropped_top.
 */

import { trpc } from "@/lib/trpc";
import { TrendingUp } from "lucide-react";

const BANNER_STYLES = {
  move_up: "bg-emerald-600/90 border-emerald-500/50 text-white",
  move_down: "bg-amber-600/90 border-amber-500/50 text-white",
  entered_top: "bg-violet-600/90 border-violet-500/50 text-white",
  dropped_top: "bg-amber-700/90 border-amber-600/50 text-white",
  stable: "",
  none: "",
} as const;

const MEANINGFUL_TYPES = ["move_up", "move_down", "entered_top", "dropped_top"] as const;

export function PositionDramaBanner({ tournamentId, className = "" }: { tournamentId: number | null; className?: string }) {
  const { data, isLoading } = trpc.leaderboard.getPositionDrama.useQuery(
    { tournamentId: tournamentId! },
    { enabled: tournamentId != null && tournamentId > 0, staleTime: 30_000 }
  );

  if (!tournamentId || isLoading || !data) return null;
  if (data.type === "stable" || data.type === "none" || !data.message) return null;
  if (!MEANINGFUL_TYPES.includes(data.type as (typeof MEANINGFUL_TYPES)[number])) return null;

  const style = BANNER_STYLES[data.type as keyof typeof BANNER_STYLES] ?? BANNER_STYLES.move_up;

  return (
    <div
      className={`rounded-xl border px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${style} ${className}`}
      role="status"
      aria-live="polite"
    >
      <TrendingUp className="w-4 h-4 shrink-0" aria-hidden />
      <span>{data.message}</span>
    </div>
  );
}
