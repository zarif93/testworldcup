import { useState, useEffect, useRef } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Send, LogIn, Trophy } from "lucide-react";
import { getTournamentStyles } from "@/lib/tournamentStyles";
import { DynamicPredictionForm } from "@/components/DynamicPredictionForm";
import { LossAversionBanner } from "@/components/LossAversionBanner";
import { SocialProofStrip } from "@/components/SocialProofStrip";
import type { MatchItem } from "@/components/DynamicPredictionForm";

/** Phase 3: Supported schema kinds and legacy types for dynamic form. */
const SUPPORTED_SCHEMA_KINDS = ["football_match_predictions", "lotto", "chance"] as const;
const SUPPORTED_LEGACY_TYPES = ["football", "football_custom", "lotto", "chance"] as const;

function useDynamicFormPath(
  resolved: { formSchema: { kind: string }; legacyType: string } | undefined,
  tournamentType: string | undefined
): boolean {
  if (!resolved || !tournamentType) return false;
  const kindOk = SUPPORTED_SCHEMA_KINDS.includes(resolved.formSchema.kind as (typeof SUPPORTED_SCHEMA_KINDS)[number]);
  const typeOk = SUPPORTED_LEGACY_TYPES.includes(resolved.legacyType as (typeof SUPPORTED_LEGACY_TYPES)[number]);
  return kindOk && typeOk;
}

const PREDICTIONS_STORAGE_KEY = (tid: number) => `worldcup_predictions_${tid}`;
const RETURN_PATH_KEY = "worldcup_return_path";

/** 1X2 prediction: Home win (1) / Draw (X) / Away win (2). Correct = 3 points, wrong = 0. */
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
        className={`flex flex-col min-w-[52px] py-2 px-3 font-bold text-sm transition-all duration-200 rounded-lg ${
          value === "1"
            ? "bg-emerald-600 text-white shadow-md scale-105"
            : "text-emerald-400/80 hover:bg-emerald-500/20 hover:text-emerald-400"
        }`}
        title="ניצחון בית"
      >
        <span>1</span>
        <span className="text-[10px] font-normal opacity-90">ניצחון בית</span>
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange("X")}
        disabled={disabled}
        className={`flex flex-col min-w-[52px] py-2 px-3 font-bold text-sm transition-all duration-200 rounded-lg ${
          value === "X"
            ? "bg-amber-500 text-slate-900 shadow-md scale-105"
            : "text-amber-400/80 hover:bg-amber-500/20 hover:text-amber-400"
        }`}
        title="תיקו"
      >
        <span>X</span>
        <span className="text-[10px] font-normal opacity-90">תיקו</span>
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange("2")}
        disabled={disabled}
        className={`flex flex-col min-w-[52px] py-2 px-3 font-bold text-sm transition-all duration-200 rounded-lg ${
          value === "2"
            ? "bg-blue-600 text-white shadow-md scale-105"
            : "text-blue-400/80 hover:bg-blue-500/20 hover:text-blue-400"
        }`}
        title="ניצחון חוץ"
      >
        <span>2</span>
        <span className="text-[10px] font-normal opacity-90">ניצחון חוץ</span>
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

  const editSubmissionId =
    typeof window !== "undefined" ? parseInt(new URLSearchParams(window.location.search).get("edit") ?? "", 10) || 0 : 0;
  const duplicateFromSubmissionId =
    typeof window !== "undefined" ? parseInt(new URLSearchParams(window.location.search).get("duplicateFrom") ?? "", 10) || 0 : 0;
  const submissionIdToLoad = editSubmissionId || duplicateFromSubmissionId;
  const isEditMode = editSubmissionId > 0;
  const isDuplicateMode = duplicateFromSubmissionId > 0;

  const { data: loadedSubmission } = trpc.submissions.getById.useQuery(
    { id: submissionIdToLoad },
    { enabled: submissionIdToLoad > 0 && validId > 0 }
  );

  const { data: tournament, isLoading: tournamentLoading, isFetched: tournamentFetched, isError: tournamentError } = trpc.tournaments.getById.useQuery(
    { id: validId },
    { enabled: validId > 0, retry: false }
  );
  const tournamentType = tournament ? (tournament as { type?: string }).type : undefined;
  const { data: resolvedFormSchema, isLoading: schemaLoading, isFetched: schemaFetched } = trpc.tournaments.getResolvedFormSchema.useQuery(
    { tournamentId: validId },
    { enabled: validId > 0 && !!tournament, retry: false }
  );
  const useDynamicForm = useDynamicFormPath(resolvedFormSchema, tournamentType);
  const waitForSchema =
    !!tournament &&
    ["football", "football_custom", "lotto", "chance"].includes(tournamentType ?? "") &&
    !schemaFetched &&
    schemaLoading;

  useEffect(() => {
    if (typeof window === "undefined" || !tournament) return;
    const isDevOrAdmin = process.env.NODE_ENV === "development" || user?.role === "admin";
    if (isDevOrAdmin && schemaFetched) {
      const path = useDynamicForm && resolvedFormSchema ? "dynamic" : "legacy";
      console.info("[Phase 3] Prediction form path:", path);
    }
  }, [tournament, schemaFetched, useDynamicForm, resolvedFormSchema, user?.role]);
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
  const { data: myEntriesForTournament } = trpc.submissions.getMyEntriesForTournament.useQuery(
    { tournamentId: validId },
    { enabled: !!isAuthenticated && validId > 0 }
  );
  const submitMutation = trpc.submissions.submit.useMutation();
  const updateMutation = trpc.submissions.update.useMutation();
  const utils = trpc.useUtils();

  const drawDate = tournament ? (tournament as { drawDate?: string | null }).drawDate : null;
  const drawTime = tournament ? (tournament as { drawTime?: string | null }).drawTime : null;
  const closesAt = tournament ? (tournament as { closesAt?: Date | number | null }).closesAt : null;
  const { data: serverTimeData } = trpc.system.getServerTime.useQuery(undefined, {
    enabled: (isChance && !!drawDate && !!drawTime && validId > 0) || (isLotto && validId > 0),
    refetchInterval: 1000,
  });
  const closeAtMs = (() => {
    if (isChance && drawDate && drawTime) return new Date(drawDate.trim() + "T" + drawTime.trim() + ":00+02:00").getTime();
    if (isLotto && closesAt != null) return typeof closesAt === "number" ? closesAt : new Date(closesAt).getTime();
    return 0;
  })();
  const nowMs = serverTimeData?.now ? new Date(serverTimeData.now).getTime() : Date.now();
  const countdownMs = closeAtMs > 0 ? Math.max(0, closeAtMs - nowMs) : 0;
  const chanceDrawClosedForUI = isChance && closeAtMs > 0 && countdownMs <= 0;
  const lottoDrawClosedForUI = isLotto && (closeAtMs > 0 ? countdownMs <= 0 : (tournament as { status?: string })?.status !== "OPEN");
  const chanceCountdownDisplay = (() => {
    if (!isChance || countdownMs <= 0) return null;
    const s = Math.floor(countdownMs / 1000) % 60;
    const m = Math.floor(countdownMs / 60000) % 60;
    const h = Math.floor(countdownMs / 3600000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();
  const lottoCountdownDisplay = (() => {
    if (!isLotto || countdownMs <= 0) return null;
    const s = Math.floor(countdownMs / 1000) % 60;
    const m = Math.floor(countdownMs / 60000) % 60;
    const h = Math.floor(countdownMs / 3600000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  const [notified30, setNotified30] = useState(false);
  const [notified10, setNotified10] = useState(false);
  const [notified1, setNotified1] = useState(false);
  useEffect(() => {
    if (validId > 0 && isAuthenticated) utils.auth.me.refetch();
  }, [validId, isAuthenticated, utils]);
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
  const [showAddEntryConfirm, setShowAddEntryConfirm] = useState(false);
  const confirmedAddEntryRef = useRef(false);
  const [stickySubmitVisible, setStickySubmitVisible] = useState(false);

  useEffect(() => {
    setHasPreloadedExisting(false);
  }, [validId]);

  useEffect(() => {
    if (submissionIdToLoad <= 0 || !loadedSubmission || loadedSubmission.tournamentId !== validId) return;
    const pred = loadedSubmission.predictions;
    const t = tournamentType;
    if (t === "chance" && pred && typeof pred === "object" && !Array.isArray(pred) && "heart" in pred && "club" in pred) {
      const p = pred as { heart: string; club: string; diamond: string; spade: string };
      setChanceCards({ heart: p.heart || "", club: p.club || "", diamond: p.diamond || "", spade: p.spade || "" });
    } else if (t === "lotto" && pred && typeof pred === "object" && "numbers" in pred && "strongNumber" in pred) {
      const p = pred as { numbers: number[]; strongNumber: number };
      if (Array.isArray(p.numbers)) setLottoNumbers([...p.numbers]);
      if (typeof p.strongNumber === "number") setLottoStrong(p.strongNumber);
    } else if (Array.isArray(pred) && (t === "football" || t === "football_custom" || !t)) {
      const byId: Record<number, "1" | "X" | "2"> = {};
      if (matchesList.length > 0) {
        for (const m of matchesList) byId[m.id] = "1";
      }
      for (const x of pred as Array<{ matchId: number; prediction: "1" | "X" | "2" }>) {
        byId[x.matchId] = x.prediction;
      }
      setPredictions(byId);
    }
    setHasPreloadedExisting(true);
  }, [submissionIdToLoad, loadedSubmission, validId, tournamentType, matchesList]);

  useEffect(() => {
    if (validId) {
      setNotified30(false);
      setNotified10(false);
      setNotified1(false);
    }
  }, [validId]);

  useEffect(() => {
    if (!matchesList.length || !validId) return;
    // אחרי טעינה ראשונית – אל תדרוס שינויים של המשתמש (הוא עשוי לרצות לשלוח כניסה נוספת עם ניחושים שונים)
    if (hasPreloadedExisting) return;
    const entries = isAuthenticated && myEntriesForTournament?.length ? myEntriesForTournament : [];
    const hasEntriesAlready = entries.length > 0;
    const latest = entries[0];
    // במונדיאל/תחרויות ספורט: כשיש כבר כניסות, אל תמלא מהכניסה האחרונה — תציג טופס ריק (או sessionStorage) כדי שהמשתמש ימלא כניסה חדשה בלי דריסה
    const shouldPreloadFromLatest =
      latest &&
      latest.predictions &&
      Array.isArray(latest.predictions) &&
      (latest.predictions as Array<{ matchId: number; prediction: "1" | "X" | "2" }>).length === matchesList.length &&
      (!hasEntriesAlready || isChance || isLotto);
    if (shouldPreloadFromLatest) {
      const byId: Record<number, "1" | "X" | "2"> = {};
      for (const m of matchesList) byId[m.id] = "1";
      for (const p of latest.predictions as Array<{ matchId: number; prediction: "1" | "X" | "2" }>) {
        byId[p.matchId] = p.prediction;
      }
      setPredictions(byId);
      setHasPreloadedExisting(true);
      return;
    }
    if (isAuthenticated && (mySubmissions || hasEntriesAlready)) {
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
  }, [matchesList, validId, isAuthenticated, mySubmissions, myEntriesForTournament, hasPreloadedExisting, isChance, isLotto]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setStickySubmitVisible(window.scrollY > 350);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isChance || !validId) return;
    const entries = isAuthenticated && myEntriesForTournament?.length ? myEntriesForTournament : [];
    const latest = entries[0];
    const pred = latest?.predictions;
    if (pred && typeof pred === "object" && !Array.isArray(pred) && "heart" in pred && "club" in pred && "diamond" in pred && "spade" in pred) {
      const p = pred as { heart: string; club: string; diamond: string; spade: string };
      if (CHANCE_CARDS.includes(p.heart as ChanceCard) && CHANCE_CARDS.includes(p.club as ChanceCard) && CHANCE_CARDS.includes(p.diamond as ChanceCard) && CHANCE_CARDS.includes(p.spade as ChanceCard)) {
        setChanceCards({ heart: p.heart as ChanceCard, club: p.club as ChanceCard, diamond: p.diamond as ChanceCard, spade: p.spade as ChanceCard });
      }
    }
  }, [isChance, validId, isAuthenticated, myEntriesForTournament]);

  useEffect(() => {
    if (!isLotto || !validId) return;
    const entries = isAuthenticated && myEntriesForTournament?.length ? myEntriesForTournament : [];
    const latest = entries[0];
    const pred = latest?.predictions;
    if (pred && typeof pred === "object" && !Array.isArray(pred) && "numbers" in pred && "strongNumber" in pred) {
      const p = pred as { numbers: number[]; strongNumber: number };
      if (Array.isArray(p.numbers) && p.numbers.length === 6 && p.numbers.every((n) => n >= 1 && n <= 37) && new Set(p.numbers).size === 6 && p.strongNumber >= 1 && p.strongNumber <= 7) {
        setLottoNumbers([...p.numbers]);
        setLottoStrong(p.strongNumber);
      }
    }
  }, [isLotto, validId, isAuthenticated, myEntriesForTournament]);

  if (!validId) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-slate-400">טורניר לא נמצא</p>
        <Button variant="outline" onClick={() => setLocation("/tournaments")} className="rounded-xl">חזרה לתחרויות</Button>
      </div>
    );
  }
  if (tournamentError) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-slate-400">שגיאה בטעינת הטורניר. ייתכן שהטורניר לא קיים.</p>
        <Button variant="outline" onClick={() => setLocation("/tournaments")} className="rounded-xl">חזרה לתחרויות</Button>
      </div>
    );
  }
  if (tournamentLoading || !tournamentFetched || waitForSchema) {
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
        <Button variant="outline" onClick={() => setLocation("/tournaments")} className="rounded-xl">חזרה לתחרויות</Button>
      </div>
    );
  }

  const hasMatchesForFootball =
    resolvedFormSchema?.legacyType !== "football" &&
    resolvedFormSchema?.legacyType !== "football_custom" ||
    !isLoadingMatches;
  if (useDynamicForm && resolvedFormSchema && hasMatchesForFootball) {
    const matchesForDynamic: MatchItem[] = matchesList.map((m) => ({
      id: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      matchNumber: "matchNumber" in m ? (m as { matchNumber?: number }).matchNumber : undefined,
      matchDate: "matchDate" in m ? (m as { matchDate?: string }).matchDate : undefined,
      matchTime: "matchTime" in m ? (m as { matchTime?: string }).matchTime : undefined,
    }));
    return (
      <DynamicPredictionForm
        tournament={tournament}
        formSchema={resolvedFormSchema.formSchema}
        legacyType={resolvedFormSchema.legacyType}
        matchesList={matchesForDynamic}
        showRendererBadge={user?.role === "admin"}
      />
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
    if (isEditMode && editSubmissionId > 0) {
      try {
        if (isLotto) {
          if (lottoNumbers.length !== 6 || lottoStrong == null || lottoStrong < 1 || lottoStrong > 7) {
            toast.error("יש לבחור בדיוק 6 מספרים (1–37) ומספר חזק אחד (1–7)");
            return;
          }
          await updateMutation.mutateAsync({
            submissionId: editSubmissionId,
            predictionsLotto: { numbers: lottoNumbers, strongNumber: lottoStrong },
          });
        } else if (isChance) {
          if (!chanceCards.heart || !chanceCards.club || !chanceCards.diamond || !chanceCards.spade) {
            toast.error("יש לבחור קלף אחד מכל צורה (לב, תלתן, יהלום, עלה)");
            return;
          }
          await updateMutation.mutateAsync({
            submissionId: editSubmissionId,
            predictionsChance: {
              heart: chanceCards.heart as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
              club: chanceCards.club as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
              diamond: chanceCards.diamond as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
              spade: chanceCards.spade as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            },
          });
        } else {
          const preds = Object.entries(predictions).map(([matchId, prediction]) => ({
            matchId: Number(matchId),
            prediction,
          }));
          if (preds.length !== matchesList.length) {
            toast.error(`יש למלא ניחוש לכל ${matchesList.length} המשחקים`);
            return;
          }
          await updateMutation.mutateAsync({ submissionId: editSubmissionId, predictions: preds });
        }
        await utils.submissions.getAll.invalidate();
        await utils.submissions.getMine.invalidate();
        await utils.submissions.getByTournament.invalidate({ tournamentId: validId });
        await utils.submissions.getMyEntriesForTournament.invalidate({ tournamentId: validId });
        toast.success("הטופס עודכן בהצלחה (ללא חיוב)");
        setLocation("/submissions");
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
      return;
    }
    if (freerollLimitReached) {
      toast.error("הגעת למקסימום 2 טפסים בתחרות FreeRoll זו");
      return;
    }
    if (hasEntries && entryCost > 0 && !confirmedAddEntryRef.current) {
      setShowAddEntryConfirm(true);
      return;
    }
    confirmedAddEntryRef.current = false;
    setShowAddEntryConfirm(false);
    if (isLotto) {
      if (lottoNumbers.length !== 6 || lottoStrong == null || lottoStrong < 1 || lottoStrong > 7) {
        toast.error("יש לבחור בדיוק 6 מספרים (1–37) ומספר חזק אחד (1–7)");
        return;
      }
      try {
        const result = await submitMutation.mutateAsync({
          tournamentId: validId,
          predictionsLotto: { numbers: lottoNumbers, strongNumber: lottoStrong },
          idempotencyKey: `sub-${validId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        });
        sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(validId));
        await utils.submissions.getAll.invalidate();
        await utils.submissions.getMine.invalidate();
        await utils.submissions.getMyEntriesForTournament.invalidate({ tournamentId: validId });
        await utils.auth.me.invalidate();
        const balanceAfter = (result as { balanceAfter?: number }).balanceAfter;
        if (typeof balanceAfter === "number") {
          const prev = utils.auth.me.getData();
          if (prev != null) utils.auth.me.setData(undefined, { ...prev, points: balanceAfter });
        }
        if ((result as { pendingApproval?: boolean }).pendingApproval) {
          toast.success("הטופס נשלח וממתין לאישור מנהל.");
        } else {
          toast.success(hasEntries ? "כניסה נוספת נשלחה בהצלחה!" : "הטופס נשלח בהצלחה! צפה בדירוג.");
        }
        setLocation(`/?submitted=1&tournamentId=${validId}`);
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
          idempotencyKey: `sub-${validId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        });
        sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(validId));
        await utils.submissions.getAll.invalidate();
        await utils.submissions.getMine.invalidate();
        await utils.submissions.getByTournament.invalidate({ tournamentId: validId });
        await utils.submissions.getMyEntriesForTournament.invalidate({ tournamentId: validId });
        await utils.auth.me.invalidate();
        await utils.tournaments.getPublicStats.invalidate();
        const balanceAfterChance = (result as { balanceAfter?: number }).balanceAfter;
        if (typeof balanceAfterChance === "number") {
          const prev = utils.auth.me.getData();
          if (prev != null) utils.auth.me.setData(undefined, { ...prev, points: balanceAfterChance });
        }
        if ((result as { pendingApproval?: boolean }).pendingApproval) {
          toast.success("הטופס נשלח וממתין לאישור מנהל.");
        } else {
          toast.success(hasEntries ? "כניסה נוספת נשלחה בהצלחה!" : "הטופס נשלח בהצלחה! צפה בדירוג.");
        }
        setLocation(`/?submitted=1&tournamentId=${validId}`);
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
      const result = await submitMutation.mutateAsync({
        tournamentId: validId,
        predictions: preds,
        idempotencyKey: `sub-${validId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });
      sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(validId));
      await utils.submissions.getAll.invalidate();
      await utils.submissions.getMine.invalidate();
      await utils.submissions.getByTournament.invalidate({ tournamentId: validId });
      await utils.submissions.getMyEntriesForTournament.invalidate({ tournamentId: validId });
      await utils.auth.me.invalidate();
      await utils.tournaments.getPublicStats.invalidate();
      const balanceAfterDefault = (result as { balanceAfter?: number }).balanceAfter;
      if (typeof balanceAfterDefault === "number") {
        const prev = utils.auth.me.getData();
        if (prev != null) utils.auth.me.setData(undefined, { ...prev, points: balanceAfterDefault });
      }
      if ((result as { pendingApproval?: boolean }).pendingApproval) {
        toast.success("הטופס נשלח וממתין לאישור מנהל.");
      } else {
        toast.success(hasEntries ? "כניסה נוספת נשלחה בהצלחה!" : "הטופס נשלח בהצלחה! צפה בדירוג.");
      }
      setLocation(`/?submitted=1&tournamentId=${validId}`);
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
  const entryCost = (tournament as { entryCostPoints?: number }).entryCostPoints ?? (tournament as { amount?: number }).amount ?? 0;
  const isFreeroll = entryCost === 0;
  const countPendingApproved = (list: Array<{ status?: string }> | undefined) =>
    (list ?? []).filter((s) => s.status === "pending" || s.status === "approved").length;
  const freerollSubmissionCount = countPendingApproved(myEntriesForTournament);
  const freerollLimitReached = !!isAuthenticated && isFreeroll && freerollSubmissionCount >= 2;
  const hasEntries = !!isAuthenticated && (myEntriesForTournament?.length ?? 0) > 0;
  const hasEnoughPoints =
    user?.unlimitedPoints || user?.role === "admin" || (typeof user?.points === "number" && user.points >= entryCost);

  return (
    <div className="min-h-screen py-4 sm:py-8 overflow-x-hidden max-w-full">
      <div className="container mx-auto px-3 sm:px-4 min-w-0">
        <SocialProofStrip tournamentId={validId} className="mb-4" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2 break-words min-w-0 max-w-full">
            <Trophy className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${styles.icon}`} />
            {isChance && drawDate && drawTime
              ? `צ'אנס – ${new Date(drawDate + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })} – ${drawTime}`
              : isLotto && (drawDate || closesAt)
                ? `לוטו – ${drawDate && drawTime ? new Date(drawDate + "T" + drawTime).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + drawTime : "הגרלה"}`
                : `${tournament.name} – טופס ניחושים`}
          </h1>
          <Button
            variant="outline"
            onClick={() => setLocation("/tournaments")}
            className="border-slate-600 rounded-xl hover:bg-slate-700/50 min-h-[44px] shrink-0"
          >
            חזרה לתחרויות
          </Button>
        </div>

        {/* Phase 32: tournament hero – entry, prize, urgency, why join */}
        <div className="mb-6 rounded-2xl border border-slate-600/60 bg-gradient-to-b from-slate-800/80 to-slate-800/50 overflow-hidden card-tournament-live">
          <div className="p-4 sm:p-5 flex flex-wrap items-center gap-4 gap-y-3">
            <span className="text-amber-400 font-bold">כניסה: {entryCost > 0 ? `${entryCost} נקודות` : "חינם"}</span>
            <span className="text-emerald-400 font-black text-lg">₪{(tournament as { prizePool?: number }).prizePool?.toLocaleString("he-IL") ?? "—"} פרס</span>
            {!tournament.isLocked && (isChance && chanceCountdownDisplay) && (
              <span className={`font-mono font-bold text-lg tabular-nums ${countdownMs > 0 && countdownMs <= 3600000 ? "countdown-urgent is-less-than-hour" : "text-amber-400"}`}>
                ⏳ {chanceCountdownDisplay}
              </span>
            )}
            {!tournament.isLocked && isLotto && lottoCountdownDisplay != null && (
              <span className={`font-mono font-bold text-lg tabular-nums ${countdownMs > 0 && countdownMs <= 3600000 ? "countdown-urgent is-less-than-hour" : "text-amber-400"}`}>
                ⏳ {lottoCountdownDisplay}
              </span>
            )}
          </div>
          <p className="px-4 pb-4 pt-0 text-slate-400 text-sm border-t border-slate-700/50 mt-0 pt-3">
            הזדמנות לזכות בפרס – מלא טופס והצטרף תוך דקה. אחרי אישור הטופס תיכנס לדירוג התחרות. {entryCost > 0 && isAuthenticated && !user?.unlimitedPoints && user?.role !== "admin" ? "ההשתתפות תחויב מנקודותיך." : ""}
          </p>
        </div>

        {isAuthenticated && validId > 0 && !tournament.isLocked && <LossAversionBanner tournamentId={validId} className="mb-4" />}

        {(tournament as { bannerUrl?: string | null }).bannerUrl && (
          <div className="mb-6 rounded-xl overflow-hidden border border-slate-600 bg-slate-800/60">
            <img
              src={(tournament as { bannerUrl: string }).bannerUrl}
              alt=""
              className="w-full h-32 sm:h-40 object-cover"
            />
          </div>
        )}

        {tournament.isLocked && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2 break-words min-w-0">
            🔒 הטורניר נעול – לא ניתן לשלוח ניחושים. הניחושים ששלחת סופיים ולא ניתנים לעריכה.
          </div>
        )}

        {freerollLimitReached && !tournament.isLocked && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2 break-words min-w-0">
            הגעת למקסימום 2 טפסים בתחרות FreeRoll זו
          </div>
        )}

        {isEditMode && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-4 mb-6 text-emerald-200 flex items-center gap-2 break-words min-w-0">
            ✏️ מצב עריכה – עדכון הטופס לא יחייב חיוב נוסף.
          </div>
        )}
        {isDuplicateMode && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2 break-words min-w-0">
            📋 מצב שכפול – שליחה תיצור טופס חדש {user?.unlimitedPoints || user?.role === "admin" ? "ללא חיוב נקודות" : `ותחייב ${entryCost} נקודות`}.
          </div>
        )}

        {isChance && (drawDate && drawTime) && (
          <div className="mb-6 rounded-xl p-4 border border-slate-600 bg-slate-800/60 text-center">
            {chanceDrawClosedForUI ? (
              <p className="text-amber-300 font-medium">✔ ההרשמה להגרלה נסגרה</p>
            ) : chanceCountdownDisplay != null ? (
              <>
                <p className="text-slate-400 text-sm mb-1">⏳ זמן נותר עד סגירת התחרות</p>
                <p className={`text-2xl font-mono font-bold tabular-nums ${countdownMs > 0 && countdownMs <= 3600000 ? "countdown-urgent is-less-than-hour" : "text-white"}`}>{chanceCountdownDisplay}</p>
                {countdownMs > 0 && countdownMs <= 10 * 60 * 1000 && (
                  <p className="text-amber-400 text-sm mt-2">🔥 נסגרת בקרוב!</p>
                )}
              </>
            ) : null}
          </div>
        )}

        {isLotto && (closesAt != null || (drawDate && drawTime)) && (
          <div className="mb-6 rounded-xl p-4 border border-slate-600 bg-slate-800/60 text-center">
            {lottoDrawClosedForUI ? (
              <p className="text-amber-300 font-medium">✔ ההגרלה נסגרה – לא ניתן לשלוח או לערוך טפסים</p>
            ) : lottoCountdownDisplay != null ? (
              <>
                <p className="text-slate-400 text-sm mb-1">⏳ זמן נותר עד סגירת ההגרלה</p>
                <p className={`text-2xl font-mono font-bold tabular-nums ${countdownMs > 0 && countdownMs <= 3600000 ? "countdown-urgent is-less-than-hour" : "text-white"}`}>{lottoCountdownDisplay}</p>
                {countdownMs > 0 && countdownMs <= 10 * 60 * 1000 && (
                  <p className="text-amber-400 text-sm mt-2">🔥 נסגרת בקרוב!</p>
                )}
              </>
            ) : null}
          </div>
        )}

        {isChance ? (
          <div className="max-w-xl mx-auto space-y-4">
            <p className="text-slate-400 text-center mb-6 leading-relaxed">
              בחר קלף אחד מכל צורה. הקלפים הזמינים: 7, 8, 9, 10, J, Q, K, A. לאחר מילוי – לחצו &quot;שלח והשתתף&quot;.
            </p>
            {SUITS.map(({ key, label, color }) => (
              <Card key={key} className="card-sport bg-slate-800/60 border-slate-600/50">
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-4">
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
            <p className="text-slate-400 text-center mb-2">
              בחר בדיוק 6 מספרים (1–37). אין כפילויות. לאחר מכן בחר מספר חזק אחד (1–7). בסיום – &quot;שלח והשתתף&quot;.
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
                      disabled={tournament.isLocked || lottoDrawClosedForUI}
                      onClick={() => {
                        if (tournament.isLocked || lottoDrawClosedForUI) return;
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
              <div className="flex flex-row flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto min-w-0 justify-start py-1">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={tournament.isLocked || lottoDrawClosedForUI}
                    onClick={() => !(tournament.isLocked || lottoDrawClosedForUI) && setLottoStrong((prev) => (prev === n ? null : n))}
                    className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg font-bold transition-all touch-manipulation ${
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
          <div className="space-y-4 min-w-0">
            <p className="text-slate-400 text-center mb-2">בחרו 1 / X / 2 לכל משחק. בסיום לחצו &quot;שלח והשתתף&quot;.</p>
            {/* Phase 32: progress – reduce cognitive load for large competitions */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 border border-slate-600/50 px-4 py-2">
              <span className="text-slate-400 text-sm font-medium">
                {Object.keys(predictions).filter((k) => matchesList.some((m) => m.id === parseInt(k, 10))).length} מתוך {matchesList.length} ניחושים
              </span>
              <div className="flex-1 max-w-[140px] h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${matchesList.length ? (Object.keys(predictions).filter((k) => matchesList.some((m) => m.id === parseInt(k, 10))).length / matchesList.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto overflow-x-hidden pr-2 min-w-0">
            {matchesList.map((m, idx) => (
              <Card
                key={m.id}
                className="card-sport bg-slate-800/60 border-slate-600/50 hover:border-slate-500/60 transition-colors min-w-0 max-w-full overflow-x-hidden"
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <span className="text-amber-400 text-sm font-mono font-bold mr-2">#{("matchNumber" in m ? m.matchNumber : idx + 1)}</span>
                      <span className="text-white font-medium break-words">{m.homeTeam}</span>
                      <span className="text-slate-500 mx-2 font-medium">vs</span>
                      <span className="text-white font-medium break-words">{m.awayTeam}</span>
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
          </div>
        )
        )}

        <div className="mt-6 sm:mt-8 flex justify-center pb-safe-nav sm:pb-0" id="predict-submit-area">
          <Button
            size="lg"
            disabled={!allFilled || tournament.isLocked || freerollLimitReached || (isChance && chanceDrawClosedForUI) || (isLotto && lottoDrawClosedForUI) || submitMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
            className={`rounded-xl shadow-lg btn-sport text-base sm:text-lg px-6 sm:px-10 min-h-[48px] w-full max-w-md touch-target ${styles.button}`}
          >
            {submitMutation.isPending || updateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin ml-2" />
            ) : (
              <Send className="w-5 h-5 ml-2" />
            )}
            {isEditMode ? "עדכן טופס (ללא חיוב)" : hasEntries ? "הוסף כניסה" : "שלח והשתתף"}
          </Button>
        </div>
      </div>

      {/* Phase 32: sticky submit on mobile – keeps CTA visible above bottom nav */}
      {stickySubmitVisible && (
        <div
          className="md:hidden fixed left-0 right-0 z-30 p-3 bg-slate-900/95 border-t border-slate-700/60 backdrop-blur-md"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="container mx-auto max-w-md">
            <Button
              size="lg"
              disabled={!allFilled || tournament.isLocked || freerollLimitReached || (isChance && chanceDrawClosedForUI) || (isLotto && lottoDrawClosedForUI) || submitMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
              className={`w-full rounded-xl shadow-lg btn-sport text-base px-6 min-h-[48px] touch-target ${styles.button}`}
            >
              {submitMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
              ) : (
                <Send className="w-5 h-5 ml-2" />
              )}
              {isEditMode ? "עדכן טופס" : hasEntries ? "הוסף כניסה" : "שלח והשתתף"}
            </Button>
          </div>
        </div>
      )}

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

      <AlertDialog open={showAddEntryConfirm} onOpenChange={setShowAddEntryConfirm}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>כניסה נוספת</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תיצור כניסה נוספת לתחרות {user?.unlimitedPoints || user?.role === "admin" ? "ללא חיוב נקודות." : `ותוריד ${entryCost} נקודות מיתרתך.`} להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setShowAddEntryConfirm(false);
                confirmedAddEntryRef.current = true;
                handleSubmit();
              }}
            >
              המשך
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
