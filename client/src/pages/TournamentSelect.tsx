import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Trophy, Loader2, Lock } from "lucide-react";
import { SocialProofStrip } from "@/components/SocialProofStrip";
import { ThreeStepsTrustStrip } from "@/components/ThreeStepsTrustStrip";

function useNow(intervalMs: number) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function formatRemaining(removalScheduledAt: string | Date | number | null | undefined): string {
  if (!removalScheduledAt) return "00:00";
  const end = new Date(removalScheduledAt).getTime();
  const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatRemainingHms(until: string | Date | number | null | undefined): string {
  if (until == null) return "0:00:00";
  const end = new Date(until).getTime();
  const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** תאריך פתיחה – נפתח: DD/MM/YYYY */
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

function getRemainingSeconds(until: string | Date | number | null | undefined): number {
  if (until == null) return 0;
  const end = new Date(until).getTime();
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

/** תאריך+שעה – נפתח/נסגר: DD/MM/YYYY HH:MM (למונדיאל) */
function formatDateTime(val: string | Date | number | null | undefined): string | null {
  if (val == null) return null;
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return null;
  const d = date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const t = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d} ${t}`;
}

/** טיימר עם ימים – נסגר בעוד: X ימים HH:MM:SS */
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

/** שם לתצוגה – אם ריק או נראה כמו נתונים שבורים, מציגים "סוג ₪סכום" */
function getDisplayName(t: { name?: string | null; amount?: number; type?: string }, typeLabel: Record<string, string>, type: string): string {
  const name = (t.name ?? "").trim();
  const label = typeLabel[type] ?? "תחרות";
  const amount = t.amount ?? 0;
  if (!name || name.length < 2) return `${label} ₪${amount}`;
  if (/^[\d\s/.\-–—]+$/i.test(name) || /^\d+\.?\d*\s*[xX]?$/i.test(name)) return `${label} ₪${amount}`;
  return name;
}

export default function TournamentSelect() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  useNow(1000);
  const { data: tournamentStats, isLoading } = trpc.tournaments.getPublicStats.useQuery();
  const { data: firstParticipation } = trpc.user.getFirstParticipationStatus.useQuery(undefined, { enabled: isAuthenticated });
  type T = NonNullable<typeof tournamentStats>[number];
  const typeOrder: Record<string, number> = { football: 0, mondial: 0, lotto: 1, chance: 2, football_custom: 3 };
  const typeLabel: Record<string, string> = { football: "מונדיאל", lotto: "לוטו", chance: "צ'אנס", football_custom: "תחרויות ספורט", mondial: "מונדיאל" };
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
    { key: "football_custom", title: "תחרויות ספורט" },
  ];

  function getStatusInfo(tour: T): { label: string; color: string } {
    const status = (tour as { status?: string }).status;
    const isLocked = status === "LOCKED" || status === "CLOSED" || tour.isLocked;
    const removalAt = (tour as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
    const closesAt = (tour as { closesAt?: Date | number | null }).closesAt;
    const hasCountdown = isLocked && removalAt;
    const typ = (tour.type ?? "football") as string;
    const lottoClosed = typ === "lotto" && status === "CLOSED";
    if (!isLocked) {
      const remainingSec = closesAt != null ? Math.max(0, Math.floor((new Date(closesAt).getTime() - Date.now()) / 1000)) : null;
      const closingSoon = remainingSec != null && remainingSec < 3600;
      return { label: closingSoon ? "נסגר בקרוב" : "פתוח להרשמה", color: closingSoon ? "text-amber-400 bg-amber-500/20 border-amber-500/50" : "text-emerald-400 bg-emerald-500/20 border-emerald-500/50" };
    }
    if (lottoClosed || (hasCountdown && removalAt && new Date(removalAt).getTime() <= Date.now())) {
      return { label: "הסתיים", color: "text-slate-400 bg-slate-600/30 border-slate-500/50" };
    }
    return { label: "נסגר", color: "text-amber-400 bg-amber-500/20 border-amber-500/50" };
  }

  const renderTournamentCard = (t: T, sectionKey: keyof typeof byType, i: number) => {
    const type = (t.type ?? "football") as string;
    const isLocked = (t as { status?: string }).status === "LOCKED" || (t as { status?: string }).status === "CLOSED" || t.isLocked;
    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
    const drawDate = (t as { drawDate?: string | null }).drawDate;
    const drawTime = (t as { drawTime?: string | null }).drawTime;
    const opensAt = (t as { opensAt?: Date | number | null }).opensAt;
    const openDateStr = formatOpenDate(type === "chance" || type === "lotto" ? drawDate : opensAt);
    const closeTimeStr = drawTime?.trim() || (closesAt != null ? new Date(closesAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null);
    const openDateTimeStr = type === "football" && opensAt != null ? formatDateTime(opensAt) : null;
    const closeDateTimeStr = type === "football" && closesAt != null ? formatDateTime(closesAt) : null;
    const closeTs = type === "chance" ? getChanceCloseTimestamp(drawDate, drawTime) : closesAt != null ? new Date(closesAt).getTime() : null;
    const timerStr = !isLocked && closeTs != null && closeTs > Date.now() ? (type === "football" ? formatRemainingWithDays(closeTs) : formatRemainingHms(closeTs)) : null;
    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
    const statusInfo = getStatusInfo(t);
    const displayName = getDisplayName(t, typeLabel, type);
    const remainingSec = closeTs != null && !isLocked && closeTs > Date.now() ? Math.max(0, Math.floor((closeTs - Date.now()) / 1000)) : 0;
    const closingSoon = remainingSec > 0 && remainingSec < 3600;
    const lessThanHour = remainingSec > 0 && remainingSec < 3600;
    const remainingMinutes = closeTs != null && closeTs > Date.now() ? Math.ceil(remainingSec / 60) : 0;
    const cardLive = !isLocked && (closingSoon ? "card-tournament-closing" : "card-tournament-live");
    const maxParticipants = (t as { maxParticipants?: number | null }).maxParticipants;
    const spotsLeft = maxParticipants != null && maxParticipants > 0 ? Math.max(0, maxParticipants - (t.participants ?? 0)) : null;
    const prizeGrowing = !isLocked && (t.participants ?? 0) > 0;

    return (
      <button
        key={t.id}
        type="button"
        disabled={isLocked}
        onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
        className={`relative w-full text-right min-w-0 overflow-hidden flex flex-col rounded-xl border-2 transition-all duration-200 animate-slide-up min-h-[44px] ${cardLive} card-tournament-premium ${isLocked ? "opacity-90 cursor-not-allowed border-slate-600/60" : "border-slate-600/50 hover:border-emerald-500/40 active:scale-[0.99] cursor-pointer"}`}
        style={{ animationDelay: `${i * 0.04}s` }}
        aria-label={isLocked ? `צפה – ${displayName}` : `הצטרף – ${displayName}`}
      >
        {!isLocked && (closingSoon || lessThanHour) && <div className="absolute top-0 left-0 right-0 z-[2] tournament-card-urgency-bar" aria-hidden />}
        {/* Category badge top-right; status top-left – RTL-friendly, no overlap */}
        <span className="absolute right-2 top-2 z-[1] inline-flex rounded-md border border-slate-600/60 bg-slate-700/95 text-slate-300 px-2 py-0.5 text-[10px] font-bold shadow-sm whitespace-nowrap sm:right-3 sm:top-3 sm:text-xs sm:px-2.5 sm:py-1">
          {typeLabel[type] ?? "תחרות"}
        </span>
        <span className={`absolute left-2 top-2 z-[1] inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold sm:left-3 sm:top-3 sm:text-xs sm:px-2.5 sm:py-1 ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        <div className="pt-8 pb-3 px-3 sm:pt-10 sm:pb-4 sm:px-4 flex flex-col gap-1.5 sm:gap-2">
          <p className="text-white font-bold text-sm sm:text-base leading-tight break-words">{displayName}</p>
          <p className="text-emerald-400 font-black text-lg sm:text-xl leading-tight tabular-nums break-words">₪{t.prizePool.toLocaleString("he-IL")} {t.amount === 0 && t.prizePool > 0 ? "פרס מובטח" : "פרס"}</p>
          {prizeGrowing && <p className="text-emerald-400/90 text-xs font-semibold">הקופה גדלה עכשיו</p>}
          <p className="text-amber-400/95 font-semibold text-xs sm:text-sm">{t.amount === 0 ? "כניסה חינם" : `כניסה ₪${t.amount}`}</p>
          <p className="text-slate-400 text-[11px] sm:text-xs font-medium">{(t.participants ?? 0)} משתתפים</p>
          {spotsLeft != null && spotsLeft > 0 && <p className="text-amber-400 text-xs font-semibold">נשארו {spotsLeft} מקומות</p>}
          {!isLocked && timerStr != null && (
            remainingMinutes <= 60 && remainingMinutes > 0 ? (
              <p className={`text-sm font-mono font-bold tabular-nums ${lessThanHour ? "countdown-urgent is-less-than-hour" : "text-amber-400"}`}>נסגר תוך {remainingMinutes} דקות</p>
            ) : (
              <p className={`text-xs sm:text-sm font-mono font-semibold tabular-nums ${lessThanHour ? "countdown-urgent is-less-than-hour" : "text-amber-400/90"}`}>⏳ {timerStr}</p>
            )
          )}
          <div className="flex flex-wrap gap-x-2 gap-y-0 text-[10px] sm:text-xs text-slate-500 leading-tight">
            {openDateStr && !openDateTimeStr && <span>נפתח: {openDateStr}</span>}
            {openDateTimeStr && <span>נפתח: {openDateTimeStr}</span>}
            {closeTimeStr && !closeDateTimeStr && <span>נסגר: {closeTimeStr}</span>}
            {closeDateTimeStr && <span>נסגר: {closeDateTimeStr}</span>}
          </div>
          {isLocked && countdown != null && (
            <span className="text-slate-400 text-[10px] font-mono flex items-center gap-1">
              <Lock className="w-3 h-3 shrink-0" /> {countdown}
            </span>
          )}
        </div>
        <span className={`btn-tournament-cta shrink-0 mx-3 mb-3 sm:mx-4 sm:mb-4 py-2 flex items-center justify-center text-sm sm:text-base font-bold ${isLocked ? "bg-slate-600/80 text-slate-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
          {isLocked ? "צפה" : "הצטרף עכשיו"}
        </span>
      </button>
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
    <div className="min-h-screen py-4 sm:py-6 md:py-12 overflow-x-hidden max-w-full" dir="rtl">
      <div className="container mx-auto px-3 sm:px-4 min-w-0">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-3 md:mb-5 flex items-center justify-center gap-2 animate-fade-in">
          <Trophy className="w-8 h-8 sm:w-9 sm:h-9 text-amber-400 shrink-0" />
          🏆 טורנירים זמינים
        </h1>
        <p className="text-slate-400 text-center mb-6 md:mb-10 max-w-xl mx-auto text-sm sm:text-base px-1 break-words">
          בחרו תחרות מהרשימה והשתתפו. מונדיאל, לוטו, צ'אנס או תחרויות ספורט – כל תחרות לפי כללים משלה.
        </p>
        {/* Phase 36: First participation – encourage first-time join */}
        {isAuthenticated && firstParticipation && !firstParticipation.hasApprovedSubmission && hasAny && (
          <div className="max-w-xl mx-auto mb-6 py-3 px-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center">
            <p className="text-amber-200 font-medium text-sm sm:text-base">ההשתתפות הראשונה? בחרו תחרות מהרשימה למטה והתחילו עכשיו.</p>
          </div>
        )}
        <SocialProofStrip className="mb-6 md:mb-8 max-w-2xl mx-auto" />
        {/* Phase 35: 3 steps + trust */}
        <div className="max-w-2xl mx-auto mb-6">
          <ThreeStepsTrustStrip showTrustLinks={true} />
        </div>
        {/* איך זה עובד – פרטים + מה אחרי שליחה + Phase 33: leaderboard teaser */}
        <div className="max-w-2xl mx-auto mb-6 md:mb-12 p-3 sm:p-6 rounded-2xl bg-slate-800/50 border border-slate-600/50 text-right min-w-0 overflow-hidden max-w-full">
          <h2 className="text-base sm:text-lg font-bold text-white mb-2 sm:mb-3 break-words">פרטים נוספים</h2>
          <ul className="text-slate-400 text-sm sm:text-base space-y-2 list-none break-words leading-relaxed">
            <li><strong className="text-slate-300">בחירת תחרות:</strong> בחרו תחרות מהרשימה (מונדיאל, לוטו, צ'אנס או תחרויות ספורט) ולחצו עליה.</li>
            <li><strong className="text-slate-300">טופס והשתתפות:</strong> אחרי הלחיצה תגיעו לטופס לפי סוג התחרות. מלאו ושליחו.</li>
            <li><strong className="text-slate-300">אחרי שליחה:</strong> הטופס נבדק על ידי המערכת. אחרי אישור – ההשתתפות נספרת ואתם נכנסים לדירוג התחרות.</li>
            <li><strong className="text-slate-300">נעילה:</strong> תחרות עם סימן 🔒 סגורה להרשמה – לא ניתן לשלוח אליה טפסים.</li>
          </ul>
          <p className="text-slate-500 text-xs sm:text-sm mt-3 pt-3 border-t border-slate-600/50">
            משתתפים אמיתיים • תחרות אמיתית • כללים ברורים. <button type="button" onClick={() => setLocation("/how-it-works")} className="text-amber-400/90 hover:text-amber-400 underline">הסבר מלא</button>
          </p>
          <div className="mt-4 pt-4 border-t border-slate-600/50">
            <button type="button" onClick={() => setLocation("/leaderboard")} className="text-amber-400 hover:text-amber-300 font-medium text-sm flex items-center gap-1.5">
              <Trophy className="w-4 h-4 shrink-0" />
              צפה בטבלת הדירוג
            </button>
          </div>
        </div>
        <div className="min-w-0 max-w-6xl mx-auto">
          {!hasAny ? (
            <div className="w-full max-w-xl mx-auto p-6 md:p-8 rounded-2xl bg-slate-800/50 border border-slate-600/50 text-center">
              <p className="text-slate-300 font-medium mb-2">אין תחרויות כרגע</p>
              <p className="text-slate-500 text-sm mb-4">כשיפתחו תחרויות חדשות הן יופיעו כאן. מונדיאל, לוטו, צ'אנס ותחרויות ספורט – כולן במקום אחד.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 min-w-0 overflow-x-hidden">
              {sectionOrder.map(({ key, title }) => {
                const list = byType[key];
                return (
                  <div key={key} className="min-w-0 flex flex-col">
                    <h2 className="text-xl font-bold text-white mb-5 text-center break-words">{title}</h2>
                    <div className="flex flex-col gap-5">
                      {list.map((t, i) => renderTournamentCard(t, key, i))}
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
