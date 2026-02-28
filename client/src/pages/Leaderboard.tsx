import { useLocation } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trophy, Check, Clock, X, Eye } from "lucide-react";
import { SubmissionPredictionsModal } from "@/components/SubmissionPredictionsModal";
import { getTournamentStyles } from "@/lib/tournamentStyles";

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

export default function Leaderboard() {
  const [, setLocation] = useLocation();
  const [viewSubmissionId, setViewSubmissionId] = useState<number | null>(null);
  const { data: tournaments } = trpc.tournaments.getAll.useQuery();
  const { data: submissions } = trpc.submissions.getAll.useQuery();

  const sortedTournaments = tournaments?.slice().sort((a, b) => a.amount - b.amount) ?? [];

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
        <Tabs defaultValue={String(sortedTournaments?.[0]?.amount ?? "50")} className="space-y-4">
          <TabsList className="bg-slate-800/80 border border-slate-600/50 flex flex-wrap gap-1 p-1 rounded-xl">
            {sortedTournaments?.map((t) => {
              const st = getTournamentStyles(t.amount);
              return (
                <TabsTrigger
                  key={t.id}
                  value={String(t.amount)}
                  className={`rounded-lg ${st.tab}`}
                >
                  <Trophy className={`w-4 h-4 ml-1 ${st.icon}`} />
                  {t.name}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {sortedTournaments?.map((t) => {
            const list = byTournament(t.id);
            let rank = 0;
            const st = getTournamentStyles(t.amount);
            return (
              <TabsContent key={t.id} value={String(t.amount)} className="mt-4 animate-fade-in">
                <Card className="card-sport bg-slate-800/60 border-slate-600/50 overflow-hidden">
                  <CardHeader className="border-b border-slate-600/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className={`w-6 h-6 ${st.icon}`} />
                      {t.name} – דירוג
                    </h2>
                  </CardHeader>
                  <CardContent className="p-0">
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
                            if (isApproved) rank += 1;
                            const displayRank = rank;
                            return (
                              <tr
                                key={s.id}
                                onClick={() => setViewSubmissionId(s.id)}
                                className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer"
                              >
                                <td className="p-3">
                                  <RankBadge rank={displayRank} isApproved={isApproved} />
                                </td>
                                <td className="p-3 text-white font-medium">{s.username}</td>
                                <td className="p-3">
                                  <span className="text-emerald-400 font-bold">{s.points}</span>
                                  <span className="text-slate-500 text-sm mr-1">נקודות</span>
                                </td>
                                <td className="p-3">{statusBadge(s.status)}</td>
                                <td className="p-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewSubmissionId(s.id);
                                    }}
                                    className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-slate-600/50"
                                    title="צפייה בניחושים"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {list.length === 0 && (
                      <p className="text-slate-500 text-center py-12">אין עדיין טפסים בטורניר זה</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <SubmissionPredictionsModal
        submissionId={viewSubmissionId}
        open={viewSubmissionId !== null}
        onOpenChange={(open) => !open && setViewSubmissionId(null)}
      />
    </div>
  );
}
