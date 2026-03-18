/**
 * Floating social media buttons – premium betting / jackpot competition style.
 * WhatsApp (dominant CTA), Instagram, Facebook. Fixed vertical stack on right,
 * mobile safe area, luxury dark theme with neon accents.
 * Rendered via portal to body to avoid parent overflow/transform clipping.
 */

import { createPortal } from "react-dom";
import { MessageCircle, Instagram, Facebook } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const SOCIAL_INSTAGRAM_URL = "https://www.instagram.com/mega_toto_il/";
export const SOCIAL_FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61577544472577";

const DEFAULT_WHATSAPP_NUMBER = "972538099212";

export type FloatingSocialButtonsProps = {
  /** WhatsApp contact URL (e.g. from site settings). Defaults to wa.me/DEFAULT_WHATSAPP_NUMBER */
  whatsappUrl?: string;
  /** Optional class for the container */
  className?: string;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return <MessageCircle className={cn("w-5 h-5 md:w-6 md:h-6", className)} strokeWidth={2.25} aria-hidden />;
}

function InstagramIcon({ className }: { className?: string }) {
  return <Instagram className={cn("w-4 h-4 md:w-5 md:h-5", className)} strokeWidth={2} aria-hidden />;
}

function FacebookIcon({ className }: { className?: string }) {
  return <Facebook className={cn("w-4 h-4 md:w-5 md:h-5", className)} strokeWidth={2} aria-hidden />;
}

export function FloatingSocialButtons({ whatsappUrl, className }: FloatingSocialButtonsProps) {
  const waUrl = whatsappUrl?.trim() || `https://wa.me/${DEFAULT_WHATSAPP_NUMBER}`;

  const content = (
    <aside
      role="group"
      aria-label="צור קשר ברשתות חברתיות"
      className={cn(
        "floating-social-buttons flex flex-col gap-3 items-center",
        "animate-floating-social-enter",
        className
      )}
    >
      <div className="flex flex-col gap-3 items-center animate-floating-social-bounce">
      {/* WhatsApp – dominant CTA, pulse glow */}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center rounded-full text-white",
              "w-12 h-12 md:w-14 md:h-14",
              "shadow-[0_0_20px_rgba(37,211,102,0.35),0_0_40px_rgba(37,211,102,0.15),0_4px_20px_rgba(0,0,0,0.35)]",
              "hover:shadow-[0_0_28px_rgba(37,211,102,0.45),0_0_52px_rgba(37,211,102,0.22),0_6px_24px_rgba(0,0,0,0.4)]",
              "hover:scale-110 active:scale-[1.02]",
              "transition-all duration-300 ease-out",
              "animate-floating-social-whatsapp-pulse",
              "border border-white/10",
              "bg-[#25D366] hover:bg-[#2ee66d]"
            )}
            style={{
              background:
                "linear-gradient(145deg, #2ee66d 0%, #25D366 45%, #20bd5a 100%)",
            }}
            aria-label="צור קשר בוואטסאפ"
          >
            <WhatsAppIcon className="text-white drop-shadow-sm" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={10} className="bg-slate-800 border-slate-600 text-white">
          וואטסאפ – צור קשר
        </TooltipContent>
      </Tooltip>

      {/* Instagram – medium, premium gradient */}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={SOCIAL_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center rounded-full text-white",
              "w-10 h-10 md:w-11 md:h-11",
              "shadow-[0_0_14px_rgba(225,48,108,0.25),0_4px_16px_rgba(0,0,0,0.3)]",
              "hover:shadow-[0_0_20px_rgba(225,48,108,0.35),0_6px_20px_rgba(0,0,0,0.35)]",
              "hover:scale-105 active:scale-[1.02]",
              "transition-all duration-300 ease-out",
              "border border-white/10"
            )}
            style={{
              background:
                "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
            }}
            aria-label="אינסטגרם"
          >
            <InstagramIcon className="text-white drop-shadow-sm" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={10} className="bg-slate-800 border-slate-600 text-white">
          איתנו באינסטגרם
        </TooltipContent>
      </Tooltip>

      {/* Facebook – smaller, refined blue */}
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={SOCIAL_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center rounded-full text-white",
              "w-9 h-9 md:w-10 md:h-10",
              "shadow-[0_0_12px_rgba(24,119,242,0.25),0_4px_14px_rgba(0,0,0,0.3)]",
              "hover:shadow-[0_0_18px_rgba(24,119,242,0.35),0_6px_18px_rgba(0,0,0,0.35)]",
              "hover:scale-105 active:scale-[1.02]",
              "transition-all duration-300 ease-out",
              "border border-white/10",
              "bg-[#1877F2] hover:bg-[#1a7bf5]"
            )}
            aria-label="פייסבוק"
          >
            <FacebookIcon className="text-white drop-shadow-sm" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={10} className="bg-slate-800 border-slate-600 text-white">
          פייסבוק
        </TooltipContent>
      </Tooltip>
      </div>
    </aside>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
