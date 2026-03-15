/**
 * Phase 34 Step 2: Rival System – direct competition banner vs user above/below.
 * Red/orange: pressure (rival_below). Green: opportunity (rival_above). Purple/amber: battle_zone.
 */

import { trpc } from "@/lib/trpc";
import { Swords } from "lucide-react";

const BANNER_STYLES = {
  rival_above: "bg-emerald-600/90 border-emerald-500/50 text-white",
  rival_below: "bg-amber-600/90 border-amber-500/50 text-white",
  battle_zone: "bg-violet-600/90 border-violet-500/50 text-white",
  generic: "bg-sky-600/90 border-sky-500/50 text-white",
} as const;

export function RivalStatusBanner({ tournamentId, className = "" }: { tournamentId: number | null; className?: string }) {
  const { data, isLoading } = trpc.leaderboard.getRivalStatus.useQuery(
    { tournamentId: tournamentId! },
    { enabled: tournamentId != null && tournamentId > 0, staleTime: 30_000 }
  );

  if (!tournamentId || isLoading || !data?.message) return null;

  const style = BANNER_STYLES[data.type] ?? BANNER_STYLES.generic;

  return (
    <div
      className={`rounded-xl border px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${style} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Swords className="w-4 h-4 shrink-0" aria-hidden />
      <span>{data.message}</span>
    </div>
  );
}
