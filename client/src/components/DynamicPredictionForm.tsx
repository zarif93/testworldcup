/**
 * Phase 3: Schema-driven entry form renderer.
 * Renders football (1/X/2), lotto (6+1), and chance (4 suits) from resolved form schema.
 * Produces the same payload shapes as the legacy PredictionForm for backend compatibility.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
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
import { formatSpreadLine, formatMatchPairingTitle } from "@/lib/spreadDisplay";
import { normalizeMarketKind, marketKindLabel } from "@/lib/marketDisplay";
import { sanitizePickForMatchRow, validatePredictionsPayloadAgainstMatches } from "@/lib/customMatchPickValidation";

type ResolvedFormSchemaResult = RouterOutputs["tournaments"]["getResolvedFormSchema"];
type FormSchema = ResolvedFormSchemaResult["formSchema"];
type LegacyType = ResolvedFormSchemaResult["legacyType"];

export type FootballPredictionChoice =
  | "1"
  | "X"
  | "2"
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "HOME_SPREAD"
  | "AWAY_SPREAD";

export interface MatchItem {
  id: number;
  homeTeam: string;
  awayTeam: string;
  matchNumber?: number;
  matchDate?: string;
  matchTime?: string;
  marketType?: string;
  homeSpread?: number | null;
  awaySpread?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

function defaultPickForMatchItem(m: MatchItem, isFootballCustom: boolean): FootballPredictionChoice {
  if (!isFootballCustom) return "1";
  const kind = normalizeMarketKind(m.marketType);
  if (kind === "MONEYLINE") return "HOME";
  return "1";
}

function MoneylinePickToggle({
  homeName,
  awayName,
  value,
  onChange,
  disabled,
}: {
  homeName: string;
  awayName: string;
  value: "HOME" | "AWAY";
  onChange: (v: "HOME" | "AWAY") => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 min-w-0 ${disabled ? "opacity-75 pointer-events-none" : ""}`}>
      <p className="text-[11px] text-violet-400/95 font-medium">מונייליין — מנצח בלבד</p>
      <div className="flex rounded-xl overflow-hidden border border-violet-600/40 bg-slate-800/50 p-0.5 gap-0.5 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange("HOME")}
          className={`flex flex-col flex-1 min-w-[120px] py-2 px-2 font-bold text-sm transition-all rounded-lg ${
            value === "HOME" ? "bg-emerald-600 text-white shadow-md" : "text-emerald-300/90 hover:bg-emerald-500/15"
          }`}
        >
          <span className="break-words text-xs leading-tight">{homeName}</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange("AWAY")}
          className={`flex flex-col flex-1 min-w-[120px] py-2 px-2 font-bold text-sm transition-all rounded-lg ${
            value === "AWAY" ? "bg-blue-600 text-white shadow-md" : "text-blue-300/90 hover:bg-blue-500/15"
          }`}
        >
          <span className="break-words text-xs leading-tight">{awayName}</span>
        </button>
      </div>
    </div>
  );
}

const PREDICTIONS_STORAGE_KEY = (tid: number) => `worldcup_predictions_${tid}`;
const RETURN_PATH_KEY = "worldcup_return_path";

const CHANCE_CARD_VALUES = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;

const SUITS: { key: "heart" | "club" | "diamond" | "spade"; label: string; color: string }[] = [
  { key: "heart", label: "❤️ לב", color: "text-red-400" },
  { key: "club", label: "♣ תלתן", color: "text-slate-300" },
  { key: "diamond", label: "♦ יהלום", color: "text-blue-400" },
  { key: "spade", label: "♠ עלה", color: "text-slate-400" },
];

/** 1X2: Home win (1) / Draw (X) / Away win (2). Correct = 3 pts, wrong = 0. */
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

function SpreadPickToggle({
  homeName,
  awayName,
  homeSpread,
  awaySpread,
  value,
  onChange,
  disabled,
}: {
  homeName: string;
  awayName: string;
  homeSpread: number;
  awaySpread: number;
  /** null = no side chosen yet — do not default to HOME (avoids silent HOME_SPREAD submits). */
  value: "HOME_SPREAD" | "AWAY_SPREAD" | null;
  onChange: (v: "HOME_SPREAD" | "AWAY_SPREAD") => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 min-w-0 ${disabled ? "opacity-75 pointer-events-none" : ""}`}>
      <p className="text-[11px] text-cyan-400/95 font-medium">פר ספרד — בחירה מול הקו (לא ניצחון משחק בלבד)</p>
      <div className="flex rounded-xl overflow-hidden border border-cyan-600/40 bg-slate-800/50 p-0.5 gap-0.5 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange("HOME_SPREAD")}
          className={`flex flex-col flex-1 min-w-[120px] py-2 px-2 font-bold text-sm transition-all rounded-lg ${
            value === "HOME_SPREAD"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-emerald-300/90 hover:bg-emerald-500/15"
          }`}
        >
          <span className="break-words text-xs leading-tight">{homeName}</span>
          <span className="text-[11px] font-mono opacity-95">{formatSpreadLine(homeSpread)}</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange("AWAY_SPREAD")}
          className={`flex flex-col flex-1 min-w-[120px] py-2 px-2 font-bold text-sm transition-all rounded-lg ${
            value === "AWAY_SPREAD"
              ? "bg-blue-600 text-white shadow-md"
              : "text-blue-300/90 hover:bg-blue-500/15"
          }`}
        >
          <span className="break-words text-xs leading-tight">{awayName}</span>
          <span className="text-[11px] font-mono opacity-95">{formatSpreadLine(awaySpread)}</span>
        </button>
      </div>
    </div>
  );
}

export interface DynamicPredictionFormProps {
  tournament: NonNullable<RouterOutputs["tournaments"]["getById"]>;
  formSchema: FormSchema;
  legacyType: LegacyType;
  matchesList: MatchItem[];
  /** Optional: show a small dev/admin badge indicating dynamic renderer (no impact on users). */
  showRendererBadge?: boolean;
}

export function DynamicPredictionForm({
  tournament,
  formSchema,
  legacyType,
  matchesList,
  showRendererBadge = false,
}: DynamicPredictionFormProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const submitMutation = trpc.submissions.submit.useMutation();
  const validId = tournament.id;
  const isChance = legacyType === "chance";
  const isLotto = legacyType === "lotto";
  const isFootball = legacyType === "football" || legacyType === "football_custom";
  const isFootballCustom = legacyType === "football_custom";

  const editSubmissionId =
    typeof window !== "undefined" ? parseInt(new URLSearchParams(window.location.search).get("edit") ?? "", 10) || 0 : 0;
  const duplicateFromSubmissionId =
    typeof window !== "undefined" ? parseInt(new URLSearchParams(window.location.search).get("duplicateFrom") ?? "", 10) : 0;
  const submissionIdToLoad = editSubmissionId || duplicateFromSubmissionId;
  const isEditMode = editSubmissionId > 0;
  const isDuplicateMode = duplicateFromSubmissionId > 0;

  const { data: loadedSubmission } = trpc.submissions.getById.useQuery(
    { id: submissionIdToLoad },
    { enabled: submissionIdToLoad > 0 && validId > 0 }
  );
  const { data: myEntriesForTournament } = trpc.submissions.getMyEntriesForTournament.useQuery(
    { tournamentId: validId },
    { enabled: !!isAuthenticated && validId > 0 }
  );
  const updateMutation = trpc.submissions.update.useMutation();

  const drawDate = (tournament as { drawDate?: string | null }).drawDate ?? null;
  const drawTime = (tournament as { drawTime?: string | null }).drawTime ?? null;
  const closesAt = (tournament as { closesAt?: Date | number | null }).closesAt ?? null;
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

  const [predictions, setPredictions] = useState<Partial<Record<number, FootballPredictionChoice>>>({});
  const [chanceCards, setChanceCards] = useState<Record<string, string>>({ heart: "", club: "", diamond: "", spade: "" });
  const [lottoNumbers, setLottoNumbers] = useState<number[]>([]);
  const [lottoStrong, setLottoStrong] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ path: string; message: string }[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddEntryConfirm, setShowAddEntryConfirm] = useState(false);
  const confirmedAddEntryRef = useRef(false);
  const [hasPreloadedExisting, setHasPreloadedExisting] = useState(false);
  const [stickySubmitVisible, setStickySubmitVisible] = useState(false);

  const entryCost = (tournament as { entryCostPoints?: number }).entryCostPoints ?? (tournament as { amount?: number }).amount ?? 0;
  const isFreeroll = entryCost === 0;
  const countPendingApproved = (list: Array<{ status?: string }> | undefined) =>
    (list ?? []).filter((s) => s.status === "pending" || s.status === "approved").length;
  const freerollSubmissionCount = countPendingApproved(myEntriesForTournament);
  const freerollLimitReached = isFreeroll && freerollSubmissionCount >= 2;
  const hasEntries = !!isAuthenticated && (myEntriesForTournament?.length ?? 0) > 0;
  const hasEnoughPoints =
    user?.unlimitedPoints || user?.role === "admin" || (typeof user?.points === "number" && user.points >= entryCost);

  // Preload from edit/duplicate
  useEffect(() => {
    if (submissionIdToLoad <= 0 || !loadedSubmission || loadedSubmission.tournamentId !== validId) return;
    const pred = loadedSubmission.predictions;
    if (isChance && pred && typeof pred === "object" && !Array.isArray(pred) && "heart" in pred && "club" in pred) {
      const p = pred as { heart: string; club: string; diamond: string; spade: string };
      setChanceCards({ heart: p.heart || "", club: p.club || "", diamond: p.diamond || "", spade: p.spade || "" });
    } else if (isLotto && pred && typeof pred === "object" && "numbers" in pred && "strongNumber" in pred) {
      const p = pred as { numbers: number[]; strongNumber: number };
      if (Array.isArray(p.numbers)) setLottoNumbers([...p.numbers]);
      if (typeof p.strongNumber === "number") setLottoStrong(p.strongNumber);
    } else if (Array.isArray(pred) && isFootball) {
      const byId: Partial<Record<number, FootballPredictionChoice>> = {};
      for (const m of matchesList) {
        const kind = normalizeMarketKind((m as MatchItem).marketType);
        if (isFootballCustom && kind === "SPREAD") continue;
        byId[m.id] = defaultPickForMatchItem(m as MatchItem, isFootballCustom);
      }
      const allowed = new Set([
        "1",
        "X",
        "2",
        "HOME",
        "DRAW",
        "AWAY",
        "HOME_SPREAD",
        "AWAY_SPREAD",
      ]);
      for (const x of pred as Array<{ matchId: number; prediction: string }>) {
        if (!allowed.has(x.prediction)) continue;
        const row = matchesList.find((mm) => mm.id === x.matchId);
        byId[x.matchId] = (row && isFootballCustom
          ? sanitizePickForMatchRow(row, x.prediction)
          : x.prediction) as FootballPredictionChoice;
      }
      setPredictions(byId);
    }
    setHasPreloadedExisting(true);
  }, [submissionIdToLoad, loadedSubmission, validId, isChance, isLotto, isFootball, isFootballCustom, matchesList]);

  // Init football predictions when matches load
  useEffect(() => {
    if (!isFootball || !matchesList.length) return;
    if (hasPreloadedExisting) return;
    const init: Partial<Record<number, FootballPredictionChoice>> = {};
    for (const m of matchesList) {
      const kind = normalizeMarketKind((m as MatchItem).marketType);
      if (isFootballCustom && kind === "SPREAD") continue;
      init[m.id] = defaultPickForMatchItem(m as MatchItem, isFootballCustom);
    }
    setPredictions((prev) => (Object.keys(prev).length === 0 ? init : prev));
  }, [isFootball, isFootballCustom, matchesList, hasPreloadedExisting]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setStickySubmitVisible(window.scrollY > 350);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const buildPayload = (): unknown => {
    if (formSchema.kind === "football_match_predictions") {
      return matchesList.map((m) => {
        const mi = m as MatchItem;
        const kind = isFootballCustom ? normalizeMarketKind(mi.marketType) : "REGULAR_1X2";
        let raw: string;
        if (isFootballCustom && kind === "SPREAD") {
          const p = predictions[m.id];
          if (p !== "HOME_SPREAD" && p !== "AWAY_SPREAD") {
            throw new Error("יש לבחור כיסוי בית או חוץ מול הקו (פר ספרד)");
          }
          raw = p;
        } else {
          raw = (predictions[m.id] ?? "1") as string;
        }
        const prediction = isFootballCustom ? sanitizePickForMatchRow(m, raw) : raw;
        return { matchId: m.id, prediction };
      });
    }
    if (formSchema.kind === "lotto") {
      return { numbers: lottoNumbers, strongNumber: lottoStrong };
    }
    if (formSchema.kind === "chance") {
      return { heart: chanceCards.heart, club: chanceCards.club, diamond: chanceCards.diamond, spade: chanceCards.spade };
    }
    return null;
  };

  const handleSubmit = async () => {
    setValidationErrors([]);
    if (!isAuthenticated) {
      if (isChance) sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(validId), JSON.stringify(chanceCards));
      else if (isLotto) sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(validId), JSON.stringify({ numbers: lottoNumbers, strongNumber: lottoStrong }));
      else sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(validId), JSON.stringify(predictions));
      sessionStorage.setItem(RETURN_PATH_KEY, `/predict/${validId}`);
      setShowLoginModal(true);
      return;
    }

    if (isEditMode && editSubmissionId > 0) {
      try {
        if (isLotto) {
          const payload = buildPayload() as { numbers: number[]; strongNumber: number | null };
          if (payload.numbers.length !== lottoRegularCount || payload.strongNumber == null) {
            toast.error("יש למלא את כל השדות לפי סוג התחרות");
            return;
          }
          await updateMutation.mutateAsync({
            submissionId: editSubmissionId,
            predictionsLotto: { numbers: payload.numbers, strongNumber: payload.strongNumber },
          });
        } else if (isChance) {
          const payload = buildPayload() as Record<string, string>;
          if (!payload.heart || !payload.club || !payload.diamond || !payload.spade) {
            toast.error("יש לבחור קלף אחד מכל צורה");
            return;
          }
          await updateMutation.mutateAsync({
            submissionId: editSubmissionId,
            predictionsChance: {
              heart: payload.heart as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
              club: payload.club as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
              diamond: payload.diamond as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
              spade: payload.spade as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            },
          });
        } else {
          const preds = (buildPayload() as Array<{ matchId: number; prediction: FootballPredictionChoice }>).filter(
            (p) => matchesList.some((m) => m.id === p.matchId)
          );
          if (preds.length !== matchesList.length) {
            toast.error(`יש למלא ניחוש לכל ${matchesList.length} המשחקים`);
            return;
          }
          if (isFootballCustom) {
            const err = validatePredictionsPayloadAgainstMatches(matchesList, preds);
            if (err) {
              toast.error(err);
              return;
            }
          }
          await updateMutation.mutateAsync({ submissionId: editSubmissionId, predictions: preds });
        }
        await utils.submissions.getMine.invalidate();
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

    const payload = buildPayload();
    if (payload == null) {
      toast.error("סוג טופס לא נתמך");
      return;
    }

    try {
      if (formSchema.kind === "football_match_predictions" && isFootballCustom) {
        const preds = payload as Array<{ matchId: number; prediction: string }>;
        const err = validatePredictionsPayloadAgainstMatches(matchesList, preds);
        if (err) {
          toast.error(err);
          return;
        }
      }
      const validation = await utils.submissions.validateEntrySchema.fetch({ tournamentId: validId, payload });
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        toast.error(validation.errors.map((e) => e.message).join("; "));
        return;
      }
    } catch {
      setValidationErrors([{ path: "", message: "אימות הטופס נכשל" }]);
      toast.error("אימות הטופס נכשל");
      return;
    }

    try {
      const idempotencyKey = `sub-${validId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      let result: { balanceAfter?: number; pendingApproval?: boolean } = {};
      if (formSchema.kind === "football_match_predictions") {
        const preds = payload as Array<{ matchId: number; prediction: FootballPredictionChoice }>;
        result = (await submitMutation.mutateAsync({ tournamentId: validId, predictions: preds, idempotencyKey })) as typeof result;
      } else if (formSchema.kind === "lotto") {
        const p = payload as { numbers: number[]; strongNumber: number | null };
        if (p.strongNumber == null) {
          toast.error("חסר מספר חזק");
          return;
        }
        result = (await submitMutation.mutateAsync({
          tournamentId: validId,
          predictionsLotto: { numbers: p.numbers, strongNumber: p.strongNumber },
          idempotencyKey,
        })) as typeof result;
      } else if (formSchema.kind === "chance") {
        const p = payload as Record<string, string>;
        result = (await submitMutation.mutateAsync({
          tournamentId: validId,
          predictionsChance: {
            heart: p.heart as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            club: p.club as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            diamond: p.diamond as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
            spade: p.spade as "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
          },
          idempotencyKey,
        })) as typeof result;
      } else {
        toast.error("סוג טופס לא נתמך");
        return;
      }
      setValidationErrors([]);
      sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(validId));
      await utils.submissions.getMine.invalidate();
      await utils.submissions.getMyEntriesForTournament.invalidate({ tournamentId: validId });
      await utils.auth.me.invalidate();
      await utils.tournaments.getPublicStats.invalidate();
      if (typeof result.balanceAfter === "number") {
        const prev = utils.auth.me.getData();
        if (prev != null) utils.auth.me.setData(undefined, { ...prev, points: result.balanceAfter });
      }
      if (result.pendingApproval) {
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

  const lottoRegularCount = formSchema.kind === "lotto" ? (formSchema.regularCount ?? 6) : 6;
  const lottoRegularMin = formSchema.kind === "lotto" ? (formSchema.regularMin ?? 1) : 1;
  const lottoRegularMax = formSchema.kind === "lotto" ? (formSchema.regularMax ?? 37) : 37;
  const lottoStrongMin = formSchema.kind === "lotto" ? (formSchema.strongMin ?? 1) : 1;
  const lottoStrongMax = formSchema.kind === "lotto" ? (formSchema.strongMax ?? 7) : 7;

  const allFilled =
    isChance
      ? !!(chanceCards.heart && chanceCards.club && chanceCards.diamond && chanceCards.spade)
      : isLotto
        ? lottoNumbers.length === lottoRegularCount &&
          lottoStrong != null &&
          lottoStrong >= lottoStrongMin &&
          lottoStrong <= lottoStrongMax
        : matchesList.length > 0 &&
          matchesList.every((m) => {
            const p = predictions[m.id];
            if (p === undefined) return false;
            if (!isFootballCustom) return p === "1" || p === "X" || p === "2";
            const kind = normalizeMarketKind((m as MatchItem).marketType);
            if (kind === "SPREAD") return p === "HOME_SPREAD" || p === "AWAY_SPREAD";
            if (kind === "MONEYLINE") return p === "HOME" || p === "AWAY";
            return p === "1" || p === "X" || p === "2" || p === "HOME" || p === "DRAW" || p === "AWAY";
          });

  const styles = getTournamentStyles(tournament.amount);
  const isLocked = tournament.isLocked;
  const submitDisabled =
    !allFilled ||
    isLocked ||
    freerollLimitReached ||
    (isChance && chanceDrawClosedForUI) ||
    (isLotto && lottoDrawClosedForUI) ||
    submitMutation.isPending ||
    updateMutation.isPending;

  const cardValues = formSchema.kind === "chance" ? (Array.isArray(formSchema.cardValues) ? formSchema.cardValues : CHANCE_CARD_VALUES) : CHANCE_CARD_VALUES;
  const suits = formSchema.kind === "chance" ? (Array.isArray(formSchema.suits) ? formSchema.suits : SUITS.map((s) => s.key)) : SUITS.map((s) => s.key);

  return (
    <div className="min-h-screen py-4 sm:py-8 overflow-x-hidden max-w-full">
      <div className="container mx-auto px-3 sm:px-4 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2 break-words min-w-0 max-w-full">
            <Trophy className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${styles.icon}`} />
            {isChance && drawDate && drawTime
              ? `צ'אנס – ${new Date(drawDate + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })} – ${drawTime}`
              : isLotto && (drawDate || closesAt)
                ? `לוטו – ${drawDate && drawTime ? new Date(drawDate + "T" + drawTime).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + drawTime : "הגרלה"}`
                : `${tournament.name} – טופס ניחושים`}
            {showRendererBadge && (
              <span className="text-xs font-normal bg-slate-600 text-slate-300 px-2 py-0.5 rounded" title="Dynamic form (schema-driven)">
                schema
              </span>
            )}
          </h1>
          <Button
            variant="outline"
            onClick={() => setLocation("/tournaments")}
            className="border-slate-600 rounded-xl hover:bg-slate-700/50 min-h-[44px] shrink-0"
          >
            חזרה לתחרויות
          </Button>
        </div>

        {isLocked && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2 break-words min-w-0">
            🔒 הטורניר נעול – לא ניתן לשלוח ניחושים.
          </div>
        )}

        {freerollLimitReached && !isLocked && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2 break-words min-w-0">
            הגעת למקסימום 2 טפסים בתחרות FreeRoll זו
          </div>
        )}

        <p className="text-slate-400 text-sm mb-6">הזדמנות לזכות בפרס – מלא טופס והצטרף תוך דקה.</p>

        {isEditMode && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-4 mb-6 text-emerald-200 flex items-center gap-2 break-words min-w-0">
            ✏️ מצב עריכה – עדכון הטופס לא יחייב חיוב נוסף.
          </div>
        )}
        {isDuplicateMode && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 text-amber-200 flex items-center gap-2 break-words min-w-0">
            📋 מצב שכפול – שליחה תיצור טופס חדש.
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="mb-6 rounded-xl p-4 border border-red-500/50 bg-red-500/10 text-red-200">
            <p className="font-medium mb-1">שגיאות אימות:</p>
            <ul className="list-disc list-inside text-sm">
              {validationErrors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        )}

        {isChance && drawDate && drawTime && (
          <div className="mb-6 rounded-xl p-4 border border-slate-600 bg-slate-800/60 text-center">
            {chanceDrawClosedForUI ? (
              <p className="text-amber-300 font-medium">✔ ההרשמה להגרלה נסגרה</p>
            ) : chanceCountdownDisplay != null ? (
              <>
                <p className="text-slate-400 text-sm mb-1">⏳ זמן נותר עד סגירת התחרות</p>
                <p className="text-2xl font-mono font-bold text-white tabular-nums">{chanceCountdownDisplay}</p>
              </>
            ) : null}
          </div>
        )}

        {isLotto && (closesAt != null || (drawDate && drawTime)) && (
          <div className="mb-6 rounded-xl p-4 border border-slate-600 bg-slate-800/60 text-center">
            {lottoDrawClosedForUI ? (
              <p className="text-amber-300 font-medium">✔ ההגרלה נסגרה</p>
            ) : lottoCountdownDisplay != null ? (
              <>
                <p className="text-slate-400 text-sm mb-1">⏳ זמן נותר עד סגירת ההגרלה</p>
                <p className="text-2xl font-mono font-bold text-white tabular-nums">{lottoCountdownDisplay}</p>
              </>
            ) : null}
          </div>
        )}

        {formSchema.kind === "chance" && (
          <div className="max-w-xl mx-auto space-y-4">
            <p className="text-slate-400 text-center mb-6">
              בחר קלף אחד מכל צורה. הקלפים הזמינים: {cardValues.join(", ")}
            </p>
            {SUITS.filter((s) => suits.includes(s.key)).map(({ key, label, color }) => (
              <Card key={key} className="card-sport bg-slate-800/60 border-slate-600/50">
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-4">
                    <span className={`font-bold text-lg ${color}`}>{label}</span>
                    <select
                      className="bg-slate-800 text-white border border-slate-600 rounded-lg px-4 py-2 text-lg font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                      value={chanceCards[key] ?? ""}
                      onChange={(e) => setChanceCards((p) => ({ ...p, [key]: e.target.value }))}
                      disabled={isLocked || chanceDrawClosedForUI}
                    >
                      <option value="">בחר קלף</option>
                      {cardValues.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {formSchema.kind === "lotto" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <p className="text-slate-400 text-center">
              בחר בדיוק {lottoRegularCount} מספרים ({lottoRegularMin}–{lottoRegularMax}). אין כפילויות. לאחר מכן בחר מספר חזק אחד ({lottoStrongMin}–{lottoStrongMax}).
            </p>
            <div>
              <p className="text-amber-400 font-medium mb-2">שלב 1 – {lottoRegularCount} מספרים ({lottoNumbers.length}/{lottoRegularCount})</p>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {Array.from({ length: lottoRegularMax - lottoRegularMin + 1 }, (_, i) => i + lottoRegularMin).map((n) => {
                  const selected = lottoNumbers.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={isLocked || lottoDrawClosedForUI}
                      onClick={() => {
                        if (isLocked || lottoDrawClosedForUI) return;
                        if (selected) {
                          setLottoNumbers((prev) => prev.filter((x) => x !== n));
                        } else if (lottoNumbers.length < lottoRegularCount) {
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
              <p className="text-amber-400 font-medium mb-2">שלב 2 – מספר חזק ({lottoStrongMin}–{lottoStrongMax})</p>
              <div className="flex flex-row flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto min-w-0 justify-start py-1">
                {Array.from({ length: lottoStrongMax - lottoStrongMin + 1 }, (_, i) => i + lottoStrongMin).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={isLocked || lottoDrawClosedForUI}
                    onClick={() => !(isLocked || lottoDrawClosedForUI) && setLottoStrong((prev) => (prev === n ? null : n))}
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
        )}

        {formSchema.kind === "football_match_predictions" && (
          <div className="space-y-4 min-w-0">
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
            {matchesList.map((m, idx) => {
              const mi = m as MatchItem;
              const kind = isFootballCustom ? normalizeMarketKind(mi.marketType) : "REGULAR_1X2";
              const isSpread =
                isFootballCustom &&
                kind === "SPREAD" &&
                mi.homeSpread != null &&
                mi.awaySpread != null &&
                Number.isFinite(mi.homeSpread) &&
                Number.isFinite(mi.awaySpread);
              const isMoneyline = isFootballCustom && kind === "MONEYLINE";
              return (
              <Card
                key={m.id}
                className="card-sport bg-slate-800/60 border-slate-600/50 hover:border-slate-500/60 transition-colors min-w-0 max-w-full overflow-x-hidden"
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <span className="text-amber-400 text-sm font-mono font-bold mr-2">#{m.matchNumber ?? idx + 1}</span>
                      {isFootballCustom ? (
                        <span className="text-slate-400 text-xs font-semibold ml-2">{marketKindLabel(kind)}</span>
                      ) : null}
                      {isSpread ? (
                        <span className="text-white font-medium break-words">
                          {formatMatchPairingTitle(
                            {
                              homeTeam: m.homeTeam,
                              awayTeam: m.awayTeam,
                              marketType: mi.marketType,
                              homeSpread: mi.homeSpread ?? null,
                              awaySpread: mi.awaySpread ?? null,
                            },
                            " vs "
                          )}
                        </span>
                      ) : (
                        <>
                          <span className="text-white font-medium break-words">{m.homeTeam}</span>
                          <span className="text-slate-500 mx-2 font-medium">vs</span>
                          <span className="text-white font-medium break-words">{m.awayTeam}</span>
                        </>
                      )}
                      {!isFootballCustom && (m.matchDate || m.matchTime) && (
                        <span className="text-slate-500 text-sm mr-2 block sm:inline mt-1 sm:mt-0">
                          {[m.matchDate, m.matchTime].filter(Boolean).join(" • ")}
                        </span>
                      )}
                    </div>
                    {isSpread ? (
                      <SpreadPickToggle
                        homeName={m.homeTeam}
                        awayName={m.awayTeam}
                        homeSpread={mi.homeSpread!}
                        awaySpread={mi.awaySpread!}
                        value={
                          predictions[m.id] === "AWAY_SPREAD"
                            ? "AWAY_SPREAD"
                            : predictions[m.id] === "HOME_SPREAD"
                              ? "HOME_SPREAD"
                              : null
                        }
                        onChange={(v) => setPredictions((p) => ({ ...p, [m.id]: v }))}
                        disabled={isLocked}
                      />
                    ) : isMoneyline ? (
                      <MoneylinePickToggle
                        homeName={m.homeTeam}
                        awayName={m.awayTeam}
                        value={predictions[m.id] === "AWAY" ? "AWAY" : "HOME"}
                        onChange={(v) => setPredictions((p) => ({ ...p, [m.id]: v }))}
                        disabled={isLocked}
                      />
                    ) : (
                      <Toggle12X
                        value={(() => {
                          const p = predictions[m.id];
                          if (p === "1" || p === "X" || p === "2") return p;
                          if (p === "HOME") return "1";
                          if (p === "DRAW") return "X";
                          if (p === "AWAY") return "2";
                          return "1";
                        })()}
                        onChange={(v) => setPredictions((p) => ({ ...p, [m.id]: v }))}
                        disabled={isLocked}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );})}
            </div>
          </div>
        )}

        <div className="mt-6 sm:mt-8 flex justify-center pb-safe-nav sm:pb-0">
          <Button
            size="lg"
            disabled={submitDisabled}
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

      {stickySubmitVisible && (
        <div
          className="md:hidden fixed left-0 right-0 z-30 p-3 bg-slate-900/95 border-t border-slate-700/60 backdrop-blur-md"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="container mx-auto max-w-md">
            <Button
              size="lg"
              disabled={submitDisabled}
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
            <Button onClick={() => { setShowLoginModal(false); setLocation("/login"); }} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
              <LogIn className="w-4 h-4 ml-2" />
              התחברות
            </Button>
            <Button onClick={() => { setShowLoginModal(false); setLocation("/register"); }} variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 rounded-xl">
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
