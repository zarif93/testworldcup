import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Trophy, Lock, X } from "lucide-react";
import { getTournamentStyles } from "@/lib/tournamentStyles";
import { NearWinBanner } from "@/components/NearWinBanner";
import { RivalStatusBanner } from "@/components/RivalStatusBanner";
import { StreakBanner } from "@/components/StreakBanner";
import { PositionDramaBanner } from "@/components/PositionDramaBanner";
import { LossAversionBanner } from "@/components/LossAversionBanner";
import { SocialProofStrip } from "@/components/SocialProofStrip";
import { ThreeStepsTrustStrip } from "@/components/ThreeStepsTrustStrip";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function getRemainingSeconds(removalScheduledAt: string | Date | number | null | undefined): number {
  if (removalScheduledAt == null) return 0;
  const end = new Date(removalScheduledAt).getTime();
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function formatRemaining(removalScheduledAt: string | Date | null | undefined): string {
  const remaining = getRemainingSeconds(removalScheduledAt);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatRemainingHms(until: string | Date | number | null | undefined): string {
  if (until == null) return "0:00:00";
  const remaining = getRemainingSeconds(until);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** תאריך פתיחה לתצוגה – נפתח: DD/MM/YYYY */
function formatOpenDate(val: string | Date | number | null | undefined): string | null {
  if (val == null) return null;
  let date: Date;
  if (typeof val === "string") {
    if (!val.trim()) return null;
    date = new Date(val.trim() + "T12:00:00");
  } else {
    date = new Date(val);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** מועד סגירת צ'אנס (ms) מתאריך + שעה ישראל */
function getChanceCloseTimestamp(drawDate: string | null | undefined, drawTime: string | null | undefined): number | null {
  if (!drawDate?.trim() || !drawTime?.trim()) return null;
  const date = new Date(drawDate.trim() + "T" + drawTime.trim() + ":00+02:00");
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

/** תאריך+שעה לתצוגה – נפתח/נסגר: DD/MM/YYYY HH:MM (למונדיאל) */
function formatDateTime(val: string | Date | number | null | undefined): string | null {
  if (val == null) return null;
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return null;
  const d = date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const t = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d} ${t}`;
}

/** טיימר עם ימים – ⏳ נסגר בעוד: X ימים HH:MM:SS או HH:MM:SS */
function formatRemainingWithDays(until: string | Date | number | null | undefined): string {
  if (until == null) return "0:00:00";
  const remaining = getRemainingSeconds(until);
  const days = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const timePart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (days > 0) return `${days} ימים ${timePart}`;
  return timePart;
}

/** תצוגת פרס/קופה – "0 פרסים" או "₪X פרס/פרסים" (ללא "סכום הקופה X למובילים") */
function formatPrizeLabel(prizePool: number): string {
  if (prizePool === 0) return "0 פרסים";
  const formatted = prizePool.toLocaleString("he-IL");
  return prizePool === 1 ? `₪${formatted} פרס` : `₪${formatted} פרסים`;
}

const HERO_URGENCY_LINES = [
  "הפרס מחכה למובילים",
  "תחרויות פתוחות – הצטרף כשמוכן",
  "הקופה גדלה עם כל משתתף",
];

function HeroUrgencyLine() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % HERO_URGENCY_LINES.length), 4000);
    return () => clearInterval(id);
  }, []);
  return <>{HERO_URGENCY_LINES[idx]}</>;
}

/** Phase 2: Top 3 leaderboard preview for one tournament – "מי מוביל עכשיו" */
function LeaderboardTopTeaser({
  tournamentId,
  type,
  onGoToLeaderboard,
}: {
  tournamentId: number;
  type: "chance" | "lotto" | "football_custom";
  onGoToLeaderboard: () => void;
}) {
  const { data: chance } = trpc.submissions.getChanceLeaderboard.useQuery(
    { tournamentId },
    { enabled: type === "chance" }
  );
  const { data: lotto } = trpc.submissions.getLottoLeaderboard.useQuery(
    { tournamentId },
    { enabled: type === "lotto" }
  );
  const { data: custom } = trpc.submissions.getCustomFootballLeaderboard.useQuery(
    { tournamentId },
    { enabled: type === "football_custom" }
  );
  const rows = (type === "chance" ? chance?.rows : type === "lotto" ? lotto?.rows : custom?.rows) ?? [];
  const top3 = Array.isArray(rows) ? rows.slice(0, 3) : [];
  if (top3.length === 0) return null;
  const pts = (r: { points?: number }) => r.points ?? 0;
  const gap12 = top3.length >= 2 ? pts(top3[0]) - pts(top3[1]) : null;
  const gap23 = top3.length >= 3 ? pts(top3[1]) - pts(top3[2]) : null;
  const narrowGap = (gap12 != null && gap12 <= 5) || (gap23 != null && gap23 <= 5);
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-right">
      <p className="text-amber-400 font-semibold text-xs mb-1.5">מי מוביל עכשיו</p>
      <ol className="space-y-0.5 text-slate-300 text-xs font-medium">
        {top3.map((row: { username?: string | null; points?: number }, i: number) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="tabular-nums text-amber-400/90">{row.points ?? 0} pts</span>
            <span className="truncate min-w-0">{row.username ?? `#${i + 1}`}</span>
          </li>
        ))}
      </ol>
      {narrowGap && (
        <p className="text-amber-500/90 text-[10px] mt-1 font-medium">הפערים קטנים – המקומות יכולים להשתנות מהר</p>
      )}
      <button
        type="button"
        onClick={onGoToLeaderboard}
        className="mt-2 w-full rounded-lg bg-amber-500/20 border border-amber-500/40 py-1.5 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition"
      >
        צפה בדירוג המלא
      </button>
    </div>
  );
}

/** CMS banner block for homepage placements (promo, secondary, cta). Renders nothing if banner is null. */
type HomepageBannerData = {
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
};

function HomepageBannerBlock({
  banner,
  onCtaClick,
  variant = "default",
  className = "",
}: {
  banner: HomepageBannerData | null;
  onCtaClick: (url: string) => void;
  variant?: "promo" | "secondary" | "cta";
  className?: string;
}) {
  if (!banner) return null;
  const hasContent = (banner.title && banner.title.trim()) || (banner.subtitle && banner.subtitle.trim()) || (banner.buttonText && banner.buttonText.trim());
  if (!hasContent && !banner.imageUrl) return null;
  const imageUrl = banner.imageUrl?.trim() || null;
  const mobileImageUrl = banner.mobileImageUrl?.trim() || null;
  const containerClass =
    variant === "cta"
      ? "rounded-2xl overflow-hidden border border-slate-600/60 bg-slate-800/50"
      : variant === "promo"
        ? "rounded-xl overflow-hidden border border-amber-500/30 bg-slate-800/60"
        : "rounded-xl overflow-hidden border border-slate-600/50 bg-slate-800/40";
  return (
    <div className={`relative ${containerClass} ${className}`}>
      {(imageUrl || mobileImageUrl) && (
        <div className="absolute inset-0 overflow-hidden">
          {mobileImageUrl && <img src={mobileImageUrl} alt="" className="w-full h-full object-cover opacity-40 md:hidden" />}
          {imageUrl && <img src={imageUrl} alt="" className={`w-full h-full object-cover opacity-40 ${mobileImageUrl ? "hidden md:block" : ""}`} />}
        </div>
      )}
      <div className="relative z-10 px-4 py-4 sm:px-6 sm:py-5 text-center">
        {banner.title?.trim() && (
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1 break-words">{banner.title.trim()}</h3>
        )}
        {banner.subtitle?.trim() && (
          <p className="text-slate-300 text-sm sm:text-base mb-3 break-words">{banner.subtitle.trim()}</p>
        )}
        {banner.buttonText?.trim() && banner.buttonUrl?.trim() && (
          <Button
            size="lg"
            className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl"
            onClick={() => onCtaClick(banner.buttonUrl!.trim())}
          >
            {banner.buttonText.trim()}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Homepage block from CMS sections (global blocks). Renders by type; supports internal nav via onNavigate. */
type HomepageSection = { id: number; key: string; type: string; title: string | null; subtitle: string | null; body: string | null; imageUrl: string | null; buttonText: string | null; buttonUrl: string | null; sortOrder: number };

function HomepageSectionBlock({ section, onNavigate }: { section: HomepageSection; onNavigate: (url: string) => void }) {
  const { type, title, subtitle, body, imageUrl, buttonText, buttonUrl } = section;
  const cardClass = "rounded-xl bg-slate-800/80 border border-slate-600/80 p-5 md:p-6 shadow-sm";

  const handleAction = () => {
    if (!buttonUrl?.trim()) return;
    if (buttonUrl.startsWith("http")) window.location.href = buttonUrl; else onNavigate(buttonUrl);
  };

  if (type === "hero") {
    return (
      <div className={`${cardClass} text-center`}>
        {imageUrl && <img src={imageUrl} alt={title ?? ""} className="mx-auto rounded-lg max-h-40 object-cover mb-4" />}
        {title && <h3 className="text-lg font-bold text-white mb-1">{title}</h3>}
        {subtitle && <p className="text-slate-400 text-sm mb-3">{subtitle}</p>}
        {body && <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{body}</p>}
        {buttonText?.trim() && buttonUrl?.trim() && <Button type="button" className="mt-4 bg-amber-500 hover:bg-amber-600" onClick={handleAction}>{buttonText}</Button>}
      </div>
    );
  }
  if (type === "cta") {
    return (
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-5 md:p-6 text-center">
        {title && <h3 className="text-lg font-bold text-white mb-1">{title}</h3>}
        {subtitle && <p className="text-slate-400 text-sm mb-2">{subtitle}</p>}
        {body && <p className="text-slate-300 text-sm mb-3">{body}</p>}
        {buttonText?.trim() && buttonUrl?.trim() && <Button type="button" className="bg-amber-600 hover:bg-amber-700" onClick={handleAction}>{buttonText}</Button>}
      </div>
    );
  }
  if (type === "features" || type === "cards") {
    const items = body ? body.split("\n").filter(Boolean) : [];
    return (
      <div className={cardClass}>
        {title && <h3 className="text-lg font-bold text-white mb-2">{title}</h3>}
        {subtitle && <p className="text-slate-400 text-sm mb-3">{subtitle}</p>}
        <ul className="space-y-2">
          {items.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
              <span className="text-amber-400 shrink-0">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (type === "links") {
    const items = body ? body.split("\n").filter(Boolean) : [];
    return (
      <div className={cardClass}>
        {title && <h3 className="text-lg font-bold text-white mb-2">{title}</h3>}
        <ul className="space-y-2">
          {items.map((line, i) => {
            const [label, url] = line.includes("|") ? line.split("|").map((s) => s.trim()) : [line, ""];
            return (
              <li key={i}>
                {url ? (
                  <a href={url} className="text-amber-400 hover:text-amber-300 text-sm" target="_blank" rel="noopener noreferrer">{label}</a>
                ) : (
                  <span className="text-slate-400 text-sm">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  if (type === "html") {
    return (
      <div className={cardClass}>
        {title && <h3 className="text-lg font-bold text-white mb-2">{title}</h3>}
        {body && <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{body}</p>}
      </div>
    );
  }
  // text, banner, default
  return (
    <div className={cardClass}>
      {imageUrl && <img src={imageUrl} alt={title ?? ""} className="w-full rounded-lg max-h-32 object-cover mb-3" />}
      {title && <h3 className="text-lg font-bold text-white mb-1">{title}</h3>}
      {subtitle && <p className="text-slate-400 text-sm mb-2">{subtitle}</p>}
      {body && <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{body}</p>}
      {buttonText?.trim() && buttonUrl?.trim() && <Button type="button" size="sm" className="mt-3 bg-amber-500 hover:bg-amber-600" onClick={handleAction}>{buttonText}</Button>}
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const justSubmitted = searchParams?.get("submitted") === "1";
  const now = useNow(1000);
  const [hideConfirmId, setHideConfirmId] = useState<number | null>(null);
  const { data: tournamentStats, isLoading, refetch, dataUpdatedAt } = trpc.tournaments.getPublicStats.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const isDataFresh = dataUpdatedAt != null && Date.now() - dataUpdatedAt < 20000;
  const { data: firstParticipation } = trpc.user.getFirstParticipationStatus.useQuery(undefined, { enabled: isAuthenticated });
  const { data: mySummary } = trpc.user.getMyCompetitionSummary.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60_000 });
  const { data: recommendation } = trpc.tournaments.getRecommendedTournamentForUser.useQuery(undefined, {
    enabled: isAuthenticated && !!(tournamentStats?.length),
    staleTime: 45_000,
  });
  const { data: cmsBanners } = trpc.cms.getActiveBanners.useQuery({ key: "homepage_hero" });
  const { data: cmsBannersPromo } = trpc.cms.getActiveBanners.useQuery({ key: "homepage_promo" });
  const { data: cmsBannersSecondary } = trpc.cms.getActiveBanners.useQuery({ key: "homepage_secondary" });
  const { data: cmsBannersCta } = trpc.cms.getActiveBanners.useQuery({ key: "homepage_cta" });
  const { data: homepageFeaturesBlocks } = trpc.cms.getActiveHomepageSections.useQuery({ key: "homepage_features" });
  const { data: homepageSecondaryBlocks } = trpc.cms.getActiveHomepageSections.useQuery({ key: "homepage_secondary" });
  const { data: homepageCtaBlocks } = trpc.cms.getActiveHomepageSections.useQuery({ key: "homepage_cta" });
  const { data: cmsAnnouncements } = trpc.cms.getActiveAnnouncements.useQuery();
  const { data: siteSettings } = trpc.settings.getPublic.useQuery();
  const heroBanner = (cmsBanners && cmsBanners.length > 0) ? cmsBanners[0] : null;
  const promoBanner = (cmsBannersPromo && cmsBannersPromo.length > 0) ? cmsBannersPromo[0] : null;
  const secondaryBanner = (cmsBannersSecondary && cmsBannersSecondary.length > 0) ? cmsBannersSecondary[0] : null;
  const ctaBanner = (cmsBannersCta && cmsBannersCta.length > 0) ? cmsBannersCta[0] : null;
  const featuresBlocks = homepageFeaturesBlocks ?? [];
  const secondaryBlocks = homepageSecondaryBlocks ?? [];
  const ctaBlocks = homepageCtaBlocks ?? [];
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && cmsBanners !== undefined) {
      console.log("[Home] cms.getActiveBanners(homepage_hero) returned", cmsBanners.length, "banner(s)", cmsBanners.length > 0 ? cmsBanners[0] : null);
    }
  }, [cmsBanners]);
  const announcement = (cmsAnnouncements && cmsAnnouncements.length > 0) ? cmsAnnouncements[0] : null;
  const ctaPrimaryText = (siteSettings?.["cta.primary_text"] ?? "").trim();
  const ctaPrimaryUrl = (siteSettings?.["cta.primary_url"] ?? "").trim();
  const siteName = (siteSettings?.["brand.site_name"] ?? "").trim();
  const tagline = (siteSettings?.["brand.tagline"] ?? "").trim();
  const hideMutation = trpc.admin.hideTournamentFromHomepage.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("התחרות הוסרה מהמסך הראשי");
      setHideConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const removedIdsRef = useRef<Set<number>>(new Set());
  const isAdmin = user?.role === "admin";
  const canShowHide = (status: string | undefined) =>
    isAdmin && status && ["OPEN", "LOCKED", "CLOSED", "SETTLED"].includes(status);

  useEffect(() => {
    if (!tournamentStats?.length) return;
    const toRemove: number[] = [];
    for (const t of tournamentStats) {
      const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
      if (removalAt && getRemainingSeconds(removalAt) <= 0 && !removedIdsRef.current.has(t.id)) toRemove.push(t.id);
    }
    if (toRemove.length > 0) {
      toRemove.forEach((id) => removedIdsRef.current.add(id));
      refetch();
    }
  }, [tournamentStats, now, refetch]);
  type Stats = typeof tournamentStats;
  const byType: { football: Stats; lotto: Stats; chance: Stats; footballCustom: Stats; custom: Stats } = (() => {
    if (!tournamentStats?.length) return { football: [], lotto: [], chance: [], footballCustom: [], custom: [] };
    const football = tournamentStats.filter((t) => (t.type ?? "football") === "football").sort((a, b) => a.amount - b.amount);
    const lotto = tournamentStats.filter((t) => t.type === "lotto").sort((a, b) => a.amount - b.amount);
    const chance = tournamentStats.filter((t) => t.type === "chance").sort((a, b) => a.amount - b.amount);
    const footballCustom = tournamentStats.filter((t) => t.type === "football_custom").sort((a, b) => a.amount - b.amount);
    const custom = tournamentStats.filter((t) => t.type === "custom").sort((a, b) => a.amount - b.amount);
    return { football, lotto, chance, footballCustom, custom };
  })();
  const hasAny = (byType.football?.length ?? 0) > 0 || (byType.lotto?.length ?? 0) > 0 || (byType.chance?.length ?? 0) > 0 || (byType.footballCustom?.length ?? 0) > 0 || (byType.custom?.length ?? 0) > 0;

  const allTournamentsList = (() => {
    if (!tournamentStats?.length) return [];
    const football = (byType.football ?? []).map((t) => ({ ...t, _type: "football" as const }));
    const lotto = (byType.lotto ?? []).map((t) => ({ ...t, _type: "lotto" as const }));
    const chance = (byType.chance ?? []).map((t) => ({ ...t, _type: "chance" as const }));
    const footballCustom = (byType.footballCustom ?? []).map((t) => ({ ...t, _type: "football_custom" as const }));
    const custom = (byType.custom ?? []).map((t) => ({ ...t, _type: "custom" as const }));
    return [...football, ...lotto, ...chance, ...footballCustom, ...custom];
  })();
  const typeLabel: Record<string, string> = { football: "מונדיאל", lotto: "לוטו", chance: "צ'אנס", football_custom: "תחרויות ספורט", custom: "מותאם" };
  /** Phase 36/38: Recommended tournament – API when authenticated, else first OPEN in list. */
  const recommendedTournament = allTournamentsList.find((t) => (t as { status?: string }).status === "OPEN") ?? allTournamentsList[0];
  const _recommendedId = recommendation?.tournamentId ?? recommendedTournament?.id;
  const _recommendedDisplayName = recommendation
    ? (recommendation.name?.trim() || `${typeLabel[recommendation.type ?? "football"]} ₪${recommendation.amount ?? 0}`)
    : recommendedTournament
      ? getTournamentDisplayName(recommendedTournament, recommendedTournament._type)
      : "";
  const recommendedMessage = recommendation?.message ?? null;
  const tournamentIdFromUrl = searchParams?.get("tournamentId");
  const tidParsed = tournamentIdFromUrl ? parseInt(tournamentIdFromUrl, 10) : null;
  const nearWinTournamentId = (tidParsed != null && Number.isFinite(tidParsed) ? tidParsed : null) ?? (hasAny && allTournamentsList[0] ? allTournamentsList[0].id : null);

  /** שם לתצוגה: אם השם ריק או נראה כמו תאריך/נתונים שבורים – מציגים "סוג תחרות ₪סכום" */
  function getTournamentDisplayName(
    t: { name?: string | null; amount?: number; type?: string },
    typeKey: "football" | "lotto" | "chance" | "football_custom" | "custom"
  ): string {
    const name = (t.name ?? "").trim();
    const label = typeLabel[typeKey] ?? typeLabel[t.type ?? "football"] ?? "תחרות";
    const amount = t.amount ?? 0;
    if (!name) return `${label} ₪${amount}`;
    if (name.length < 2) return `${label} ₪${amount}`;
    if (/^[\d\s/.\-–—]+$/i.test(name)) return `${label} ₪${amount}`;
    if (/^\d+\.?\d*\s*[xX]?$/i.test(name)) return `${label} ₪${amount}`;
    return name;
  }

  /** תאריך ושעת הגרלה לפורמט קריא – רק אם התאריך תקין */
  function formatDrawLabelSafe(drawDate: string | null | undefined, drawTime: string | null | undefined): string | null {
    if (!drawDate?.trim() || !drawTime?.trim()) return null;
    const date = new Date(drawDate.trim() + "T12:00:00");
    if (Number.isNaN(date.getTime())) return null;
    const formatted = date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${formatted} – ${drawTime.trim()}`;
  }

  const dismissSubmittedBanner = () => {
    setLocation("/");
    window.history.replaceState(null, "", "/");
  };

  const shareUrl = typeof window !== "undefined" ? window.location.origin + "/" : "";

  /** Open tournaments for the single yellow promo block – real data only, used for rotation. */
  const openTournamentsForPromo = (() => {
    if (!allTournamentsList.length) return [];
    return allTournamentsList
      .filter((t) => (t as { status?: string }).status === "OPEN" && !(t as { isLocked?: boolean }).isLocked)
      .map((t) => ({ id: t.id, displayName: getTournamentDisplayName(t, t._type) }));
  })();

  /** Phase 7: Live presence – open list and derived stats (real data only, no extra queries). */
  const openList = allTournamentsList.filter((t) => (t as { status?: string }).status === "OPEN" && !(t as { isLocked?: boolean }).isLocked);
  const getCloseTs = (t: (typeof allTournamentsList)[0]): number | null => {
    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
    const drawDate = (t as { drawDate?: string | null }).drawDate;
    const drawTime = (t as { drawTime?: string | null }).drawTime;
    if (t._type === "chance") return getChanceCloseTimestamp(drawDate, drawTime);
    if (t._type === "lotto" && closesAt != null) return new Date(closesAt).getTime();
    if (closesAt != null) return new Date(closesAt).getTime();
    return null;
  };
  const totalActiveParticipants = openList.reduce((sum, t) => sum + (t.participants ?? 0), 0);
  const closingSoonestTournament = (() => {
    let best: { id: number; displayName: string; closeTs: number } | null = null;
    for (const t of openList) {
      const ts = getCloseTs(t);
      if (ts == null || ts <= Date.now()) continue;
      if (best == null || ts < best.closeTs) best = { id: t.id, displayName: getTournamentDisplayName(t, t._type), closeTs: ts };
    }
    return best;
  })();
  const [promoIndex, setPromoIndex] = useState(0);
  useEffect(() => {
    if (openTournamentsForPromo.length <= 1) return;
    const id = setInterval(() => setPromoIndex((i) => (i + 1) % openTournamentsForPromo.length), 4500);
    return () => clearInterval(id);
  }, [openTournamentsForPromo.length]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Phase 33: Shareable moment – after submit success */}
      {justSubmitted && (
        <div className="bg-emerald-600/90 border-b border-emerald-500/50 text-white py-3 px-4 flex flex-wrap items-center justify-center gap-3">
          <span className="font-bold">ההשתתפות נספרה!</span>
          <span className="text-emerald-100 text-sm">עכשיו אתה במשחק – צפה בדירוג או השתתף בתחרות נוספת.</span>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 border-0 text-white h-8 rounded-lg min-h-[44px] touch-target" onClick={() => setLocation("/leaderboard?justSubmitted=1")}>
              צפה בדירוג
            </Button>
            <Button size="sm" className="bg-white/20 hover:bg-white/30 border-0 text-white h-8 rounded-lg min-h-[44px] touch-target" onClick={() => setLocation("/tournaments")}>
              השתתף בתחרות נוספת
            </Button>
            <Button
              size="sm"
              className="bg-white/20 hover:bg-white/30 border-0 text-white h-8 rounded-lg min-h-[44px] touch-target"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast.success("הקישור הועתק להדבקה");
              }}
            >
              שתף קישור
            </Button>
            <button type="button" className="text-white/80 hover:text-white text-sm underline min-h-[44px] px-2 touch-target" onClick={dismissSubmittedBanner} aria-label="סגור">
              סגור
            </button>
          </div>
        </div>
      )}

      {isAuthenticated && nearWinTournamentId != null && (
        <>
          <NearWinBanner tournamentId={nearWinTournamentId} />
          <RivalStatusBanner tournamentId={nearWinTournamentId} className="mt-2" />
          <StreakBanner className="mt-2" />
          <PositionDramaBanner tournamentId={nearWinTournamentId} className="mt-2" />
          <LossAversionBanner tournamentId={nearWinTournamentId} className="mt-2" />
        </>
      )}
      {isAuthenticated && (nearWinTournamentId == null) && <StreakBanner />}

      {/* Phase 11: Announcement strip from CMS – fail-safe: only render if we have data */}
      {announcement && (
        <div className={`text-center py-2 px-3 text-sm border-b ${
          announcement.variant === "warning" ? "bg-amber-500/20 border-amber-500/50 text-amber-200" :
          announcement.variant === "success" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200" :
          announcement.variant === "neutral" ? "bg-slate-700/50 border-slate-600 text-slate-200" :
          "bg-sky-500/20 border-sky-500/50 text-sky-200"
        }`}>
          <span className="font-medium">{announcement.title}</span>
          {announcement.body && <span className="mr-2"> – {announcement.body}</span>}
        </div>
      )}

      {/* Hero – live state, one primary CTA, then hot/personal/list (Phase 8: conversion polish) */}
      <section className="relative container mx-auto px-3 sm:px-4 pt-5 pb-2 md:pt-8 md:pb-4 text-center overflow-x-hidden max-w-full">
        {heroBanner?.imageUrl && (
          <div className="absolute inset-0 overflow-hidden rounded-xl mx-auto max-w-5xl">
            <img src={heroBanner.imageUrl} alt="" className="w-full h-full object-cover opacity-30" />
          </div>
        )}
        <div className="animate-fade-in min-w-0 relative z-10">
          <div className="inline-flex items-center justify-center w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-500/25 to-emerald-600/25 border border-amber-500/40 mb-2 md:mb-3 shadow-lg">
            <Trophy className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 text-amber-400 drop-shadow" />
          </div>
          <h1 className="text-xl xs:text-2xl min-[375px]:text-3xl sm:text-4xl md:text-5xl font-black text-white mb-1 md:mb-2 tracking-tight drop-shadow-sm px-1 break-words">
            {heroBanner?.title?.trim() || siteName || "WinMondial"}
          </h1>
          <p className="text-sm xs:text-base sm:text-lg text-emerald-200/95 mb-1 max-w-2xl mx-auto font-semibold break-words">
            {heroBanner?.subtitle?.trim() || tagline || "תחרות ניחושי המונדיאל – פרסים ודירוג חי"}
          </p>
          <p className="text-slate-400 text-xs sm:text-sm mb-2 md:mb-3 max-w-xl mx-auto px-1 break-words">
            {(heroBanner as { body?: string | null } | undefined)?.body?.trim() || (!heroBanner ? "הצטרף לתחרות – תתחרה על פרסים ודירוג. מונדיאל, לוטו, צ'אנס ותחרויות ספורט." : "")}
          </p>
          {/* One compact live line: open count + participants + closing soonest */}
          {!isLoading && hasAny && openList.length > 0 && (
            <p className="text-slate-400 text-xs sm:text-sm mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
              <span className="flex items-center gap-1.5 text-emerald-400/95 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                {openList.length} תחרויות פתוחות
              </span>
              {totalActiveParticipants > 0 && (
                <span className="tabular-nums text-slate-300">{totalActiveParticipants.toLocaleString("he-IL")} משתתפים פעילים</span>
              )}
              {closingSoonestTournament && (
                <>
                  <span className="text-slate-500">·</span>
                  <button
                    type="button"
                    onClick={() => setLocation(`/predict/${closingSoonestTournament.id}`)}
                    className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-1"
                  >
                    נסגרת הכי בקרוב: {closingSoonestTournament.displayName}
                  </button>
                </>
              )}
            </p>
          )}
        </div>

        {/* Primary CTA – single clear join action */}
        {!isLoading && (hasAny || heroBanner?.buttonUrl || ctaPrimaryUrl) && (
          <div className="animate-slide-up mb-3 md:mb-4 relative z-10">
            <Button
              size="lg"
              className="w-full max-w-xs sm:w-auto min-h-[44px] sm:min-h-[48px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-base sm:text-lg px-5 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 btn-sport touch-target"
              onClick={() => {
                const url = heroBanner?.buttonUrl?.trim() || (ctaPrimaryUrl && ctaPrimaryUrl.startsWith("/") ? ctaPrimaryUrl : "");
                setLocation(url || "/tournaments");
              }}
            >
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 ml-2 text-amber-300 shrink-0" />
              {heroBanner?.buttonText?.trim() || ctaPrimaryText || "הצטרף לתחרות – הזדמנות לנצח"}
            </Button>
            {hasAny && (
              <>
                <p className="text-amber-200/90 text-xs sm:text-sm font-medium mt-1.5 md:mt-2 animate-fade-in">
                  <HeroUrgencyLine />
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  <button type="button" onClick={() => setLocation("/tournaments")} className="text-slate-400 hover:text-slate-300 font-medium underline underline-offset-1">כל התחרויות</button>
                  {" · "}
                  <button type="button" onClick={() => setLocation("/leaderboard")} className="text-slate-500 hover:text-slate-400 font-medium underline underline-offset-1">דירוג</button>
                </p>
              </>
            )}
            {/* Yellow promo – secondary CTA for logged-in users (rotating tournament) */}
            {!isLoading && isAuthenticated && hasAny && openTournamentsForPromo.length > 0 && (
              <div className="max-w-2xl mx-auto mt-3 mb-3 px-2 py-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center">
                <p className="text-amber-200 font-medium text-sm mb-2">
                  {firstParticipation && !firstParticipation.hasApprovedSubmission
                    ? (recommendedMessage || "זו ההזדמנות שלך – בחר תחרות והצטרף תוך דקה.")
                    : "נסגרת בקרוב – כדאי להצטרף עכשיו"}
                </p>
                <Button
                  size="lg"
                  className="min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold text-sm touch-target"
                  onClick={() => setLocation(`/predict/${openTournamentsForPromo[promoIndex].id}`)}
                >
                  <Trophy className="w-4 h-4 ml-2 shrink-0" />
                  <span key={openTournamentsForPromo[promoIndex].id} className="animate-fade-in">
                    הצטרף לתחרות – {openTournamentsForPromo[promoIndex].displayName}
                  </span>
                </Button>
                <p className="text-slate-500 text-[11px] mt-1.5">
                  <button type="button" onClick={() => setLocation("/tournaments")} className="text-amber-400/90 hover:text-amber-400 underline">בחר תחרות אחרת</button>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Personal area – rank, chase, pressure (logged-in only) */}
        {isAuthenticated && mySummary && (
          <div className="max-w-2xl mx-auto px-2 mb-3 md:mb-4">
            <div className="rounded-xl border border-slate-600/60 bg-slate-800/50 px-3 py-2.5 text-right">
              <p className="text-amber-400 font-bold text-sm mb-1.5">אזור התחרות שלי</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300 text-xs sm:text-sm">
                <span className="font-medium">אני בתחרות ב־{mySummary.activeCount} מקומות</span>
                {mySummary.bestRank != null && (
                  <span className="text-emerald-400/95 font-semibold">מקום {mySummary.bestRank} בדירוג</span>
                )}
                {mySummary.totalPoints > 0 && (
                  <span className="tabular-nums">{mySummary.totalPoints} נקודות שלי</span>
                )}
              </div>
              {mySummary.rankChange != null && mySummary.rankChange !== 0 && (
                <p className={`text-xs font-semibold mt-1.5 ${mySummary.rankChange > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {mySummary.rankChange > 0 ? "עלית מקום" : "ירדת מקום"}
                </p>
              )}
              {/* Ranking context – real data only, one line when relevant */}
              {(mySummary as { playerAbove?: { username: string; pointsDiff: number } | null }).playerAbove && (
                <p className="text-slate-400 text-xs mt-1">
                  מקדים אותך: {(mySummary as { playerAbove: { username: string; pointsDiff: number } }).playerAbove.username} ({(mySummary as { playerAbove: { pointsDiff: number } }).playerAbove.pointsDiff} נק׳)
                </p>
              )}
              {(mySummary as { playerBelow?: { username: string; pointsDiff: number } | null }).playerBelow && (
                <p className="text-slate-400 text-xs mt-0.5">
                  מאחוריך: {(mySummary as { playerBelow: { username: string; pointsDiff: number } }).playerBelow.username} ({(mySummary as { playerBelow: { pointsDiff: number } }).playerBelow.pointsDiff} נק׳)
                </p>
              )}
              {(mySummary as { someoneCloseBehind?: boolean }).someoneCloseBehind && (
                <p className="text-amber-400 text-xs font-medium mt-1">מישהו צמוד אליך – שמור על המקום</p>
              )}
              {(mySummary as { closeToNextRank?: boolean }).closeToNextRank && (
                <p className="text-emerald-400 text-xs font-medium mt-0.5">אפשר לעקוף את המקום הבא</p>
              )}
              {mySummary.nextTargetLabel != null && mySummary.bestRank != null && (
                <p className="text-slate-400 text-xs mt-1">היעד הבא: {mySummary.nextTargetLabel}</p>
              )}
              {(mySummary.pointsToNextRank != null || mySummary.pointsToTop10 != null) && (
                <p className="text-slate-400 text-xs mt-1">
                  {mySummary.pointsToTop10 != null && mySummary.bestRank != null && mySummary.bestRank > 10 && (
                    <span>עוד {mySummary.pointsToTop10} נקודות לטופ 10</span>
                  )}
                  {mySummary.pointsToNextRank != null && (mySummary.pointsToTop10 == null || mySummary.bestRank == null || mySummary.bestRank <= 10) && (
                    <span>עוד {mySummary.pointsToNextRank} נקודות למקום הבא</span>
                  )}
                </p>
              )}
              {mySummary.bestRank != null && mySummary.nextTargetLabel != null && (
                <div className="mt-2 h-1.5 rounded-full bg-slate-700/80 overflow-hidden" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-emerald-500/80 to-amber-500/60 transition-all duration-300"
                    style={{
                      width: mySummary.bestRank <= 1 ? "100%" : mySummary.bestRank <= 10 ? `${Math.round((1 - (mySummary.bestRank - 1) / 10) * 100)}%` : "0%",
                    }}
                  />
                </div>
              )}
              {mySummary.closingSoonCount > 0 && (
                <p className="text-amber-400 text-xs font-medium mt-2">תחרות שלך נסגרת בקרוב</p>
              )}
              {mySummary.inTop10Any && (
                <p className="text-emerald-400 text-xs font-medium mt-1">אתה בטופ 10</p>
        )}
        </div>
      </div>
        )}

        {/* homepage_promo: promotional banner above tournaments section */}
        {promoBanner && (
          <div className="max-w-4xl mx-auto px-3 mb-6">
            <HomepageBannerBlock
              banner={promoBanner}
              variant="promo"
              onCtaClick={(url) => (url.startsWith("http") ? (window.location.href = url) : setLocation(url))}
            />
          </div>
        )}

        {/* homepage_features: features/benefits blocks above tournaments */}
        {featuresBlocks.length > 0 && (
          <div className="max-w-4xl mx-auto px-3 mb-6 space-y-4">
            {featuresBlocks.map((block) => (
              <HomepageSectionBlock key={block.id} section={block} onNavigate={setLocation} />
            ))}
          </div>
        )}

        {/* כרטיסי טורניר – שורה לכל סוג */}
        {isLoading ? (
          <div className="space-y-12 max-w-5xl mx-auto mb-20">
            <div>
              <Skeleton className="h-6 w-48 mx-auto mb-4 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl bg-slate-700/50" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-32 mx-auto mb-4 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl bg-slate-700/50" />
                ))}
              </div>
            </div>
          </div>
        ) : !hasAny ? (
          <div className="max-w-xl mx-auto mb-12 p-5 md:p-6 rounded-xl bg-slate-800/50 border border-slate-600/50 text-center">
            <p className="text-slate-300 font-medium mb-1.5">אין תחרויות כרגע</p>
            <p className="text-slate-500 text-sm mb-3">כשיפתחו תחרויות חדשות הן יופיעו כאן.</p>
            <Button variant="outline" onClick={() => setLocation("/tournaments")} className="min-h-[44px] rounded-xl border-slate-500 text-slate-300 hover:bg-slate-700/50">כל התחרויות</Button>
          </div>
        ) : (
          <>
          {/* Mobile: open tournaments grid */}
          <div className="md:hidden max-w-6xl mx-auto mb-4 min-w-0 overflow-hidden px-2">
            {isAuthenticated && mySummary && mySummary.activeCount > 0 && (
              <p className="text-slate-500 text-xs mb-1 px-0.5">התחרויות שלך</p>
            )}
            <h2 className="text-lg font-bold text-white mb-0.5 px-0.5 flex items-center gap-2">
              תחרויות פתוחות
              {isDataFresh && !isLoading && hasAny && (
                <span className="text-emerald-400 text-xs font-normal flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                  פעיל עכשיו
                </span>
              )}
            </h2>
            <p className="text-slate-500 text-xs mb-2 px-0.5">הצטרף לתחרות – הזדמנות לנצח</p>
            {allTournamentsList.some((x) => (x.participants ?? 0) > 0) && (
              <p className="text-emerald-400/90 text-[11px] font-medium mb-1.5 px-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                משתתפים פעילים עכשיו
              </p>
            )}
            <div className="grid grid-cols-2 min-[414px]:grid-cols-3 gap-2.5 sm:gap-3">
              {allTournamentsList.map((t) => {
                const isLocked = t.status === "LOCKED" || t.status === "CLOSED" || t.isLocked;
                const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                const drawDate = (t as { drawDate?: string | null }).drawDate;
                const drawTime = (t as { drawTime?: string | null }).drawTime;
                const openDateStr = formatOpenDate(t._type === "chance" || t._type === "lotto" ? drawDate : (t as { opensAt?: Date | number | null }).opensAt);
                const closeTimeStr = drawTime?.trim() || (closesAt != null ? new Date(closesAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null);
                const openDateTimeStr = t._type === "football" && (t as { opensAt?: Date | number | null }).opensAt != null ? formatDateTime((t as { opensAt?: Date | number }).opensAt) : null;
                const closeDateTimeStr = t._type === "football" && closesAt != null ? formatDateTime(closesAt) : null;
                const closeTimestamp = t._type === "chance" ? getChanceCloseTimestamp(drawDate, drawTime) : t._type === "lotto" ? (closesAt != null ? new Date(closesAt).getTime() : null) : closesAt != null ? new Date(closesAt).getTime() : null;
                const remainingSecClose = closeTimestamp != null ? Math.max(0, Math.floor((closeTimestamp - Date.now()) / 1000)) : 0;
                const timerStr = !isLocked && closeTimestamp != null && remainingSecClose > 0 ? (t._type === "football" ? formatRemainingWithDays(closeTimestamp) : formatRemainingHms(closeTimestamp)) : null;
                const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                const _drawCountdown = t._type === "lotto" && !isLocked && closesAt != null ? formatRemainingHms(closesAt) : null;
                const remainingSec = closesAt != null && !isLocked ? getRemainingSeconds(closesAt) : null;
                const closingSoon = remainingSec != null && remainingSec > 0 && remainingSec < 3600;
                const popular = (t.participants ?? 0) >= 15;
                const showHide = canShowHide(t.status);
                const lessThanHour = remainingSecClose > 0 && remainingSecClose < 3600;
                const remainingMinutes = closeTimestamp != null && remainingSecClose > 0 ? Math.ceil(remainingSecClose / 60) : 0;
                const cardBorder = closingSoon ? "border-amber-500/60" : popular ? "border-emerald-500/40" : "border-slate-600/50";
                const cardLive = !isLocked && (closingSoon ? "card-tournament-closing" : "card-tournament-live");
                const bannerUrl = (t as { bannerUrl?: string | null }).bannerUrl;
                const maxParticipants = (t as { maxParticipants?: number | null }).maxParticipants;
                const spotsLeft = maxParticipants != null && maxParticipants > 0 ? Math.max(0, maxParticipants - (t.participants ?? 0)) : null;
                const prizeGrowing = !isLocked && (t.participants ?? 0) > 0;
                const highPrize = (t.prizePool ?? 0) >= 5000;
                const highParticipation = (t.participants ?? 0) >= 20;
                const cardExtraClass = highPrize ? "card-prize-high" : highParticipation ? "card-participation-high" : "";
                const isParticipating = isAuthenticated && mySummary?.participatedTournamentIds?.includes(t.id);
                const rankPressure = (mySummary as { rankPressureByTournament?: Array<{ tournamentId: number; closeToOvertake: boolean; someoneCloseBehind: boolean }> } | undefined)?.rankPressureByTournament?.find((p) => p.tournamentId === t.id);
                return (
                  <div key={t.id} className={`relative overflow-hidden min-w-0 transition-all duration-200 active:scale-[0.99] border-2 rounded-xl ${cardBorder} ${cardLive} card-tournament-premium ${cardExtraClass}`}>
                    {!isLocked && (closingSoon || lessThanHour) && <div className="absolute top-0 left-0 right-0 z-[2] tournament-card-urgency-bar" aria-hidden />}
                    {bannerUrl && (
                      <div className="w-full h-12 shrink-0 bg-slate-700/80 overflow-hidden">
                        <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {showHide && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                        className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white min-h-[36px] min-w-[36px] shadow"
                        aria-label="הסתר מדף ראשי"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {/* Category badge top-right; optional status badge below it or left */}
                    <span className="absolute right-1.5 top-1.5 z-[1] text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-700/95 text-slate-300 border border-slate-600/60 shadow-sm whitespace-nowrap">
                      {typeLabel[t._type] ?? "תחרות"}
                    </span>
                    {(closingSoon || popular) && (
                      <span className={`absolute right-1.5 top-5 z-[1] text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${closingSoon ? "bg-amber-500/95 text-slate-900" : "bg-emerald-500/90 text-white"}`}>
                        {closingSoon ? "נסגר בקרוב" : "פופולרי"}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                      className={`w-full text-right flex flex-col items-stretch min-w-0 min-h-[44px] ${isLocked ? "opacity-90 cursor-not-allowed" : "active:scale-[0.98]"}`}
                      aria-label={isLocked ? `סגור – ${getTournamentDisplayName(t, t._type)}` : `השתתף – ${getTournamentDisplayName(t, t._type)}`}
                    >
                      <div className="pt-9 pb-2 px-2.5 flex flex-col gap-1">
                        <p className="text-white font-bold text-xs leading-tight line-clamp-2 break-words">{getTournamentDisplayName(t, t._type)}</p>
                        <p className="text-emerald-400 font-black text-base leading-tight tabular-nums">{(t.prizePool ?? 0) === 0 ? formatPrizeLabel(0) : `₪${(t.prizePool ?? 0).toLocaleString("he-IL")} ${t.amount === 0 && (t.prizePool ?? 0) > 0 ? "פרס מובטח" : "פרס"}`}</p>
                        {prizeGrowing && <p className="text-emerald-400/90 text-[10px] font-semibold">הקופה גדלה</p>}
                        <p className="text-amber-400/95 font-semibold text-[11px]">{t.amount === 0 ? "חינם" : `₪${t.amount}`}</p>
                        <p className="text-slate-500 text-[10px] leading-tight">{(t.participants ?? 0)} משתתפים</p>
                        {spotsLeft != null && spotsLeft > 0 && <p className="text-amber-400 text-[10px] font-semibold">נשארו {spotsLeft} מקומות</p>}
                        {!isLocked && timerStr != null && (
                          remainingMinutes <= 60 && remainingMinutes > 0 ? (
                            <p className={`text-sm font-mono font-bold tabular-nums ${lessThanHour ? "countdown-urgent is-less-than-hour" : "text-amber-400"}`}>נסגר בעוד {remainingMinutes} דקות</p>
                          ) : (
                            <p className={`text-xs font-mono font-semibold tabular-nums ${lessThanHour ? "countdown-urgent is-less-than-hour" : "text-amber-400/90"}`}>⏳ נסגר בעוד {timerStr}</p>
                          )
                        )}
                        <div className="flex flex-wrap gap-x-1.5 gap-y-0 text-[9px] text-slate-500 leading-tight">
                          {openDateStr && !openDateTimeStr && <span>נפתח: {openDateStr}</span>}
                          {openDateTimeStr && <span>נפתח: {openDateTimeStr}</span>}
                          {closeTimeStr && !closeDateTimeStr && <span>נסגר: {closeTimeStr}</span>}
                          {closeDateTimeStr && <span>נסגר: {closeDateTimeStr}</span>}
                        </div>
                        {isLocked && countdown != null && (
                          <p className="text-red-400 text-[9px] font-mono flex items-center gap-0.5"><Lock className="w-2.5 h-2.5 shrink-0" /> {countdown}</p>
                        )}
                        {isParticipating && !isLocked && (
                          <p className="text-emerald-400/90 text-[10px] font-medium mt-0.5">
                            {rankPressure?.closeToOvertake ? "אפשר לעקוף מקום" : rankPressure?.someoneCloseBehind ? "שמור על המקום" : "אפשר לשפר מיקום"}
                          </p>
                        )}
                      </div>
                      <span className={`btn-tournament-cta shrink-0 mx-2 mb-2 py-2 flex items-center justify-center text-xs font-bold ${isLocked ? "bg-slate-600/80 text-slate-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
                        {isLocked ? "סגור" : "הצטרף לתחרות"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <TooltipProvider>
          <div className="hidden md:block max-w-6xl mx-auto px-1 mb-6">
            {isAuthenticated && mySummary && mySummary.activeCount > 0 && (
              <p className="text-slate-500 text-sm mb-1">התחרויות שלך</p>
            )}
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              תחרויות פתוחות עכשיו
              {isDataFresh && !isLoading && hasAny && (
                <span className="text-emerald-400 text-xs font-normal flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                  פעיל עכשיו
                </span>
              )}
            </h2>
            <p className="text-slate-500 text-sm mb-4">הצטרף לתחרות – תתחרה על פרסים ודירוג חי</p>
          </div>
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto mb-6 min-w-0 overflow-hidden px-1">
            {/* טור 1: מונדיאל */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-3 text-center break-words">מונדיאל – ניחושי משחקים</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.football ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                    const opensAt = (t as { opensAt?: Date | number | null }).opensAt;
                    const openDateStr = formatOpenDate(opensAt);
                    const closeTimeStr = closesAt != null ? new Date(closesAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null;
                    const openDateTimeStr = opensAt != null ? formatDateTime(opensAt) : null;
                    const closeDateTimeStr = closesAt != null ? formatDateTime(closesAt) : null;
                    const timerStr = !isLocked && closesAt != null && new Date(closesAt).getTime() > Date.now() ? formatRemainingWithDays(closesAt) : null;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    const remainingSecF = closesAt != null && !isLocked ? Math.max(0, Math.floor((new Date(closesAt).getTime() - Date.now()) / 1000)) : 0;
                    const closingSoonF = remainingSecF > 0 && remainingSecF < 3600;
                    const lessThanHourF = remainingSecF > 0 && remainingSecF < 3600;
                    const cardLiveF = !isLocked && (closingSoonF ? "card-tournament-closing" : "card-tournament-live");
                    return (
                      <div key={t.id} className={`relative group min-w-0 ${cardLiveF}`}>
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 px-4 py-5 text-center min-w-0 min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center rounded-2xl overflow-hidden w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 shrink-0 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg break-words min-w-0 leading-tight">{getTournamentDisplayName(t, "football")}</p>
                        {openDateTimeStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateTimeStr}</p>}
                        {!openDateTimeStr && openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {closeDateTimeStr && <p className="text-slate-400 text-xs">נסגר: {closeDateTimeStr}</p>}
                        {!closeDateTimeStr && closeTimeStr && <p className="text-slate-400 text-xs">נסגר: {closeTimeStr}</p>}
                        {timerStr != null && <p className={`text-sm font-mono mt-0.5 ${lessThanHourF ? "countdown-urgent is-less-than-hour" : "text-amber-400/90"}`}>⏳ נסגר בעוד: {timerStr}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1 break-words">
                              <Lock className="w-4 h-4 shrink-0" /> התחרות ננעלה
                            </p>
                            <p className="text-red-300 font-black text-lg mt-1 break-words">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-emerald-400 font-black text-lg mt-1.5 break-words leading-tight">{formatPrizeLabel(t.prizePool ?? 0)}</p>
                            <p className="text-amber-400/95 text-sm font-semibold mt-0.5">{t.amount === 0 ? "חינם" : `₪${t.amount} השתתפות`}</p>
                            <p className="text-slate-400 text-xs mt-1 break-words">{t.participants} משתתפים כבר בתחרות</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.football ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
            {/* טור 2: לוטו */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-3 text-center break-words">לוטו</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.lotto ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.status === "CLOSED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                    const drawDate = (t as { drawDate?: string | null }).drawDate;
                    const drawTime = (t as { drawTime?: string | null }).drawTime;
                    const openDateStr = formatOpenDate(drawDate);
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const drawCountdown = !isLocked && closesAt != null ? formatRemainingHms(closesAt) : null;
                    const showHide = canShowHide(t.status);
                    const remainingSecL = closesAt != null && !isLocked ? Math.max(0, Math.floor((new Date(closesAt).getTime() - Date.now()) / 1000)) : 0;
                    const closingSoonL = remainingSecL > 0 && remainingSecL < 3600;
                    const lessThanHourL = remainingSecL > 0 && remainingSecL < 3600;
                    const cardLiveL = !isLocked && (closingSoonL ? "card-tournament-closing" : "card-tournament-live");
                    return (
                      <div key={t.id} className={`relative group min-w-0 ${cardLiveL}`}>
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 p-5 text-center min-w-0 min-h-[120px] sm:min-h-[140px] overflow-hidden flex flex-col items-center justify-center rounded-2xl w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg break-words min-w-0">{getTournamentDisplayName(t, "lotto")}</p>
                        {openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {drawTime?.trim() && <p className="text-slate-400 text-xs">נסגר: {drawTime.trim()}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1"><Lock className="w-4 h-4" /> {t.status === "CLOSED" ? "ההגרלה נסגרה" : "התחרות ננעלה"}</p>
                            <p className="text-red-300 font-black text-xl mt-1">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : drawCountdown != null ? (
                          <>
                            <p className="text-slate-400 text-sm mt-1">⏳ נסגר בעוד</p>
                            <p className={`font-black text-xl mt-1 font-mono tabular-nums ${lessThanHourL ? "countdown-urgent is-less-than-hour" : "text-amber-400"}`}>{drawCountdown}</p>
                            <p className="text-emerald-400 font-black text-base mt-0.5">{formatPrizeLabel(t.prizePool ?? 0)}</p>
                            <p className="text-amber-400/95 text-sm font-semibold">{t.amount === 0 ? "חינם" : `₪${t.amount} השתתפות`}</p>
                            <p className="text-slate-400 text-xs mt-2 break-words">{t.participants} משתתפים כבר בתחרות</p>
                          </>
                        ) : (
                          <>
                            <p className="text-emerald-400 font-black text-xl mt-1 break-words">{formatPrizeLabel(t.prizePool ?? 0)}</p>
                            <p className="text-amber-400/95 text-sm font-semibold mt-0.5">{t.amount === 0 ? "חינם" : `₪${t.amount} השתתפות`}</p>
                            <p className="text-slate-400 text-xs mt-2 break-words">{t.participants} משתתפים כבר בתחרות</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.lotto ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
            {/* טור 3: צ'אנס */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-3 text-center break-words">צ'אנס</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.chance ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const d = (t as { drawDate?: string | null }).drawDate;
                    const drawTime = (t as { drawTime?: string | null }).drawTime;
                    const drawLabel = formatDrawLabelSafe(d, drawTime);
                    const openDateStr = formatOpenDate(d);
                    const chanceCloseMs = getChanceCloseTimestamp(d, drawTime);
                    const chanceCountdown = !isLocked && chanceCloseMs != null && chanceCloseMs > Date.now() ? formatRemainingHms(chanceCloseMs) : null;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    const remainingSecC = chanceCloseMs != null && !isLocked && chanceCloseMs > Date.now() ? Math.max(0, Math.floor((chanceCloseMs - Date.now()) / 1000)) : 0;
                    const closingSoonC = remainingSecC > 0 && remainingSecC < 3600;
                    const lessThanHourC = remainingSecC > 0 && remainingSecC < 3600;
                    const cardLiveC = !isLocked && (closingSoonC ? "card-tournament-closing" : "card-tournament-live");
                    return (
                      <div key={t.id} className={`relative group min-w-0 ${cardLiveC}`}>
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 px-4 py-5 text-center min-w-0 min-h-[120px] sm:min-h-[160px] flex flex-col items-center justify-center rounded-2xl overflow-hidden w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 shrink-0 ${styles.icon}`} />
                        <p className="text-white font-bold text-base break-words min-w-0 leading-tight">{getTournamentDisplayName(t, "chance")}</p>
                        {openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {drawTime?.trim() && <p className="text-slate-400 text-xs">נסגר: {drawTime.trim()}</p>}
                        {chanceCountdown != null && <p className={`text-sm font-mono mt-0.5 ${lessThanHourC ? "countdown-urgent is-less-than-hour" : "text-amber-400/90"}`}>⏳ נסגר בעוד: {chanceCountdown}</p>}
                        {drawLabel && !isLocked && !chanceCountdown && <p className="text-slate-400 text-xs mt-1 break-words min-w-0 leading-tight">⏰ {drawLabel}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1 break-words"><Lock className="w-4 h-4 shrink-0" /> התחרות ננעלה</p>
                            <p className="text-red-300 font-black text-lg mt-1 break-words">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : !isLocked && (
                          <>
                            <p className="text-emerald-400 font-black text-lg mt-1.5 break-words leading-tight">{formatPrizeLabel(t.prizePool ?? 0)}</p>
                            <p className="text-amber-400/95 text-sm font-semibold mt-0.5">{t.amount === 0 ? "חינם" : `₪${t.amount} השתתפות`}</p>
                            <p className="text-slate-400 text-xs mt-1.5 break-words">{t.participants} משתתפים כבר בתחרות</p>
                          </>
                        )}
                        {isLocked && !countdown && <span className="text-slate-500 text-xs mt-1">🔒</span>}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.chance ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
            {/* טור 4: תחרויות ספורט */}
            <div className="min-w-0 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-3 text-center break-words">תחרויות ספורט</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.footballCustom ?? []).map((t, i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.isLocked;
                    const removalAt = (t as { removalScheduledAt?: string | Date | null }).removalScheduledAt;
                    const closesAt = (t as { closesAt?: Date | number | null }).closesAt;
                    const opensAt = (t as { opensAt?: Date | number | null }).opensAt;
                    const openDateStr = formatOpenDate(opensAt);
                    const closeTimeStr = closesAt != null ? new Date(closesAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null;
                    const timerStr = !isLocked && closesAt != null && new Date(closesAt).getTime() > Date.now() ? formatRemainingHms(closesAt) : null;
                    const countdown = isLocked && removalAt ? formatRemaining(removalAt) : null;
                    const showHide = canShowHide(t.status);
                    const remainingSecK = closesAt != null && !isLocked ? Math.max(0, Math.floor((new Date(closesAt).getTime() - Date.now()) / 1000)) : 0;
                    const closingSoonK = remainingSecK > 0 && remainingSecK < 3600;
                    const lessThanHourK = remainingSecK > 0 && remainingSecK < 3600;
                    const cardLiveK = !isLocked && (closingSoonK ? "card-tournament-closing" : "card-tournament-live");
                    return (
                      <div key={t.id} className={`relative group min-w-0 ${cardLiveK}`}>
                        {showHide && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHideConfirmId(t.id); }}
                                className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-500 shadow transition-opacity opacity-80 hover:opacity-100"
                                aria-label="הסתר מדף ראשי"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-slate-800 text-white border-slate-600">
                              Hide from homepage
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 px-4 py-5 text-center min-w-0 min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center rounded-2xl overflow-hidden w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed border-red-500/40" : "hover:border-emerald-500/40 active:scale-[0.99]"} animate-slide-up touch-target`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                        <Trophy className={`w-8 h-8 mx-auto mb-2 shrink-0 ${styles.icon}`} />
                        <p className="text-white font-bold text-lg break-words min-w-0 leading-tight">{getTournamentDisplayName(t, "football_custom")}</p>
                        {openDateStr && <p className="text-slate-400 text-xs mt-0.5">נפתח: {openDateStr}</p>}
                        {closeTimeStr && <p className="text-slate-400 text-xs">נסגר: {closeTimeStr}</p>}
                        {timerStr != null && <p className={`text-sm font-mono mt-0.5 ${lessThanHourK ? "countdown-urgent is-less-than-hour" : "text-amber-400/90"}`}>⏳ נסגר בעוד: {timerStr}</p>}
                        {isLocked && countdown != null ? (
                          <>
                            <p className="text-red-400 font-bold text-sm mt-2 flex items-center justify-center gap-1 break-words"><Lock className="w-4 h-4 shrink-0" /> התחרות ננעלה</p>
                            <p className="text-red-300 font-black text-lg mt-1 break-words">נסגרת בעוד: {countdown}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-emerald-400 font-black text-lg mt-1.5 break-words leading-tight">{formatPrizeLabel(t.prizePool ?? 0)}</p>
                            <p className="text-amber-400/95 text-sm font-semibold mt-0.5">{t.amount === 0 ? "חינם" : `₪${t.amount} השתתפות`}</p>
                            <p className="text-slate-400 text-xs mt-1.5 break-words">{t.participants} משתתפים כבר בתחרות</p>
                          </>
                        )}
                      </button>
                      </div>
                    );
                  })}
                </div>
                {(byType.footballCustom ?? []).length === 0 && <p className="text-slate-500 text-sm text-center py-4">אין תחרויות</p>}
            </div>
            {(byType.custom ?? []).length > 0 && (
            <div className="min-w-0 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-3 text-center break-words">מותאם</h3>
                <div className="flex flex-col gap-4 min-w-0">
                  {(byType.custom ?? []).map((t, _i) => {
                    const styles = getTournamentStyles(t.amount);
                    const isLocked = t.status === "LOCKED" || t.status === "CLOSED" || t.isLocked;
                    return (
                      <div key={t.id} className="relative group min-w-0">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => !isLocked && setLocation(`/predict/${t.id}`)}
                          className={`card-sport bg-slate-800/60 border-slate-600/50 px-4 py-5 text-center min-w-0 min-h-[120px] flex flex-col items-center justify-center rounded-2xl overflow-hidden w-full max-w-full ${isLocked ? "opacity-90 cursor-not-allowed" : "hover:border-emerald-500/40 active:scale-[0.99]"} touch-target`}
                        >
                          <Trophy className={`w-8 h-8 mx-auto mb-2 shrink-0 ${styles.icon}`} />
                          <p className="text-white font-bold text-lg break-words min-w-0 leading-tight">{getTournamentDisplayName(t, "custom")}</p>
                          <p className="text-emerald-400 font-black text-lg mt-1.5 break-words">{formatPrizeLabel(t.prizePool ?? 0)}</p>
                          <p className="text-amber-400/95 text-sm font-semibold mt-0.5">{t.amount === 0 ? "חינם" : `₪${t.amount} השתתפות`}</p>
                          <p className="text-slate-400 text-xs mt-1 break-words">{t.participants} משתתפים</p>
                        </button>
                      </div>
                    );
                  })}
                </div>
            </div>
            )}
          </div>
          </TooltipProvider>

          {/* 2. Leaderboard + supporting – "מי מוביל עכשיו" top 3 + CTA */}
          {hasAny && (
            <div className="max-w-6xl mx-auto mb-4 mt-2 px-2 flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLocation("/leaderboard")}
                  className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-amber-400 font-semibold text-sm hover:bg-amber-500/20 transition"
                >
                  🏆 צפה בדירוג
                </button>
                {isDataFresh && !isLoading && (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                    חי
                  </span>
                )}
              </div>
              {(() => {
                const t = allTournamentsList.find((x) => x._type === "chance" || x._type === "lotto" || x._type === "football_custom");
                return t ? (
                  <LeaderboardTopTeaser
                    tournamentId={t.id}
                    type={t._type}
                    onGoToLeaderboard={() => setLocation("/leaderboard")}
                  />
                ) : null;
              })()}
            </div>
          )}
          {hasAny && <ThreeStepsTrustStrip className="max-w-2xl mx-auto mb-4 px-2" showTrustLinks={true} />}
          {hasAny && <SocialProofStrip className="max-w-6xl mx-auto mb-4 px-2" />}

          {/* Phase 3: Engagement loop – daily return, participation feedback, re-engagement */}
          {hasAny && (
            <div className="max-w-2xl mx-auto mb-6 px-2 space-y-3">
              <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 px-4 py-3 text-right">
                <p className="text-slate-300 font-semibold text-sm">כדאי לחזור כל יום</p>
                <p className="text-slate-500 text-xs mt-0.5">תחרויות חדשות, דירוגים משתנים, קופות גדלות</p>
              </div>
              {isAuthenticated && firstParticipation && firstParticipation.hasApprovedSubmission && (firstParticipation.approvedCount ?? 0) > 0 && (
                <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-4 py-3 text-right">
                  <p className="text-emerald-200 font-semibold text-sm">אתה משתתף ב־{(firstParticipation.approvedCount ?? 0)} תחרויות פעילות</p>
                </div>
              )}
              {isAuthenticated && firstParticipation && firstParticipation.hasApprovedSubmission && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-right">
                  <p className="text-amber-200/95 text-sm">הדירוג שלך יכול להשתנות בכל רגע</p>
                </div>
              )}
              <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 px-4 py-3 text-right flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-300 font-semibold text-sm">תוצאות ודירוג</p>
                <button
                  type="button"
                  onClick={() => setLocation("/leaderboard")}
                  className="text-amber-400 hover:text-amber-300 text-xs font-medium underline underline-offset-1"
                >
                  צפה בדירוגים ותוצאות
                </button>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 px-4 py-2.5 text-right">
                <p className="text-slate-500 text-xs">בקרוב: הישגים, רמות וסטטיסטיקות אישיות</p>
              </div>
            </div>
          )}
          </>
        )}

        {/* homepage_secondary: secondary supporting banner + blocks lower on the page */}
        {secondaryBanner && (
          <div className="max-w-4xl mx-auto px-2 mb-6">
            <HomepageBannerBlock
              banner={secondaryBanner}
              variant="secondary"
              onCtaClick={(url) => (url.startsWith("http") ? (window.location.href = url) : setLocation(url))}
            />
          </div>
        )}
        {secondaryBlocks.length > 0 && (
          <div className="max-w-4xl mx-auto px-2 mb-6 space-y-4">
            {secondaryBlocks.map((block) => (
              <HomepageSectionBlock key={block.id} section={block} onNavigate={setLocation} />
            ))}
          </div>
        )}

        <AlertDialog open={hideConfirmId != null} onOpenChange={(open) => !open && setHideConfirmId(null)}>
          <AlertDialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400 text-right">הסתרת תחרות מהדף הראשי</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 text-right">
                להסתיר תחרות זו מהמסך הראשי? המשתמשים לא יראו אותה. הנתונים וההיסטוריה נשמרים. ניתן לשחזר מדף המנהל.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel className="border-slate-600 text-slate-300">ביטול</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => hideConfirmId != null && hideMutation.mutate({ id: hideConfirmId })}
              >
                {hideMutation.isPending ? "מסתיר..." : "הסתר מדף ראשי"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* homepage_cta: CTA banner + blocks before footer / secondary actions */}
        {ctaBanner && (
          <div className="max-w-4xl mx-auto px-3 mt-6 mb-4">
            <HomepageBannerBlock
              banner={ctaBanner}
              variant="cta"
              onCtaClick={(url) => (url.startsWith("http") ? (window.location.href = url) : setLocation(url))}
            />
          </div>
        )}
        {ctaBlocks.length > 0 && (
          <div className="max-w-4xl mx-auto px-3 mb-4 space-y-4">
            {ctaBlocks.map((block) => (
              <HomepageSectionBlock key={block.id} section={block} onNavigate={setLocation} />
            ))}
          </div>
        )}

        {/* Secondary actions – tournaments, ranking, auth */}
        <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center flex-wrap px-2">
          {!isAuthenticated && (
            <>
              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white text-base sm:text-lg px-8 rounded-2xl btn-sport"
                onClick={() => setLocation("/register")}
              >
                הרשמה
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto min-h-[48px] border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 text-base sm:text-lg px-8 rounded-2xl"
                onClick={() => setLocation("/login")}
              >
                התחברות
              </Button>
            </>
          )}
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto min-h-[48px] border-slate-500 text-slate-300 hover:bg-slate-700/50 text-base sm:text-lg px-6 rounded-2xl"
            onClick={() => setLocation("/tournaments")}
          >
            כל התחרויות
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto min-h-[48px] border-amber-500/50 text-amber-400 hover:bg-amber-500/20 text-base sm:text-lg px-6 rounded-2xl"
            onClick={() => setLocation("/leaderboard")}
          >
            דירוג
          </Button>
        </div>
      </section>
    </div>
  );
}
