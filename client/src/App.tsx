import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useState, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { Loader2, Trophy, LayoutGrid, LogOut, LogIn, Coins, Menu, MessageCircle, FileText, Gem, Bell, Share2, Home as HomeIcon, HelpCircle, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorldCupBackground } from "@/components/WorldCupBackground";

import { AdminNewSubmissionNotifier } from "./components/AdminNewSubmissionNotifier";
import { UserNotificationsBell } from "./components/UserNotificationsBell";
import { PointsSocketSync } from "./components/PointsSocketSync";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { SiteFooter } from "./components/SiteFooter";
import { trpc } from "@/lib/trpc";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const TournamentSelect = lazy(() => import("./pages/TournamentSelect"));
const PredictionForm = lazy(() => import("./pages/PredictionForm"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Submissions = lazy(() => import("./pages/Submissions"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Transparency = lazy(() => import("./pages/Transparency"));
const PointsHistory = lazy(() => import("./pages/PointsHistory"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const CmsPageView = lazy(() => import("./pages/CmsPageView"));
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

const DEFAULT_WHATSAPP = "972538099212";

function NavLinks({
  setLocation,
  user,
  logout,
  onNavigate,
  onOpenTerms,
  whatsappUrl,
  termsPageSlug,
  privacyPageSlug,
  ctaPrimaryText,
  ctaPrimaryUrl,
}: {
  setLocation: (path: string) => void;
  user: { id?: number; role?: string; points?: number; unlimitedPoints?: boolean } | null;
  logout: () => void;
  onNavigate?: () => void;
  onOpenTerms?: () => void;
  whatsappUrl?: string;
  termsPageSlug?: string;
  privacyPageSlug?: string;
  ctaPrimaryText?: string;
  ctaPrimaryUrl?: string;
}) {
  const go = (path: string) => {
    setLocation(path);
    onNavigate?.();
  };
  const pointsLabel =
    user?.unlimitedPoints || user?.role === "admin"
      ? "ללא הגבלה"
      : typeof user?.points === "number"
        ? String(user.points)
        : "0";
  const waUrl = whatsappUrl ?? `https://wa.me/${DEFAULT_WHATSAPP}`;
  const termsSlug = termsPageSlug?.trim();
  const privacySlug = privacyPageSlug?.trim();

  return (
    <>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[#25D366] hover:text-[#20bd5a] transition text-sm font-medium shrink-0"
        aria-label="צור קשר בוואטסאפ"
      >
        <MessageCircle className="w-5 h-5 shrink-0" />
        <span className="hidden sm:inline truncate">וואטסאפ</span>
      </a>
      {termsSlug ? (
        <button onClick={() => go(`/page/${encodeURIComponent(termsSlug)}`)} className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition text-sm font-medium shrink-0 min-w-0" aria-label="תקנון האתר">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">תקנון</span>
        </button>
      ) : (
        <button onClick={() => onOpenTerms?.()} className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition text-sm font-medium shrink-0 min-w-0" aria-label="תקנון האתר">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">תקנון</span>
        </button>
      )}
      {privacySlug ? (
        <button onClick={() => go(`/page/${encodeURIComponent(privacySlug)}`)} className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition text-sm font-medium shrink-0 min-w-0" aria-label="פרטיות">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">פרטיות</span>
        </button>
      ) : null}
      <button onClick={() => go("/how-it-works")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium shrink-0 min-w-0 truncate">
        איך זה עובד
      </button>
      <button onClick={() => go("/leaderboard")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium shrink-0 min-w-0 truncate">
        דירוג
      </button>
      <button onClick={() => go("/submissions")} className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium shrink-0 min-w-0 truncate">
        טפסים
      </button>
      {user && (user.role === "user" || user.role === "agent") && (
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            const inviteUrl = `${window.location.origin}/register${user.id != null ? `?ref=${user.id}` : ""}`;
            const message = `היי! הצטרף אליי לתחרויות – הירשם כאן: ${inviteUrl}`;
            const waShareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            try {
              const opened = window.open(waShareUrl, "_blank", "noopener,noreferrer");
              if (!opened || opened.closed) {
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success("קישור ההזמנה הועתק");
                }
              }
            } catch {
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(inviteUrl);
                toast.success("קישור ההזמנה הועתק");
              }
            }
          }}
          className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition text-sm font-medium shrink-0 min-w-0 truncate"
          aria-label="הזמן חברים"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span className="truncate">הזמן חברים</span>
        </button>
      )}
      {user && (
        <>
          {(user.role === "user" || user.role === "agent") && (
            <button onClick={() => go("/notifications")} className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition text-sm font-medium shrink-0 min-w-0">
              <Bell className="w-4 h-4 shrink-0" />
              <span className="truncate">התראות</span>
            </button>
          )}
          <button onClick={() => go("/points")} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/20 transition text-sm font-medium shrink-0 min-w-0">
            <Gem className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">נקודות שלי:</span>
            <span className="font-bold tabular-nums">{pointsLabel}</span>
            <span aria-hidden>💎</span>
          </button>
        </>
      )}
      <button
        onClick={() => go((ctaPrimaryUrl?.trim() && ctaPrimaryUrl.startsWith("/") ? ctaPrimaryUrl.trim() : "/tournaments"))}
        className="text-slate-300 hover:text-emerald-400 transition text-sm font-medium shrink-0 min-w-0 truncate"
        aria-label={ctaPrimaryText?.trim() || "תחרויות"}
      >
        {ctaPrimaryText?.trim() || "תחרויות"}
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

/** Mobile drawer menu: RTL-aligned, sectioned layout with consistent icon+label rows. */
function MobileDrawerMenu({
  setLocation,
  user,
  logout,
  onClose,
  onOpenTerms,
  whatsappUrl,
  termsPageSlug,
  privacyPageSlug,
  ctaPrimaryText,
  ctaPrimaryUrl,
}: {
  setLocation: (path: string) => void;
  user: { id?: number; role?: string; points?: number; unlimitedPoints?: boolean; name?: string; username?: string } | null;
  logout: () => void;
  onClose: () => void;
  onOpenTerms: () => void;
  whatsappUrl?: string;
  termsPageSlug?: string;
  privacyPageSlug?: string;
  ctaPrimaryText?: string;
  ctaPrimaryUrl?: string;
}) {
  const go = (path: string) => {
    setLocation(path);
    onClose();
  };
  const pointsLabel =
    user?.unlimitedPoints || user?.role === "admin"
      ? "ללא הגבלה"
      : typeof user?.points === "number"
        ? String(user.points)
        : "0";
  const waUrl = whatsappUrl ?? `https://wa.me/${DEFAULT_WHATSAPP}`;
  const termsSlug = termsPageSlug?.trim();
  const privacySlug = privacyPageSlug?.trim();
  const ctaLabel = ctaPrimaryText?.trim() || "תחרויות";
  const ctaPath = (ctaPrimaryUrl?.trim() && ctaPrimaryUrl.startsWith("/") ? ctaPrimaryUrl.trim() : "/tournaments") || "/tournaments";

  const rowClass = "flex items-center gap-3 w-full min-h-[44px] px-3 py-2.5 rounded-xl text-right transition-colors";
  const rowLabel = "flex-1 min-w-0 text-sm font-medium";
  const iconClass = "w-5 h-5 shrink-0 text-slate-400";
  const sectionSpacing = "space-y-1";
  const sectionGap = "pt-6";

  const inviteAction = () => {
    if (typeof window === "undefined") return;
    const inviteUrl = `${window.location.origin}/register${user?.id != null ? `?ref=${user.id}` : ""}`;
    const message = `היי! הצטרף אליי לתחרויות – הירשם כאן: ${inviteUrl}`;
    const waShareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      const opened = window.open(waShareUrl, "_blank", "noopener,noreferrer");
      if (!opened || opened.closed) {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(inviteUrl);
          toast.success("קישור ההזמנה הועתק");
        }
      }
    } catch {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(inviteUrl);
        toast.success("קישור ההזמנה הועתק");
      }
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full text-right" dir="rtl">
      {/* User / account */}
      {user && (
        <div className="pb-4 border-b border-slate-700/80">
          <p className="text-slate-400 text-xs font-medium mb-1">מחובר כעת</p>
          <p className="text-white font-semibold truncate" aria-label="מחובר כעת">
            {user.name || user.username || `#${user.id}`}
          </p>
        </div>
      )}

      {/* Primary navigation */}
      <nav className={sectionGap + " flex-1 min-h-0 overflow-y-auto"} aria-label="ניווט ראשי">
        <div className={sectionSpacing}>
          <button type="button" onClick={() => go("/")} className={`${rowClass} text-slate-200 hover:bg-slate-800/60 hover:text-white`} aria-label="דף הבית">
            <span className={rowLabel}>דף הבית</span>
            <HomeIcon className={iconClass} aria-hidden />
          </button>
          <button type="button" onClick={() => go(ctaPath)} className={`${rowClass} text-slate-200 hover:bg-slate-800/60 hover:text-white`} aria-label={ctaLabel}>
            <span className={rowLabel}>{ctaLabel}</span>
            <Trophy className={iconClass} aria-hidden />
          </button>
          <button type="button" onClick={() => go("/submissions")} className={`${rowClass} text-slate-200 hover:bg-slate-800/60 hover:text-white`} aria-label="הטפסים שלי">
            <span className={rowLabel}>הטפסים שלי</span>
            <FileText className={iconClass} aria-hidden />
          </button>
          <button type="button" onClick={() => go("/leaderboard")} className={`${rowClass} text-slate-200 hover:bg-slate-800/60 hover:text-white`} aria-label="דירוג">
            <span className={rowLabel}>דירוג</span>
            <TrendingUp className={iconClass} aria-hidden />
          </button>
        </div>

        {/* Points highlight (logged-in) */}
        {user && (
          <div className={sectionGap}>
            <button
              type="button"
              onClick={() => go("/points")}
              className="flex items-center gap-3 w-full min-h-[48px] px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-right hover:bg-amber-500/15 transition"
              aria-label="נקודות שלי"
            >
              <span className="flex-1 min-w-0 text-sm font-semibold text-amber-400/95">נקודות שלי</span>
              <span className="text-base font-bold tabular-nums text-amber-400" aria-hidden>{pointsLabel}</span>
              <Gem className="w-5 h-5 shrink-0 text-amber-400/90" aria-hidden />
            </button>
          </div>
        )}

        {/* Secondary: how it works, legal, WhatsApp */}
        <div className={sectionGap}>
          <button type="button" onClick={() => go("/how-it-works")} className={`${rowClass} text-slate-400 hover:bg-slate-800/50 hover:text-slate-200`} aria-label="איך זה עובד">
            <span className={rowLabel}>איך זה עובד</span>
            <HelpCircle className={iconClass} aria-hidden />
          </button>
          {termsSlug ? (
            <button type="button" onClick={() => go(`/page/${encodeURIComponent(termsSlug)}`)} className={`${rowClass} text-slate-400 hover:bg-slate-800/50 hover:text-slate-200`} aria-label="תקנון">
              <span className={rowLabel}>תקנון</span>
              <FileText className={iconClass} aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={onOpenTerms} className={`${rowClass} text-slate-400 hover:bg-slate-800/50 hover:text-slate-200`} aria-label="תקנון">
              <span className={rowLabel}>תקנון</span>
              <FileText className={iconClass} aria-hidden />
            </button>
          )}
          {privacySlug && (
            <button type="button" onClick={() => go(`/page/${encodeURIComponent(privacySlug)}`)} className={`${rowClass} text-slate-400 hover:bg-slate-800/50 hover:text-slate-200`} aria-label="פרטיות">
              <span className={rowLabel}>פרטיות</span>
              <FileText className={iconClass} aria-hidden />
            </button>
          )}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${rowClass} text-[#25D366] hover:bg-slate-800/50`}
            aria-label="וואטסאפ"
          >
            <span className={rowLabel}>וואטסאפ</span>
            <MessageCircle className="w-5 h-5 shrink-0" aria-hidden />
          </a>
        </div>

        {/* User-only: notifications, invite */}
        {user && (user.role === "user" || user.role === "agent") && (
          <div className={sectionSpacing + " " + sectionGap}>
            <button type="button" onClick={() => go("/notifications")} className={`${rowClass} text-slate-400 hover:bg-slate-800/50 hover:text-slate-200`} aria-label="התראות">
              <span className={rowLabel}>התראות</span>
              <Bell className={iconClass} aria-hidden />
            </button>
            <button type="button" onClick={inviteAction} className={`${rowClass} text-slate-400 hover:bg-slate-800/50 hover:text-slate-200`} aria-label="הזמן חברים">
              <span className={rowLabel}>הזמן חברים</span>
              <Share2 className={iconClass} aria-hidden />
            </button>
          </div>
        )}

        {/* Admin / Agent */}
        {user?.role === "admin" && (
          <button type="button" onClick={() => go("/admin")} className={`${rowClass} text-amber-400 hover:bg-amber-500/10 mt-4`} aria-label="ניהול">
            <span className={rowLabel}>ניהול</span>
            <LayoutGrid className="w-5 h-5 shrink-0 text-amber-400/90" aria-hidden />
          </button>
        )}
        {user?.role === "agent" && (
          <button type="button" onClick={() => go("/agent")} className={`${rowClass} text-emerald-400 hover:bg-emerald-500/10 mt-4`} aria-label="לוח סוכן">
            <span className={rowLabel}>לוח סוכן</span>
            <Users className="w-5 h-5 shrink-0 text-emerald-400/90" aria-hidden />
          </button>
        )}
      </nav>

      {/* Logout / Auth at bottom */}
      <div className="pt-4 mt-auto border-t border-slate-700/80 space-y-2">
        {user ? (
          <button
            type="button"
            onClick={() => { logout(); onClose(); }}
            className={`${rowClass} text-slate-400 hover:bg-slate-800/60 hover:text-white w-full`}
            aria-label="יציאה"
          >
            <span className={rowLabel}>יציאה מהחשבון</span>
            <LogOut className="w-5 h-5 shrink-0" aria-hidden />
          </button>
        ) : (
          <>
            <button type="button" onClick={() => go("/login")} className={`${rowClass} text-slate-200 hover:bg-slate-800/60 hover:text-white`} aria-label="התחברות">
              <span className={rowLabel}>התחברות</span>
              <LogIn className={iconClass} aria-hidden />
            </button>
            <button type="button" onClick={() => go("/register")} className="flex items-center justify-center w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition" aria-label="הרשמה">
              הרשמה
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const { data: siteSettings } = trpc.settings.getPublic.useQuery();
  const whatsappNumber = siteSettings?.["contact.whatsapp"]?.trim() || DEFAULT_WHATSAPP;
  const whatsappUrl = `https://wa.me/${whatsappNumber}`;
  const siteName = siteSettings?.["brand.site_name"]?.trim() || "WinMondial";

  if (loading) return <LoadingScreen />;

  const termsContent = (
    <div className="content-prose max-h-[70vh] overflow-y-auto pr-2 text-slate-300 max-w-[750px] mx-auto">
      {/* פתיחה */}
      <p className="text-slate-400 mb-6">
        תקנון זה מגדיר את תנאי השימוש באתר. השימוש באתר מהווה הסכמה לתקנון.
      </p>
      <p className="text-slate-400 mb-10">
        מומלץ לקרוא לפני ההרשמה וההשתתפות.
      </p>

      {/* 1. הרשמה ושימוש */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">1. הרשמה ושימוש</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li><strong className="text-amber-400/90">גיל מינימום 18</strong> – השימוש באתר מותר לבני 18 ומעלה בלבד.</li>
          <li>בהרשמה יש למסור <strong className="text-white">פרטים אמיתיים ומדויקים</strong> (שם, טלפון, וכו').</li>
          <li>אתה אחראי לשמירה על <strong className="text-white">סודיות הסיסמה</strong> ולכל הפעולות מחשבונך.</li>
        </ul>
      </section>

      {/* 2. השתתפות בתחרויות */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">2. השתתפות בתחרויות</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li>ניתן להשתתף בתחרויות: <strong className="text-white">מונדיאל</strong> (ניחושי משחקים), <strong className="text-white">לוטו</strong>, <strong className="text-white">צ'אנס</strong> ותחרויות כדורגל נוספות.</li>
          <li>בכל תחרות מופיעים <strong className="text-amber-400/90">סכום ההשתתפות</strong> ו־<strong className="text-amber-400/90">קופת הפרסים</strong>.</li>
          <li>תחרות שמסומנת כ־🔒 <strong className="text-white">נעולה</strong> – לא ניתן לשלוח אליה טפסים חדשים.</li>
        </ul>
      </section>

      {/* 3. מילוי ניחושים */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">3. מילוי ניחושים</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li>יש למלא את הניחושים <strong className="text-white">בעצמך</strong>, באחריות ובהגינות.</li>
          <li>אסור להשתמש ב<strong className="text-red-400/90">כלים אוטומטיים, בוטים או תוכנות</strong> שמשפיעים על התהליך או התוצאות.</li>
        </ul>
      </section>

      {/* 4. דירוג וחלוקת פרסים */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">4. טבלת דירוג וחלוקת פרסים</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li>טפסים <strong className="text-emerald-400/90">מאושרים</strong> נכנסים לטבלת הדירוג של אותה תחרות; ניתן לעקוב אחרי הציונים והמיקום בזמן אמת.</li>
          <li><strong className="text-amber-400/90">חלוקת פרסים:</strong> לאחר סיום התחרות והגרלת התוצאות (במקרה של לוטו/צ'אנס), הזוכים נקבעים לפי הכללים של כל תחרות.</li>
          <li>אם יש <strong className="text-white">מספר זוכים עם אותו ציון</strong> – קופת הפרסים מתחלקת <strong className="text-white">שווה בשווה</strong> ביניהם (עיגול לפי כללי האתר).</li>
        </ul>
      </section>

      {/* 5. פרטיות ואבטחת מידע */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">5. פרטיות ואבטחת מידע</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li>המידע האישי נשמר באופן מאובטח ומוגן.</li>
          <li>האתר לא מעביר את פרטיך ל<strong className="text-white">צד שלישי</strong> ללא הסכמתך, אלא אם נדרש על פי דין.</li>
        </ul>
      </section>

      {/* 6. הגבלת אחריות */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">6. הגבלת אחריות</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li>האתר <strong className="text-white">אינו אחראי</strong> להפסדים כספיים כתוצאה מהשתתפות בתחרויות.</li>
          <li>האתר אינו אחראי לעיכובים או לשגיאות במידע שמגיע ממקורות חיצוניים (כגון תוצאות הגרלות, תוצאות משחקים).</li>
        </ul>
      </section>

      {/* 7. ביטול והפסקת שימוש */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">7. ביטול והפסקת שימוש</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li>ניתן להפסיק את השימוש באתר בכל עת.</li>
          <li>במקרה של <strong className="text-red-400/90">הפרת תקנון</strong> – האתר רשאי לחסום או להסיר משתמש, ו־<strong className="text-red-400/90">דמי השתתפות ששולמו לא יוחזרו</strong>.</li>
        </ul>
      </section>

      {/* 8. תנאי משיכה */}
      <section className="mb-10">
        <h3 className="text-white font-bold text-xl border-b border-slate-600 pb-1.5 mb-4">8. תנאי משיכה</h3>
        <ul className="list-disc list-inside space-y-3 pr-5 mb-0">
          <li>משיכות מתבצעות <strong className="text-amber-400/90">בימי חול בלבד</strong>, בין השעות <strong className="text-white">09:00–13:00</strong>.</li>
          <li><strong className="text-white">ביום שבת</strong> לא מתבצעות משיכות.</li>
        </ul>
      </section>

      <p className="text-slate-500 text-base pt-10 mt-10 border-t border-white/10 mb-0">
        עדכון אחרון: תקנון זה עשוי להתעדכן. המשך שימוש באתר לאחר עדכון מהווה הסכמה לגרסה המעודכנת.
      </p>
    </div>
  );

  return (
    <div className="min-h-[100dvh] relative overflow-x-hidden max-w-[100vw]">
      <WorldCupBackground />
      {user?.role === "admin" && <AdminNewSubmissionNotifier />}
      <PointsSocketSync />
      <div className="relative z-10 min-h-[100dvh] flex flex-col min-w-0 max-w-full overflow-x-hidden overflow-y-visible">
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-950/95 backdrop-blur-md shadow-sm min-w-0 overflow-hidden md:min-h-0">
        <div className="container mx-auto px-3 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2 min-w-0 h-[var(--header-height-mobile)] md:h-auto">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 text-white font-bold text-sm md:text-lg hover:text-emerald-400 transition-colors min-w-0 shrink-0 touch-target min-h-[44px] active:opacity-90"
            aria-label={`${siteName} – דף הבית`}
          >
            <Trophy className="w-6 h-6 md:w-7 md:h-7 text-amber-400 drop-shadow-sm shrink-0" />
            <span className="tracking-tight truncate text-right sm:max-w-[200px] md:max-w-none font-semibold">
              {siteName}
            </span>
          </button>
          <nav className="hidden md:flex items-center gap-4 md:gap-6 min-w-0 flex-1 justify-end flex-wrap">
            {user && (user.role === "user" || user.role === "agent") && <UserNotificationsBell />}
            {user && (
              <>
                <span className="flex items-center gap-1.5 text-slate-200 text-sm font-medium shrink-0 max-w-[140px] truncate" aria-label="מחובר כעת" title={user.name || user.username || ""}>
                  {user.name || user.username || `#${user.id}`}
                </span>
                <span className="flex items-center gap-1.5 text-slate-300 text-sm font-medium tabular-nums shrink-0" aria-label="יתרת נקודות">
                  <Gem className="w-4 h-4 text-amber-400/90 shrink-0" />
                  {user.unlimitedPoints || user.role === "admin" ? "ללא הגבלה" : `${user.points ?? 0} נקודות`}
                </span>
              </>
            )}
            <NavLinks setLocation={setLocation} user={user} logout={logout} onOpenTerms={() => setTermsOpen(true)} whatsappUrl={whatsappUrl} termsPageSlug={siteSettings?.["legal.terms_page_slug"]} privacyPageSlug={siteSettings?.["legal.privacy_page_slug"]} ctaPrimaryText={siteSettings?.["cta.primary_text"]} ctaPrimaryUrl={siteSettings?.["cta.primary_url"]} />
          </nav>
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {user && (user.role === "user" || user.role === "agent") && <UserNotificationsBell />}
            {user && (
              <span className="flex items-center gap-1 rounded-lg px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tabular-nums min-h-[36px] items-center" aria-label="יתרת נקודות">
                <Gem className="w-3.5 h-3.5 shrink-0" />
                {user.unlimitedPoints || user.role === "admin" ? "∞" : `${user.points ?? 0}`}
              </span>
            )}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition touch-target min-h-[44px] min-w-[44px] flex items-center justify-center active:opacity-80" aria-label="תפריט">
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100vw-2rem,300px)] max-w-[300px] bg-slate-900 border-slate-700 text-white p-0 flex flex-col overflow-hidden">
                <div className="pt-14 px-4 pb-4 flex flex-col h-full min-h-0">
                  <MobileDrawerMenu
                    setLocation={setLocation}
                    user={user}
                    logout={logout}
                    onClose={() => setMobileOpen(false)}
                    onOpenTerms={() => { setMobileOpen(false); setTermsOpen(true); }}
                    whatsappUrl={whatsappUrl}
                    termsPageSlug={siteSettings?.["legal.terms_page_slug"]}
                    privacyPageSlug={siteSettings?.["legal.privacy_page_slug"]}
                    ctaPrimaryText={siteSettings?.["cta.primary_text"]}
                    ctaPrimaryUrl={siteSettings?.["cta.primary_url"]}
                  />
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
      <main className="flex-1 pb-safe-nav md:pb-0 min-w-0 w-full max-w-full overflow-x-hidden py-3 md:py-4 md:container md:mx-auto">{children}</main>
      <SiteFooter />
      <MobileBottomNav isAdmin={user?.role === "admin"} isAgent={user?.role === "agent"} />
      {/* כפתור וואטסאפ צף – מובייל בלבד, מעל הסרגל התחתון */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="md:hidden fixed z-[38] flex items-center justify-center w-11 h-11 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/25 hover:bg-[#20bd5a] active:scale-95 transition-all duration-200"
        style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 10px)", right: "14px" }}
        aria-label="צור קשר בוואטסאפ"
      >
        <MessageCircle className="w-5 h-5" strokeWidth={2.5} />
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
                  <Route path="/page/:slug" component={CmsPageView} />
                  <Route path="/how-it-works" component={HowItWorks} />
                  <Route path="/points" component={PointsHistory} />
                  <Route path="/notifications" component={NotificationsPage} />
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
