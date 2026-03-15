# Phase 14: Frontend Global Content Integration Cleanup

## Summary

Remaining public-facing content is connected to site settings and CMS where safe. A global footer was added using footer/social/contact/legal settings. Global CTA text and URL are used in the header nav and on the homepage hero. Brand and CTA fallbacks are applied with no breaking changes.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **client/src/components/SiteFooter.tsx** | **New.** Footer component: company name, copyright, legal links (terms/privacy by slug), “איך זה עובד” / “שקיפות”, social links (Instagram, Facebook, Telegram), optional contact (email, phone, address). All from `trpc.settings.getPublic` with safe fallbacks; sections hidden when empty. |
| **client/src/App.tsx** | Import and render `<SiteFooter />` after main; pass `ctaPrimaryText` and `ctaPrimaryUrl` from site settings into `NavLinks`; nav “תחרויות” button uses CTA settings with fallback “תחרויות” / `/tournaments`. |
| **client/src/pages/Home.tsx** | Use `trpc.settings.getPublic.useQuery()`; hero title uses `brand.site_name` when no CMS banner title; hero subtitle uses `brand.tagline` when no CMS banner subtitle; main CTA button uses `cta.primary_text` and `cta.primary_url` when CMS banner has no button; CTA shown when `ctaPrimaryUrl` is set even if no tournaments. |
| **PHASE-14-FRONTEND-CONTENT-CLEANUP-NOTES.md** | **New.** This file. |

---

## 2. Frontend Areas Integrated

| Area | Integration |
|------|-------------|
| **Footer** | New global footer: company name, copyright, terms/privacy (by slug), איך זה עובד, שקיפות, social icons, contact (email/phone/address). Rendered after main in Layout. |
| **Header nav – CTA** | “תחרויות” button label and path come from `cta.primary_text` and `cta.primary_url` when set; otherwise “תחרויות” and `/tournaments`. |
| **Homepage hero** | Title: CMS banner title → `brand.site_name` → “WinMondial”. Subtitle: CMS banner subtitle → `brand.tagline` → “תחרות ניחושי המונדיאל הגדולה”. Main CTA: CMS banner button → `cta.primary_text` / `cta.primary_url` → “בחר טורניר” / `/tournaments`. |
| **Social links** | Footer only: Instagram, Facebook, Telegram when URLs are set in settings. |
| **Contact** | Footer only: email (mailto), phone (tel), address when set. |
| **Legal** | Footer: terms and privacy links to `/page/{slug}` when `legal.terms_page_slug` and `legal.privacy_page_slug` are set (already used in header in Phase 13). |

---

## 3. Settings / CMS Keys Used

| Key | Where used |
|-----|------------|
| **footer.company_name** | Footer: company name (fallback: brand.site_name). |
| **footer.copyright_text** | Footer: copyright line. |
| **brand.site_name** | Footer fallback; Home hero title when no CMS banner title. |
| **brand.tagline** | Home hero subtitle when no CMS banner subtitle. |
| **cta.primary_text** | Nav CTA label; Home hero CTA button label. |
| **cta.primary_url** | Nav CTA path; Home hero CTA button path (must start with `/`). |
| **cta.secondary_text / cta.secondary_url** | Not used in this phase (available for future use). |
| **legal.terms_page_slug** | Footer + header: link to `/page/{slug}`. |
| **legal.privacy_page_slug** | Footer + header: link to `/page/{slug}`. |
| **social.instagram / .facebook / .telegram** | Footer: icon links. |
| **contact.email / .phone / .contact.address** | Footer: contact line (mailto, tel, plain text). |
| **contact.whatsapp** | Already used in Phase 12 (header + floating button). |

CMS banner (homepage_hero) continues to override hero title, subtitle, and CTA when present; settings provide fallbacks.

---

## 4. Hardcoded Content Replaced (with fallbacks)

| Before | After |
|--------|--------|
| Nav “תחרויות” always label “תחרויות”, path `/tournaments` | Label and path from `cta.primary_text` and `cta.primary_url` when set; else unchanged. |
| Home hero title “WinMondial” when no banner | `brand.site_name` or “WinMondial”. |
| Home hero subtitle “תחרות ניחושי המונדיאל הגדולה” when no banner | `brand.tagline` or same string. |
| Home CTA “בחר טורניר” / `/tournaments` when no banner button | `cta.primary_text` / `cta.primary_url` or same. |
| No global footer | Footer added with all content from settings; nothing shown when values are empty. |

No hardcoded strings were removed without a fallback; existing behavior is preserved when settings are empty.

---

## 5. Fallback Strategy

- **Footer:** Empty or missing setting → section or link omitted. Company name falls back to `brand.site_name` then “WinMondial”. No footer block is shown if everything is empty (footer container still renders for layout).
- **Nav CTA:** Missing or invalid `cta.primary_url` (e.g. does not start with `/`) → path `/tournaments`. Missing `cta.primary_text` → label “תחרויות”.
- **Home hero:** Same as before: CMS banner wins; then site settings; then “WinMondial” / “תחרות ניחושי המונדיאל…” / “בחר טורניר” / `/tournaments`.
- **Home CTA visibility:** Shown when there are tournaments, or CMS banner has button URL, or `cta.primary_url` is set; otherwise not shown (same as before when only hasAny/heroBanner.buttonUrl were used).

---

## 6. Remaining Hardcoded Public Content (for later)

| Location | Content | Suggestion |
|----------|---------|------------|
| **ErrorBoundary** | “An unexpected error occurred.”, “Please try refreshing the page. If the problem continues, contact support.”, “Reload Page” | Could use site settings (e.g. support URL / contact) or CMS page; currently left as-is to avoid touching error boundary logic. |
| **HowItWorks** | Full step content (steps array) | Could be driven by CMS page at `/page/how-it-works`; current component and route unchanged. |
| **Transparency** | Page content and data from API | Data-driven; optional CMS intro block could be added later. |
| **Home** | Fallback paragraph when no hero banner (“FIFA World Cup 2026 – שלב הבתים…”) | Could come from CMS or site setting. |
| **Register** | Post-registration WhatsApp message text | Could be a site setting. |
| **Terms dialog** | Full hardcoded terms (when `legal.terms_page_slug` not set) | Already fallback in Phase 13; can stay until CMS terms page is used. |

---

## Backward Compatibility

- All new behavior is additive. Empty or missing settings do not change previous labels or paths.
- Footer does not depend on any new API; it uses existing `settings.getPublic`.
- Existing routes and components (HowItWorks, Transparency, etc.) are unchanged.
