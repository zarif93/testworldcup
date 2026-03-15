/**
 * Global site footer – company name, copyright, CMS page links (when published), legal, social, contact.
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FileText, Mail, Phone, MapPin, Instagram, Facebook, HelpCircle, UserPlus, Shield } from "lucide-react";

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
  const instagram = (s?.["social.instagram"] ?? "").trim();
  const facebook = (s?.["social.facebook"] ?? "").trim();
  const telegram = (s?.["social.telegram"] ?? "").trim();
  const email = (s?.["contact.email"] ?? "").trim();
  const phone = (s?.["contact.phone"] ?? "").trim();
  const address = (s?.["contact.address"] ?? "").trim();

  const hasSocial = instagram || facebook || telegram;
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
                {instagram && <SocialIcon href={instagram} label="Instagram"><Instagram className="w-4 h-4" /></SocialIcon>}
                {facebook && <SocialIcon href={facebook} label="Facebook"><Facebook className="w-4 h-4" /></SocialIcon>}
                {telegram && (
                  <a href={telegram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-amber-400 transition p-1.5 rounded-lg hover:bg-slate-800/50" aria-label="Telegram">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  </a>
                )}
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
