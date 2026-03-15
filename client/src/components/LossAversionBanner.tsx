/**
 * Phase 34 Step 5: Loss Aversion / FOMO – only when tournament joinable and user has not participated.
 * Red/orange: closing_now. Amber: closing_today. Purple/red: momentum_risk. Short Hebrew copy.
 */

import { trpc } from "@/lib/trpc";
import { AlertCircle } from "lucide-react";

const BANNER_STYLES = {
  closing_now: "bg-red-600/90 border-red-500/50 text-white",
  closing_today: "bg-amber-600/90 border-amber-500/50 text-white",
  social_fomo: "bg-violet-600/90 border-violet-500/50 text-white",
  momentum_risk: "bg-violet-700/90 border-violet-600/50 text-white",
  generic: "bg-amber-600/80 border-amber-500/50 text-white",
  none: "",
} as const;

export function LossAversionBanner({ tournamentId, className = "" }: { tournamentId: number | null; className?: string }) {
  const { data, isLoading } = trpc.tournaments.getLossAversionMessage.useQuery(
    { tournamentId: tournamentId! },
    { enabled: tournamentId != null && tournamentId > 0, staleTime: 30_000 }
  );

  if (!tournamentId || isLoading || !data || data.type === "none" || !data.message) return null;

  const style = BANNER_STYLES[data.type] ?? BANNER_STYLES.generic;

  return (
    <div
      className={`rounded-xl border px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${style} ${className}`}
      role="status"
      aria-live="polite"
    >
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
      <span>{data.message}</span>
    </div>
  );
}
