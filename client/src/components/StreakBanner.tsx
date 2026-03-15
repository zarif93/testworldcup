/**
 * Phase 34 Step 3: Streak System – momentum/habit banner.
 * Gold/amber colors; short motivational copy; hide when type "none" or no message.
 */

import { trpc } from "@/lib/trpc";
import { Flame } from "lucide-react";

const BANNER_STYLES = {
  active_streak: "bg-amber-600/90 border-amber-500/50 text-white",
  milestone_close: "bg-amber-500/90 border-amber-400/50 text-white",
  streak_warning: "bg-orange-600/90 border-orange-500/50 text-white",
  none: "",
} as const;

export function StreakBanner({ className = "" }: { className?: string }) {
  const { data, isLoading } = trpc.user.getParticipationStreak.useQuery(undefined, {
    staleTime: 30_000,
  });

  if (isLoading || !data || data.type === "none" || !data.message) return null;

  const style = BANNER_STYLES[data.type] ?? BANNER_STYLES.active_streak;

  return (
    <div
      className={`rounded-xl border px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${style} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Flame className="w-4 h-4 shrink-0" aria-hidden />
      <span>{data.message}</span>
    </div>
  );
}
