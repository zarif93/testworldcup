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
import { Trophy, Loader2, Lock, X } from "lucide-react";
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

function getRemainingSeconds(removalScheduledAt: string | Date | number | null | undefined): number {
  if (removalScheduledAt == null) return 0;
  const end = new Date(removalScheduledAt).getTime();
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function formatRemaining(removalScheduledAt: string | Date | null | undefined): string {
  const remaining = getRemainingSeconds(removalScheduledAt);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatRemainingHms(until: string | Date | number | null | undefined): string {
  if (until == null) return "0:00:00";
  const remaining = getRemainingSeconds(until);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** תאריך פתיחה לתצוגה – נפתח: DD/MM/YYYY */
function formatOpenDate(val: string | Date | number | null | undefined): string | null {
  if (val == null) return null;
  let date: Date;
  if (typeof val === "string") {
    if (!val.trim()) return null;
    date = new Date(val.trim() + "T12:00:00");
  } else {
    date = new Date(val);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** מועד סגירת צ'אנס (ms) מתאריך + שעה ישראל */
function getChanceCloseTimestamp(drawDate: string | null | undefined, drawTime: string | null | undefined): number | null {
  if (!drawDate?.trim() || !drawTime?.trim()) return null;
  const date = new Date(drawDate.trim() + "T" + drawTime.trim() + ":00+02:00");
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

/** תאריך+שעה לתצוגה – נפתח/נסגר: DD/MM/YYYY HH:MM (למונדיאל) */
function formatDateTime(val: string | Date | number | null | undefined): string | null {
  if (val == null) return null;
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return null;
  const d = date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const t = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d} ${t}`;
}

/** טיימר עם ימים – ⏳ נסגר בעוד: X ימים HH:MM:SS או HH:MM:SS */
function formatRemainingWithDays(until: string | Date | number | null | undefined): string {
  if (until == null) return "0:00:00";
  const remaining = getRemainingSeconds(until);
  const days = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const timePart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (days > 0) return `${days} ימים ${timePart}`;
  return timePart;
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
      refetch();
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

  const allTournamentsList = (() => {
    if (!tournamentStats?.length) return [];
    const football = (byType.football ?? []).map((t) => ({ ...t, _type: "football" as const }));
    const lotto = (byType.lotto ?? []).map((t) => ({ ...t, _type: "lotto" as const }));
    const chance = (byType.chance ?? []).map((t) => ({ ...t, _type: "chance" as const }));
    const footballCustom = (byType.footballCustom ?? []).map((t) => ({ ...t, _type: "football_custom" as const }));
    return [...football, ...lotto, ...chance, ...footballCustom];
  })();
  const typeLabel: Record<string, string> = { football: "מונדיאל", lotto: "לוטו", chance: "צ'אנס", football_custom: "כדורגל" };

  /** שם לתצוגה: אם השם ריק או נראה כמו תאריך/נתונים שבורים – מציגים "סוג תחרות ₪סכום" */
  function getTournamentDisplayName(
    t: { name?: string | null; amount?: number; type?: string },
    typeKey: "football" | "lotto" | "chance" | "football_custom"
  ): string {
    const name = (t.name ?? "").trim();
    const label = typeLabel[typeKey] ?? typeLabel[t.type ?? "football"] ?? "תחרות";
    const amount = t.amount ?? 0;
    if (!name) return `${label} ₪${amount}`;
    if (name.length < 2) return `${label} ₪${amount}`;
    if (/^[\d\s\/\.\-–—]+$/i.test(name)) return `${label} ₪${amount}`;
    if (/^\d+\.?\d*\s*[xX]?$/i.test(name)) return `${label} ₪${amount}`;
    return name;
  }

  /** תאריך ושעת הגרלה לפורמט קריא – רק אם התאריך תקין */
  function formatDrawLabelSafe(drawDate: string | null | undefined, drawTime: string | null | undefined): string | null {
    if (!drawDate?.trim() || !drawTime?.trim()) return null;
    const date = new Date(drawDate.trim() + "T12:00:00");
    if (Number.isNaN(date.getTime())) return null;
    const formatted = date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${formatted} – ${drawTime.trim()}`;
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative container mx-auto px-3 sm:px-4 pt-4 pb-6 md:pt-12 md:pb-16 lg:pt-20 lg:pb-24 text-center overflow-x-hidden max-w-full">
        <div className="animate-fade-in min-w-0">
          <div className="inline-flex items-center justify-center w-16 h-16 xs:w-20 xs:h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-amber-500/20 to-emerald-600/20 border border-amber-500/30 mb-4 md:mb-8 shadow-lg">
            <Trophy className="w-8 h-8 xs:w-10 xs:h-10 sm:w-14 sm:h-14 text-amber-400 drop-shadow" />
          </div>
          <h1 className="text-xl xs:text-2xl min-[375px]:text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white mb-2 md:mb-4 tracking-tight drop-shadow-sm px-1 break-words">
            תחרות ניחושי המונדיאל הגדולה
          </h1>
          <p className="text-sm xs:text-base sm:text-lg md:text-xl text-emerald-200/95 mb-2 md:mb-4 max-w-2xl mx-auto font-medium break-words">
            FIFA World Cup 2026 – שלב הבתים
          </p>
          <p className="text-slate-400 text-xs sm:text-base mb-6 md:mb-12 max-w-xl mx-auto px-1 break-words">
            בחר טורניר, מלא ניחושים לכל 72 המשחקים, ועקוב אחרי הדירוג והפרסים.
          </p>
        </div>

        {/* CTA – בחר טורניר */}
        {!isLoading && hasAny && (
          <div className="animate-slide-up mb-8 md:mb-16">
            <Button
              size="lg"
              className="w-full max-w-xs sm:w-auto min-h-[48px] sm:min-h-[52px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-base sm:text-lg px-6 sm:px-10 py-5 sm:py-6 rounded-2xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 btn-sport touch-target"
              onClick={() => setLocation("/tournaments")}
            >
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 ml-2 text-amber-300 shrink-0" />
              בחר טורניר
            </Button>
          </div>
        )}

        {/* כרטיסי טורניר – שורה לכל סוג */}
        {isLoading ? (
          <div className="space-y-12 max-w-5xl mx-auto mb-20">
            <div>
              <Skeleton className="h-6 w-48 mx-auto mb-4 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl bg-slate-700/50" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-32 mx-auto mb-4 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          <>
          {/* מובייל: Grid 2–3 תחרויות בשורה, כרטיסים קומפקטיים */}
          <div className="md:hidden max-w-6xl mx-auto mb-10 min-w-0 overflow-hidden px-2">
            <h2 className="text-lg font-bold text-white mb-2 px-0.5">תחרויות פתוחות עכשיו</h2>
            <div className="grid grid-cols-2 min-[414px]:grid-cols-3 gap-2">
              {allTournamentsList.map((t) => {
                const isLocked = t.status === "LOCKED" || t.status === "CLOSED" || t.isLocked;
                const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                const drawDate = (t as { drawDate?: string | null }).drawDate;
                const drawTime = (t as { drawTime?: string | null }).drawTime;
                const openDateStr = formatOpenDate(t._type === "chance" || t._type === "lotto" ? drawDate : (t as { opensAt?: Date | number | null }).opensAt);
                const closeTimeStr = drawTime?.trim() || (closesAt != null ? new Date(closesAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null);
                const openDateTimeStr = t._type === "football" && (t as { opensAt?: Date | number | null }).opensAt != null ? formatDateTime((t as { opensAt?: Date | number }).opensAt) : null;
                const closeDateTimeStr = t._type === "football" && closesAt != null ? formatDateTime(closesAt) : null;
                const closeTimestamp = t._type === "chance" ? getChanceCloseTimestamp(drawDate, drawTime) : t._type === "lotto" ? (closesAt != null ? new Date(closesAt).getTime() : null) : closesAt != null ? new Date(closesAt).getTime() : null;
                const remainingSecClose = closeTimestamp != null ? Math.max(0, Math.floor((closeTimestamp - Date.now()) / 1000)) : 0;
                const timerStr = !isLocked && closeTimestamp != null && remainingSecClose > 0 ? (t._type === "football" ? formatRemainingWithDays(closeTimestamp) : formatRemainingHms(closeTimestamp)) : null;
                const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                const drawCountdown = t._type === "lotto" && !isLocked && closesAt != null ? formatRemainingHms(closesAt) : null;
                const remainingSec = closesAt != null && !isLocked ? getRemainingSeconds(closesAt) : null;
                const closingSoon = remainingSec != null && remainingSec > 0 && remainingSec < 3600;
                const popular = (t.participants ?? 0) >= 15;
                const showHide = canShowHide(t.status);
                const cardBorder = closingSoon ? "border-amber-500/60" : popular ? "border-emerald-500/40" : "border-slate-600/50";
                return (
                  <div key={t.id} className={`relative rounded-lg border bg-slate-800/80 shadow-md overflow-hidden min-w-0 transition-all duration-200 active:scale-[0.99] ${cardBorder}`}>
                    {showHide && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                        className="absolute left-0.5 top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white min-h-[36px] min-w-[36px]"
                        aria-label="הסתר מדף ראשי"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {(closingSoon || popular) && (
                      <span className="absolute right-0.5 top-0.5 z-[1] text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/90 text-slate-900 leading-none">
                        {closingSoon ? "נסגר" : "פופולרי"}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                      className={`w-full text-right p-2 flex flex-col items-stretch gap-1 min-w-0 min-h-0 ${isLocked ? "opacity-90 cursor-not-allowed" : "active:scale-[0.98]"}`}
                    >
                      <p className="text-white font-bold text-xs leading-tight line-clamp-2 break-words">{getTournamentDisplayName(t, t._type)}</p>
                      <p className="text-amber-400 font-semibold text-[10px] leading-tight">₪{t.prizePool.toLocaleString("he-IL")} פרס</p>
                      <p className="text-slate-400 text-[10px]">כניסה ₪{t.amount}</p>
                      <p className="text-slate-400 text-[10px]">משתתפים: {t.participants ?? 0}</p>
                      {openDateStr && !openDateTimeStr && <p className="text-slate-400 text-[9px]">נפתח: {openDateStr}</p>}
                      {openDateTimeStr && <p className="text-slate-400 text-[9px]">נפתח: {openDateTimeStr}</p>}
                      {closeTimeStr && !closeDateTimeStr && <p className="text-slate-400 text-[9px]">נסגר: {closeTimeStr}</p>}
                      {closeDateTimeStr && <p className="text-slate-400 text-[9px]">נסגר: {closeDateTimeStr}</p>}
                      {timerStr != null && <p className="text-amber-400/90 text-[9px] font-mono">⏳ נסגר בעוד: {timerStr}</p>}
                      {isLocked && countdown != null && <p className="text-red-400 text-[9px] font-mono flex items-center gap-0.5"><Lock className="w-2.5 h-2.5 shrink-0" /> {countdown}</p>}
                      <span className={`shrink-0 text-[10px] font-bold py-1.5 px-2 rounded-md w-full flex items-center justify-center mt-0.5 min-h-[32px] ${isLocked ? "bg-slate-600 text-slate-400" : "bg-emerald-600 text-white"}`}>
                        {isLocked ? "סגור" : "שלח טופס"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <TooltipProvider>
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-6xl mx-auto mb-16 md:mb-20 min-w-0 overflow-hidden px-1">
            {/* טור 1: מונדיאל */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 text-center break-words">מונדיאל – ניחושי משחקים</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.football ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                    const opensAt = (t as { opensAt?: Date | number | null }).opensAt;
                    const openDateStr = formatOpenDate(opensAt);
                    const closeTimeStr = closesAt != null ? new Date(closesAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null;
                    const openDateTimeStr = opensAt != null ? formatDateTime(opensAt) : null;
                    const closeDateTimeStr = closesAt != null ? formatDateTime(closesAt) : null;
                    const timerStr = !isLocked && closesAt != null && new Date(closesAt).getTime() > Date.now() ? formatRemainingWithDays(closesAt) : null;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group min-w-0">
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
                          className={`card-sport bg-slate-800/60 border-slate-600/50 px-4 py-5 text-center min-w-0 min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center rounded-2xl overflow-hidden w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 shrink-0 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg break-words min-w-0 leading-tight">{getTournamentDisplayName(t, "football")}</p>
                        {openDateTimeStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateTimeStr}</p>}
                        {!openDateTimeStr && openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {closeDateTimeStr && <p className="text-slate-400 text-xs">נסגר: {closeDateTimeStr}</p>}
                        {!closeDateTimeStr && closeTimeStr && <p className="text-slate-400 text-xs">נסגר: {closeTimeStr}</p>}
                        {timerStr != null && <p className="text-amber-400/90 text-sm font-mono mt-0.5">⏳ נסגר בעוד: {timerStr}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1 break-words">
                              <Lock className="w-4 h-4 shrink-0" /> התחרות ננעלה
                            </p>
                            <p className="text-red-300 font-black text-lg mt-1 break-words">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-amber-400 font-black text-lg mt-1.5 break-words leading-tight">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-1.5 break-words">{t.participants} משתתפים</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.football ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
            {/* טור 2: לוטו */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 text-center break-words">לוטו</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.lotto ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.status === "CLOSED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                    const drawDate = (t as { drawDate?: string | null }).drawDate;
                    const drawTime = (t as { drawTime?: string | null }).drawTime;
                    const openDateStr = formatOpenDate(drawDate);
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const drawCountdown = !isLocked && closesAt != null ? formatRemainingHms(closesAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group min-w-0">
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
                          className={`card-sport bg-slate-800/60 border-slate-600/50 p-5 text-center min-w-0 min-h-[120px] sm:min-h-[140px] overflow-hidden flex flex-col items-center justify-center rounded-2xl w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg break-words min-w-0">{getTournamentDisplayName(t, "lotto")}</p>
                        {openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {drawTime?.trim() && <p className="text-slate-400 text-xs">נסגר: {drawTime.trim()}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1"><Lock className="w-4 h-4" /> {t.status === "CLOSED" ? "ההגרלה נסגרה" : "התחרות ננעלה"}</p>
                            <p className="text-red-300 font-black text-xl mt-1">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : drawCountdown != null ? (
                          <>
                            <p className="text-slate-400 text-sm mt-1">⏳ נסגר בעוד</p>
                            <p className="text-amber-400 font-black text-xl mt-1 font-mono tabular-nums">{drawCountdown}</p>
                            <p className="text-slate-500 text-xs mt-2 break-words">{t.participants} משתתפים</p>
                          </>
                        ) : (
                          <>
                            <p className="text-amber-400 font-black text-xl mt-1 break-words">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-2 break-words">{t.participants} משתתפים</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.lotto ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
            {/* טור 3: צ'אנס */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 text-center break-words">צ'אנס</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.chance ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const d = (t as { drawDate?: string | null }).drawDate;
                    const drawTime = (t as { drawTime?: string | null }).drawTime;
                    const drawLabel = formatDrawLabelSafe(d, drawTime);
                    const openDateStr = formatOpenDate(d);
                    const chanceCloseMs = getChanceCloseTimestamp(d, drawTime);
                    const chanceCountdown = !isLocked && chanceCloseMs != null && chanceCloseMs > Date.now() ? formatRemainingHms(chanceCloseMs) : null;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group min-w-0">
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
                          className={`card-sport bg-slate-800/60 border-slate-600/50 px-4 py-5 text-center min-w-0 min-h-[120px] sm:min-h-[160px] flex flex-col items-center justify-center rounded-2xl overflow-hidden w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 shrink-0 ${styles.icon}`} />
                        <p className="text-white font-bold text-base break-words min-w-0 leading-tight">{getTournamentDisplayName(t, "chance")}</p>
                        {openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {drawTime?.trim() && <p className="text-slate-400 text-xs">נסגר: {drawTime.trim()}</p>}
                        {chanceCountdown != null && <p className="text-amber-400/90 text-sm font-mono mt-0.5">⏳ נסגר בעוד: {chanceCountdown}</p>}
                        {drawLabel && !isLocked && !chanceCountdown && <p className="text-slate-400 text-xs mt-1 break-words min-w-0 leading-tight">⏰ {drawLabel}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1 break-words"><Lock className="w-4 h-4 shrink-0" /> התחרות ננעלה</p>
                            <p className="text-red-300 font-black text-lg mt-1 break-words">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : !isLocked && (
                          <>
                            <p className="text-amber-400 font-black text-lg mt-1.5 break-words leading-tight">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-1.5 break-words">{t.participants} משתתפים</p>
                          </>
                        )}
                        {isLocked && !countdown && <span className="text-slate-500 text-xs mt-1">🔒</span>}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.chance ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
            {/* טור 4: תחרות כדורגל */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 text-center break-words">תחרות כדורגל</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.footballCustom ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                    const opensAt = (t as { opensAt?: Date | number | null }).opensAt;
                    const openDateStr = formatOpenDate(opensAt);
                    const closeTimeStr = closesAt != null ? new Date(closesAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null;
                    const timerStr = !isLocked && closesAt != null && new Date(closesAt).getTime() > Date.now() ? formatRemainingHms(closesAt) : null;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    return (
                      <div key={t.id} className="relative group min-w-0">
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
                          className={`card-sport bg-slate-800/60 border-slate-600/50 px-4 py-5 text-center min-w-0 min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center rounded-2xl overflow-hidden w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 shrink-0 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg break-words min-w-0 leading-tight">{getTournamentDisplayName(t, "football_custom")}</p>
                        {openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {closeTimeStr && <p className="text-slate-400 text-xs">נסגר: {closeTimeStr}</p>}
                        {timerStr != null && <p className="text-amber-400/90 text-sm font-mono mt-0.5">⏳ נסגר בעוד: {timerStr}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1 break-words"><Lock className="w-4 h-4 shrink-0" /> התחרות ננעלה</p>
                            <p className="text-red-300 font-black text-lg mt-1 break-words">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-amber-400 font-black text-lg mt-1.5 break-words leading-tight">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                            <p className="text-slate-500 text-xs mt-1.5 break-words">{t.participants} משתתפים</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.footballCustom ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
          </div>
          </TooltipProvider>
          </>
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

        {/* כפתורי משתמש */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center flex-wrap px-2">
          {!isAuthenticated && (
            <>
              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white text-base sm:text-lg px-8 rounded-2xl btn-sport"
                onClick={() => setLocation("/register")}
              >
                הרשמה
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto min-h-[48px] border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 text-base sm:text-lg px-8 rounded-2xl"
                onClick={() => setLocation("/login")}
              >
                התחברות
              </Button>
            </>
          )}
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto min-h-[48px] border-slate-500 text-slate-300 hover:bg-slate-700/50 text-base sm:text-lg px-6 rounded-2xl"
            onClick={() => setLocation("/tournaments")}
          >
            כל התחרויות
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto min-h-[48px] border-amber-500/50 text-amber-400 hover:bg-amber-500/20 text-base sm:text-lg px-6 rounded-2xl"
            onClick={() => setLocation("/leaderboard")}
          >
            טבלת דירוג
          </Button>
        </div>
      </section>
    </div>
  );
}
