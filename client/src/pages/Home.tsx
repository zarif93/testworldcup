import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2, Target, FileEdit, Award } from "lucide-react";
import { getTournamentStyles } from "@/lib/tournamentStyles";

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: tournamentStats, isLoading } = trpc.tournaments.getPublicStats.useQuery();
  const sortedTournaments = tournamentStats?.slice().sort((a, b) => a.amount - b.amount) ?? [];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative container mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/20 to-emerald-600/20 border border-amber-500/30 mb-8 shadow-lg">
            <Trophy className="w-14 h-14 text-amber-400 drop-shadow" />
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight drop-shadow-sm">
            תחרות ניחושי המונדיאל הגדולה
          </h1>
          <p className="text-lg md:text-xl text-emerald-200/95 mb-4 max-w-2xl mx-auto font-medium">
            FIFA World Cup 2026 – שלב הבתים
          </p>
          <p className="text-slate-400 mb-12 max-w-xl mx-auto">
            בחר טורניר, מלא ניחושים לכל 72 המשחקים, ועקוב אחרי הדירוג והפרסים.
          </p>
        </div>

        {/* CTA – בחר טורניר */}
        {!isLoading && sortedTournaments.length > 0 && (
          <div className="animate-slide-up mb-16">
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 btn-sport"
              onClick={() => setLocation("/tournaments")}
            >
              <Trophy className="w-6 h-6 ml-2 text-amber-300" />
              בחר טורניר
            </Button>
          </div>
        )}

        {/* כרטיסי טורניר */}
        {isLoading ? (
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto block" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto mb-20">
            {sortedTournaments.map((t, i) => {
              const styles = getTournamentStyles(t.amount);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.isLocked}
                  onClick={() => !t.isLocked && setLocation(`/predict/${t.id}`)}
                  className={`card-sport bg-slate-800/60 border-slate-600/50 p-5 text-center ${t.isLocked ? "opacity-60 cursor-not-allowed" : "hover:border-emerald-500/40"} animate-slide-up`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <Trophy className={`w-8 h-8 mx-auto mb-2 ${styles.icon}`} />
                  <p className="text-white font-bold text-lg">{t.name}</p>
                  <p className="text-amber-400 font-black text-xl mt-1">₪{t.prizePool.toLocaleString("he-IL")} פרסים</p>
                  <p className="text-slate-500 text-xs mt-2">{t.participants} משתתפים</p>
                  {t.isLocked && <span className="text-slate-500 text-xs">🔒</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* איך זה עובד */}
        <section className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 flex items-center justify-center gap-2">
            <Target className="w-7 h-7 text-emerald-400" />
            איך זה עובד
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-right">
            <div className="card-sport bg-slate-800/50 border-slate-600/50 p-6 animate-slide-up-delay-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/30 flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">שלב 1: בחר טורניר</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                בדף "בחר טורניר" תופיע רשימת טורנירים. כל טורניר מתאים לסכום השתתפות שונה. לחץ על הטורניר שמתאים לך – תעבור לטופס הניחושים של אותו טורניר. אם טורניר נעול (🔒) אי אפשר לשלוח אליו טפסים חדשים.
              </p>
            </div>
            <div className="card-sport bg-slate-800/50 border-slate-600/50 p-6 animate-slide-up-delay-2">
              <div className="w-12 h-12 rounded-xl bg-amber-500/30 flex items-center justify-center mb-4">
                <FileEdit className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">שלב 2: מלא ניחושים</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                לכל אחד מ-72 משחקי שלב הבתים תבחר ניחוש: 1 (ניצחון לקבוצה הביתית), X (תיקו), או 2 (ניצחון לקבוצה החיצונית). אחרי שתמלא את כל המשחקים שלח את הטופס. הטופס יישלח לאישור – אחרי אישור והעברת התשלום תיכנס לדירוג.
              </p>
            </div>
            <div className="card-sport bg-slate-800/50 border-slate-600/50 p-6 animate-slide-up-delay-3">
              <div className="w-12 h-12 rounded-xl bg-amber-600/30 flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-amber-300" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">שלב 3: ניקוד ודירוג</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                הניקוד מחושב אוטומטית: כל ניחוש נכון (ניצחון או תיקו) = 3 נקודות. ניחוש שגוי = 0 נקודות. בדף "דירוג" תראה את טבלת המובילים לפי טורניר. בדף "טפסים" תוכל לראות את כל הטפסים ששלחת ואת הסטטוס שלהם (ממתין / אושר / נדחה).
              </p>
            </div>
          </div>
        </section>

        {/* כפתורי משתמש */}
        <div className="flex gap-4 justify-center flex-wrap">
          {!isAuthenticated && (
            <>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 rounded-xl btn-sport"
                onClick={() => setLocation("/register")}
              >
                הרשמה
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 text-lg px-8 rounded-xl"
                onClick={() => setLocation("/login")}
              >
                התחברות
              </Button>
            </>
          )}
          <Button
            size="lg"
            variant="outline"
            className="border-slate-500 text-slate-300 hover:bg-slate-700/50 text-lg px-6 rounded-xl"
            onClick={() => setLocation("/tournaments")}
          >
            כל הטורנירים
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20 text-lg px-6 rounded-xl"
            onClick={() => setLocation("/leaderboard")}
          >
            טבלת דירוג
          </Button>
        </div>
      </section>
    </div>
  );
}
