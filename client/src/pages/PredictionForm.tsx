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
}: {
  value: "1" | "X" | "2";
  onChange: (v: "1" | "X" | "2") => void;
}) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-slate-600 bg-slate-800/50 p-0.5">
      <button
        type="button"
        onClick={() => onChange("1")}
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
        onClick={() => onChange("X")}
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
        onClick={() => onChange("2")}
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

export default function PredictionForm() {
  const [, params] = useRoute("/predict/:id");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const tournamentId = params?.id ? parseInt(params.id) : 0;

  const { data: tournament } = trpc.tournaments.getById.useQuery(
    { id: tournamentId },
    { enabled: !!tournamentId }
  );
  const { data: matches, isLoading } = trpc.matches.getAll.useQuery();
  const submitMutation = trpc.submissions.submit.useMutation();
  const utils = trpc.useUtils();

  const [predictions, setPredictions] = useState<Record<number, "1" | "X" | "2">>({});
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (matches) {
      const stored = tournamentId ? sessionStorage.getItem(PREDICTIONS_STORAGE_KEY(tournamentId)) : null;
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
      for (const m of matches) init[m.id] = "1";
      setPredictions(init);
    }
  }, [matches, tournamentId]);

  if (!tournamentId || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">טורניר לא נמצא</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(tournamentId), JSON.stringify(predictions));
      sessionStorage.setItem(RETURN_PATH_KEY, `/predict/${tournamentId}`);
      setShowLoginModal(true);
      return;
    }
    const preds = Object.entries(predictions).map(([matchId, prediction]) => ({
      matchId: parseInt(matchId),
      prediction,
    }));
    if (preds.length !== 72) {
      toast.error("יש למלא ניחוש לכל 72 המשחקים");
      return;
    }
    try {
      await submitMutation.mutateAsync({ tournamentId, predictions: preds });
      sessionStorage.removeItem(PREDICTIONS_STORAGE_KEY(tournamentId));
      await utils.submissions.getAll.invalidate();
      await utils.submissions.getByTournament.invalidate({ tournamentId });
      toast.success("הטופס נשלח בהצלחה! נוספת לטבלת הדירוג.");
      setLocation("/");
    } catch (e: unknown) {
      const err = e as { data?: { code?: string }; message?: string };
      if (err?.data?.code === "UNAUTHORIZED" || err?.message?.includes("להתחבר")) {
        sessionStorage.setItem(PREDICTIONS_STORAGE_KEY(tournamentId), JSON.stringify(predictions));
        sessionStorage.setItem(RETURN_PATH_KEY, `/predict/${tournamentId}`);
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

  const allFilled = matches && Object.keys(predictions).length === matches.length;
  const styles = getTournamentStyles(tournament.amount);

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Trophy className={`w-8 h-8 ${styles.icon}`} />
            {tournament.name} – טופס ניחושים
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
            🔒 הטורניר נעול – לא ניתן לשלוח ניחושים
          </div>
        )}

        {isLoading ? (
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto block" />
        ) : (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
            {matches?.map((m) => (
              <Card
                key={m.id}
                className="card-sport bg-slate-800/60 border-slate-600/50 hover:border-slate-500/60 transition-colors"
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-amber-400 text-sm font-mono font-bold mr-2">#{m.matchNumber}</span>
                      <span className="text-white font-medium">{m.homeTeam}</span>
                      <span className="text-slate-500 mx-2 font-medium">vs</span>
                      <span className="text-white font-medium">{m.awayTeam}</span>
                      <span className="text-slate-500 text-sm mr-2 block sm:inline mt-1 sm:mt-0">
                        {m.matchDate} • {m.matchTime}
                      </span>
                    </div>
                    <Toggle12X
                      value={predictions[m.id] || "1"}
                      onChange={(v) => setPredictions((p) => ({ ...p, [m.id]: v }))}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            disabled={!allFilled || tournament.isLocked || submitMutation.isPending}
            onClick={handleSubmit}
            className={`rounded-xl shadow-lg btn-sport text-lg px-10 ${styles.button}`}
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin ml-2" />
            ) : (
              <Send className="w-5 h-5 ml-2" />
            )}
            שלח טופס
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
