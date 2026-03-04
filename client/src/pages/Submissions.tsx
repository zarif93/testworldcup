import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Clock, Eye, Trophy, FileText, Pencil, Sparkles } from "lucide-react";
import { SubmissionPredictionsModal } from "@/components/SubmissionPredictionsModal";
import { getTournamentStyles } from "@/lib/tournamentStyles";

type StatusFilter = "all" | "approved" | "pending" | "rejected";
const CATEGORY_IDS = ["chance", "lotto", "mondial", "football_custom"] as const;
type CategoryId = (typeof CATEGORY_IDS)[number];

type TournamentStat = { id: number; name: string; amount: number; type?: string; isLocked?: boolean };

function getTournamentsByCategory(tournamentStats: TournamentStat[]) {
  const chance = tournamentStats.filter((t) => t.type === "chance").sort((a, b) => a.amount - b.amount);
  const lotto = tournamentStats.filter((t) => t.type === "lotto").sort((a, b) => a.amount - b.amount);
  const mondial = tournamentStats.filter((t) => t.type === "football" || t.type === undefined).sort((a, b) => a.amount - b.amount);
  const football_custom = tournamentStats.filter((t) => t.type === "football_custom").sort((a, b) => a.amount - b.amount);
  return { chance, lotto, mondial, football_custom };
}

export default function Submissions() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [viewSubmissionId, setViewSubmissionId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("chance");
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: submissions } = trpc.submissions.getAll.useQuery();
  const { data: tournamentStats } = trpc.tournaments.getPublicStats.useQuery();

  const stats = tournamentStats ?? [];
  const byCategory = useMemo(() => getTournamentsByCategory(stats), [stats]);

  const tournamentsInCategory = byCategory[activeCategory];
  const categoryTournamentIds = useMemo(() => tournamentsInCategory.map((t) => t.id), [tournamentsInCategory]);

  useEffect(() => {
    if (selectedTournamentId != null && !categoryTournamentIds.includes(selectedTournamentId)) {
      setSelectedTournamentId(null);
    }
  }, [activeCategory, categoryTournamentIds, selectedTournamentId]);

  const getTourName = (tid: number) => stats.find((t) => t.id === tid)?.name ?? `טורניר ${tid}`;

  const filtered = useMemo(() => {
    return (submissions ?? []).filter((s) => {
      if (!categoryTournamentIds.includes(s.tournamentId)) return false;
      if (selectedTournamentId !== null && s.tournamentId !== selectedTournamentId) return false;
      if (statusFilter === "approved" && s.status !== "approved") return false;
      if (statusFilter === "pending" && s.status !== "pending") return false;
      if (statusFilter === "rejected" && s.status !== "rejected") return false;
      return true;
    });
  }, [submissions, categoryTournamentIds, selectedTournamentId, statusFilter]);

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-2 animate-fade-in">
          <FileText className="w-9 h-9 text-emerald-400" />
          כל הטפסים
        </h1>
        <p className="text-slate-400 mb-6">
          בחר קטגוריה ותחרות כדי לראות את הטפסים. רק טפסים שאושרו נספרים בדירוג.
        </p>

        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as CategoryId)} className="space-y-4">
          <TabsList className="bg-slate-800/80 border border-slate-600/50 flex flex-wrap gap-1 p-1 rounded-xl">
            <TabsTrigger value="chance" className="rounded-lg data-[state=active]:bg-amber-600/80 data-[state=active]:text-white">
              <Sparkles className="w-4 h-4 ml-1" />
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

          {CATEGORY_IDS.map((catId) => (
            <TabsContent key={catId} value={catId} className="mt-4 space-y-4">
              {byCategory[catId].length === 0 ? (
                <p className="text-slate-500 text-center py-8">אין תחרויות פתוחות בקטגוריה זו.</p>
              ) : (
                <>
                  {/* לחצני תחרות לפי סכום – רק של הקטגוריה הנוכחית */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedTournamentId === null ? "default" : "outline"}
                      size="sm"
                      className={selectedTournamentId === null ? "bg-slate-600 shadow-md" : "border-slate-600 text-slate-400 hover:bg-slate-700/50"}
                      onClick={() => setSelectedTournamentId(null)}
                    >
                      כל התחרויות בקטגוריה
                      <span className="mr-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-slate-500/80 text-xs font-bold">
                        {(submissions ?? []).filter((s) => categoryTournamentIds.includes(s.tournamentId)).length}
                      </span>
                    </Button>
                    {byCategory[catId].map((t) => {
                      const styles = getTournamentStyles(t.amount);
                      const isSelected = selectedTournamentId === t.id;
                      const count = (submissions ?? []).filter((s) => s.tournamentId === t.id).length;
                      return (
                        <Button
                          key={t.id}
                          variant="outline"
                          size="sm"
                          className={`rounded-xl border-2 max-w-[200px] min-w-0 flex items-center ${styles.border} ${isSelected ? styles.button + " shadow-md" : "text-slate-400 hover:bg-slate-700/50"}`}
                          onClick={() => setSelectedTournamentId(t.id)}
                          title={t.name}
                        >
                          <Trophy className={`w-4 h-4 ml-1 shrink-0 ${styles.icon}`} />
                          <span className="min-w-0 truncate mr-1.5">{t.name}</span>
                          <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-slate-600/80 text-xs font-bold">
                            {count}
                          </span>
                        </Button>
                      );
                    })}
                  </div>

                  {/* סינון סטטוס */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-slate-500 text-sm self-center">סטטוס:</span>
                    {(
                      [
                        { value: "all" as const, label: "הכל" },
                        { value: "approved" as const, label: "מאושר" },
                        { value: "pending" as const, label: "ממתין" },
                        { value: "rejected" as const, label: "נדחה" },
                      ] as const
                    ).map(({ value, label }) => (
                      <Button
                        key={value}
                        variant={statusFilter === value ? "default" : "ghost"}
                        size="sm"
                        className={`rounded-xl ${statusFilter === value ? "bg-slate-600" : "text-slate-400 hover:text-white"}`}
                        onClick={() => setStatusFilter(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  {/* רשימת טפסים */}
                  <div className="space-y-3 animate-fade-in min-w-0 overflow-hidden">
                    {filtered.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-600/50 min-w-0">
                        <table className="w-full text-right text-sm table-fixed">
                          <thead>
                            <tr className="border-b border-slate-600 bg-slate-800/80 text-slate-400">
                              <th className="py-2 px-3 w-[20%]">משתמש</th>
                              <th className="py-2 px-3 w-[22%]">תחרות</th>
                              <th className="py-2 px-3">נקודות</th>
                              <th className="py-2 px-3">סטטוס</th>
                              <th className="py-2 px-3">תאריך</th>
                              <th className="py-2 px-3">פעולות</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((s) => {
                              const tour = stats.find((t) => t.id === s.tournamentId);
                              const canEdit =
                                user &&
                                (s as { userId?: number }).userId === user.id &&
                                tour &&
                                !tour.isLocked;
                              return (
                                <tr
                                  key={s.id}
                                  className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                                  onClick={() => setViewSubmissionId(s.id)}
                                >
                                  <td className="py-2 px-3 text-white font-medium min-w-0 max-w-0 break-words" title={s.username}>{s.username}</td>
                                  <td className="py-2 px-3 text-slate-400 text-sm min-w-0 max-w-0 break-words" title={getTourName(s.tournamentId)}>{getTourName(s.tournamentId)}</td>
                                  <td className="py-2 px-3 text-emerald-400 font-bold">{s.points}</td>
                                  <td className="py-2 px-3">
                                    {s.status === "approved" ? (
                                      <Badge className="bg-emerald-600"><Check className="w-3 h-3 mr-1" />מאושר</Badge>
                                    ) : s.status === "rejected" ? (
                                      <Badge variant="destructive"><X className="w-3 h-3 mr-1" />נדחה</Badge>
                                    ) : (
                                      <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />ממתין</Badge>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-slate-400">{new Date(s.createdAt).toLocaleDateString("he-IL")}</td>
                                  <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                    {canEdit && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20 mr-1"
                                        onClick={() => setLocation(`/predict/${s.tournamentId}`)}
                                      >
                                        <Pencil className="w-3.5 h-3.5 ml-1" />ערוך
                                      </Button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setViewSubmissionId(s.id)}
                                      className="text-slate-400 hover:text-emerald-400 text-sm"
                                    >
                                      <Eye className="w-4 h-4 inline" /> צפה
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-12">
                        {selectedTournamentId
                          ? "טרם מולאו טפסים בתחרות זו"
                          : "אין טפסים בקטגוריה זו"}
                      </p>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
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
