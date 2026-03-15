/**
 * Phase 37: Retention & Re-engagement – one compact block combining streak / near-win / rival
 * with a single clear CTA for returning users. Mobile-first, above-the-fold safe.
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ReengagementBlockProps = {
  /** Primary tournament context for near-win/rival messages. */
  nearWinTournamentId: number | null;
  /** Recommended next tournament to join. */
  recommendedTournamentId: number;
  recommendedDisplayName: string;
  /** For copy: 2+ = "continue momentum", 1 = "come back / don't stop". */
  approvedCount: number;
  /** Phase 38: Reason message from recommendation API (e.g. "נסגרת בקרוב – כדאי להצטרף עכשיו"). */
  reasonMessage?: string | null;
  className?: string;
};

export function ReengagementBlock({
  nearWinTournamentId,
  recommendedTournamentId,
  recommendedDisplayName,
  approvedCount,
  reasonMessage,
  className = "",
}: ReengagementBlockProps) {
  const [, setLocation] = useLocation();
  const { data: streak } = trpc.user.getParticipationStreak.useQuery(undefined, { staleTime: 30_000 });
  const { data: nearWin } = trpc.leaderboard.getNearWinMessage.useQuery(
    { tournamentId: nearWinTournamentId! },
    { enabled: nearWinTournamentId != null && nearWinTournamentId > 0, staleTime: 30_000 }
  );
  const { data: rival } = trpc.leaderboard.getRivalStatus.useQuery(
    { tournamentId: nearWinTournamentId! },
    { enabled: nearWinTournamentId != null && nearWinTournamentId > 0, staleTime: 30_000 }
  );

  const signalMessage =
    reasonMessage ??
    (streak?.type && streak.type !== "none" && streak.message ? streak.message : null) ??
    nearWin?.message ??
    rival?.message ??
    null;

  const headline =
    approvedCount >= 2
      ? "אל תעצור עכשיו – המשך את המומנטום"
      : "חזרת? בוא תמשיך – יש לך עוד מה להשיג";

  return (
    <div
      className={`max-w-2xl mx-auto px-2 py-4 rounded-xl bg-sky-500/15 border border-sky-500/40 text-center ${className}`}
      role="region"
      aria-label="הזדמנות להמשיך להשתתף"
    >
      <p className="text-sky-200 font-semibold mb-1">{headline}</p>
      {signalMessage && <p className="text-slate-300 text-sm mb-3">{signalMessage}</p>}
      <Button
        type="button"
        className="w-full max-w-sm mx-auto bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white font-semibold py-3.5 px-5 rounded-xl min-h-[48px] touch-target"
        onClick={() => setLocation(`/predict/${recommendedTournamentId}`)}
      >
        <Trophy className="w-5 h-5 shrink-0 ml-2" aria-hidden />
        {approvedCount >= 2 ? "הצטרף לתחרות נוספת" : "הצטרף לתחרות"} – {recommendedDisplayName}
      </Button>
      <p className="text-slate-400 text-xs mt-2">
        או <button type="button" onClick={() => setLocation("/tournaments")} className="text-sky-400 hover:text-sky-300 underline">בחר תחרות אחרת</button>
      </p>
    </div>
  );
}
