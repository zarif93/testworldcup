import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Send, LogIn, Trophy } from "lucide-react";
import { getTournamentStyles } from "@/lib/tournamentStyles";

const PREDICTIONS_STORAGE_KEY = (tid: number) => `worldcup_predictions_${tid}`;
const RETURN_PATH_KEY = "worldcup_return_path";

function Toggle12X({
  value,
  onChange,
  disabled,
}: {
  value: "1" | "X" | "2";
  onChange: (v: "1" | "X" | "2") => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex rounded-xl overflow-hidden border border-slate-600 bg-slate-800/50 p-0.5 ${disabled ? "opacity-75 pointer-events-none" : ""}`}>
      <button
        type="button"
        onClick={() => !disabled && onChange("1")}
        disabled={disabled}
        className={`min-w-[44px] py-2 px-4 font-bold text-sm transition-all duration-200 rounded-lg ${
          value === "1"
            ? "bg-emerald-600 text-white shadow-md scale-105"
            : "text-emerald-400/80 hover:bg-emerald-500/20 hover:text-emerald-400"
        }`}
      >
        1
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange("X")}
        disabled={disabled}
        className={`min-w-[44px] py-2 px-4 font-bold text-sm transition-all duration-200 rounded-lg ${
          value === "X"
            ? "bg-amber-500 text-slate-900 shadow-md scale-105"
            : "text-amber-400/80 hover:bg-amber-500/20 hover:text-amber-400"
        }`}
      >
        X
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange("2")}
        disabled={disabled}
        className={`min-w-[44px] py-2 px-4 font-bold text-sm transition-all duration-200 rounded-lg ${
          value === "2"
            ? "bg-blue-600 text-white shadow-md scale-105"
            : "text-blue-400/80 hover:bg-blue-500/20 hover:text-blue-400"
        }`}
      >
        2
      </button>
    </div>
  );
}

const CHANCE_CARDS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
type ChanceCard = (typeof CHANCE_CARDS)[number];

const SUITS = [
  { key: "heart" as const, label: "❤️ לב", color: "text-red-400" },
  { key: "club" as const, label: "♣ תלתן", color: "text-slate-300" },
  { key: "diamond" as const, label: "♦ יהלום", color: "text-blue-400" },
  { key: "spade" as const, label: "♠ עלה", color: "text-slate-400" },
] as const;

export default function PredictionForm() {
  const [, params] = useRoute("/predict/:id");
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const rawId = params?.id;
  const parsedId = rawId != null && rawId !== "" ? parseInt(String(rawId), 10) : NaN;
  const validId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0;

  const { data: tournament, isLoading: tournamentLoading, isFetched: tournamentFetched, isError: tournamentError } = trpc.tournaments.getById.useQuery(
    { id: validId },
    { enabled: validId > 0, retry: false }
  );
  const tournamentType = tournament ? (tournament as { type?: string }).type : undefined;
  const isChance = tournamentType === "chance";
  const isLotto = tournamentType === "lotto";
  const isFootballCustom = tournamentType === "football_custom";
  const { data: matches, isLoading } = trpc.matches.getAll.useQuery(undefined, {
    enabled: validId > 0 && (!tournament || (tournamentType !== "chance" && tournamentType !== "lotto" && tournamentType !== "football_custom")),
  });
  const { data: customMatches } = trpc.tournaments.getCustomFootballMatches.useQuery(
    { tournamentId: validId },
    { enabled: validId > 0 && !!isFootballCustom }
  );
  const matchesList = isFootballCustom ? (customMatches ?? []) : (matches ?? []);
  const isLoadingMatches = isFootballCustom ? customMatches === undefined : isLoading;
  const { data: mySubmissions } = trpc.submissions.getMine.useQuery(undefined, {
    enabled: !!isAuthenticated && validId > 0,
  });
  const submitMutation = trpc.submissions.submit.useMutation();
  const utils = trpc.useUtils();

  const drawDate = tournament ? (tournament as { drawDate?: string | null }).drawDate : null;
  const drawTime = tournament ? (tournament as { drawTime?: string | null }).drawTime : null;
  const { data: serverTimeData } = trpc.system.getServerTime.useQuery(undefined, {
    enabled: isChance && !!drawDate && !!drawTime && validId > 0,
    refetchInterval: 1000,
  });
  const closeAtMs = isChance && drawDate && drawTime
    ? new Date(drawDate.trim() + "T" + drawTime.trim() + ":00+02:00").getTime()
    : 0;
  const nowMs = serverTimeData?.now ? new Date(serverTimeData.now).getTime() : Date.now();
  const countdownMs = closeAtMs > 0 ? Math.max(0, closeAtMs - nowMs) : 0;
  const chanceDrawClosedForUI = isChance && closeAtMs > 0 && countdownMs <= 0;
  const chanceCountdownDisplay = (() => {
    if (!isChance || countdownMs <= 0) return null;
    const s = Math.floor(countdownMs / 1000) % 60;
    const m = Math.floor(countdownMs / 60000) % 60;
    const h = Math.floor(countdownMs / 3600000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  const [notified30, setNotified30] = useState(false);
  const [notified10, setNotified10] = useState(false);
  const [notified1, setNotified1] = useState(false);
  useEffect(() => {
    if (!isChance || countdownMs <= 0) return;
    const minLeft = countdownMs / (60 * 1000);
    if (minLeft <= 1 && !notified1) {
      setNotified1(true);
      toast.info("⏰ נשארה דקה אחת עד סגירת ההרשמה להגרלה!", { duration: 5000 });
    } else if (minLeft <= 10 && !notified10) {
      setNotified10(true);
      toast.info("⏰ נשארו 10 דקות עד סגירת ההרשמה להגרלה", { duration: 5000 });
    } else if (minLeft <= 30 && !notified30) {
      setNotified30(true);
      toast.info("⏰ נשארו 30 דקות עד סגירת ההרשמה להגרלה", { duration: 5000 });
    }
  }, [isChance, countdownMs, notified30, notified10, notified1]);

  const [predictions, setPredictions] = useState<Record<number, "1" | "X" | "2">>({});
  const [chanceCards, setChanceCards] = useState({ heart: "", club: "", diamond: "", spade: "" });
  const [lottoNumbers, setLottoNumbers] = useState<number[]>([]);
  const [lottoStrong, setLottoStrong] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [hasPreloadedExisting, setHasPreloadedExisting] = useState(false);

  useEffect(() => {
    setHasPreloadedExisting(false);
  }, [validId]);

  useEffect(() => {
    if (validId) {
      setNotified30(false);
      setNotified10(false);
      setNotified1(false);
    }
  }, [validId]);

  useEffect(() => {
    if (!matchesList.length || !validId) return;
    const myExisting =
      isAuthenticated && mySubmissions
        ? mySubmissions.find((s) => s.tournamentId === validId)
        : null;
    if (
      myExisting &&
      myExisting.predictions &&
      Array.isArray(myExisting.predictions) &&
      (myExisting.predictions as Array<{ matchId: number; prediction: "1" | "X" | "2" }>).length === matchesList.length
    ) {
      const byId: Record<number, "1" | "X" | "2"> = {};
      for (const p of myExisting.predictions as Array<{ matchId: number; prediction: "1" | "X" | "2" }>) {
        byId[p.matchId] = p.prediction;
      }
      setPredictions(byId);
      setHasPreloadedExisting(true);
      return;
    }
    if (isAuthenticated && mySubmissions) {
      setHasPreloadedExisting(true);
    }
    const stored = sessionStorage.getItem(PREDICTIONS_STORAGE_KEY(validId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, "1" | "X" | "2">;
        const byNum: Record<number, "1" | "X" | "2"> = {};
        for (const [k, v] of Object.entries(parsed)) byNum[parseInt(k)] = v;
        setPredictions(byNum);
        return;
      } catch {
        /* ignore */
      }
    }
    const init: Record<number, "1" | "X" | "2"> = {};
    for (const m of matchesList) init[m.id] = "1";
    setPredictions(init);
  }, [matchesList, validId, isAuthenticated, mySubmissions, hasPreloadedExisting]);

  useEffect(() => {
    if (!isChance || !validId) return;
    const myExisting = isAuthenticated && mySubmissions ? mySubmissions.find((s) => s.tournamentId === validId) : null;
    const pred = myExisting?.predictions;
    if (pred && typeof pred === "object" && !Array.isArray(pred) && "heart" in pred && "club" in pred && "diamond" in pred && "spade" in pred) {
      const p = pred as { heart: string; club: string; diamond: string; spade: string };
      if (CHANCE_CARDS.includes(p.heart as ChanceCard) && CHANCE_CARDS.includes(p.club as ChanceCard) && CHANCE_CARDS.includes(p.diamond as ChanceCard) && CHANCE_CARDS.includes(p.spade as ChanceCard)) {
        setChanceCards({ heart: p.heart as ChanceCard, club: p.club as ChanceCard, diamond: p.diamond as ChanceCard, spade: p.spade as ChanceCard });
      }
    }
  }, [isChance, validId, isAuthenticated, mySubmissions]);

  useEffect(() => {
    if (!isLotto || !validId) return;
    const myExisting = isAuthenticated && mySubmissions ? mySubmissions.find((s) => s.tournamentId === validId) : null;
    const pred = myExisting?.predictions;
    if (pred && typeof pred === "object" && !Array.isArray(pred) && "numbers" in pred && "strongNumber" in pred) {
      const p = pred as { numbers: number[]; strongNumber: number };
      if (Array.isArray(p.numbers) && p.numbers.length === 6 && p.numbers.every((n) => n >= 1 && n <= 37) && new Set(p.numbers).size === 6 && p.strongNumber >= 1 && p.strongNumber <= 7) {
        setLottoNumbers([...p.numbers]);
        setLottoStrong(p.strongNumber);
      }
    }
  }, [isLotto, validId, isAuthenticated, mySubmissions]);

  if (!validId) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-slate-400">טורניר לא נמצא</p>
        <Button variant="outline" onClick={() => setLocation("/tournaments")} className="rounded-xl">חזרה לטורנירים</Button>
      </div>
    );
  }
  if (tournamentError) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-slate-400">שגיאה בטעינת הטורניר. ייתכן שהטורניר לא קיים.</p>
        <Button variant="outline" onClick={() => setLocation("/tournaments")} className="rounded-xl">חזרה לטורנירים</Button>
      </div>
    );
  }
  if (tournamentLoading || !tournamentFetched) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
        <span className="text-slate-400">טוען טורניר...</span>
      </div>
    );
  }
  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-slate-400">טורניר לא נמצא</p>
        <Button variant="outline" onClick={() => setLocation("/tournaments")} className="rounded-xl">חזרה לטורנירים</Button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      if (isChance) {
        sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(validId), JSON.stringify(chanceCards));
      } else if (isLotto) {
        sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(validId), JSON.stringify({ numbers: lottoNumbers, strongNumber: lottoStrong }));
      } else {
        sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(validId), JSON.stringify(predictions));
      }
      sessionStorage.setItem(RETURN_PATH_KEY, `/predict/${validId}`);
      setShowLoginModal(true);
      return;
    }
    if (isLotto) {
      if (lottoNumbers.length !== 6 || lottoStrong == null || lottoStrong < 1 || lottoStrong > 7) {
        toast.error("יש לבחור בדיוק 6 מספרים (1–37) ומספר חזק אחד (1–7)");
        return;
      }
      try {
        const result = await submitMutation.mutateAsync({
          tournamentId: validId,
          predictionsLotto: { numbers: lottoNumbers, strongNumber: lottoStrong },
        });
        sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(validId));
        await utils.submissions.getAll.invalidate();
        await utils.submissions.getMine.invalidate();
        if ((result as { pendingApproval?: boolean }).pendingApproval) {
          toast.success("הטופס נשלח וממתין לאישור מנהל.");
        } else {
          toast.success(isEditing ? "הטופס עודכן בהצלחה" : "הטופס נשלח בהצלחה!");
        }
        setLocation("/");
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
      return;
    }
    if (isChance) {
      if (!chanceCards.heart || !chanceCards.club || !chanceCards.diamond || !chanceCards.spade) {
        toast.error("יש לבחור קלף אחד מכל צורה (לב, תלתן, יהלום, עלה)");
        return;
      }
      try {
        const result = await submitMutation.mutateAsync({
          tournamentId: validId,
          predictionsChance: {
            heart: chanceCards.heart as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            club: chanceCards.club as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            diamond: chanceCards.diamond as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            spade: chanceCards.spade as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
          },
        });
        sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(validId));
        await utils.submissions.getAll.invalidate();
        await utils.submissions.getMine.invalidate();
        if ((result as { pendingApproval?: boolean }).pendingApproval) {
          toast.success("הטופס נשלח וממתין לאישור מנהל.");
        } else {
          toast.success(isEditing ? "הטופס עודכן בהצלחה" : "הטופס נשלח בהצלחה!");
        }
        setLocation("/");
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
      return;
    }
    const preds = Object.entries(predictions).map(([matchId, prediction]) => ({
      matchId: Number(matchId),
      prediction,
    }));
    if (preds.length !== matchesList.length) {
      toast.error(`יש למלא ניחוש לכל ${matchesList.length} המשחקים`);
      return;
    }
    try {
      const result = await submitMutation.mutateAsync({ tournamentId: validId, predictions: preds });
      sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(validId));
      await utils.submissions.getAll.invalidate();
      await utils.submissions.getMine.invalidate();
      await utils.submissions.getByTournament.invalidate({ tournamentId: validId });
      if ((result as { pendingApproval?: boolean }).pendingApproval) {
        toast.success("הטופס נשלח וממתין לאישור מנהל.");
      } else {
        toast.success(isEditing ? "הטופס עודכן בהצלחה" : "הטופס נשלח בהצלחה! נוספת לטבלת הדירוג.");
      }
      setLocation("/");
    } catch (e: unknown) {
      const err = e as { data?: { code?: string }; message?: string };
      if (err?.data?.code === "UNAUTHORIZED" || err?.message?.includes("להתחבר")) {
        sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(validId), JSON.stringify(predictions));
        sessionStorage.setItem(RETURN_PATH_KEY, `/predict/${validId}`);
        setShowLoginModal(true);
      } else {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    }
  };

  const goToLogin = () => {
    setShowLoginModal(false);
    setLocation("/login");
  };

  const goToRegister = () => {
    setShowLoginModal(false);
    setLocation("/register");
  };

  const allFilled = isChance
    ? !!(chanceCards.heart && chanceCards.club && chanceCards.diamond && chanceCards.spade)
    : isLotto
      ? lottoNumbers.length === 6 && lottoStrong != null && lottoStrong >= 1 && lottoStrong <= 7
      : matchesList.length > 0 && Object.keys(predictions).length === matchesList.length;
  const styles = getTournamentStyles(tournament.amount);
  const isEditing =
    !!isAuthenticated &&
    !!mySubmissions?.find((s) => s.tournamentId === validId);
  const cost = (tournament as { amount?: number }).amount ?? 0;
  const hasEnoughPoints =
    user?.role === "admin" || (typeof user?.points === "number" && user.points >= cost);
  const showPendingApprovalMessage =
    !!isAuthenticated &&
    !!user &&
    user.role !== "admin" &&
    typeof user.points === "number" &&
    cost > 0 &&
    user.points < cost;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Trophy className={`w-8 h-8 ${styles.icon}`} />
            {isChance && drawDate && drawTime
              ? `צ'אנס – ${new Date(drawDate + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })} – ${drawTime}`
              : `${tournament.name} – טופס ניחושים`}
          </h1>
          <Button
            variant="outline"
            onClick={() => setLocation("/tournaments")}
            className="border-slate-600 rounded-xl hover:bg-slate-700/50"
          >
            חזרה לטורנירים
          </Button>
        </div>

        {tournament.isLocked && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2">
            🔒 הטורניר נעול – לא ניתן לשלוח ניחושים. הניחושים ששלחת סופיים ולא ניתנים לעריכה.
          </div>
        )}

        {showPendingApprovalMessage && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2">
            💎 אין מספיק נקודות ({user?.points ?? 0} / {cost}). הטופס יישלח וימתין לאישור מנהל.
          </div>
        )}

        {isChance && (drawDate && drawTime) && (
          <div className="mb-6 rounded-xl p-4 border border-slate-600 bg-slate-800/60 text-center">
            {chanceDrawClosedForUI ? (
              <p className="text-amber-300 font-medium">✔ ההרשמה להגרלה נסגרה</p>
            ) : chanceCountdownDisplay != null ? (
              <>
                <p className="text-slate-400 text-sm mb-1">⏳ זמן נותר עד סגירת התחרות</p>
                <p className="text-2xl font-mono font-bold text-white tabular-nums">{chanceCountdownDisplay}</p>
                {countdownMs > 0 && countdownMs <= 10 * 60 * 1000 && (
                  <p className="text-amber-400 text-sm mt-2">🔥 נסגרת בקרוב!</p>
                )}
              </>
            ) : null}
          </div>
        )}

        {isChance ? (
          <div className="max-w-xl mx-auto space-y-4">
            <p className="text-slate-400 text-center mb-6">
              בחר קלף אחד מכל צורה. הקלפים הזמינים: 7, 8, 9, 10, J, Q, K, A
            </p>
            {SUITS.map(({ key, label, color }) => (
              <Card key={key} className="card-sport bg-slate-800/60 border-slate-600/50">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className={`font-bold text-lg ${color}`}>{label}</span>
                    <select
                      className="bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2 text-lg font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                      value={chanceCards[key] || ""}
                      onChange={(e) => setChanceCards((p) => ({ ...p, [key]: e.target.value as ChanceCard | "" }))}
                      disabled={tournament.isLocked || chanceDrawClosedForUI}
                    >
                      <option value="">בחר קלף</option>
                      {CHANCE_CARDS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isLotto ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <p className="text-slate-400 text-center">
              בחר בדיוק 6 מספרים (1–37). אין כפילויות. לאחר מכן בחר מספר חזק אחד (1–7).
            </p>
            <div>
              <p className="text-amber-400 font-medium mb-2">שלב 1 – 6 מספרים ({lottoNumbers.length}/6)</p>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {Array.from({ length: 37 }, (_, i) => i + 1).map((n) => {
                  const selected = lottoNumbers.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={tournament.isLocked}
                      onClick={() => {
                        if (tournament.isLocked) return;
                        if (selected) {
                          setLottoNumbers((prev) => prev.filter((x) => x !== n));
                        } else if (lottoNumbers.length < 6) {
                          setLottoNumbers((prev) => [...prev, n].sort((a, b) => a - b));
                        }
                      }}
                      className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                        selected
                          ? "bg-amber-500 text-slate-900 ring-2 ring-amber-400"
                          : "bg-slate-700 text-white hover:bg-slate-600 border border-slate-600"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-amber-400 font-medium mb-2">שלב 2 – מספר חזק (1–7)</p>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={tournament.isLocked}
                    onClick={() => !tournament.isLocked && setLottoStrong((prev) => (prev === n ? null : n))}
                    className={`w-12 h-12 rounded-lg font-bold transition-all ${
                      lottoStrong === n
                        ? "bg-emerald-500 text-white ring-2 ring-emerald-400"
                        : "bg-slate-700 text-white hover:bg-slate-600 border border-slate-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
        isLoadingMatches ? (
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto block" />
        ) : (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
            {matchesList.map((m, idx) => (
              <Card
                key={m.id}
                className="card-sport bg-slate-800/60 border-slate-600/50 hover:border-slate-500/60 transition-colors"
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-amber-400 text-sm font-mono font-bold mr-2">#{("matchNumber" in m ? m.matchNumber : idx + 1)}</span>
                      <span className="text-white font-medium">{m.homeTeam}</span>
                      <span className="text-slate-500 mx-2 font-medium">vs</span>
                      <span className="text-white font-medium">{m.awayTeam}</span>
                      {((m as { matchDate?: string; matchTime?: string }).matchDate || (m as { matchTime?: string }).matchTime) && (
                        <span className="text-slate-500 text-sm mr-2 block sm:inline mt-1 sm:mt-0">
                          {[(m as { matchDate?: string }).matchDate, (m as { matchTime?: string }).matchTime].filter(Boolean).join(" • ")}
                        </span>
                      )}
                    </div>
                    <Toggle12X
                      value={predictions[m.id] || "1"}
                      onChange={(v) => setPredictions((p) => ({ ...p, [m.id]: v }))}
                      disabled={tournament.isLocked}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
        )}

        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            disabled={!allFilled || tournament.isLocked || (isChance && chanceDrawClosedForUI) || submitMutation.isPending}
            onClick={handleSubmit}
            className={`rounded-xl shadow-lg btn-sport text-lg px-10 ${styles.button}`}
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin ml-2" />
            ) : (
              <Send className="w-5 h-5 ml-2" />
            )}
            {isEditing ? "עדכן טופס" : "שלח טופס"}
          </Button>
        </div>
      </div>

      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white rounded-2xl" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle className="text-xl text-white">נדרשת התחברות</DialogTitle>
            <DialogDescription className="text-slate-300">
              עליך להירשם או להתחבר כדי לשלוח טופס. הבחירות שלך נשמרו ותישמרנה אחרי ההתחברות.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={goToLogin} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
              <LogIn className="w-4 h-4 ml-2" />
              התחברות
            </Button>
            <Button onClick={goToRegister} variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 rounded-xl">
              הרשמה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
