/**
 * Phase 35: Israeli Onboarding & Trust – compact 3 steps + trust line.
 * Use on Home and TournamentSelect for first-time clarity.
 */

import { useLocation } from "wouter";
import { Trophy, FileEdit, CheckCircle2, Shield } from "lucide-react";

const STEPS = [
  { icon: Trophy, label: "בחר תחרות", short: "1" },
  { icon: FileEdit, label: "מלא טופס ושלוח", short: "2" },
  { icon: CheckCircle2, label: "אחרי אישור – אתה בדירוג", short: "3" },
] as const;

export function ThreeStepsTrustStrip({
  className = "",
  showTrustLinks = true,
}: {
  className?: string;
  showTrustLinks?: boolean;
}) {
  const [, setLocation] = useLocation();

  return (
    <div
      className={`rounded-2xl border border-slate-600/50 bg-slate-800/50 p-4 sm:p-5 text-right min-w-0 overflow-hidden ${className}`}
      role="region"
      aria-label="איך זה עובד בשלושה שלבים"
    >
      <p className="text-slate-300 font-bold text-sm sm:text-base mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
        איך זה עובד – 3 שלבים
      </p>
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-slate-300 text-sm sm:text-base list-none mb-3">
        {STEPS.map(({ icon: Icon, label }, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs shrink-0">
              {i + 1}
            </span>
            <Icon className="w-4 h-4 text-slate-500 shrink-0" aria-hidden />
            <span>{label}</span>
          </li>
        ))}
      </ol>
      {showTrustLinks && (
        <p className="text-slate-400 text-xs sm:text-sm flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-700/50 pt-3">
          <Shield className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" aria-hidden />
          <span>משתתפים אמיתיים • כללים ברורים • שקיפות מלאה</span>
          <button
            type="button"
            onClick={() => setLocation("/how-it-works")}
            className="text-amber-400/90 hover:text-amber-400 underline underline-offset-1"
          >
            איך זה עובד
          </button>
        </p>
      )}
    </div>
  );
}
