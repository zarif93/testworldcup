import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2, Lock } from "lucide-react";
import { getTournamentStyles } from "@/lib/tournamentStyles";

function useNow(intervalMs: number) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function formatRemaining(removalScheduledAt: string | Date | null | undefined): string {
  if (!removalScheduledAt) return "00:00";
  const end = new Date(removalScheduledAt).getTime();
  const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TournamentSelect() {
  const [, setLocation] = useLocation();
  useNow(1000);
  const { data: tournamentStats, isLoading } = trpc.tournaments.getPublicStats.useQuery();
  type T = NonNullable<typeof tournamentStats>[number];
  const typeOrder: Record<string, number> = { football: 0, mondial: 0, lotto: 1, chance: 2, football_custom: 3 };
  const typeLabel: Record<string, string> = { football: "מונדיאל", lotto: "לוטו", chance: "צ'אנס", football_custom: "כדורגל" };
  const allTournaments: T[] = (() => {
    if (!tournamentStats?.length) return [];
    return [...tournamentStats].sort((a, b) => {
      const typeA = (a.type ?? "football") as string;
      const typeB = (b.type ?? "football") as string;
      const orderA = typeOrder[typeA] ?? 4;
      const orderB = typeOrder[typeB] ?? 4;
      if (orderA !== orderB) return orderA - orderB;
      return (a.amount ?? 0) - (b.amount ?? 0);
    });
  })();

  const byType = useMemo(() => {
    const football: T[] = [];
    const lotto: T[] = [];
    const chance: T[] = [];
    const football_custom: T[] = [];
    for (const t of allTournaments) {
      const type = (t.type ?? "football") as string;
      if (type === "lotto") lotto.push(t);
      else if (type === "chance") chance.push(t);
      else if (type === "football_custom") football_custom.push(t);
      else football.push(t);
    }
    return { football, lotto, chance, football_custom };
  }, [allTournaments]);

  const hasAny = allTournaments.length > 0;
  const sectionOrder: Array<{ key: keyof typeof byType; title: string }> = [
    { key: "football", title: "מונדיאל – ניחושי משחקים" },
    { key: "lotto", title: "לוטו" },
    { key: "chance", title: "צ'אנס" },
    { key: "football_custom", title: "תחרות כדורגל" },
  ];

  const renderTournamentButton = (t: T, i: number) => {
    const styles = getTournamentStyles(t.amount);
    const d = (t as { drawDate?: string | null }).drawDate;
    const drawTime = (t as { drawTime?: string | null }).drawTime;
    const drawLabel = d && drawTime ? ` – ${new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })} – ${drawTime}` : "";
    const label = typeLabel[(t.type ?? "football") as string] ?? t.type ?? "";
    const isLocked = (t as { status?: string }).status === "LOCKED" || t.isLocked;
    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
    return (
      <Button
        key={t.id}
        size="lg"
        className={`text-lg px-6 py-5 rounded-xl border-2 shadow-lg hover:shadow-xl transition-all duration-300 min-w-0 max-w-full flex items-stretch gap-3 text-right min-h-[7.5rem] ${styles.button} ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "btn-sport"} animate-slide-up`}
        style={{ animationDelay: `${i * 0.04}s` }}
        onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
        disabled={isLocked}
      >
        <Trophy className={`w-6 h-6 ml-2 shrink-0 self-center ${styles.icon}`} />
        <span className="block text-right min-w-0 flex-1 py-0.5 flex flex-col justify-center">
          {label && !isLocked && <span className="text-xs opacity-80 block mb-1 break-words leading-tight">{label}</span>}
          <span className="break-words leading-snug">{t.name}{!isLocked ? drawLabel : ""}</span>
          {isLocked && countdown != null ? (
            <>
              <span className="text-red-400 font-bold flex items-center gap-1 mt-1 text-sm"><Lock className="w-4 h-4 shrink-0" /> התחרות ננעלה</span>
              <span className="block text-red-300 font-black text-lg mt-0.5">נסגרת בעוד: {countdown}</span>
            </>
          ) : !isLocked && (
            <span className="block text-sm opacity-90 mt-1.5 break-words leading-tight">₪{t.prizePool.toLocaleString("he-IL")} פרסים • {t.participants} משתתפים</span>
          )}
        </span>
        {isLocked && countdown == null && <span className="mr-2 shrink-0 self-center">🔒</span>}
      </Button>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4 flex items-center justify-center gap-2 animate-fade-in">
          <Trophy className="w-9 h-9 text-amber-400" />
          בחר טורניר
        </h1>
        <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
          בחר תחרות והשתתף. כל תחרות לפי כללים משלה – מונדיאל, לוטו, צ'אנס או כדורגל.
        </p>

        {/* איך זה עובד – הסבר קצר */}
        <div className="max-w-2xl mx-auto mb-12 p-6 rounded-xl bg-slate-800/50 border border-slate-600/50 text-right min-w-0 overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-3 break-words">איך זה עובד</h2>
          <ul className="text-slate-400 text-sm space-y-2 list-none break-words">
            <li><strong className="text-slate-300">בחירת תחרות:</strong> בחר תחרות מהרשימה (מונדיאל, לוטו, צ'אנס או כדורגל) ולחץ עליה.</li>
            <li><strong className="text-slate-300">טופס והשתתפות:</strong> אחרי הלחיצה תגיע לטופס לפי סוג התחרות. מלא ושלוח.</li>
            <li><strong className="text-slate-300">אישור ותשלום:</strong> לאחר אישור מנהל ותשלום תיכנס לדירוג של התחרות.</li>
            <li><strong className="text-slate-300">נעילה:</strong> תחרות עם סימן 🔒 סגורה להרשמה – לא ניתן לשלוח אליה טפסים.</li>
          </ul>
        </div>
        <div className="min-w-0 max-w-6xl mx-auto">
          {!hasAny ? (
            <div className="w-full max-w-xl mx-auto p-6 rounded-xl bg-slate-800/50 border border-slate-600/50 text-center">
              <p className="text-slate-400 mb-2">אין תחרויות כרגע.</p>
              <p className="text-slate-500 text-sm">כשיפתחו תחרויות חדשות הן יופיעו כאן.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {sectionOrder.map(({ key, title }) => {
                const list = byType[key];
                return (
                  <div key={key} className="min-w-0 flex flex-col">
                    <h2 className="text-xl font-bold text-white mb-4 text-center break-words">{title}</h2>
                    <div className="flex flex-col gap-4">
                      {list.map((t, i) => renderTournamentButton(t, i))}
                    </div>
                    {list.length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
