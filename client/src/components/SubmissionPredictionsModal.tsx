import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";

type Prediction = { matchId: number; prediction: "1" | "X" | "2" };
type MatchRow = { id: number; matchNumber: number; homeTeam: string; awayTeam: string };

function isFootballPredictions(p: unknown): p is Prediction[] {
  return Array.isArray(p) && p.every((x) => x && typeof x.matchId === "number" && ["1", "X", "2"].includes(x.prediction));
}

interface SubmissionPredictionsModalProps {
  submissionId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export function SubmissionPredictionsModal({
  submissionId,
  open,
  onOpenChange,
  title,
}: SubmissionPredictionsModalProps) {
  const { isAuthenticated } = useAuth();
  const { data: submission, isLoading, isError, error } = trpc.submissions.getById.useQuery(
    { id: submissionId! },
    { enabled: open && !!submissionId && isAuthenticated }
  );
  const { data: matches } = trpc.matches.getAll.useQuery(undefined, {
    enabled: open && !!submissionId,
  });
  const { data: tournaments } = trpc.tournaments.getAll.useQuery(undefined, {
    enabled: open && !!submission?.tournamentId,
  });

  const rawPredictions = submission?.predictions;
  const predictions: Prediction[] = isFootballPredictions(rawPredictions) ? rawPredictions : [];
  const matchMap = new Map<number, MatchRow>(matches?.map((m: MatchRow) => [m.id, m]) ?? []);
  const removed = !!(submission as { tournamentRemoved?: boolean } | undefined)?.tournamentRemoved;
  const tourName = removed ? "תחרות לא זמינה" : (tournaments?.find((t: { id: number; name: string }) => t.id === submission?.tournamentId)?.name ?? `טורניר ${submission?.tournamentId ?? ""}`);
  const tournament = removed ? undefined : tournaments?.find((t: { id: number; type?: string }) => t.id === submission?.tournamentId);
  const isChance = (tournament as { type?: string } | undefined)?.type === "chance";
  const isLotto = (tournament as { type?: string } | undefined)?.type === "lotto";

  const sortedRows = predictions
    .map((p) => ({ pred: p, match: matchMap.get(p.matchId) }))
    .filter((r): r is { pred: Prediction; match: MatchRow } => !!r.match)
    .sort((a, b) => a.match.matchNumber - b.match.matchNumber);

  const chancePred = !isFootballPredictions(rawPredictions) && rawPredictions && typeof rawPredictions === "object" && "heart" in rawPredictions
    ? (rawPredictions as { heart?: string; club?: string; diamond?: string; spade?: string })
    : null;
  const lottoPred = !isFootballPredictions(rawPredictions) && rawPredictions && typeof rawPredictions === "object" && "numbers" in rawPredictions
    ? (rawPredictions as { numbers?: number[]; strongNumber?: number })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] flex flex-col min-w-0 overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-emerald-400" />
            {title ?? (submission ? `ניחושים של ${submission.username}` : "ניחושים")}
          </DialogTitle>
        </DialogHeader>
        {submission && (
          <div className="flex gap-2 flex-wrap mb-3 min-w-0 break-words">
            <span className="text-slate-400">טורניר:</span>
            <span className="text-white font-medium break-words">{tourName}</span>
            <span className="text-slate-400 mr-2">|</span>
            <span className="text-slate-400">משתמש:</span>
            <span className="text-white font-medium break-words">{submission.username}</span>
            <Badge variant="secondary" className="text-emerald-400">
              {submission.points} נקודות
            </Badge>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          </div>
        ) : !isAuthenticated ? (
          <p className="text-slate-400 text-center py-8">התחבר כדי לצפות בפרטי טופס</p>
        ) : isError ? (
          <p className="text-slate-400 text-center py-8">{error?.message ?? "אין הרשאה לצפות בטופס זה"}</p>
        ) : (
          <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 rounded border border-slate-700 bg-slate-800/50 min-w-0">
            {chancePred && (isChance || ("heart" in chancePred && "club" in chancePred)) ? (
              <div className="p-6 text-right">
                <p className="text-slate-400 mb-2">ניחוש צ'אנס – קלפים לפי צורה:</p>
                <ul className="space-y-1 text-white font-medium">
                  <li>❤️ לב: {String(chancePred.heart ?? "—")}</li>
                  <li>♣ תלתן: {String(chancePred.club ?? "—")}</li>
                  <li>♦ יהלום: {String(chancePred.diamond ?? "—")}</li>
                  <li>♠ עלה: {String(chancePred.spade ?? "—")}</li>
                </ul>
              </div>
            ) : lottoPred && (isLotto || ("numbers" in lottoPred && Array.isArray(lottoPred.numbers))) ? (
              <div className="p-6 text-right">
                <p className="text-slate-400 mb-2">ניחוש לוטו:</p>
                <p className="text-white font-medium">
                  מספרים: {Array.isArray(lottoPred.numbers) ? [...lottoPred.numbers].sort((a, b) => a - b).join(", ") : "—"}
                </p>
                <p className="text-white font-medium mt-1">מספר חזק: {lottoPred.strongNumber ?? "—"}</p>
              </div>
            ) : (
            <table className="w-full text-right text-sm table-fixed min-w-0">
              <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
                <tr className="text-slate-400">
                  <th className="p-2 font-medium w-12">#</th>
                  <th className="p-2 font-medium">משחק</th>
                  <th className="p-2 font-medium w-16">ניחוש</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({ pred, match }) => (
                  <tr key={pred.matchId} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-2 text-slate-500">{match.matchNumber}</td>
                    <td className="p-2 text-white min-w-0 max-w-full break-words">
                      {match.homeTeam} – {match.awayTeam}
                    </td>
                    <td className="p-2">
                      <span
                        className={
                          pred.prediction === "1"
                            ? "text-emerald-400 font-bold"
                            : pred.prediction === "X"
                              ? "text-amber-400 font-bold"
                              : "text-blue-400 font-bold"
                        }
                      >
                        {pred.prediction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
            {sortedRows.length === 0 && !chancePred && !lottoPred && !isLoading && (
              <p className="text-slate-500 text-center py-8">אין ניחושים להצגה</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
