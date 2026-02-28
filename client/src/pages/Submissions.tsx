import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, Eye, Trophy, FileText } from "lucide-react";
import { SubmissionPredictionsModal } from "@/components/SubmissionPredictionsModal";
import { getTournamentStyles } from "@/lib/tournamentStyles";

type StatusFilter = "all" | "approved" | "pending" | "rejected";

export default function Submissions() {
  const [viewSubmissionId, setViewSubmissionId] = useState<number | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: submissions } = trpc.submissions.getAll.useQuery();
  const { data: tournamentStats } = trpc.tournaments.getPublicStats.useQuery();

  const sortedTournaments = tournamentStats?.slice().sort((a, b) => a.amount - b.amount) ?? [];

  const getTourName = (tid: number) =>
    tournamentStats?.find((t) => t.id === tid)?.name ?? `טורניר ${tid}`;

  const filtered = (submissions ?? []).filter((s) => {
    if (selectedTournamentId !== null && s.tournamentId !== selectedTournamentId) return false;
    if (statusFilter === "approved" && s.status !== "approved") return false;
    if (statusFilter === "pending" && s.status !== "pending") return false;
    if (statusFilter === "rejected" && s.status !== "rejected") return false;
    return true;
  });

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-2 animate-fade-in">
          <FileText className="w-9 h-9 text-emerald-400" />
          כל הטפסים
        </h1>
        <p className="text-slate-400 mb-6">
          בחר טורניר כדי לראות רק את הטפסים שלו. רק טפסים שאושרו נספרים בדירוג.
        </p>

        {/* לחצני טורניר */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={selectedTournamentId === null ? "default" : "outline"}
            size="sm"
            className={`rounded-xl ${selectedTournamentId === null ? "bg-slate-600 shadow-md" : "border-slate-600 text-slate-400 hover:bg-slate-700/50"}`}
            onClick={() => setSelectedTournamentId(null)}
          >
            כל הטורנירים
          </Button>
          {sortedTournaments.map((t) => {
            const styles = getTournamentStyles(t.amount);
            const isSelected = selectedTournamentId === t.id;
            return (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                className={`rounded-xl border-2 ${styles.border} ${isSelected ? styles.button + " shadow-md" : "text-slate-400 hover:bg-slate-700/50"}`}
                onClick={() => setSelectedTournamentId(t.id)}
              >
                <Trophy className={`w-4 h-4 ml-1 ${styles.icon}`} />
                {t.name} — ₪{t.prizePool.toLocaleString("he-IL")} פרסים, {t.participants} משתתפים
              </Button>
            );
          })}
        </div>

        {/* סינון סטטוס */}
        <div className="flex flex-wrap gap-2 mb-6">
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
        <div className="space-y-3 animate-fade-in">
          {filtered.map((s) => (
            <Card
              key={s.id}
              className="card-sport bg-slate-800/60 border-slate-600/50 cursor-pointer hover:border-emerald-500/50 transition-all"
              onClick={() => setViewSubmissionId(s.id)}
            >
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-white font-medium">{s.username}</span>
                    <span className="text-slate-400 text-sm">{getTourName(s.tournamentId)}</span>
                    <span className="text-emerald-400 font-bold">{s.points} נקודות</span>
                    {s.status === "approved" ? (
                      <Badge className="bg-emerald-600">
                        <Check className="w-3 h-3 mr-1" />
                        מאושר
                      </Badge>
                    ) : s.status === "rejected" ? (
                      <Badge variant="destructive">
                        <X className="w-3 h-3 mr-1" />
                        נדחה
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="w-3 h-3 mr-1" />
                        ממתין
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewSubmissionId(s.id);
                      }}
                      className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors text-sm"
                      title="צפייה בניחושים"
                    >
                      <Eye className="w-4 h-4" />
                      צפה בניחושים
                    </button>
                  </div>
                  <span className="text-slate-500 text-sm">
                    {new Date(s.createdAt).toLocaleDateString("he-IL")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-slate-500 text-center py-12">
            {selectedTournamentId
              ? "טרם מולאו טפסים בטורניר זה"
              : "אין עדיין טפסים"}
          </p>
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
