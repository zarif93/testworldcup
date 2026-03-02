import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trophy, Check, Clock, X, Eye, Sparkles, Timer } from "lucide-react";
import { SubmissionPredictionsModal } from "@/components/SubmissionPredictionsModal";
import { getTournamentStyles } from "@/lib/tournamentStyles";

const DISPLAY_WINDOW_MS = 10 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

type TournamentLike = { id: number; name: string; amount: number; type?: string; resultsFinalizedAt?: Date | string | null; dataCleanedAt?: Date | string | null };

/** כרטיס דירוג בודד לטורניר – טוען דאטה לפי סוג התחרות */
function SingleTournamentLeaderboardCard({
  tournament,
  tabId,
  now,
  onViewSubmission,
  statusBadge,
  byTournament,
}: {
  tournament: TournamentLike;
  tabId: "chance" | "lotto" | "mondial" | "football_custom";
  now: number;
  onViewSubmission: (id: number) => void;
  statusBadge: (status: string) => JSX.Element;
  byTournament: (tid: number) => Array<{ id: number; username: string; status: string; points: number; updatedAt: Date | string }>;
}) {
  const t = tournament;
  const st = getTournamentStyles(t.amount);
  const isChance = tabId === "chance";
  const isLotto = tabId === "lotto";
  const isFootballCustom = tabId === "football_custom";
  const isMondial = tabId === "mondial";

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
  const list = isMondial ? byTournament(t.id) : [];

  const tour = t as { resultsFinalizedAt?: Date | string | null; dataCleanedAt?: Date | string | null };
  const finalizedAt = tour.resultsFinalizedAt ? new Date(tour.resultsFinalizedAt).getTime() : 0;
  const cleanedAt = tour.dataCleanedAt;
  const displayUntil = finalizedAt + DISPLAY_WINDOW_MS;
  const inDisplayWindow = finalizedAt > 0 && !cleanedAt && now < displayUntil;
  const remainingMs = displayUntil - now;

  if (cleanedAt) {
    return (
      <Card className="card-sport bg-slate-800/60 border-slate-600/50 overflow-hidden mb-4">
        <CardHeader className="border-b border-slate-600/50">
          <h2 className="text-lg font-bold text-white">{t.name}</h2>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-slate-400 font-medium">נתוני התחרות נמחקו.</p>
          <p className="text-slate-500 text-sm mt-1">הדירוג וטפסי הניחושים הוסרו לאחר 10 דקות מהצגת התוצאות.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-sport bg-slate-800/60 border-slate-600/50 overflow-hidden mb-4">
      <CardHeader className="border-b border-slate-600/50">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {isChance ? <Sparkles className="w-6 h-6 text-amber-400" /> : <Trophy className={`w-6 h-6 ${st.icon}`} />}
          {t.name} – דירוג {isChance ? "צ'אנס" : isLotto ? "לוטו" : isFootballCustom ? "תחרות כדורגל" : "מונדיאל"}
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
      </CardHeader>
      <CardContent className="p-0">
        {inDisplayWindow && (
          <div className="mx-4 mt-4 p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-right">
            <p className="text-amber-200 font-medium">התחרות הסתיימה! הזוכים קיבלו את הפרסים.</p>
            <p className="text-slate-400 text-sm mt-1">נתוני התחרות יוצגו למשך 10 דקות בלבד.</p>
            <p className="text-amber-400 font-mono text-lg mt-2 flex items-center justify-end gap-2">
              <Timer className="w-5 h-5" />
              נתוני תחרות יימחקו בעוד: {formatCountdown(remainingMs)}
            </p>
          </div>
        )}
        {isChance ? (
          !chanceLeaderboard ? (
            <p className="text-slate-500 text-center py-12">טוען דירוג צ'אנס...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/40">
                    <th className="p-3 font-medium w-24">מיקום</th>
                    <th className="p-3 font-medium">שם משתמש</th>
                    <th className="p-3 font-medium">פגיעות (0–4)</th>
                    <th className="p-3 font-medium">סטטוס</th>
                    <th className="p-3 font-medium">סכום זכייה</th>
                    <th className="p-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {chanceLeaderboard.rows?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">אין משתתפים מאושרים או שעדיין לא עודכנו תוצאות ההגרלה.</td>
                    </tr>
                  ) : (
                    chanceLeaderboard.rows?.map((row, i) => (
                      <tr key={row.submissionId} onClick={() => onViewSubmission(row.submissionId)} className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer">
                        <td className="p-3"><span className="text-slate-400 font-bold">#{i + 1}</span></td>
                        <td className="p-3 text-white font-medium">{row.username}</td>
                        <td className="p-3"><span className="text-emerald-400 font-bold">{row.points}</span><span className="text-slate-500 text-sm mr-1">/ 4</span></td>
                        <td className="p-3">{row.isWinner ? <Badge className="bg-amber-600/90 text-white rounded-lg">זוכה</Badge> : <span className="text-slate-500">לא זוכה</span>}</td>
                        <td className="p-3">{row.prizeAmount > 0 ? <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span> : <span className="text-slate-500">—</span>}</td>
                        <td className="p-3">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-slate-600/50" title="צפייה בניחושים"><Eye className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-3 border-t border-slate-600/50 text-sm text-slate-400">
                קופת פרסים: ₪{chanceLeaderboard.prizePool.toLocaleString("he-IL")}
                {chanceLeaderboard.winnerCount > 0 && ` • ${chanceLeaderboard.winnerCount} זוכים`}
              </div>
            </div>
          )
        ) : isLotto ? (
          !lottoLeaderboard ? (
            <p className="text-slate-500 text-center py-12">טוען דירוג לוטו...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/40">
                    <th className="p-3 font-medium w-24">מיקום</th>
                    <th className="p-3 font-medium">שם משתמש</th>
                    <th className="p-3 font-medium">פגיעות (0–6)</th>
                    <th className="p-3 font-medium">מספר חזק</th>
                    <th className="p-3 font-medium">סטטוס</th>
                    <th className="p-3 font-medium">סכום זכייה</th>
                    <th className="p-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {lottoLeaderboard.rows?.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">אין משתתפים או שעדיין לא עודכנו תוצאות.</td></tr>
                  ) : (
                    lottoLeaderboard.rows?.map((row, i) => (
                      <tr key={row.submissionId} onClick={() => onViewSubmission(row.submissionId)} className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer">
                        <td className="p-3"><span className="text-slate-400 font-bold">#{i + 1}</span></td>
                        <td className="p-3 text-white font-medium">{row.username}</td>
                        <td className="p-3"><span className="text-emerald-400 font-bold">{row.points}</span><span className="text-slate-500 text-sm mr-1">/ 6</span></td>
                        <td className="p-3">{row.strongHit ? <span className="text-amber-400">כן</span> : <span className="text-slate-500">לא</span>}</td>
                        <td className="p-3">{row.isWinner ? <Badge className="bg-amber-600/90 text-white rounded-lg">זוכה</Badge> : <span className="text-slate-500">לא זוכה</span>}</td>
                        <td className="p-3">{row.prizeAmount > 0 ? <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span> : <span className="text-slate-500">—</span>}</td>
                        <td className="p-3"><button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-600/50" title="צפייה בניחושים"><Eye className="w-4 h-4" /></button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-3 border-t border-slate-600/50 text-sm text-slate-400">
                קופת פרסים: ₪{lottoLeaderboard.prizePool.toLocaleString("he-IL")}
                {lottoLeaderboard.winnerCount > 0 && ` • ${lottoLeaderboard.winnerCount} זוכים`}
              </div>
            </div>
          )
        ) : isFootballCustom ? (
          !customFootballLeaderboard ? (
            <p className="text-slate-500 text-center py-12">טוען דירוג...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-600/50 text-slate-400 text-sm bg-slate-800/40">
                    <th className="p-3 font-medium w-24">מיקום</th>
                    <th className="p-3 font-medium">שם משתמש</th>
                    <th className="p-3 font-medium">ניחושים נכונים</th>
                    <th className="p-3 font-medium">נקודות</th>
                    <th className="p-3 font-medium">סכום זכייה</th>
                    <th className="p-3 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {customFootballLeaderboard.rows.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">אין משתתפים מאושרים.</td></tr>
                  ) : (
                    customFootballLeaderboard.rows.map((row) => (
                      <tr key={row.submissionId} onClick={() => onViewSubmission(row.submissionId)} className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer">
                        <td className="p-3"><span className="text-slate-400 font-bold">#{row.rank}</span></td>
                        <td className="p-3 text-white font-medium">{row.username}</td>
                        <td className="p-3"><span className="text-emerald-400 font-bold">{row.correctCount}</span></td>
                        <td className="p-3"><span className="text-amber-400 font-bold">{row.points}</span></td>
                        <td className="p-3">{row.prizeAmount > 0 ? <span className="text-amber-400 font-medium">₪{row.prizeAmount.toLocaleString("he-IL")}</span> : <span className="text-slate-500">—</span>}</td>
                        <td className="p-3"><button type="button" onClick={(e) => { e.stopPropagation(); onViewSubmission(row.submissionId); }} className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-600/50" title="צפייה בניחושים"><Eye className="w-4 h-4" /></button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-3 border-t border-slate-600/50 text-sm text-slate-400">
                קופת פרסים: ₪{customFootballLeaderboard.prizePool.toLocaleString("he-IL")}
                {customFootballLeaderboard.winnerCount > 0 && ` • ${customFootballLeaderboard.winnerCount} זוכים`}
              </div>
            </div>
          )
        ) : (
          <>
            <div className="overflow-x-auto">
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
      </CardContent>
    </Card>
  );
}

export default function Leaderboard() {
  const [, setLocation] = useLocation();
  const [viewSubmissionId, setViewSubmissionId] = useState<number | null>(null);
  const { data: tournaments, isLoading: tournamentsLoading } = trpc.tournaments.getAll.useQuery();
  const { data: submissions } = trpc.submissions.getAll.useQuery();

  const sortedTournaments = tournaments?.slice().sort((a, b) => a.amount - b.amount) ?? [];
  const chanceTournaments = sortedTournaments.filter((t) => (t as { type?: string }).type === "chance");
  const lottoTournaments = sortedTournaments.filter((t) => (t as { type?: string }).type === "lotto");
  const mondialTournaments = sortedTournaments.filter((t) => {
    const type = (t as { type?: string }).type;
    return type === "football" || type === undefined;
  });
  const footballCustomTournaments = sortedTournaments.filter((t) => (t as { type?: string }).type === "football_custom");

  const TAB_IDS = ["chance", "lotto", "mondial", "football_custom"] as const;
  const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>("chance");

  useEffect(() => {
    if (chanceTournaments.length > 0 || lottoTournaments.length > 0 || mondialTournaments.length > 0 || footballCustomTournaments.length > 0) {
      const currentHasTournaments =
        (activeTab === "chance" && chanceTournaments.length > 0) ||
        (activeTab === "lotto" && lottoTournaments.length > 0) ||
        (activeTab === "mondial" && mondialTournaments.length > 0) ||
        (activeTab === "football_custom" && footballCustomTournaments.length > 0);
      if (!currentHasTournaments) {
        if (chanceTournaments.length > 0) setActiveTab("chance");
        else if (lottoTournaments.length > 0) setActiveTab("lotto");
        else if (mondialTournaments.length > 0) setActiveTab("mondial");
        else if (footballCustomTournaments.length > 0) setActiveTab("football_custom");
      }
    }
  }, [chanceTournaments.length, lottoTournaments.length, mondialTournaments.length, footballCustomTournaments.length, activeTab]);

  const tabValue = activeTab;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const hasDisplayWindow = sortedTournaments.some(
      (t) => (t as { resultsFinalizedAt?: Date | null; dataCleanedAt?: Date | null }).resultsFinalizedAt && !(t as { dataCleanedAt?: Date | null }).dataCleanedAt
    );
    if (!hasDisplayWindow) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sortedTournaments]);

  const byTournament = (tid: number) =>
    (submissions ?? [])
      .filter((s) => s.tournamentId === tid)
      .sort((a, b) => {
        if (a.status === "approved" && b.status !== "approved") return -1;
        if (a.status !== "approved" && b.status === "approved") return 1;
        if (a.status === "approved" && b.status === "approved") return b.points - a.points;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

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

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-2 animate-fade-in">
          <Trophy className="w-9 h-9 text-amber-400" />
          טבלת דירוג
        </h1>
        <p className="text-slate-400 mb-8">
          כל הטפסים מופיעים מיד בדירוג. רק טפסים שאושרו נספרים במיקום לפי ניקוד.
        </p>
        {tournamentsLoading ? (
          <div className="flex justify-center py-16">
            <p className="text-slate-400">טוען טורנירים...</p>
          </div>
        ) : sortedTournaments.length === 0 ? (
          <p className="text-slate-500 text-center py-12">אין טורנירים להצגה.</p>
        ) : (
        <Tabs value={tabValue} onValueChange={(v) => setActiveTab(v as (typeof TAB_IDS)[number])} className="space-y-4">
          <TabsList className="bg-slate-800/80 border border-slate-600/50 flex flex-wrap gap-1 p-1 rounded-xl">
            <TabsTrigger value="chance" className="rounded-lg data-[state=active]:bg-amber-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1" />
              צ'אנס
            </TabsTrigger>
            <TabsTrigger value="lotto" className="rounded-lg data-[state=active]:bg-emerald-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1" />
              לוטו
            </TabsTrigger>
            <TabsTrigger value="mondial" className="rounded-lg data-[state=active]:bg-sky-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1" />
              מונדיאל
            </TabsTrigger>
            <TabsTrigger value="football_custom" className="rounded-lg data-[state=active]:bg-rose-600/80 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 ml-1" />
              תחרות כדורגל
            </TabsTrigger>
          </TabsList>
          {TAB_IDS.map((tabId) => {
            const tournamentsOfType =
              tabId === "chance"
                ? chanceTournaments
                : tabId === "lotto"
                  ? lottoTournaments
                  : tabId === "mondial"
                    ? mondialTournaments
                    : footballCustomTournaments;
            return (
              <TabsContent key={tabId} value={tabId} className="mt-4 animate-fade-in space-y-0">
                {tournamentsOfType.length === 0 ? (
                  <Card className="card-sport bg-slate-800/60 border-slate-600/50 overflow-hidden">
                    <CardContent className="p-6 text-center text-slate-500">
                      אין טורנירים מסוג זה כרגע.
                    </CardContent>
                  </Card>
                ) : (
                  tournamentsOfType.map((t) => (
                    <SingleTournamentLeaderboardCard
                      key={t.id}
                      tournament={t as TournamentLike}
                      tabId={tabId}
                      now={now}
                      onViewSubmission={setViewSubmissionId}
                      statusBadge={statusBadge}
                      byTournament={byTournament}
                    />
                  ))
                )}
              </TabsContent>
            );
          })}
        </Tabs>
        )}
      </div>

      <SubmissionPredictionsModal
        submissionId={viewSubmissionId}
        open={viewSubmissionId !== null}
        onOpenChange={(open) => !open && setViewSubmissionId(null)}
      />
    </div>
  );
}
