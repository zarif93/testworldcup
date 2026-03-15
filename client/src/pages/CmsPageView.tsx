/**
 * Public CMS page renderer – dedicated content layout.
 * Renders on a clean surface (no stadium background), centered column, clear typography.
 */

import { useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Loader2, FileText, ArrowRight, Link2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { looksLikeHtml, plainTextToHtml } from "@/lib/cmsBody";

/** Max width for main content column (readable + ~900–1100px) */
const CONTENT_MAX_WIDTH = "max-w-[min(65rem,100%)]";

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
  const allowedTags = ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a", "h2", "h3", "span", "div"];
  let out = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  out = out.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (full, tag) => {
    if (!allowedTags.includes(tag.toLowerCase())) return "";
    return full.replace(/\s+on\w+=["'][^"']*["']/gi, "").replace(/href\s*=\s*["']?\s*javascript:/gi, "href=\"#\"");
  });
  return out;
}

/**
 * Normalize CMS body: plain text → paragraphs + br; HTML → preserved and sanitized.
 * - Plain text: split by double newlines into <p>, single newlines → <br />
 * - HTML: pass through sanitizer only (preserve p, br, ul, ol, li, h2, h3).
 */
function normalizeBodyContent(body: string): string {
  if (!body || typeof body !== "string") return "";
  const trimmed = body.trim();
  if (!trimmed) return "";

  if (looksLikeHtml(trimmed)) {
    return sanitizeHtml(trimmed);
  }
  return sanitizeHtml(plainTextToHtml(trimmed));
}

function SectionBlock({ section }: { section: Section }) {
  const { type, title, subtitle, body, imageUrl, buttonText, buttonUrl } = section;
  const cardClass = "rounded-xl bg-slate-800/80 border border-slate-600/80 p-6 md:p-8 shadow-sm";

  if (type === "hero") {
    return (
      <section className={`${cardClass} text-center`}>
        {imageUrl && (
          <img src={imageUrl} alt={title ?? ""} className="mx-auto rounded-lg max-h-52 object-cover mb-5" />
        )}
        {title && <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{title}</h2>}
        {subtitle && <p className="text-slate-400 mb-4">{subtitle}</p>}
        {body && <p className="text-slate-300 text-base leading-relaxed whitespace-pre-wrap">{body}</p>}
        {buttonText && buttonUrl && (
          <Button asChild className="mt-5 bg-amber-600 hover:bg-amber-700">
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
      <section className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-6 md:p-8 text-center">
        {title && <h2 className="text-lg font-bold text-white mb-2">{title}</h2>}
        {subtitle && <p className="text-slate-400 text-sm mb-3">{subtitle}</p>}
        {body && <p className="text-slate-300 text-base leading-relaxed mb-4">{body}</p>}
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
      <section className={cardClass}>
        {title && <h2 className="text-lg font-bold text-white mb-3">{title}</h2>}
        {subtitle && <p className="text-slate-400 text-sm mb-4">{subtitle}</p>}
        <ul className="space-y-2.5">
          {items.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-300 text-base leading-relaxed">
              <span className="text-amber-400 mt-0.5 shrink-0">•</span>
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
      <section className={cardClass}>
        {title && <h2 className="text-lg font-bold text-white mb-3">{title}</h2>}
        <ul className="space-y-2.5">
          {items.map((line, i) => {
            const [label, url] = line.includes("|") ? line.split("|").map((s) => s.trim()) : [line, ""];
            return (
              <li key={i}>
                {url ? (
                  <a href={url} className="text-amber-400 hover:text-amber-300 flex items-center gap-1.5 text-base" target="_blank" rel="noopener noreferrer">
                    <Link2 className="w-4 h-4 shrink-0" />
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
      <section className={`${cardClass} prose prose-invert prose-base max-w-none`}>
        {title && <h2 className="text-lg font-bold text-white mb-3">{title}</h2>}
        {safe ? <div className="text-slate-300 text-right leading-relaxed [&_p]:mb-3" dir="rtl" dangerouslySetInnerHTML={{ __html: safe }} /> : (body && <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{body}</p>)}
      </section>
    );
  }

  // text (default)
  return (
    <section className={cardClass}>
      {title && <h2 className="text-lg font-bold text-white mb-2">{title}</h2>}
      {subtitle && <p className="text-slate-400 text-sm mb-3">{subtitle}</p>}
      {body && <p className="text-slate-300 text-base leading-relaxed whitespace-pre-wrap">{body}</p>}
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

  /** Full-width surface so CMS pages never sit on stadium background. Use min-h-[100dvh] so mobile viewport is correct; allow full scroll with overflow-y visible. */
  const contentLayoutWrapper = "min-h-[100dvh] w-screen bg-slate-900 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] overflow-x-hidden overflow-y-visible flex flex-col";

  if (isLoading) {
    return (
      <div className={`${contentLayoutWrapper} flex items-center justify-center py-16`}>
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" aria-hidden />
      </div>
    );
  }

  if (isError || !data?.page) {
    return (
      <div className={`${contentLayoutWrapper} flex flex-col items-center justify-center py-16 px-4`}>
        <FileText className="w-14 h-14 text-slate-500 mb-4" aria-hidden />
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2 text-center">דף לא נמצא</h2>
        <p className="text-slate-400 text-base mb-6 text-center max-w-md">הדף המבוקש לא קיים או שאינו מפורסם.</p>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" onClick={() => setLocation("/")}>
          חזרה לדף הבית
        </Button>
      </div>
    );
  }

  const { page, sections } = data;
  const p = page as { title: string; shortDescription?: string | null; body?: string | null; coverImageUrl?: string | null };
  const hasBody = p.body?.trim();
  const hasSections = sections.length > 0;

  return (
    <div className={contentLayoutWrapper}>
      {/* Cover image: full width at top (within content area) */}
      {p.coverImageUrl && (
        <div className="w-full aspect-[21/9] min-h-[12rem] max-h-[20rem] bg-slate-800">
          <img src={p.coverImageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Centered content column – mobile: bottom padding = nav + safe area so content scrolls above bar; desktop: normal padding */}
      <div className={`mx-auto px-4 sm:px-6 md:px-8 pt-8 md:pt-12 pb-safe-nav md:pb-16 ${CONTENT_MAX_WIDTH}`}>
        <article className="text-right" dir="rtl">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 leading-tight tracking-tight">
            {p.title}
          </h1>
          {p.shortDescription?.trim() && (
            <p className="content-prose text-slate-400 text-lg md:text-xl mb-8 leading-[1.8] max-w-[750px]">
              {p.shortDescription.trim()}
            </p>
          )}

          {hasBody && (
            <div
              className="content-prose cms-body text-slate-300 mb-10 [&_p]:mb-6 [&_p:last-child]:mb-0 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-8 [&_h3]:mb-4 [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:space-y-3 [&_ol]:list-decimal [&_ol]:pr-5 [&_ol]:space-y-3 [&_a]:text-amber-400 [&_a]:underline [&_a:hover]:text-amber-300"
              dangerouslySetInnerHTML={{ __html: normalizeBodyContent(p.body!) }}
            />
          )}

          {hasSections && (
            <div className="space-y-6 mt-10 pt-6 border-t border-slate-700/80">
              {sections.map((section) => (
                <SectionBlock key={section.id} section={section as Section} />
              ))}
            </div>
          )}

          {!hasBody && !hasSections && (
            <p className="text-slate-500 text-sm text-center py-10">אין תוכן נוסף בדף זה.</p>
          )}

          {/* Optional CTA block at bottom of every CMS page */}
          <nav className="mt-12 pt-8 border-t border-slate-700/80 flex flex-wrap items-center justify-center gap-3" aria-label="ניווט">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" asChild>
              <Link href="/">חזור לדף הבית</Link>
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700" asChild>
              <Link href="/tournaments">הצטרף לתחרות</Link>
            </Button>
          </nav>
        </article>
      </div>
    </div>
  );
}
