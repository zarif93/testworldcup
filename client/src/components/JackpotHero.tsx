/**
 * Jackpot Hero – casino-grade, high-conversion, FOMO-driven banner.
 * Aggressive visual: golden burst, red countdown, metallic amount, light FX.
 * CSS-only animation. Data from backend (balance, nextDrawAt).
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="w-full">
      <section
        id="jackpot-banner"
        className="relative w-full min-h-[220px] sm:min-h-[250px] md:min-h-[280px] rounded-2xl overflow-hidden border border-amber-500/40 shadow-2xl"
        aria-label="ג׳קפוט"
        style={{
          background: "radial-gradient(ellipse 120% 80% at 50% 50%, #1c1917 0%, #0f172a 45%, #020617 70%, #000 100%)",
          boxShadow: "0 0 0 1px rgba(251, 191, 36, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.6)",
        }}
      >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* FX layer: golden burst explosion + stadium sweep + gold sparks */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {/* Outer burst – radiant energy, not fireworks */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(160%,640px)] h-[min(160%,640px)] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.28) 0%, rgba(245,158,11,0.14) 30%, transparent 60%)",
            animation: "jackpot-burst-explosion 4s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(140%,560px)] h-[min(140%,560px)] rounded-full blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.12) 35%, transparent 65%)",
            animation: "jackpot-burst-pulse 4.5s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(110%,440px)] h-[min(110%,440px)] rounded-full blur-[80px]"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.2) 0%, transparent 55%)",
            animation: "jackpot-glow-float 5s ease-in-out infinite",
          }}
        />
        {/* Stadium light sweep – slow, atmospheric */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(105deg, transparent 0%, rgba(251,191,36,0.08) 25%, transparent 50%, rgba(251,191,36,0.06) 75%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "jackpot-stadium-sweep 8s linear infinite",
          }}
        />
        {/* Gold particles – soft, atmospheric, subtle glow */}
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-400/80 blur-[1px]"
            style={{
              width: i % 4 === 0 ? "4px" : i % 4 === 1 ? "3px" : "2px",
              height: i % 4 === 0 ? "4px" : i % 4 === 1 ? "3px" : "2px",
              left: `${10 + (i * 6) % 80}%`,
              top: `${15 + (i * 5) % 70}%`,
              animation: `jackpot-particle-float ${5 + (i % 2)}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              boxShadow: "0 0 6px rgba(251,191,36,0.35)",
            }}
          />
        ))}
      </div>

      {/* Rotating halo + lens flare behind amount – scaled to compact banner */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
        <div
          className="absolute left-1/2 top-1/2 w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] md:w-[320px] md:h-[320px] rounded-full border-2 border-amber-400/25 -translate-x-1/2 -translate-y-1/2"
          style={{ animation: "jackpot-halo-rotate 30s linear infinite" }}
        />
        <div
          className="absolute left-1/2 top-1/2 w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[250px] md:h-[250px] rounded-full border border-amber-500/20 -translate-x-1/2 -translate-y-1/2"
          style={{ animation: "jackpot-halo-rotate 34s linear infinite reverse" }}
        />
        <div
          className="absolute w-[2px] h-[130%] bg-gradient-to-b from-transparent via-amber-400/20 to-transparent -rotate-12"
          style={{ left: "34%" }}
        />
        <div
          className="absolute w-[2px] h-[130%] bg-gradient-to-b from-transparent via-amber-300/15 to-transparent rotate-12"
          style={{ right: "34%" }}
        />
      </div>

      {/* Content – JACKPOT headline → countdown → amount (amount remains hero) */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[250px] md:min-h-[280px] px-5 py-4 sm:py-5 text-center">
        {/* JACKPOT – main headline at top, premium gold, subtle glow */}
        <p
          className="text-2xl sm:text-3xl md:text-4xl font-black tracking-[0.35em] uppercase mb-2 sm:mb-3 select-none"
          style={{
            color: "#fcd34d",
            textShadow: "0 0 20px rgba(251,191,36,0.5), 0 0 40px rgba(245,158,11,0.25), 0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          JACKPOT
        </p>

        {/* Countdown – urgency pulse, above amount */}
        {hasCountdown && (
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-red-400 mb-1 font-semibold">
            הגרלה בעוד
          </p>
        )}
        {hasCountdown ? (
          <div
            className="font-mono text-2xl sm:text-3xl md:text-4xl font-black tabular-nums mb-2 md:mb-3 tracking-wider"
            style={{
              color: "#fef2f2",
              textShadow: "0 0 8px rgba(239,68,68,0.85), 0 0 18px rgba(220,38,38,0.5)",
              animation: "jackpot-countdown-pulse-red 1.4s ease-in-out infinite",
            }}
          >
            {countdownStr}
          </div>
        ) : (
          <p className="text-slate-500 text-sm mb-2 md:mb-3">מועד הגרלה הבאה לא נקבע</p>
        )}

        {/* Hero amount – metallic gold, strong glow, shimmer (strongest focal point) */}
        <div className="relative inline-block">
          <p
            className="text-4xl sm:text-5xl md:text-[3.75rem] lg:text-[4.5rem] font-black tabular-nums tracking-tighter mb-0 select-none"
            style={{
              background: "linear-gradient(180deg, #fffbeb 0%, #fef3c7 15%, #fcd34d 35%, #f59e0b 55%, #d97706 78%, #92400e 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 28px rgba(251,191,36,0.45)) drop-shadow(0 0 52px rgba(245,158,11,0.22)) drop-shadow(0 4px 14px rgba(0,0,0,0.45))",
              animation: "jackpot-amount-shimmer 3s ease-in-out infinite",
            }}
          >
            ₪{amountStr}
          </p>
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 35%, transparent 65%, rgba(255,255,255,0.06) 100%)",
              backgroundSize: "200% 100%",
              animation: "jackpot-amount-sweep 5s ease-in-out infinite",
              maskImage: "linear-gradient(black, black)",
              WebkitMaskImage: "linear-gradient(black, black)",
            }}
          />
        </div>
      </div>
    </section>

      {/* Action buttons – below banner, refined size */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4 w-full">
        <Button
          type="button"
          size="sm"
          className="min-h-[36px] h-9 px-5 rounded-lg text-black font-bold text-sm border-0 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg, #fde68a 0%, #fcd34d 35%, #f59e0b 100%)",
            boxShadow: "0 0 14px rgba(251,191,36,0.35), 0 0 28px rgba(245,158,11,0.12), 0 2px 10px rgba(0,0,0,0.25)",
            animation: "jackpot-cta-glow 2.5s ease-in-out infinite",
          }}
          onClick={onPlayNow}
        >
          שחק עכשיו
        </Button>
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
            className="min-h-[32px] h-8 px-4 rounded-lg text-slate-500 hover:text-amber-400/90 hover:bg-white/5 text-xs"
            onClick={onProgress}
          >
            ההתקדמות שלי
          </Button>
        )}
      </div>
    </div>
  );
}
