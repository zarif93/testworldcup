import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Trophy, Loader2, Lock } from "lucide-react";

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
  if (/^[\d\s\/\.\-–—]+$/i.test(name) || /^\d+\.?\d*\s*[xX]?$/i.test(name)) return `${label} ₪${amount}`;
  return name;
}

export default function TournamentSelect() {
  const [, setLocation] = useLocation();
  useNow(1000);
  const { data: tournamentStats, isLoading } = trpc.tournaments.getPublicStats.useQuery();
  type T = NonNullable<typeof tournamentStats>[number];
  const typeOrder: Record<string, number> = { football: 0, mondial: 0, lotto: 1, chance: 2, football_custom: 3 };
  const typeLabel: Record<string, string> = { football: "מונדיאל", lotto: "לוטו", chance: "צ'אנס", football_custom: "כדורגל", mondial: "מונדיאל" };
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

    return (
      <button
        key={t.id}
        type="button"
        disabled={isLocked}
        onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
        className={`w-full text-right rounded-xl border-2 p-4 sm:p-5 transition-all duration-200 min-w-0 overflow-hidden flex flex-col gap-3 shadow-md hover:shadow-lg animate-slide-up ${isLocked ? "opacity-90 cursor-not-allowed border-slate-600/60 bg-slate-800/60" : "border-slate-600/50 bg-slate-800/50 hover:border-emerald-500/40 active:scale-[0.99] cursor-pointer"}`}
        style={{ animationDelay: `${i * 0.04}s` }}
      >
        <p className="text-white font-bold text-base sm:text-lg leading-tight break-words">{displayName}</p>
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-slate-400 break-words"><span className="text-slate-500">סוג:</span> {typeLabel[type] ?? "תחרות"}</p>
          <p className="text-amber-400/90 font-medium break-words"><span className="text-slate-500">כניסה:</span> ₪{t.amount}</p>
          <p className="text-emerald-400/90 font-medium break-words"><span className="text-slate-500">פרס:</span> ₪{t.prizePool.toLocaleString("he-IL")}</p>
          {openDateStr && !openDateTimeStr && <p className="text-slate-400 text-xs break-words">נפתח: {openDateStr}</p>}
          {openDateTimeStr && <p className="text-slate-400 text-xs break-words">נפתח: {openDateTimeStr}</p>}
          {closeTimeStr && !closeDateTimeStr && <p className="text-slate-400 text-xs break-words">נסגר: {closeTimeStr}</p>}
          {closeDateTimeStr && <p className="text-slate-400 text-xs break-words">נסגר: {closeDateTimeStr}</p>}
          {timerStr != null && <p className="text-amber-400/90 text-xs font-mono">⏳ נסגר בעוד: {timerStr}</p>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {isLocked && countdown != null && (
            <span className="text-slate-400 text-xs font-mono flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> {countdown}
            </span>
          )}
        </div>
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
          בחרו תחרות מהרשימה והשתתפו. מונדיאל, לוטו, צ'אנס או כדורגל – כל תחרות לפי כללים משלה.
        </p>

        {/* איך זה עובד – הסבר קצר */}
        <div className="max-w-2xl mx-auto mb-6 md:mb-12 p-3 sm:p-6 rounded-2xl bg-slate-800/50 border border-slate-600/50 text-right min-w-0 overflow-hidden max-w-full">
          <h2 className="text-base sm:text-lg font-bold text-white mb-2 sm:mb-3 break-words">איך זה עובד</h2>
          <ul className="text-slate-400 text-sm sm:text-base space-y-2 list-none break-words leading-relaxed">
            <li><strong className="text-slate-300">בחירת תחרות:</strong> בחרו תחרות מהרשימה (מונדיאל, לוטו, צ'אנס או כדורגל) ולחצו עליה.</li>
            <li><strong className="text-slate-300">טופס והשתתפות:</strong> אחרי הלחיצה תגיעו לטופס לפי סוג התחרות. מלאו ושליחו.</li>
            <li><strong className="text-slate-300">אישור ותשלום:</strong> לאחר אישור מנהל ותשלום תיכנסו לדירוג של התחרות.</li>
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
