/**
 * Jackpot Hero – live event stage. Background: active jackpot image (blur placeholder → fade-in full),
 * else default fallback image, else gradient. Overlay controlled by site settings. Does not affect global site background.
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const DEFAULT_JACKPOT_FALLBACK = "/jackpot-bg-default.webp";

function JackpotCtaButton({ onPlayNow, backgroundId }: { onPlayNow: () => void; backgroundId?: number }) {
  const trackMut = trpc.settings.trackJackpotCtaClick.useMutation();
  return (
    <Button
      type="button"
      size="sm"
      className="min-h-[36px] h-9 px-5 rounded-lg text-black font-bold text-sm border-0 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
      style={{
        background: "linear-gradient(180deg, #fde68a 0%, #fcd34d 35%, #f59e0b 100%)",
        boxShadow: "0 0 14px rgba(251,191,36,0.35), 0 0 28px rgba(245,158,11,0.12), 0 2px 10px rgba(0,0,0,0.25)",
        animation: "jackpot-cta-glow 2.5s ease-in-out infinite",
      }}
      onClick={() => {
        trackMut.mutate({ backgroundId: backgroundId ?? undefined });
        onPlayNow();
      }}
    >
      שחק עכשיו
    </Button>
  );
}

function getRemainingSeconds(until: string | Date | number | null | undefined): number {
  if (until == null) return 0;
  const end = new Date(until).getTime();
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function formatHms(remaining: number): string {
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type JackpotHeroProps = {
  balancePoints: number;
  nextDrawAt: string | Date | null | undefined;
  onPlayNow: () => void;
  onHowItWorks: () => void;
  onProgress?: () => void;
  showProgressButton?: boolean;
};

export function JackpotHero({
  balancePoints,
  nextDrawAt,
  onPlayNow,
  onHowItWorks,
  onProgress,
  showProgressButton = false,
}: JackpotHeroProps) {
  const [remainingSec, setRemainingSec] = useState(() => getRemainingSeconds(nextDrawAt));
  const hasCountdown = nextDrawAt != null && new Date(nextDrawAt).getTime() > Date.now();

  useEffect(() => {
    if (!hasCountdown) return;
    const tick = () => setRemainingSec(getRemainingSeconds(nextDrawAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextDrawAt, hasCountdown]);

  const countdownStr = formatHms(remainingSec);
  const amountStr = (balancePoints ?? 0).toLocaleString("he-IL");
  const { data: jackpotBgData } = trpc.settings.getActiveJackpotBackground.useQuery(undefined, { staleTime: 60_000 });
  const active = jackpotBgData?.active ?? null;
  const trackViewMut = trpc.settings.trackJackpotHeroView.useMutation();
  const heroRef = useRef<HTMLElement>(null);
  const viewTrackedRef = useRef(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting || viewTrackedRef.current) return;
        if (active?.id == null) return;
        viewTrackedRef.current = true;
        trackViewMut.mutate({ backgroundId: active.id });
      },
      { threshold: 0.2, rootMargin: "0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [active?.id]);
  const baseOverlay = (jackpotBgData?.overlayOpacity ?? 70) / 100;
  const vignetteStrength = (jackpotBgData?.vignetteStrength ?? 80) / 100;
  const fxIntensity = (jackpotBgData?.fxIntensity ?? 80) / 100;
  const glowStrength = (jackpotBgData?.glowStrength ?? 80) / 100;
  const intensityNorm = (jackpotBgData?.intensity ?? 70) / 100; // 0–1 psychological intensity
  const meanLuminance = active?.meanLuminance ?? null; // 0–1, brighter = higher
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobileViewport(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const imageUrl = (isMobileViewport && active?.mobileUrl) ? active.mobileUrl : (active?.url ?? DEFAULT_JACKPOT_FALLBACK);
  const thumbnailUrl = active?.thumbnailUrl ?? active?.url ?? DEFAULT_JACKPOT_FALLBACK;
  const hasImage = !!active?.url || imageUrl === DEFAULT_JACKPOT_FALLBACK;
  const overlayOpacity = meanLuminance != null
    ? Math.min(1, baseOverlay * 0.7 + (1 - meanLuminance) * 0.25)
    : baseOverlay * 0.7;
  const textGlowScale = meanLuminance != null ? 0.85 + meanLuminance * 0.3 : 1;
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const defaultGradient = "radial-gradient(ellipse 140% 90% at 50% 45%, #0f172a 0%, #020617 38%, #000 70%, #000 100%)";
  const durationScale = 0.35 + 0.65 * intensityNorm;
  const countdownPulseScale = 0.4 + 0.6 * intensityNorm;

  return (
    <div className="w-full">
      <section
        ref={heroRef}
        id="jackpot-banner"
        className="relative w-full min-h-[280px] sm:min-h-[320px] md:min-h-[360px] rounded-2xl overflow-hidden jackpot-live-stage"
        aria-label="ג׳קפוט"
        style={{ background: defaultGradient }}
      >
        {/* Background image: blur thumbnail first, then fade-in full (no layout jump) */}
        {hasImage && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none scale-105"
              style={{
                backgroundImage: `url(${thumbnailUrl})`,
                filter: "blur(20px)",
                opacity: fullImageLoaded ? 0 : 1,
                transition: "opacity 0.4s ease-out",
              }}
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-opacity duration-500 ease-out"
              style={{
                backgroundImage: `url(${imageUrl})`,
                opacity: fullImageLoaded ? 1 : 0,
              }}
              aria-hidden
            />
            <img
              src={imageUrl}
              alt=""
              className="sr-only"
              onLoad={() => setFullImageLoaded(true)}
              onError={() => setFullImageLoaded(true)}
            />
          </>
        )}
        {/* Dark overlay – admin + auto contrast from background luminance */}
        {hasImage && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `rgba(0,0,0,${overlayOpacity})` }}
            aria-hidden
          />
        )}
        {/* Live event badge – broadcast cue */}
        {hasCountdown && (
          <div
            className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-600/90 border border-red-400/50"
            style={{ boxShadow: "0 0 12px rgba(239,68,68,0.4)", animation: "jackpot-live-badge-pulse 2s ease-in-out infinite" }}
            aria-hidden
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white">LIVE</span>
          </div>
        )}
        {/* ─── FX layers: vignette + beam + fog (admin-controlled intensity) ─── */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 55% 50% at 50% 48%, transparent 28%, rgba(0,0,0,${0.5 * vignetteStrength}) 55%, rgba(0,0,0,${0.92 * vignetteStrength}) 100%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, transparent 0%, rgba(251,191,36,${0.03 * fxIntensity * intensityNorm}) 20%, transparent 45%, rgba(251,191,36,${0.02 * fxIntensity * intensityNorm}) 70%, transparent 100%)`,
              backgroundSize: "200% 100%",
              animation: `jackpot-beam-sweep ${20 / durationScale}s ease-in-out infinite`,
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-[130%] h-[90%] rounded-full"
            style={{
              background: `radial-gradient(ellipse 55% 45% at 50% 50%, rgba(255,255,255,${0.03 * fxIntensity}) 0%, transparent 55%)`,
              filter: "blur(50px)",
              animation: `jackpot-fog-drift ${14 / durationScale}s ease-in-out infinite`,
            }}
          />
          <div
            className="absolute left-1/2 bottom-[22%] w-[100%] h-[50%] rounded-full"
            style={{
              background: `radial-gradient(ellipse 70% 35% at 50% 100%, rgba(251,191,36,${0.08 * fxIntensity * intensityNorm}) 0%, transparent 65%)`,
              filter: "blur(35px)",
              animation: `jackpot-arc-rise ${10 / durationScale}s ease-in-out infinite`,
            }}
          />
          {/* Core glow – intensity + admin glowStrength */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(160%,640px)] h-[min(160%,640px)] rounded-full blur-[120px]"
            style={{
              background: `radial-gradient(circle, rgba(251,191,36,${0.22 * glowStrength * (0.5 + 0.5 * intensityNorm)}) 0%, rgba(245,158,11,${0.1 * glowStrength}) 30%, transparent 58%)`,
              animation: `jackpot-burst-explosion ${6 / durationScale}s ease-in-out infinite`,
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(120%,480px)] h-[min(120%,480px)] rounded-full blur-[90px]"
            style={{
              background: `radial-gradient(circle, rgba(251,191,36,${0.18 * glowStrength * (0.5 + 0.5 * intensityNorm)}) 0%, transparent 55%)`,
              animation: `jackpot-glow-float ${7 / durationScale}s ease-in-out infinite`,
            }}
          />
          {/* Tertiary: minimal particles – do not compete with amount */}
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-amber-400/50"
              style={{
                width: "3px",
                height: "3px",
                left: `${15 + (i * 10) % 70}%`,
                top: `${20 + (i * 12) % 60}%`,
                animation: `jackpot-particle-float ${(6 + (i % 3)) * durationScale}s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
                boxShadow: "0 0 6px rgba(251,191,36,0.25)",
              }}
            />
          ))}
        </div>

        {/* ─── MID: subtle halos – support, not dominant ─── */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
          <div
            className="absolute left-1/2 top-1/2 w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] md:w-[380px] md:h-[380px] rounded-full border border-amber-400/18 -translate-x-1/2 -translate-y-1/2"
            style={{ animation: `jackpot-halo-rotate ${36 * durationScale}s linear infinite` }}
          />
          <div
            className="absolute left-1/2 top-1/2 w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] md:w-[280px] md:h-[280px] rounded-full border border-amber-500/14 -translate-x-1/2 -translate-y-1/2"
            style={{ animation: `jackpot-halo-rotate ${42 * durationScale}s linear infinite reverse` }}
          />
        </div>

        {/* ─── CONTENT: proclamation → live timer → amount on pedestal (the star) ─── */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[280px] sm:min-h-[320px] md:min-h-[360px] px-5 py-5 sm:py-6 text-center">
          {/* JACKPOT – event title: authority + live tension */}
          <p
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.38em] uppercase mb-3 sm:mb-4 select-none"
            style={{
              color: "#fcd34d",
              textShadow: `0 4px 20px rgba(0,0,0,0.7), 0 0 ${24 * textGlowScale}px rgba(251,191,36,${0.15 * textGlowScale}), 0 0 1px rgba(251,191,36,0.5)`,
            }}
          >
            JACKPOT
          </p>

          {/* Countdown – urgent draw clock: creates anticipation */}
          {hasCountdown && (
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-amber-400/90 mb-1 font-semibold">
              הגרלה בעוד
            </p>
          )}
          {hasCountdown ? (
            <div
              className="font-mono text-2xl sm:text-3xl md:text-4xl font-black tabular-nums mb-4 md:mb-5 tracking-[0.25em] text-white jackpot-countdown-urgent"
              style={{
                textShadow: `0 0 ${14 * textGlowScale}px rgba(239,68,68,0.75), 0 0 ${28 * textGlowScale}px rgba(220,38,38,0.35), 0 2px 10px rgba(0,0,0,0.5)`,
                animation: `jackpot-countdown-pulse-red ${1.15 / countdownPulseScale}s ease-in-out infinite`,
              }}
            >
              {countdownStr}
            </div>
          ) : (
            <p className="text-slate-500 text-sm mb-4 md:mb-5">מועד הגרלה הבאה לא נקבע</p>
          )}

          {/* Amount – high-stakes prize moment; heavy, dramatic presence */}
          <div className="relative inline-block">
            {/* Pedestal – stage for the prize; primary motion */}
            <div
              className="absolute left-1/2 top-full w-[160%] min-w-[300px] h-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(ellipse 65% 45% at 50% 50%, rgba(251,191,36,${0.52 * glowStrength}) 0%, rgba(245,158,11,${0.3 * glowStrength}) 30%, rgba(180,83,9,0.12) 55%, transparent 85%)`,
                animation: `jackpot-pedestal-glow ${4.5 / durationScale}s ease-in-out infinite`,
              }}
            />
            <p
              className="relative text-5xl sm:text-6xl md:text-[4.5rem] lg:text-[5.5rem] font-black tabular-nums tracking-tighter mb-0 select-none jackpot-amount-heavy"
              style={{
                background: "linear-gradient(180deg, #fffbeb 0%, #fef3c7 12%, #fcd34d 32%, #f59e0b 52%, #d97706 75%, #92400e 95%, #78350f 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: `drop-shadow(0 0 ${36 * (0.5 + 0.5 * intensityNorm)}px rgba(251,191,36,${0.6 * glowStrength})) drop-shadow(0 0 64px rgba(245,158,11,0.25)) drop-shadow(0 8px 24px rgba(0,0,0,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))`,
                animation: `jackpot-amount-shimmer ${3.5 / durationScale}s ease-in-out infinite`,
              }}
            >
              ₪{amountStr}
            </p>
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 35%, transparent 65%, rgba(255,255,255,0.06) 100%)",
                backgroundSize: "200% 100%",
                animation: `jackpot-amount-sweep ${5 / durationScale}s ease-in-out infinite`,
                maskImage: "linear-gradient(black, black)",
                WebkitMaskImage: "linear-gradient(black, black)",
              }}
            />
          </div>
        </div>
      </section>

      {/* Action buttons – below stage, support only */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4 w-full">
        <JackpotCtaButton
          onPlayNow={onPlayNow}
          backgroundId={active?.id}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[32px] h-8 px-4 rounded-lg text-slate-400 hover:text-white/90 hover:bg-white/5 font-medium text-xs"
          onClick={onHowItWorks}
        >
          איך זה עובד
        </Button>
        {showProgressButton && onProgress && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[32px] h-8 px-4 rounded-xl text-slate-500 hover:text-amber-400/90 hover:bg-white/5 text-xs"
            onClick={onProgress}
          >
            ההתקדמות שלי
          </Button>
        )}
      </div>
    </div>
  );
}
