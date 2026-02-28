import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2 } from "lucide-react";
import { getTournamentStyles } from "@/lib/tournamentStyles";

export default function TournamentSelect() {
  const [, setLocation] = useLocation();
  const { data: tournamentStats, isLoading } = trpc.tournaments.getPublicStats.useQuery();
  const sortedTournaments = tournamentStats?.slice().sort((a, b) => a.amount - b.amount) ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4 flex items-center justify-center gap-2 animate-fade-in">
          <Trophy className="w-9 h-9 text-amber-400" />
          בחר טורניר
        </h1>
        <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
          כל הטורנירים מבוססים על אותם 72 משחקי שלב הבתים. ההבדל ביניהם הוא סכום ההשתתפות בלבד – בחר טורניר ולחץ עליו כדי למלא טופס ניחושים (1 / X / 2) לכל משחק.
        </p>

        {/* איך זה עובד – הסבר קצר */}
        <div className="max-w-2xl mx-auto mb-12 p-6 rounded-xl bg-slate-800/50 border border-slate-600/50 text-right">
          <h2 className="text-lg font-bold text-white mb-3">איך זה עובד</h2>
          <ul className="text-slate-400 text-sm space-y-2 list-none">
            <li><strong className="text-slate-300">בחירת טורניר:</strong> כל כפתור מתאים לטורניר אחר (לפי סכום ההשתתפות). לחץ על הטורניר שמתאים לך.</li>
            <li><strong className="text-slate-300">טופס ניחושים:</strong> אחרי הלחיצה תגיע לטופס עם 72 משחקי שלב הבתים. לכל משחק תבחר 1 (ניצחון בית), X (תיקו) או 2 (ניצחון חוץ).</li>
            <li><strong className="text-slate-300">שליחה ואישור:</strong> אחרי שליחת הטופס הוא יישלח לאישור. לאחר אישור ותשלום תיכנס לדירוג של אותו טורניר.</li>
            <li><strong className="text-slate-300">נעילה:</strong> טורניר עם סימן 🔒 סגור להרשמה חדשה – לא ניתן לשלוח אליו טפסים.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-4 justify-center max-w-4xl mx-auto">
          {sortedTournaments.map((t, i) => {
            const styles = getTournamentStyles(t.amount);
            return (
              <Button
                key={t.id}
                size="lg"
                className={`text-lg px-8 py-6 rounded-xl border-2 shadow-lg hover:shadow-xl transition-all duration-300 ${styles.button} ${t.isLocked ? "opacity-60 cursor-not-allowed" : "btn-sport"} animate-slide-up`}
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => !t.isLocked && setLocation(`/predict/${t.id}`)}
                disabled={t.isLocked}
              >
                <Trophy className={`w-6 h-6 ml-2 ${styles.icon}`} />
                <span className="block">
                  <span>{t.name}</span>
                  <span className="block text-sm opacity-90 mt-0.5">₪{t.prizePool.toLocaleString("he-IL")} פרסים • {t.participants} משתתפים</span>
                </span>
                {t.isLocked && <span className="mr-2">🔒</span>}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
