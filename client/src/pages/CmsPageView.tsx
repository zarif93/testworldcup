/**
 * Phase 13: Public CMS page renderer by slug.
 * Loads page + active sections; renders by section type.
 * Fails safely when page is missing (404-style message).
 */

import { useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Loader2, FileText, ArrowRight, Link2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const isExternal = (url: string) => url.startsWith("http://") || url.startsWith("https://");

type Section = {
  id: number;
  pageId: number | null;
  key: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  sortOrder: number;
  isActive: boolean | null;
};

/** Allow only safe tags for HTML body (reduce XSS risk). */
function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  const allowedTags = ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a", "h2", "h3", "span"];
  let out = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  out = out.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (full, tag) => {
    if (!allowedTags.includes(tag.toLowerCase())) return "";
    return full.replace(/\s+on\w+=["'][^"']*["']/gi, "").replace(/href\s*=\s*["']?\s*javascript:/gi, "href=\"#\"");
  });
  return out;
}

function SectionBlock({ section }: { section: Section }) {
  const { type, title, subtitle, body, imageUrl, buttonText, buttonUrl } = section;

  if (type === "hero") {
    return (
      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-6 md:p-8 text-center">
        {imageUrl && (
          <img src={imageUrl} alt={title ?? ""} className="mx-auto rounded-lg max-h-48 object-cover mb-4" />
        )}
        {title && <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{title}</h2>}
        {subtitle && <p className="text-slate-400 mb-4">{subtitle}</p>}
        {body && <p className="text-slate-300 text-sm whitespace-pre-wrap">{body}</p>}
        {buttonText && buttonUrl && (
          <Button asChild className="mt-4 bg-amber-600 hover:bg-amber-700">
            {isExternal(buttonUrl) ? (
              <a href={buttonUrl} target="_blank" rel="noopener noreferrer">
                {buttonText}
                <ArrowRight className="w-4 h-4 mr-1" />
              </a>
            ) : (
              <Link href={buttonUrl}>
                {buttonText}
                <ArrowRight className="w-4 h-4 mr-1" />
              </Link>
            )}
          </Button>
        )}
      </section>
    );
  }

  if (type === "cta") {
    return (
      <section className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-6 text-center">
        {title && <h2 className="text-lg font-bold text-white mb-2">{title}</h2>}
        {subtitle && <p className="text-slate-400 text-sm mb-3">{subtitle}</p>}
        {body && <p className="text-slate-300 text-sm mb-4">{body}</p>}
        {buttonText && buttonUrl && (
          <Button asChild className="bg-amber-600 hover:bg-amber-700">
            {isExternal(buttonUrl) ? (
              <a href={buttonUrl} target="_blank" rel="noopener noreferrer">{buttonText}</a>
            ) : (
              <Link href={buttonUrl}>{buttonText}</Link>
            )}
          </Button>
        )}
      </section>
    );
  }

  if (type === "features" || type === "cards") {
    const items = body ? body.split("\n").filter(Boolean) : [];
    return (
      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-6">
        {title && <h2 className="text-lg font-bold text-white mb-3">{title}</h2>}
        {subtitle && <p className="text-slate-400 text-sm mb-4">{subtitle}</p>}
        <ul className="space-y-2">
          {items.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (type === "links") {
    const items = body ? body.split("\n").filter(Boolean) : [];
    return (
      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-6">
        {title && <h2 className="text-lg font-bold text-white mb-3">{title}</h2>}
        <ul className="space-y-2">
          {items.map((line, i) => {
            const [label, url] = line.includes("|") ? line.split("|").map((s) => s.trim()) : [line, ""];
            return (
              <li key={i}>
                {url ? (
                  <a href={url} className="text-amber-400 hover:text-amber-300 flex items-center gap-1" target="_blank" rel="noopener noreferrer">
                    <Link2 className="w-4 h-4" />
                    {label}
                  </a>
                ) : (
                  <span className="text-slate-400">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (type === "html") {
    const safe = sanitizeHtml(body ?? "");
    return (
      <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-6 prose prose-invert prose-sm max-w-none">
        {title && <h2 className="text-lg font-bold text-white mb-3">{title}</h2>}
        {safe ? <div className="text-slate-300 text-right" dir="rtl" dangerouslySetInnerHTML={{ __html: safe }} /> : (body && <p className="text-slate-300 whitespace-pre-wrap">{body}</p>)}
      </section>
    );
  }

  // text (default)
  return (
    <section className="rounded-xl bg-slate-800/50 border border-slate-700 p-6">
      {title && <h2 className="text-lg font-bold text-white mb-2">{title}</h2>}
      {subtitle && <p className="text-slate-400 text-sm mb-3">{subtitle}</p>}
      {body && <p className="text-slate-300 text-sm whitespace-pre-wrap">{body}</p>}
    </section>
  );
}

export default function CmsPageView() {
  const [, params] = useRoute("/page/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? "";
  const { data, isLoading, isError } = trpc.cms.getPublicPageWithSections.useQuery(
    { slug },
    { enabled: !!slug }
  );

  useEffect(() => {
    if (!slug) setLocation("/");
  }, [slug, setLocation]);

  if (!slug) return null;

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center py-12">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (isError || !data?.page) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center py-12 px-4">
        <FileText className="w-12 h-12 text-slate-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">דף לא נמצא</h2>
        <p className="text-slate-400 text-sm mb-4 text-center">הדף המבוקש לא קיים.</p>
        <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setLocation("/")}>
          חזרה לדף הבית
        </Button>
      </div>
    );
  }

  const { page, sections } = data;

  return (
    <div className="min-h-[40vh] py-4 md:py-6">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 text-right" dir="rtl">
          {page.title}
        </h1>
        <div className="space-y-4" dir="rtl">
          {sections.map((section) => (
            <SectionBlock key={section.id} section={section as Section} />
          ))}
        </div>
        {sections.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">אין תוכן נוסף בדף זה.</p>
        )}
      </div>
    </div>
  );
}
