/**
 * Global site footer – company name, copyright, CMS page links (when published), legal, contact.
 * Social links (Instagram, Facebook) use hard-coded URLs shared with floating buttons.
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FileText, Mail, Phone, MapPin, Instagram, Facebook, HelpCircle, Shield } from "lucide-react";
import { SOCIAL_INSTAGRAM_URL, SOCIAL_FACEBOOK_URL } from "@/components/FloatingSocialButtons";

const CMS_FOOTER_SLUGS = ["about", "contact", "faq", "terms", "privacy"] as const;
const CMS_SLUG_LABELS: Record<string, { label: string; icon?: React.ReactNode }> = {
  about: { label: "אודות" },
  contact: { label: "צור קשר" },
  faq: { label: "שאלות נפוצות", icon: <HelpCircle className="w-3.5 h-3.5" /> },
  terms: { label: "תקנון", icon: <FileText className="w-3.5 h-3.5" /> },
  privacy: { label: "פרטיות", icon: <Shield className="w-3.5 h-3.5" /> },
};

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-slate-400 hover:text-amber-400 transition p-1.5 rounded-lg hover:bg-slate-800/50"
      aria-label={label}
    >
      {children}
    </a>
  );
}

export function SiteFooter() {
  const [, setLocation] = useLocation();
  const { data: s } = trpc.settings.getPublic.useQuery();
  const { data: publishedSlugs = [] } = trpc.cms.getPublishedCmsSlugs.useQuery(
    { slugs: [...CMS_FOOTER_SLUGS] },
    { staleTime: 60_000 }
  );

  const companyName = (s?.["footer.company_name"] ?? s?.["brand.site_name"] ?? "WinMondial").trim();
  const copyrightText = (s?.["footer.copyright_text"] ?? "").trim();
  const email = (s?.["contact.email"] ?? "").trim();
  const phone = (s?.["contact.phone"] ?? "").trim();
  const address = (s?.["contact.address"] ?? "").trim();

  const hasSocial = true;
  const hasContact = email || phone || address;

  const go = (path: string) => {
    setLocation(path);
  };

  return (
    <footer className="border-t border-slate-700/60 bg-slate-900/50 text-right pb-safe-nav md:pb-0" dir="rtl" aria-label="פוטר האתר">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        <p className="text-slate-500 text-xs mb-4 max-w-xl">האתר מציג דירוגים ושקיפות כספית מלאה. תקנון ופרטיות למטה.</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="space-y-1">
            <p className="text-white font-semibold">{companyName}</p>
            {copyrightText && <p className="text-slate-500 text-sm">{copyrightText}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {publishedSlugs.map((slug) => {
              const conf = CMS_SLUG_LABELS[slug];
              const label = conf?.label ?? slug;
              const icon = conf?.icon;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => go(`/page/${encodeURIComponent(slug)}`)}
                  className="text-slate-400 hover:text-amber-400 text-sm transition flex items-center gap-1"
                >
                  {icon}
                  {label}
                </button>
              );
            })}
            <button type="button" onClick={() => go("/how-it-works")} className="text-slate-400 hover:text-amber-400 text-sm transition flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              איך זה עובד
            </button>
            {hasSocial && <span className="text-slate-600 w-px h-4 hidden md:inline" />}
            {hasSocial && (
              <div className="flex items-center gap-0.5">
                <SocialIcon href={SOCIAL_INSTAGRAM_URL} label="Instagram"><Instagram className="w-4 h-4" /></SocialIcon>
                <SocialIcon href={SOCIAL_FACEBOOK_URL} label="Facebook"><Facebook className="w-4 h-4" /></SocialIcon>
              </div>
            )}
          </div>
        </div>

        {hasContact && (
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap gap-x-6 gap-y-2 text-slate-500 text-sm">
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:text-amber-400 transition">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-amber-400 transition">
                <Phone className="w-3.5 h-3.5" />
                {phone}
              </a>
            )}
            {address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {address}
              </span>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
