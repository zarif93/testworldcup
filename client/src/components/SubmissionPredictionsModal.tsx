import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";
import { formatSpreadLine, formatMatchPairingTitle } from "@/lib/spreadDisplay";
import { normalizeMarketKind } from "@/lib/marketDisplay";
import { spreadCoverSide, spreadUserOutcome, moneylineUserOutcome } from "@/lib/spreadOutcomeDisplay";

type Prediction = { matchId: number; prediction: string };
type MatchRow = {
  id: number;
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  marketType?: string;
  homeSpread?: number | null;
  awaySpread?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

function pickTo123(p: string): "1" | "X" | "2" | null {
  if (p === "1" || p === "HOME") return "1";
  if (p === "X" || p === "DRAW") return "X";
  if (p === "2" || p === "AWAY") return "2";
  return null;
}

function actual123(homeScore: number, awayScore: number): "1" | "X" | "2" {
  if (homeScore > awayScore) return "1";
  if (homeScore < awayScore) return "2";
  return "X";
}

const FOOTBALL_PRED_SET = new Set([
  "1",
  "X",
  "2",
  "HOME",
  "DRAW",
  "AWAY",
  "HOME_SPREAD",
  "AWAY_SPREAD",
]);

function isFootballPredictions(p: unknown): p is Prediction[] {
  return (
    Array.isArray(p) &&
    p.every(
      (x) =>
        x &&
        typeof (x as { matchId?: number }).matchId === "number" &&
        FOOTBALL_PRED_SET.has(String((x as { prediction?: string }).prediction))
    )
  );
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
  const { data: submission, isLoading, isError, error } = trpc.submissions.getPublicSubmissionView.useQuery(
    { id: submissionId! },
    { enabled: open && !!submissionId }
  );
  const { data: matches } = trpc.matches.getAll.useQuery(undefined, {
    enabled: open && !!submissionId,
  });
  const { data: tournaments } = trpc.tournaments.getAll.useQuery(undefined, {
    enabled: open && !!submission?.tournamentId,
  });
  const tournamentId = submission?.tournamentId;
  const tournament = !submission
    ? undefined
    : tournaments?.find((t: { id: number; type?: string }) => t.id === submission.tournamentId);
  const tType = (tournament as { type?: string } | undefined)?.type;
  const { data: customMatches } = trpc.tournaments.getCustomMatches.useQuery(
    { tournamentId: tournamentId! },
    { enabled: open && !!submissionId && !!tournamentId && tType === "football_custom" }
  );

  const rawPredictions = submission?.predictions;
  const predictions: Prediction[] = isFootballPredictions(rawPredictions) ? rawPredictions : [];
  const matchMap = useMemo(() => {
    if (tType === "football_custom" && customMatches?.length) {
      const ordered = [...customMatches].sort((a, b) => {
        const da = (a as { displayOrder?: number }).displayOrder ?? 0;
        const db = (b as { displayOrder?: number }).displayOrder ?? 0;
        return da - db || a.id - b.id;
      });
      return new Map<number, MatchRow>(
        ordered.map((m, idx) => [
          m.id,
          {
            id: m.id,
            matchNumber: (m as { displayOrder?: number }).displayOrder != null ? (m as { displayOrder: number }).displayOrder + 1 : idx + 1,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            marketType: (m as { marketType?: string }).marketType,
            homeSpread: (m as { homeSpread?: number | null }).homeSpread ?? null,
            awaySpread: (m as { awaySpread?: number | null }).awaySpread ?? null,
            homeScore: (m as { homeScore?: number | null }).homeScore ?? null,
            awayScore: (m as { awayScore?: number | null }).awayScore ?? null,
          },
        ])
      );
    }
    return new Map<number, MatchRow>(matches?.map((m: MatchRow) => [m.id, m]) ?? []);
  }, [tType, customMatches, matches]);
  const removed = !!(submission as { tournamentRemoved?: boolean } | undefined)?.tournamentRemoved;
  const tourName = removed ? "תחרות לא זמינה" : (tournaments?.find((t: { id: number; name: string }) => t.id === submission?.tournamentId)?.name ?? `טורניר ${submission?.tournamentId ?? ""}`);
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
                  <th className="p-2 font-medium min-w-0">משחק ותוצאה</th>
                  <th className="p-2 font-medium w-[min(40%,220px)]">ניחוש ומול תוצאה</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({ pred, match }) => {
                  const kind = normalizeMarketKind(match.marketType);
                  const isSpread = kind === "SPREAD" && match.homeSpread != null && match.awaySpread != null;
                  const isMoneyline = kind === "MONEYLINE";
                  const hs = match.homeScore;
                  const ascr = match.awayScore;
                  const adjH =
                    isSpread && hs != null && ascr != null ? hs + (match.homeSpread as number) : null;
                  const adjA =
                    isSpread && hs != null && ascr != null ? ascr + (match.awaySpread as number) : null;
                  const spreadCover =
                    isSpread && hs != null && ascr != null && match.homeSpread != null && match.awaySpread != null
                      ? spreadCoverSide(hs, ascr, match.homeSpread, match.awaySpread)
                      : null;

                  let userBetVsResult: string | null = null;
                  if (hs != null && ascr != null) {
                    if (
                      isSpread &&
                      match.homeSpread != null &&
                      match.awaySpread != null &&
                      (pred.prediction === "HOME_SPREAD" || pred.prediction === "AWAY_SPREAD")
                    ) {
                      const o = spreadUserOutcome(
                        pred.prediction,
                        hs,
                        ascr,
                        match.homeSpread,
                        match.awaySpread
                      );
                      userBetVsResult =
                        o === "win" ? "ניצחון בהימור" : o === "push" ? "דחייה (Push) — לא ניצחון ולא הפסד" : "הפסד בהימור";
                    } else if (isMoneyline && (pred.prediction === "HOME" || pred.prediction === "AWAY")) {
                      const o = moneylineUserOutcome(pred.prediction, hs, ascr);
                      userBetVsResult =
                        o === "win" ? "ניצחון בהימור" : o === "push" ? "דחייה (תיקו)" : "הפסד בהימור";
                    } else if (kind === "REGULAR_1X2") {
                      const pk = pickTo123(pred.prediction);
                      const ak = actual123(hs, ascr);
                      if (pk != null)
                        userBetVsResult = pk === ak ? "ניצחון בהימור" : "הפסד בהימור";
                    }
                  }

                  const coverGradingLabel =
                    spreadCover === "PUSH"
                      ? "PUSH"
                      : spreadCover === "HOME_COVER"
                        ? "HOME_COVER"
                        : spreadCover === "AWAY_COVER"
                          ? "AWAY_COVER"
                          : null;

                  return (
                  <tr key={pred.matchId} className="border-b border-slate-700/50 hover:bg-slate-700/30 align-top">
                    <td className="p-2 text-slate-500">{match.matchNumber}</td>
                    <td className="p-2 text-white min-w-0 max-w-full break-words">
                      <span className="font-medium">
                        {formatMatchPairingTitle(
                          {
                            homeTeam: match.homeTeam,
                            awayTeam: match.awayTeam,
                            marketType: match.marketType,
                            homeSpread: match.homeSpread ?? null,
                            awaySpread: match.awaySpread ?? null,
                          },
                          " – "
                        )}
                      </span>
                      {tType === "football_custom" ? (
                        <span className="text-slate-500 text-xs mr-2 block sm:inline">
                          {" "}
                          · {kind === "SPREAD" ? "פר ספרד" : kind === "MONEYLINE" ? "מונייליין" : "1X2"}
                        </span>
                      ) : null}
                      {hs != null && ascr != null ? (
                        <span className="text-slate-200 text-xs block font-medium">תוצאה בפועל: {hs}–{ascr}</span>
                      ) : null}
                      {isSpread && adjH != null && adjA != null ? (
                        <span className="text-slate-400 text-xs block">
                          מול הקו (ניקוד מתוקן): {formatSpreadLine(adjH)} – {formatSpreadLine(adjA)}
                          {coverGradingLabel != null ? (
                            <span className="text-cyan-300/95 mr-1"> · דירוג: {coverGradingLabel}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2 align-top">
                      <div className="flex flex-col gap-1">
                      {pred.prediction === "HOME_SPREAD" ? (
                        <span className="text-emerald-400 font-bold">בית (מול הקו)</span>
                      ) : pred.prediction === "AWAY_SPREAD" ? (
                        <span className="text-blue-400 font-bold">חוץ (מול הקו)</span>
                      ) : isMoneyline && pred.prediction === "HOME" ? (
                        <span className="text-emerald-400 font-bold">בית (מונייליין)</span>
                      ) : isMoneyline && pred.prediction === "AWAY" ? (
                        <span className="text-blue-400 font-bold">חוץ (מונייליין)</span>
                      ) : (
                      <span
                        className={
                          pred.prediction === "1" || pred.prediction === "HOME"
                            ? "text-emerald-400 font-bold"
                            : pred.prediction === "X" || pred.prediction === "DRAW"
                              ? "text-amber-400 font-bold"
                              : "text-blue-400 font-bold"
                        }
                      >
                        {pred.prediction === "HOME" ? "1" : pred.prediction === "DRAW" ? "X" : pred.prediction === "AWAY" ? "2" : pred.prediction}
                      </span>
                      )}
                      {userBetVsResult != null ? (
                        <span className="text-[11px] text-slate-400 leading-snug">{userBetVsResult}</span>
                      ) : null}
                      </div>
                    </td>
                  </tr>
                );})}
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
