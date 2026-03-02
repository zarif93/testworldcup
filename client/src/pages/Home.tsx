import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Loader2, Target, Lock, X } from "lucide-react";
import { getTournamentStyles } from "@/lib/tournamentStyles";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function getRemainingSeconds(removalScheduledAt: string | Date | null | undefined): number {
  if (!removalScheduledAt) return 0;
  const end = new Date(removalScheduledAt).getTime();
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function formatRemaining(removalScheduledAt: string | Date | null | undefined): string {
  const remaining = getRemainingSeconds(removalScheduledAt);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const now = useNow(1000);
  const [hideConfirmId, setHideConfirmId] = useState<number | null>(null);
  const { data: tournamentStats, isLoading, refetch } = trpc.tournaments.getPublicStats.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const hideMutation = trpc.admin.hideTournamentFromHomepage.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("התחרות הוסרה מהמסך הראשי");
      setHideConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const removedIdsRef = useRef<Set<number>>(new Set());
  const isAdmin = user?.role === "admin";
  const canShowHide = (status: string | undefined) =>
    isAdmin && status && ["OPEN", "LOCKED", "CLOSED", "SETTLED"].includes(status);

  useEffect(() => {
    if (!tournamentStats?.length) return;
    const toRemove: number[] = [];
    for (const t of tournamentStats) {
      const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
      if (removalAt && getRemainingSeconds(removalAt) <= 0 && !removedIdsRef.current.has(t.id)) toRemove.push(t.id);
    }
    if (toRemove.length > 0) {
      toRemove.forEach((id) => removedIdsRef.current.add(id));
      refetch(); // סמכות עליונה: השרת – אחרי ה-refetch התחרות לא תופיע אם ה-API לא מחזיר אותה
      toRemove.forEach((id) => console.log("[Homepage] הסרה מדף ראשי – סמכות שרת (tournament removed from view)", { tournamentId: id }));
    }
  }, [tournamentStats, now, refetch]);
  type Stats = typeof tournamentStats;
  const byType: { football: Stats; lotto: Stats; chance: Stats; footballCustom: Stats } = (() => {
    if (!tournamentStats?.length) return { football: [], lotto: [], chance: [], footballCustom: [] };
    const football = tournamentStats.filter((t) => (t.type ?? "football") === "football").sort((a, b) => a.amount - b.amount);
    const lotto = tournamentStats.filter((t) => t.type === "lotto").sort((a, b) => a.amount - b.amount);
    const chance = tournamentStats.filter((t) => t.type === "chance").sort((a, b) => a.amount - b.amount);
    const footballCustom = tournamentStats.filter((t) => t.type === "football_custom").sort((a, b) => a.amount - b.amount);
    return { football, lotto, chance, footballCustom };
  })();
  const hasAny = (byType.football?.length ?? 0) > 0 || (byType.lotto?.length ?? 0) > 0 || (byType.chance?.length ?? 0) > 0 || (byType.footballCustom?.length ?? 0) > 0;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative container mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/20 to-emerald-600/20 border border-amber-500/30 mb-8 shadow-lg">
            <Trophy className="w-14 h-14 text-amber-400 drop-shadow" />
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight drop-shadow-sm">
            תחרות ניחושי המונדיאל הגדולה
          </h1>
          <p className="text-lg md:text-xl text-emerald-200/95 mb-4 max-w-2xl mx-auto font-medium">
            FIFA World Cup 2026 – שלב הבתים
          </p>
          <p className="text-slate-400 mb-12 max-w-xl mx-auto">
            בחר טורניר, מלא ניחושים לכל 72 המשחקים, ועקוב אחרי הדירוג והפרסים.
          </p>
        </div>

        {/* CTA – בחר טורניר */}
        {!isLoading && hasAny && (
          <div className="animate-slide-up mb-16">
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 btn-sport"
              onClick={() => setLocation("/tournaments")}
            >
              <Trophy className="w-6 h-6 ml-2 text-amber-300" />
              בחר טורניר
            </Button>
          </div>
        )}

        {/* כרטיסי טורניר – שורה לכל סוג */}
        {isLoading ? (
          <div className="space-y-12 max-w-5xl mx-auto mb-20">
            <div>
              <Skeleton className="h-6 w-48 mx-auto mb-4 rounded" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl bg-slate-700/50" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-32 mx-auto mb-4 rounded" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl bg-slate-700/50" />
                ))}
              </div>
            </div>
          </div>
        ) : !hasAny ? (
          <div className="max-w-xl mx-auto mb-20 p-6 rounded-xl bg-slate-800/50 border border-slate-600/50 text-center">
            <p className="text-slate-400 mb-2">אין תחרויות כרגע.</p>
            <p className="text-slate-500 text-sm">כשיפתחו תחרויות חדשות הן יופיעו כאן. תוכל לבחור טורניר ולמלא ניחושים ל־72 המשחקים.</p>
          </div>
        ) : (
          <TooltipProvider>
          <div className="space-y-12 max-w-5xl mx-auto mb-20">
            {byType.football && byType.football.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4 text-center">מונדיאל – ניחושי משחקים</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {byType.football.map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group">
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 p-5 text-center ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40"} animate-slide-up w-full`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg">{t.name}</p>
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1">
                              <Lock className="w-4 h-4" /> התחרות ננעלה
                            </p>
                            <p className="text-red-300 font-black text-xl mt-1">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-amber-400 font-black text-xl mt-1">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-2">{t.participants} משתתפים</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {byType.lotto && byType.lotto.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4 text-center">לוטו</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {byType.lotto.map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group">
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 p-5 text-center ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40"} animate-slide-up w-full`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg">{t.name}</p>
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1"><Lock className="w-4 h-4" /> התחרות ננעלה</p>
                            <p className="text-red-300 font-black text-xl mt-1">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-amber-400 font-black text-xl mt-1">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-2">{t.participants} משתתפים</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {byType.chance && byType.chance.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4 text-center">צ'אנס</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {byType.chance.map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const d = (t as { drawDate?: string | null }).drawDate;
                    const drawTime = (t as { drawTime?: string | null }).drawTime;
                    const drawLabel = d && drawTime ? `${new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })} – ${drawTime}` : null;
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group">
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 p-5 text-center ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40"} animate-slide-up w-full`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg">{t.name}</p>
                        {drawLabel && !isLocked && <p className="text-slate-400 text-sm mt-0.5">⏰ {drawLabel}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1"><Lock className="w-4 h-4" /> התחרות ננעלה</p>
                            <p className="text-red-300 font-black text-xl mt-1">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : !isLocked && (
                          <>
                            <p className="text-amber-400 font-black text-xl mt-1">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-2">{t.participants} משתתפים</p>
                          </>
                        )}
                        {isLocked && !countdown && <span className="text-slate-500 text-xs">🔒</span>}
                      </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {byType.footballCustom && byType.footballCustom.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4 text-center">תחרות כדורגל</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {byType.footballCustom.map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group">
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 p-5 text-center ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40"} animate-slide-up w-full`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg">{t.name}</p>
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1"><Lock className="w-4 h-4" /> התחרות ננעלה</p>
                            <p className="text-red-300 font-black text-xl mt-1">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-amber-400 font-black text-xl mt-1">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-2">{t.participants} משתתפים</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          </TooltipProvider>
        )}

        <AlertDialog open={hideConfirmId != null} onOpenChange={(open) => !open && setHideConfirmId(null)}>
          <AlertDialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400 text-right">הסתרת תחרות מהדף הראשי</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 text-right">
                להסתיר תחרות זו מהמסך הראשי? המשתמשים לא יראו אותה. הנתונים וההיסטוריה נשמרים. ניתן לשחזר מדף המנהל.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel className="border-slate-600 text-slate-300">ביטול</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => hideConfirmId != null && hideMutation.mutate({ id: hideConfirmId })}
              >
                {hideMutation.isPending ? "מסתיר..." : "הסתר מדף ראשי"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* איך זה עובד – הסבר מלא על האתר */}
        <section className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center justify-center gap-2">
            <Target className="w-7 h-7 text-emerald-400" />
            איך זה עובד
          </h2>
          <div className="rounded-2xl bg-slate-800/60 border border-slate-600/50 p-6 md:p-8 text-right space-y-6 text-slate-300">
            <p className="text-base leading-relaxed">
              האתר מאפשר להשתתף בתחרויות ניחושים מסוגים שונים: <strong className="text-white">מונדיאל</strong> (ניחושי משחקי כדורגל), <strong className="text-white">לוטו</strong> ו־<strong className="text-white">צ'אנס</strong>. כל תחרות מתנהלת בנפרד – יש טורנירים לפי סכום השתתפות, ואתה בוחר באיזה להשתתף.
            </p>
            <div className="space-y-4">
              <h3 className="text-white font-bold text-lg">מה עושים צעד־אחר־צעד</h3>
              <ul className="space-y-2 list-none">
                <li><strong className="text-amber-400/90">הרשמה והתחברות:</strong> אם עדיין לא נרשמת – היכנס ל"הרשמה", מלא פרטים והתחבר. משתמש מחובר יכול להשתתף בתחרויות ולעקוב אחרי הטפסים והדירוג.</li>
                <li><strong className="text-amber-400/90">בחירת טורניר:</strong> בדף "טורנירים" (או בלחיצה על "בחר טורניר") תופיע רשימת כל הטורנירים – מונדיאל, לוטו וצ'אנס. כל טורניר מציין סכום השתתפות וקופת פרסים. טורניר עם סימן 🔒 נעול – אי אפשר לשלוח אליו טפסים חדשים.</li>
                <li><strong className="text-amber-400/90">מילוי טופס ניחושים:</strong> אחרי שלחצת על טורניר, תגיע לטופס ההגשה:
                  <ul className="mr-6 mt-2 space-y-1 text-slate-400 text-sm">
                    <li>• <strong className="text-slate-300">מונדיאל:</strong> לכל אחד מ־72 משחקי שלב הבתים בוחרים 1 (ניצחון בית), X (תיקו) או 2 (ניצחון חוץ). ניקוד: 3 נקודות לניחוש נכון, 0 לשגוי.</li>
                    <li>• <strong className="text-slate-300">לוטו:</strong> בוחרים 6 מספרים (1–37) ומספר חזק (1–7). התוצאות מתעדכנות לפי הגרלת מפעל הפיס – מנהל מזין אותן לפי מזהה תחרות.</li>
                    <li>• <strong className="text-slate-300">צ'אנס:</strong> בוחרים 4 קלפים – אחד מכל סוג (♥ לב, ♣ תלתן, ♦ יהלום, ♠ עלה) מערכות 7–A. התוצאות מתעדכנות לפי מפעל הפיס – מנהל מזין אותן לפי מזהה תחרות.</li>
                  </ul>
                </li>
                <li><strong className="text-amber-400/90">שליחה ואישור:</strong> אחרי שליחת הטופס הוא נשמר במערכת ומקבל סטטוס (ממתין לאישור / אושר / נדחה). לאחר אישור והשלמת התשלום (לפי הנחיות המארגן) ההשתתפות נכנסת לדירוג של אותו טורניר.</li>
                <li><strong className="text-amber-400/90">דירוג ופרסים:</strong> בדף "דירוג" בוחרים טורניר ורואים את טבלת המובילים. במונדיאל – לפי סכום הנקודות; בלוטו ובצ'אנס – לפי התאמה לתוצאות ההגרלה. הפרסים מחולקים לפי כללי כל טורניר (למשל למקום ראשון, שלישייה מובילה וכד').</li>
              </ul>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-600/50">
              <h3 className="text-white font-bold">ניווט באתר</h3>
              <p className="text-sm text-slate-400">
                <strong className="text-slate-300">טורנירים</strong> – רשימת כל התחרויות ובחירה להרשמה. <strong className="text-slate-300">טפסים</strong> – כל הטפסים ששלחת והסטטוס שלהם. <strong className="text-slate-300">דירוג</strong> – טבלאות מובילים לפי טורניר. ליצירת קשר ושאלות – כפתור הוואטסאפ בתחתית הדף.
              </p>
            </div>
          </div>
        </section>

        {/* כפתורי משתמש */}
        <div className="flex gap-4 justify-center flex-wrap">
          {!isAuthenticated && (
            <>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 rounded-xl btn-sport"
                onClick={() => setLocation("/register")}
              >
                הרשמה
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 text-lg px-8 rounded-xl"
                onClick={() => setLocation("/login")}
              >
                התחברות
              </Button>
            </>
          )}
          <Button
            size="lg"
            variant="outline"
            className="border-slate-500 text-slate-300 hover:bg-slate-700/50 text-lg px-6 rounded-xl"
            onClick={() => setLocation("/tournaments")}
          >
            כל הטורנירים
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20 text-lg px-6 rounded-xl"
            onClick={() => setLocation("/leaderboard")}
          >
            טבלת דירוג
          </Button>
        </div>
      </section>
    </div>
  );
}
