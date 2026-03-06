"use client";

import { useLocation } from "wouter";
import { Home, Trophy, FileText, TrendingUp, Coins, LayoutGrid, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV_BREAKPOINT = 768;

const navItems: { path: string; label: string; icon: React.ElementType }[] = [
  { path: "/", label: "בית", icon: Home },
  { path: "/tournaments", label: "תחרויות", icon: Trophy },
  { path: "/submissions", label: "הטפסים שלי", icon: FileText },
  { path: "/leaderboard", label: "דירוגים", icon: TrendingUp },
  { path: "/points", label: "פרופיל", icon: Coins },
];

export function MobileBottomNav({ isAdmin, isAgent }: { isAdmin: boolean; isAgent?: boolean }) {
  const [location, setLocation] = useLocation();

  const baseItems = [...navItems];
  const withAgent = isAgent ? [...baseItems, { path: "/agent", label: "לוח סוכן", icon: Users }] : baseItems;
  const items = isAdmin ? [...withAgent, { path: "/admin", label: "ניהול", icon: LayoutGrid }] : withAgent;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 border-t border-slate-700/60 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="ניווט ראשי"
    >
      <div className="flex items-center justify-around h-[var(--bottom-nav-height)]">
        {items.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === "/"
              ? location === "/"
              : location === path || (path.length > 1 && location.startsWith(path));
          return (
            <button
              key={path}
              type="button"
              onClick={() => setLocation(path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 px-1 py-2 text-[11px] font-medium transition-all duration-200 rounded-lg min-h-[44px] relative",
                isActive
                  ? "text-amber-400 bg-amber-500/10"
                  : "text-slate-400 hover:text-slate-200 active:bg-slate-800/50"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-amber-400" aria-hidden />
              )}
              <Icon className={cn("w-5 h-5 shrink-0", isActive && "drop-shadow-sm")} strokeWidth={2.5} aria-hidden />
              <span className="truncate w-full text-center leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { MOBILE_NAV_BREAKPOINT };
