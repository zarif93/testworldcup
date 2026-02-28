import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { Loader2, Trophy, LayoutGrid, LogOut, Coins, Menu, MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { WorldCupBackground } from "@/components/WorldCupBackground";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TournamentSelect from "./pages/TournamentSelect";
import PredictionForm from "./pages/PredictionForm";
import Leaderboard from "./pages/Leaderboard";
import Submissions from "./pages/Submissions";
import Transparency from "./pages/Transparency";
import AdminPanel from "./pages/AdminPanel";
import AgentDashboard from "./pages/AgentDashboard";
import NotFound from "./pages/NotFound";
import { AdminNewSubmissionNotifier } from "./components/AdminNewSubmissionNotifier";

function LoadingScreen() {
  return (
    <div className="min-h-screen relative">
      <WorldCupBackground />
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    </div>
  );
}

function NavLinks({
  setLocation,
  user,
  logout,
  onNavigate,
}: {
  setLocation: (path: string) => void;
  user: { role?: string } | null;
  logout: () => void;
  onNavigate?: () => void;
}) {
  const go = (path: string) => {
    setLocation(path);
    onNavigate?.();
  };
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
      <button onClick={() => go("/leaderboard")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium">
        דירוג
      </button>
      <button onClick={() => go("/submissions")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium">
        טפסים
      </button>
      <button onClick={() => go("/tournaments")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium">
        טורנירים
      </button>
      {user?.role === "admin" && (
        <button onClick={() => go("/transparency")} className="flex items-center gap-1 text-slate-300 hover:text-amber-400 transition text-sm font-medium">
          <Coins className="w-4 h-4 text-amber-400" />
          שקיפות כספית
        </button>
      )}
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

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen relative">
      <WorldCupBackground />
      {user?.role === "admin" && <AdminNewSubmissionNotifier />}
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
            <NavLinks setLocation={setLocation} user={user} logout={logout} />
          </nav>
          <div className="flex md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition" aria-label="תפריט">
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-slate-900 border-slate-700 text-white">
                <div className="flex flex-col gap-4 pt-8">
                  <NavLinks setLocation={setLocation} user={user} logout={logout} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
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
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/login" component={Login} />
                <Route path="/register" component={Register} />
                <Route path="/tournaments" component={TournamentSelect} />
                <Route path="/predict/:id" component={PredictionForm} />
                <Route path="/leaderboard" component={Leaderboard} />
                <Route path="/submissions" component={Submissions} />
                <Route path="/transparency" component={Transparency} />
                <Route path="/admin" component={AdminPanel} />
                <Route path="/agent" component={AgentDashboard} />
                <Route path="/404" component={NotFound} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
