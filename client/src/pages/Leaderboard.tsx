import { useLocation } from "wouter";
import { useState, useEffect, useMemo, type ReactElement } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trophy, Check, Clock, X, Eye, Sparkles, ChevronDown } from "lucide-react";
import { SubmissionPredictionsModal } from "@/components/SubmissionPredictionsModal";
import { getTournamentStyles } from "@/lib/tournamentStyles";
import { NearWinBanner } from "@/components/NearWinBanner";
import { RivalStatusBanner } from "@/components/RivalStatusBanner";
import { StreakBanner } from "@/components/StreakBanner";
import { PositionDramaBanner } from "@/components/PositionDramaBanner";
import { LossAversionBanner } from "@/components/LossAversionBanner";

function RankBadge({ rank, isApproved }: { rank: number; isApproved: boolean }) {
  if (!isApproved) return <span className="text-slate-500">—</span>;
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 font-black shadow-lg shadow-amber-500/30">
        🥇
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 font-black shadow-lg shadow-slate-400/30">
        🥈
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 font-black shadow-lg shadow-amber-700/30">
        🥉
      </span>
    );
  return (
    <span className="text-slate-400 font-bold">#{rank}</span>
  );
}

type TournamentLike = { id: number; name: string; amount: number; type?: string; status?: string; resultsFinalizedAt?: Date | string | null; dataCleanedAt?: Date | string | null };

type PublicTournamentType = "WORLD_CUP" | "FOOTBALL" | "CHANCE" | "LOTTO";

function parseTournamentTypeParam(raw: string | null): PublicTournamentType | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  if (t === "WORLD_CUP" || t === "WORLDCUP") return "WORLD_CUP";
  if (t === "FOOTBALL") return "FOOTBALL";
  if (t === "CHANCE") return "CHANCE";
  if (t === "LOTTO") return "LOTTO";
  return null;
}

function tabLabel(tab: PublicTournamentType): string {
  if (tab === "WORLD_CUP") return "מונדיאל";
  if (tab === "FOOTBALL") return "תחרויות ספורט";
  if (tab === "CHANCE") return "צ'אנס";
  return "לוטו";
}

/** שורת זוכה אחת מטבלת ההתנחלות – לא מדירוג, רק מ־settlement */
type SettlementWinnerRow = {
  rank: number;
  userId: number;
  username: string;
  points: number;
  prizeAmount: number;
  prizePercentage: number;
};

/**
 * טבלת זוכים – רשמית (התנחלות) או תצוגה מקדימה (FreeRoll). אותן עמודות; כותרת/תת־כותרת ניתנים להעברה.
 */
function SettlementWinnersTable({
  winners,
  totalPrizePool,
  isFreeroll,
  title,
  subtitle,
}: {
  winners: SettlementWinnerRow[];
  totalPrizePool: number;
  isFreeroll: boolean;
  title?: string;
  subtitle?: string;
}) {
  const formatAmount = (n: number) => (isFreeroll ? `₪${n.toLocaleString("he-IL")}` : `${n.toLocaleString("he-IL")} pts`);
  const showHeader = title !== undefined && title !== "" || subtitle !== undefined && subtitle !== "";
  return (
    <div className="rounded-xl border-2 border-amber-500/50 bg-slate-800/60 overflow-hidden shadow-lg">
      {showHeader && (
        <div className="px-4 py-3 border-b border-slate-600/50 bg-amber-500/10">
          <h3 className="text-lg font-bold text-white">{title ?? "🏆 תוצאות חלוקת הפרסים"}</h3>
          <p className="text-slate-400 text-sm mt-0.5">{subtitle ?? "מבוסס על התנחלות – רק זוכים שקיבלו פרס (לא דירוג כללי)"}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/60">
              <th className="p-3 font-medium w-20">מקום</th>
              <th className="p-3 font-medium">משתמש</th>
              <th className="p-3 font-medium">ניקוד</th>
              <th className="p-3 font-medium">אחוז זכייה</th>
              <th className="p-3 font-medium">סכום זכייה</th>
            </tr>
          </thead>
          <tbody>
            {winners.map((w, i) => (
              <tr key={`${w.userId}-${w.rank}-${i}`} className="border-b border-slate-700/40 hover:bg-slate-700/30 transition-colors">
                <td className="p-3">
                  {w.rank === 1 ? "🥇" : w.rank === 2 ? "🥈" : w.rank === 3 ? "🥉" : `#${w.rank}`}
                </td>
                <td className="p-3 text-white font-medium">{w.username}</td>
                <td className="p-3 text-emerald-400 font-bold">{w.points}</td>
                <td className="p-3 text-amber-400">{w.prizePercentage}%</td>
                <td className="p-3 text-amber-400 font-medium">{formatAmount(w.prizeAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-600/50 text-slate-400 text-sm font-medium">
        סה״כ קופת פרסים: {formatAmount(totalPrizePool)}
      </div>
    </div>
  );
}

/** כרטיס דירוג בודד לטורניר – טוען דאטה לפי סוג התחרות */
function SingleTournamentLeaderboardCard({
  tournament,
  tabId,
  onViewSubmission,
  statusBadge,
}: {
  tournament: TournamentLike;
  tabId: PublicTournamentType;
  onViewSubmission: (id: number) => void;
  statusBadge: (status: string) => ReactElement;
}) {
  const t = tournament;
  const st = getTournamentStyles(t.amount);
  const isChance = tabId === "CHANCE";
  const isLotto = tabId === "LOTTO";
  const isFootballCustom = tabId === "FOOTBALL";
  const isMondial = tabId === "WORLD_CUP";

  const [isCardOpen, setIsCardOpen] = useState(true);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);

  const { data: chanceLeaderboard } = trpc.submissions.getChanceLeaderboard.useQuery(
    { tournamentId: t.id },
    { enabled: isChance && t.id > 0 }
  );
  const { data: lottoLeaderboard } = trpc.submissions.getLottoLeaderboard.useQuery(
    { tournamentId: t.id },
    { enabled: isLotto && t.id > 0 }
  );
  const { data: customFootballLeaderboard } = trpc.submissions.getCustomFootballLeaderboard.useQuery(
    { tournamentId: t.id },
    { enabled: isFootballCustom && t.id > 0 }
  );
  const { data: mondialSubs } = trpc.submissions.getByTournament.useQuery(
    { tournamentId: t.id },
    { enabled: isMondial && t.id > 0 }
  );
  const { data: settlementWinners } = trpc.submissions.getTournamentSettlementWinners.useQuery(
    { tournamentId: t.id },
    { enabled: t.id > 0 }
  );
  const isFreeroll = Number(t.amount ?? 0) === 0;
  const { data: settlementPreview } = trpc.submissions.getTournamentSettlementPreview.useQuery(
    { tournamentId: t.id },
    { enabled: isFreeroll && t.id > 0 && settlementWinners !== undefined && !settlementWinners.settled }
  );
  useEffect(() => {
    if (settlementWinners?.settled && typeof window !== "undefined") {
      console.log("settlementWinners", settlementWinners, "settlementWinners.winners.length", settlementWinners.winners?.length);
    }
  }, [settlementWinners]);
  const list = useMemo(() => {
    if (isMondial && mondialSubs) {
      return [...mondialSubs].sort((a, b) => {
        if (a.status === "approved" && b.status !== "approved") return -1;
        if (a.status !== "approved" && b.status === "approved") return 1;
        if (a.status === "approved" && b.status === "approved") return b.points - a.points;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }
    return [];
  }, [isMondial, mondialSubs]);

  const tour = t as { resultsFinalizedAt?: Date | string | null; dataCleanedAt?: Date | string | null; status?: string };
  const finalizedAt = tour.resultsFinalizedAt ? new Date(tour.resultsFinalizedAt).getTime() : 0;
  const cleanedAt = tour.dataCleanedAt;
  const isArchived = !!cleanedAt || tour.status === "ARCHIVED";
  const showLeaderboardPrizeAndWinner = !settlementWinners?.settled;
  const showPaidLeaderboard = !isFreeroll && (!settlementWinners?.settled || showFullLeaderboard);

  return (
    <Card className="card-sport bg-slate-800/60 border-slate-600/50 overflow-hidden mb-4">
      <CardHeader className="border-b border-slate-600/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {isChance ? <Sparkles className="w-6 h-6 text-amber-400 shrink-0" /> : <Trophy className={`w-6 h-6 shrink-0 ${st.icon}`} />}
              {t.name} – דירוג {tabLabel(tabId)}
            </h2>
            {isChance && chanceLeaderboard?.drawResult && (
              <p className="text-slate-400 text-sm mt-1">
                תוצאות ההגרלה: ❤️ {chanceLeaderboard.drawResult.heartCard} ♣ {chanceLeaderboard.drawResult.clubCard} ♦ {chanceLeaderboard.drawResult.diamondCard} ♠ {chanceLeaderboard.drawResult.spadeCard} • {chanceLeaderboard.drawResult.drawDate}
              </p>
            )}
            {isLotto && lottoLeaderboard?.drawResult && (
              <p className="text-slate-400 text-sm mt-1">
                תוצאות: {lottoLeaderboard.drawResult.num1}, {lottoLeaderboard.drawResult.num2}, {lottoLeaderboard.drawResult.num3}, {lottoLeaderboard.drawResult.num4}, {lottoLeaderboard.drawResult.num5}, {lottoLeaderboard.drawResult.num6} • חזק: {lottoLeaderboard.drawResult.strongNumber} • {lottoLeaderboard.drawResult.drawDate}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
            onClick={() => setIsCardOpen((prev) => !prev)}
            title={isCardOpen ? "סגור דירוג" : "הצג דירוג"}
          >
            <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isCardOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      {isCardOpen && (
      <CardContent className="p-0">
        {finalizedAt > 0 && (
          <div className="mx-4 mt-4 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-right">
            <p className="text-emerald-200 font-medium">התחרות הסתיימה. הנתונים נשמרו בארכיון וניתנים לצפייה בדף הניהול.</p>
          </div>
        )}
        {/* SECTION 1: FreeRoll → כותרת בלבד (הטבלה מופיעה בבלוק התחתון). לא FreeRoll → טבלת זוכים רק אחרי חלוקה. */}
        <div className="mx-4 mt-4 mb-4">
          {settlementWinners === undefined ? (
            <p className="text-slate-500 text-center py-4 text-sm">טוען זוכים...</p>
          ) : settlementWinners.settled ? (
            isFreeroll ? (
              <div className="px-4 py-3 border-b border-slate-600/50 bg-amber-500/10 rounded-t-xl">
                <h3 className="text-lg font-bold text-white">תוצאות חלוקת הפרסים</h3>
                <p className="text-slate-400 text-sm mt-0.5">תוצאות סופיות לאחר חלוקת הפרסים</p>
              </div>
            ) : (
              <SettlementWinnersTable
                winners={settlementWinners.winners}
                totalPrizePool={settlementWinners.totalPrizePool}
                isFreeroll={false}
                title="תוצאות חלוקת הפרסים"
                subtitle="תוצאות סופיות לאחר חלוקת הפרסים"
              />
            )
          ) : isFreeroll ? (
            settlementPreview === undefined ? (
              <p className="text-slate-500 text-center py-4 text-sm">טוען תצוגה מקדימה...</p>
            ) : settlementPreview.preview ? (
              <div className="px-4 py-3 border-b border-slate-600/50 bg-amber-500/10 rounded-t-xl">
                <h3 className="text-lg font-bold text-white">זוכים צפויים לפי התוצאות הנוכחיות</h3>
                <p className="text-slate-400 text-sm mt-0.5">תצוגה מקדימה בלבד – הפרסים טרם חולקו</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-700/40 border border-slate-600/50 text-right">
                <p className="text-slate-400 font-medium">התחרות טרם חולקה</p>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-slate-700/40 border border-slate-600/50 text-right">
              <p className="text-slate-400 font-medium">התחרות טרם חולקה</p>
            </div>
          )}
        </div>
        {/* SECTION 2: דירוג מלא – רק בתשלום. FreeRoll מציג רק טבלת זוכים (אותה מקור כמו למעלה). */}
        {!isFreeroll && settlementWinners?.settled && (
          <div className="mx-4 mt-4 mb-4">
            <button
              type="button"
              onClick={() => setShowFullLeaderboard((v) => !v)}
              className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-1"
            >
              {showFullLeaderboard ? "▼" : "▶"} דירוג מלא לפי ניקוד
            </button>
          </div>
        )}
        {isFreeroll && (settlementWinners?.settled ? (
          <div className="mx-4 mt-4 mb-4">
            <SettlementWinnersTable
              winners={settlementWinners.winners}
              totalPrizePool={settlementWinners.totalPrizePool}
              isFreeroll={true}
              title=""
              subtitle=""
            />
          </div>
        ) : settlementPreview?.preview ? (
          <div className="mx-4 mt-4 mb-4">
            <SettlementWinnersTable
              winners={settlementPreview.winners}
              totalPrizePool={settlementPreview.totalPrizePool}
              isFreeroll={true}
              title=""
              subtitle=""
            />
          </div>
        ) : null)}
        {showPaidLeaderboard && (
        <>
        {isChance ? (
          !chanceLeaderboard ? (
            <p className="text-slate-500 text-center py-12">טוען דירוג צ'אנס...</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden space-y-3 p-2">
                {chanceLeaderboard.rows?.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">אין משתתפים מאושרים או שעדיין לא עודכנו תוצאות ההגרלה.</p>
                ) : (
                  chanceLeaderboard.rows?.map((row, i) => (
                    <div
                      key={row.submissionId}
                      onClick={() => onViewSubmission(row.submissionId)}
                      className="rounded-2xl border border-slate-600/50 bg-slate-800/60 p-4 shadow-lg active:scale-[0.99] cursor-pointer"
                    >
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <span className="text-slate-400 font-bold">#{i + 1}</span>
                        <span className="text-white font-medium truncate flex-1 text-center">{row.username}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 p-2 rounded-lg shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center" title="צפייה בניחושים"><Eye className="w-5 h-5" /></button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="text-emerald-400 font-bold">{row.points}/4</span>
                        {showLeaderboardPrizeAndWinner && (row.isWinner ? <Badge className="bg-amber-600/90 text-white rounded-lg">זוכה</Badge> : <span className="text-slate-500">לא זוכה</span>)}
                        {showLeaderboardPrizeAndWinner && row.prizeAmount > 0 && <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/40">
                    <th className="p-3 font-medium w-24">מיקום</th>
                    <th className="p-3 font-medium">שם משתמש</th>
                    <th className="p-3 font-medium">פגיעות (0–4)</th>
                    {showLeaderboardPrizeAndWinner && <th className="p-3 font-medium">סטטוס</th>}
                    {showLeaderboardPrizeAndWinner && <th className="p-3 font-medium">סכום זכייה</th>}
                    <th className="p-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {chanceLeaderboard.rows?.length === 0 ? (
                    <tr>
                      <td colSpan={showLeaderboardPrizeAndWinner ? 6 : 4} className="p-8 text-center text-slate-500">אין משתתפים מאושרים או שעדיין לא עודכנו תוצאות ההגרלה.</td>
                    </tr>
                  ) : (
                    chanceLeaderboard.rows?.map((row, i) => (
                      <tr key={row.submissionId} onClick={() => onViewSubmission(row.submissionId)} className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer">
                        <td className="p-3"><span className="text-slate-400 font-bold">#{i + 1}</span></td>
                        <td className="p-3 text-white font-medium">{row.username}</td>
                        <td className="p-3"><span className="text-emerald-400 font-bold">{row.points}</span><span className="text-slate-500 text-sm mr-1">/ 4</span></td>
                        {showLeaderboardPrizeAndWinner && <td className="p-3">{row.isWinner ? <Badge className="bg-amber-600/90 text-white rounded-lg">זוכה</Badge> : <span className="text-slate-500">לא זוכה</span>}</td>}
                        {showLeaderboardPrizeAndWinner && <td className="p-3">{row.prizeAmount > 0 ? <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span> : <span className="text-slate-500">—</span>}</td>}
                        <td className="p-3">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-slate-600/50" title="צפייה בניחושים"><Eye className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-3 border-t border-slate-600/50 text-sm text-slate-400">
                {showLeaderboardPrizeAndWinner ? <>קופת פרסים: ₪{chanceLeaderboard.prizePool.toLocaleString("he-IL")}{chanceLeaderboard.winnerCount > 0 && ` • ${chanceLeaderboard.winnerCount} זוכים`}</> : "דירוג לפי ניקוד בלבד – תוצאות חלוקת הפרסים למעלה"}
              </div>
            </div>
            </>
          )
        ) : isLotto ? (
          !lottoLeaderboard ? (
            <p className="text-slate-500 text-center py-12">טוען דירוג לוטו...</p>
          ) : (
            <>
              <div className="md:hidden space-y-3 p-2 min-w-0">
                {lottoLeaderboard.rows?.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">אין משתתפים או שעדיין לא עודכנו תוצאות.</p>
                ) : (
                  lottoLeaderboard.rows?.map((row, i) => {
                    const baseHits = row.points - (row.strongHit ? 1 : 0);
                    return (
                      <div key={row.submissionId} onClick={() => onViewSubmission(row.submissionId)} className="rounded-2xl border border-slate-600/50 bg-slate-800/60 p-4 shadow-lg active:scale-[0.99] cursor-pointer min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-slate-500 text-xs shrink-0">מיקום:</span>
                          <span className="text-slate-400 font-bold">#{i + 1}</span>
                          <span className="text-slate-500 text-xs shrink-0 mr-1">|</span>
                          <span className="text-slate-500 text-xs shrink-0">שם שחקן:</span>
                          <span className="text-white font-medium truncate flex-1 min-w-0" title={row.username}>{row.username}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 p-2 rounded-lg shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center" title="צפייה בניחושים"><Eye className="w-5 h-5" /></button>
                        </div>
                        <div className="flex justify-between items-center text-sm gap-2 flex-wrap">
                          <span className="text-slate-400"><span className="text-slate-500">מספרים נכונים:</span> <span className="text-emerald-400 font-bold">{baseHits}/6</span></span>
                          <span className="text-slate-400"><span className="text-slate-500">מספר חזק:</span> {row.strongHit ? <span className="text-amber-400">חזק</span> : <span className="text-slate-500">—</span>}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1 flex-wrap gap-2">
                          <span className="text-slate-400"><span className="text-slate-500">ניקוד:</span> <span className="text-emerald-300 font-bold">{row.points}</span></span>
                          {showLeaderboardPrizeAndWinner && (row.isWinner ? <Badge className="bg-amber-600/90 text-white rounded-lg text-xs">זוכה</Badge> : <span className="text-slate-500 text-xs">לא זוכה</span>)}
                          {showLeaderboardPrizeAndWinner && row.prizeAmount > 0 && <span className="text-amber-400 font-medium text-xs">₪{row.prizeAmount.toLocaleString("he-IL")}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/40">
                    <th className="p-3 font-medium w-24">מיקום</th>
                    <th className="p-3 font-medium">שם משתמש</th>
                    <th className="p-3 font-medium">ניחושים נכונים</th>
                    <th className="p-3 font-medium">מספר חזק</th>
                    <th className="p-3 font-medium">ניקוד סופי</th>
                    {showLeaderboardPrizeAndWinner && <th className="p-3 font-medium">סטטוס</th>}
                    {showLeaderboardPrizeAndWinner && <th className="p-3 font-medium">סכום זכייה</th>}
                    <th className="p-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {lottoLeaderboard.rows?.length === 0 ? (
                    <tr><td colSpan={showLeaderboardPrizeAndWinner ? 8 : 6} className="p-8 text-center text-slate-500">אין משתתפים או שעדיין לא עודכנו תוצאות.</td></tr>
                  ) : (
                    lottoLeaderboard.rows?.map((row, i) => {
                      const baseHits = row.points - (row.strongHit ? 1 : 0);
                      const finalScore = row.points;
                      return (
                        <tr
                          key={row.submissionId}
                          onClick={() => onViewSubmission(row.submissionId)}
                          className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer"
                        >
                          <td className="p-3"><span className="text-slate-400 font-bold">#{i + 1}</span></td>
                          <td className="p-3 text-white font-medium">{row.username}</td>
                          <td className="p-3">
                            <span className="text-emerald-400 font-bold">{baseHits}</span>
                            <span className="text-slate-500 text-sm mr-1">/ 6</span>
                          </td>
                          <td className="p-3">{row.strongHit ? <span className="text-amber-400">נכון</span> : <span className="text-slate-500">לא</span>}</td>
                          <td className="p-3">
                            <span className="text-emerald-300 font-bold">{finalScore}</span>
                          </td>
                          {showLeaderboardPrizeAndWinner && (
                            <td className="p-3">
                              {row.isWinner ? <Badge className="bg-amber-600/90 text-white rounded-lg">זוכה</Badge> : <span className="text-slate-500">לא זוכה</span>}
                            </td>
                          )}
                          {showLeaderboardPrizeAndWinner && (
                            <td className="p-3">
                              {row.prizeAmount > 0 ? (
                                <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          )}
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewSubmission(row.submissionId);
                              }}
                              className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-600/50"
                              title="צפייה בניחושים"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div className="p-3 border-t border-slate-600/50 text-sm text-slate-400">
                {showLeaderboardPrizeAndWinner ? <>קופת פרסים: ₪{lottoLeaderboard.prizePool.toLocaleString("he-IL")}{lottoLeaderboard.winnerCount > 0 && ` • ${lottoLeaderboard.winnerCount} זוכים`}</> : "דירוג לפי ניקוד בלבד – תוצאות חלוקת הפרסים למעלה"}
              </div>
            </div>
            </>
          )
        ) : isFootballCustom ? (
          !customFootballLeaderboard ? (
            <p className="text-slate-500 text-center py-12">טוען דירוג...</p>
          ) : (
            <>
              <div className="md:hidden space-y-3 p-2">
                {customFootballLeaderboard.rows.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">אין משתתפים מאושרים.</p>
                ) : (
                  customFootballLeaderboard.rows.map((row) => (
                    <div key={row.submissionId} onClick={() => onViewSubmission(row.submissionId)} className="rounded-2xl border border-slate-600/50 bg-slate-800/60 p-4 shadow-lg active:scale-[0.99] cursor-pointer">
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <span className="text-slate-400 font-bold">#{row.rank}</span>
                        <span className="text-white font-medium truncate flex-1 text-center">{row.username}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 p-2 rounded-lg shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center" title="צפייה בניחושים"><Eye className="w-5 h-5" /></button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="text-emerald-400 font-bold">{row.correctCount}</span>
                        <span className="text-amber-400 font-bold">{row.points} נקודות</span>
                        {showLeaderboardPrizeAndWinner && row.prizeAmount > 0 && <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/40">
                    <th className="p-3 font-medium w-24">מיקום</th>
                    <th className="p-3 font-medium">שם משתמש</th>
                    <th className="p-3 font-medium">ניחושים נכונים</th>
                    <th className="p-3 font-medium">נקודות</th>
                    {showLeaderboardPrizeAndWinner && <th className="p-3 font-medium">סכום זכייה</th>}
                    <th className="p-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {customFootballLeaderboard.rows.length === 0 ? (
                    <tr><td colSpan={showLeaderboardPrizeAndWinner ? 6 : 5} className="p-8 text-center text-slate-500">אין משתתפים מאושרים.</td></tr>
                  ) : (
                    customFootballLeaderboard.rows.map((row) => (
                      <tr key={row.submissionId} onClick={() => onViewSubmission(row.submissionId)} className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer">
                        <td className="p-3"><span className="text-slate-400 font-bold">#{row.rank}</span></td>
                        <td className="p-3 text-white font-medium">{row.username}</td>
                        <td className="p-3"><span className="text-emerald-400 font-bold">{row.correctCount}</span></td>
                        <td className="p-3"><span className="text-amber-400 font-bold">{row.points}</span></td>
                        {showLeaderboardPrizeAndWinner && <td className="p-3">{row.prizeAmount > 0 ? <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span> : <span className="text-slate-500">—</span>}</td>}
                        <td className="p-3"><button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-600/50" title="צפייה בניחושים"><Eye className="w-4 h-4" /></button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-3 border-t border-slate-600/50 text-sm text-slate-400">
                {showLeaderboardPrizeAndWinner ? <>קופת פרסים: ₪{customFootballLeaderboard.prizePool.toLocaleString("he-IL")}{customFootballLeaderboard.winnerCount > 0 && ` • ${customFootballLeaderboard.winnerCount} זוכים`}</> : "דירוג לפי ניקוד בלבד – תוצאות חלוקת הפרסים למעלה"}
              </div>
            </div>
            </>
          )
        ) : (
          <>
            {/* Mobile: mondial cards */}
            <div className="md:hidden space-y-3 p-2">
              {list.length === 0 ? (
                <p className="text-slate-500 text-center py-8">אין עדיין טפסים בטורניר זה</p>
              ) : (
                list.map((s) => {
                  const isApproved = s.status === "approved";
                  const approvedList = list.filter((x) => x.status === "approved").sort((a, b) => b.points - a.points);
                  const displayRank = isApproved ? approvedList.findIndex((x) => x.id === s.id) + 1 : 0;
                  return (
                    <div key={s.id} onClick={() => onViewSubmission(s.id)} className="rounded-2xl border border-slate-600/50 bg-slate-800/60 p-4 shadow-lg active:scale-[0.99] cursor-pointer">
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <RankBadge rank={displayRank} isApproved={isApproved} />
                        <span className="text-white font-medium truncate flex-1 text-center">{s.username}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(s.id); }} className="text-slate-400 hover:text-emerald-400 p-2 rounded-lg shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center" title="צפייה בניחושים"><Eye className="w-5 h-5" /></button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="text-emerald-400 font-bold">{s.points} נקודות</span>
                        {statusBadge(s.status)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/40">
                    <th className="p-3 font-medium w-24">מיקום</th>
                    <th className="p-3 font-medium">שם משתמש</th>
                    <th className="p-3 font-medium">ניקוד</th>
                    <th className="p-3 font-medium">סטטוס</th>
                    <th className="p-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const isApproved = s.status === "approved";
                    const approvedList = list.filter((x) => x.status === "approved").sort((a, b) => b.points - a.points);
                    const displayRank = isApproved ? approvedList.findIndex((x) => x.id === s.id) + 1 : 0;
                    return (
                      <tr key={s.id} onClick={() => onViewSubmission(s.id)} className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer">
                        <td className="p-3"><RankBadge rank={displayRank} isApproved={isApproved} /></td>
                        <td className="p-3 text-white font-medium">{s.username}</td>
                        <td className="p-3"><span className="text-emerald-400 font-bold">{s.points}</span><span className="text-slate-500 text-sm mr-1">נקודות</span></td>
                        <td className="p-3">{statusBadge(s.status)}</td>
                        <td className="p-3"><button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(s.id); }} className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-600/50" title="צפייה בניחושים"><Eye className="w-4 h-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {list.length === 0 && <p className="text-slate-500 text-center py-12">אין עדיין טפסים בטורניר זה</p>}
          </>
        )}
        </>
        )}
      </CardContent>
      )}
    </Card>
  );
}

export default function Leaderboard() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const [viewSubmissionId, setViewSubmissionId] = useState<number | null>(null);

  const search = useMemo(() => {
    const idx = location.indexOf("?");
    return idx >= 0 ? location.slice(idx + 1) : "";
  }, [location]);
  const tournamentTypeParam = useMemo(() => parseTournamentTypeParam(new URLSearchParams(search).get("tournamentType")), [search]);
  const justSubmitted = useMemo(() => new URLSearchParams(search).get("justSubmitted") === "1", [search]);
  const [hideJustSubmittedBanner, setHideJustSubmittedBanner] = useState(false);

  const TAB_IDS = ["WORLD_CUP", "FOOTBALL", "CHANCE", "LOTTO"] as const;
  const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(tournamentTypeParam ?? "WORLD_CUP");

  useEffect(() => {
    if (tournamentTypeParam && tournamentTypeParam !== activeTab) {
      setActiveTab(tournamentTypeParam);
    }
  }, [tournamentTypeParam, activeTab]);

  const { data: worldCupTournaments, isLoading: worldCupLoading } = trpc.tournaments.getByType.useQuery(
    { tournamentType: "WORLD_CUP" },
    { enabled: activeTab === "WORLD_CUP" }
  );
  const { data: footballTournaments, isLoading: footballLoading } = trpc.tournaments.getByType.useQuery(
    { tournamentType: "FOOTBALL" },
    { enabled: activeTab === "FOOTBALL" }
  );
  const { data: chanceTournaments, isLoading: chanceLoading } = trpc.tournaments.getByType.useQuery(
    { tournamentType: "CHANCE" },
    { enabled: activeTab === "CHANCE" }
  );
  const { data: lottoTournaments, isLoading: lottoLoading } = trpc.tournaments.getByType.useQuery(
    { tournamentType: "LOTTO" },
    { enabled: activeTab === "LOTTO" }
  );

  const tournamentsLoading =
    (activeTab === "WORLD_CUP" && worldCupLoading) ||
    (activeTab === "FOOTBALL" && footballLoading) ||
    (activeTab === "CHANCE" && chanceLoading) ||
    (activeTab === "LOTTO" && lottoLoading);

  const activeTournamentsUnsorted =
    activeTab === "WORLD_CUP"
      ? (worldCupTournaments ?? [])
      : activeTab === "FOOTBALL"
        ? (footballTournaments ?? [])
        : activeTab === "CHANCE"
          ? (chanceTournaments ?? [])
          : (lottoTournaments ?? []);
  const activeTournaments = useMemo(
    () => activeTournamentsUnsorted.slice().sort((a, b) => a.amount - b.amount),
    [activeTournamentsUnsorted]
  );

  const statusBadge = (status: string) => {
    if (status === "approved")
      return (
        <Badge className="bg-emerald-600/90 text-white gap-1 rounded-lg">
          <Check className="w-3 h-3" />
          מאושר
        </Badge>
      );
    if (status === "rejected")
      return (
        <Badge variant="destructive" className="gap-1 rounded-lg">
          <X className="w-3 h-3" />
          נדחה
        </Badge>
      );
    return (
      <Badge variant="secondary" className="bg-amber-500/20 text-amber-200 gap-1 rounded-lg">
        <Clock className="w-3 h-3" />
        ממתין לאישור
      </Badge>
    );
  };

  const leaderboardTournamentId = activeTournaments[0]?.id ?? null;
  const { data: recommendation } = trpc.tournaments.getRecommendedTournamentForUser.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 45_000,
  });

  return (
    <div className="min-h-screen py-4 sm:py-6 md:py-8 overflow-x-hidden max-w-full">
      <div className="container mx-auto px-3 sm:px-4 min-w-0">
        {isAuthenticated && (
          <div className="mb-4 space-y-2">
            {leaderboardTournamentId != null && (
              <>
                <NearWinBanner tournamentId={leaderboardTournamentId} />
                <RivalStatusBanner tournamentId={leaderboardTournamentId} />
                <PositionDramaBanner tournamentId={leaderboardTournamentId} />
                <LossAversionBanner tournamentId={leaderboardTournamentId} />
              </>
            )}
            <StreakBanner />
            {/* Phase 37/38: Re-engagement – one CTA to join another competition (recommended when available) */}
            <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sky-200 text-sm font-medium">{recommendation?.message ?? "המשך את המומנטום –"}</span>
              <Button
                size="sm"
                variant="outline"
                className="border-sky-500/50 text-sky-200 hover:bg-sky-500/20 min-h-[40px] touch-target"
                onClick={() => setLocation(recommendation ? `/predict/${recommendation.tournamentId}` : "/tournaments")}
              >
                <Trophy className="w-4 h-4 ml-1 shrink-0" />
                הצטרף לתחרות נוספת
              </Button>
            </div>
          </div>
        )}
        {justSubmitted && !hideJustSubmittedBanner && (
          <div className="mb-6 rounded-xl bg-emerald-600/20 border border-emerald-500/50 text-emerald-200 px-4 py-3 flex items-center justify-between gap-2">
            <span className="font-medium">ההשתתפות נספרה – אתה בדירוג!</span>
            <button type="button" onClick={() => setHideJustSubmittedBanner(true)} className="text-emerald-300 hover:text-white text-sm underline" aria-label="סגור">סגור</button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-2 animate-fade-in">
              <Trophy className="w-8 h-8 sm:w-9 sm:h-9 text-amber-400" />
              טבלת דירוג – {tabLabel(activeTab)}
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              כל הטפסים מופיעים מיד בדירוג. רק טפסים שאושרו נספרים במיקום לפי ניקוד.
            </p>
          </div>
        </div>
        <>
        {tournamentsLoading ? (
          <div className="flex justify-center py-16">
            <p className="text-slate-400">טוען טורנירים...</p>
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as (typeof TAB_IDS)[number])} className="space-y-4">
          <TabsList className="bg-slate-800/80 border border-slate-600/50 flex flex-nowrap gap-1.5 p-1.5 sm:p-1 rounded-xl w-full max-w-full min-h-[44px] overflow-x-auto overflow-y-hidden shrink-0 [scrollbar-width:thin]">
            <TabsTrigger value="WORLD_CUP" className="rounded-lg shrink-0 data-[state=active]:bg-sky-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1 shrink-0" />
              <span className="whitespace-nowrap">מונדיאל</span>
            </TabsTrigger>
            <TabsTrigger value="FOOTBALL" className="rounded-lg shrink-0 data-[state=active]:bg-rose-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1 shrink-0" />
              <span className="whitespace-nowrap">תחרויות ספורט</span>
            </TabsTrigger>
            <TabsTrigger value="CHANCE" className="rounded-lg shrink-0 data-[state=active]:bg-amber-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1 shrink-0" />
              <span className="whitespace-nowrap">צ'אנס</span>
            </TabsTrigger>
            <TabsTrigger value="LOTTO" className="rounded-lg shrink-0 data-[state=active]:bg-emerald-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1 shrink-0" />
              <span className="whitespace-nowrap">לוטו</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent key={activeTab} value={activeTab} className="mt-4 animate-fade-in space-y-0">
            {activeTournaments.length === 0 ? (
              <Card className="card-sport bg-slate-800/60 border-slate-600/50 overflow-hidden">
                <CardContent className="p-6 text-center text-slate-500">
                  <p className="mb-2">אין טורנירים בקטגוריה «{tabLabel(activeTab)}».</p>
                  <p className="text-sm text-slate-400">בחר קטגוריה אחרת בלשוניות למעלה (למשל צ'אנס או לוטו) כדי לראות דירוגים.</p>
                </CardContent>
              </Card>
            ) : (
              activeTournaments.map((t) => (
                <SingleTournamentLeaderboardCard
                  key={t.id}
                  tournament={t as TournamentLike}
                  tabId={activeTab}
                  onViewSubmission={setViewSubmissionId}
                  statusBadge={statusBadge}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
        )}
        </>
      </div>

      <SubmissionPredictionsModal
        submissionId={viewSubmissionId}
        open={viewSubmissionId !== null}
        onOpenChange={(open) => !open && setViewSubmissionId(null)}
      />
    </div>
  );
}
