import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useState, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { Loader2, Trophy, LayoutGrid, LogOut, Coins, Menu, MessageCircle, FileText, Gem, Sun, Moon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorldCupBackground } from "@/components/WorldCupBackground";

import { AdminNewSubmissionNotifier } from "./components/AdminNewSubmissionNotifier";
import { PointsSocketSync } from "./components/PointsSocketSync";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const TournamentSelect = lazy(() => import("./pages/TournamentSelect"));
const PredictionForm = lazy(() => import("./pages/PredictionForm"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Submissions = lazy(() => import("./pages/Submissions"));
const Transparency = lazy(() => import("./pages/Transparency"));
const PointsHistory = lazy(() => import("./pages/PointsHistory"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-amber-500" aria-hidden />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen relative">
      <WorldCupBackground />
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" aria-hidden />
      </div>
    </div>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, switchable } = useTheme();
  if (!switchable || !toggleTheme) return null;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={className ?? "p-2 rounded-xl text-slate-300 hover:text-amber-400 hover:bg-slate-800/50 transition"}
      aria-label={theme === "dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
    >
      {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

function NavLinks({
  setLocation,
  user,
  logout,
  onNavigate,
  onOpenTerms,
}: {
  setLocation: (path: string) => void;
  user: { role?: string; points?: number } | null;
  logout: () => void;
  onNavigate?: () => void;
  onOpenTerms?: () => void;
}) {
  const go = (path: string) => {
    setLocation(path);
    onNavigate?.();
  };
  const pointsLabel =
    user?.role === "admin"
      ? "ללא הגבלה"
      : typeof user?.points === "number"
        ? String(user.points)
        : "0";
const WHATSAPP_NUMBER = "972538099212";
  const whatsappDefaultText = "שלום\nאפשר לקבל עוד פרטים על האתר";
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappDefaultText)}`;

  return (
    <>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[#25D366] hover:text-[#20bd5a] transition text-sm font-medium"
        aria-label="צור קשר בוואטסאפ"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">וואטסאפ</span>
      </a>
      <button onClick={() => onOpenTerms?.()} className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition text-sm font-medium" aria-label="תקנון האתר">
        <FileText className="w-4 h-4" />
        תקנון
      </button>
      <button onClick={() => go("/leaderboard")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium">
        דירוג
      </button>
      <button onClick={() => go("/submissions")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium">
        טפסים
      </button>
      {user && (
        <button onClick={() => go("/points")} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/20 transition text-sm font-medium">
          <Gem className="w-4 h-4" />
          <span className="hidden sm:inline">נקודות שלי:</span>
          <span className="font-bold tabular-nums">{pointsLabel}</span>
          <span aria-hidden>💎</span>
        </button>
      )}
      <button onClick={() => go("/tournaments")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium">
        טורנירים
      </button>
      {user ? (
        <>
          {user.role === "admin" && (
            <button onClick={() => go("/admin")} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm font-medium">
              <LayoutGrid className="w-4 h-4" />
              ניהול
            </button>
          )}
          {user.role === "agent" && (
            <button onClick={() => go("/agent")} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
              לוח סוכן
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm font-medium">
            <LogOut className="w-4 h-4" />
            יציאה
          </button>
        </>
      ) : (
        <>
          <button onClick={() => go("/login")} className="text-slate-300 hover:text-white text-sm font-medium">
            התחברות
          </button>
          <button onClick={() => go("/register")} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all">
            הרשמה
          </button>
        </>
      )}
    </>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  if (loading) return <LoadingScreen />;

  const termsContent = (
    <div className="space-y-8 text-right text-slate-300 text-sm max-h-[70vh] overflow-y-auto pr-2">
      {/* פתיחה */}
      <p className="text-slate-400 text-base leading-relaxed">
        תקנון זה מגדיר את תנאי השימוש באתר. השימוש באתר מהווה הסכמה לתקנון. מומלץ לקרוא לפני ההרשמה וההשתתפות.
      </p>

      {/* 1. הרשמה ושימוש */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">1. הרשמה ושימוש</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li><strong className="text-amber-400/90">גיל מינימום 18</strong> – השימוש באתר מותר לבני 18 ומעלה בלבד.</li>
          <li>בהרשמה יש למסור <strong className="text-white">פרטים אמיתיים ומדויקים</strong> (שם, טלפון, וכו').</li>
          <li>אתה אחראי לשמירה על <strong className="text-white">סודיות הסיסמה</strong> ולכל הפעולות מחשבונך.</li>
        </ul>
      </section>

      {/* 2. השתתפות בתחרויות */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">2. השתתפות בתחרויות</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li>ניתן להשתתף בתחרויות: <strong className="text-white">מונדיאל</strong> (ניחושי משחקים), <strong className="text-white">לוטו</strong>, <strong className="text-white">צ'אנס</strong> ותחרויות כדורגל נוספות.</li>
          <li>בכל תחרות מופיעים <strong className="text-amber-400/90">סכום ההשתתפות</strong> ו־<strong className="text-amber-400/90">קופת הפרסים</strong>.</li>
          <li>תחרות שמסומנת כ־🔒 <strong className="text-white">נעולה</strong> – לא ניתן לשלוח אליה טפסים חדשים.</li>
        </ul>
      </section>

      {/* 3. מילוי ניחושים */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">3. מילוי ניחושים</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li>יש למלא את הניחושים <strong className="text-white">בעצמך</strong>, באחריות ובהגינות.</li>
          <li>אסור להשתמש ב<strong className="text-red-400/90">כלים אוטומטיים, בוטים או תוכנות</strong> שמשפיעים על התהליך או התוצאות.</li>
        </ul>
      </section>

      {/* 4. דירוג וחלוקת פרסים */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">4. טבלת דירוג וחלוקת פרסים</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li>טפסים <strong className="text-emerald-400/90">מאושרים</strong> נכנסים לטבלת הדירוג של אותה תחרות; ניתן לעקוב אחרי הציונים והמיקום בזמן אמת.</li>
          <li><strong className="text-amber-400/90">חלוקת פרסים:</strong> לאחר סיום התחרות והגרלת התוצאות (במקרה של לוטו/צ'אנס), הזוכים נקבעים לפי הכללים של כל תחרות.</li>
          <li>אם יש <strong className="text-white">מספר זוכים עם אותו ציון</strong> – קופת הפרסים מתחלקת <strong className="text-white">שווה בשווה</strong> ביניהם (עיגול לפי כללי האתר).</li>
        </ul>
      </section>

      {/* 5. פרטיות ואבטחת מידע */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">5. פרטיות ואבטחת מידע</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li>המידע האישי נשמר באופן מאובטח ומוגן.</li>
          <li>האתר לא מעביר את פרטיך ל<strong className="text-white">צד שלישי</strong> ללא הסכמתך, אלא אם נדרש על פי דין.</li>
        </ul>
      </section>

      {/* 6. הגבלת אחריות */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">6. הגבלת אחריות</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li>האתר <strong className="text-white">אינו אחראי</strong> להפסדים כספיים כתוצאה מהשתתפות בתחרויות.</li>
          <li>האתר אינו אחראי לעיכובים או לשגיאות במידע שמגיע ממקורות חיצוניים (כגון תוצאות הגרלות, תוצאות משחקים).</li>
        </ul>
      </section>

      {/* 7. ביטול והפסקת שימוש */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">7. ביטול והפסקת שימוש</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li>ניתן להפסיק את השימוש באתר בכל עת.</li>
          <li>במקרה של <strong className="text-red-400/90">הפרת תקנון</strong> – האתר רשאי לחסום או להסיר משתמש, ו־<strong className="text-red-400/90">דמי השתתפות ששולמו לא יוחזרו</strong>.</li>
        </ul>
      </section>

      {/* 8. תנאי משיכה */}
      <section className="space-y-2">
        <h3 className="text-white font-bold text-base border-b border-slate-600 pb-1.5">8. תנאי משיכה</h3>
        <ul className="list-disc list-inside space-y-1.5 pr-1">
          <li>משיכות מתבצעות <strong className="text-amber-400/90">בימי חול בלבד</strong>, בין השעות <strong className="text-white">09:00–13:00</strong>.</li>
          <li><strong className="text-white">ביום שבת</strong> לא מתבצעות משיכות.</li>
        </ul>
      </section>

      <p className="text-slate-500 text-xs pt-2 border-t border-slate-700">
        עדכון אחרון: תקנון זה עשוי להתעדכן. המשך שימוש באתר לאחר עדכון מהווה הסכמה לגרסה המעודכנת.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen relative">
      <WorldCupBackground />
      {user?.role === "admin" && <AdminNewSubmissionNotifier />}
      <PointsSocketSync />
      <div className="relative z-10 min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-950/90 backdrop-blur-md shadow-lg shadow-black/20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-white font-bold text-lg hover:text-emerald-400 transition-colors"
          >
            <Trophy className="w-7 h-7 text-amber-400 drop-shadow-sm" />
            <span className="tracking-tight">ניחושי מונדיאל 2026</span>
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <ThemeToggle />
            <NavLinks setLocation={setLocation} user={user} logout={logout} onOpenTerms={() => setTermsOpen(true)} />
          </nav>
          <div className="flex md:hidden">
            <ThemeToggle className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition" />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition" aria-label="תפריט">
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-slate-900 border-slate-700 text-white">
                <div className="flex flex-col gap-4 pt-8">
                  <ThemeToggle />
                  <NavLinks setLocation={setLocation} user={user} logout={logout} onNavigate={() => setMobileOpen(false)} onOpenTerms={() => { setMobileOpen(false); setTermsOpen(true); }} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl text-white text-right">תקנון האתר</DialogTitle>
          </DialogHeader>
          {termsContent}
        </DialogContent>
      </Dialog>
      <main className="flex-1">{children}</main>
      {/* כפתור וואטסאפ צף – ימין למטה */}
      <a
        href={`https://wa.me/972538099212?text=${encodeURIComponent("שלום\nאפשר לקבל עוד פרטים על האתר")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 hover:bg-[#20bd5a] hover:scale-110 transition-all duration-200"
        aria-label="צור קשר בוואטסאפ"
      >
        <MessageCircle className="w-8 h-8" strokeWidth={2} />
      </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Layout>
              <Suspense fallback={<PageFallback />}>
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/login" component={Login} />
                  <Route path="/register" component={Register} />
                  <Route path="/tournaments" component={TournamentSelect} />
                  <Route path="/predict/:id" component={PredictionForm} />
                  <Route path="/leaderboard" component={Leaderboard} />
                  <Route path="/submissions" component={Submissions} />
                  <Route path="/points" component={PointsHistory} />
                  <Route path="/transparency" component={Transparency} />
                  <Route path="/admin" component={AdminPanel} />
                  <Route path="/agent" component={AgentDashboard} />
                  <Route path="/404" component={NotFound} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </Layout>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
