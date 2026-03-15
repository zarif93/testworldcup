# Phase 13: Public CMS Pages Rendering + Legal / Info Pages

## Summary

CMS content (content_pages + content_sections) now powers public-facing pages via a generic `/page/:slug` route. Legal settings (terms/privacy slugs) are wired so the header can open CMS pages when configured; otherwise the existing terms dialog is used. Only **published** pages are exposed; drafts are not public.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **server/db.ts** | Added `getPublicPageWithSections(slug)` – returns published page plus active sections for that page, or `{ page: null, sections: [] }`. |
| **server/routers.ts** | Added `cms.getPublicPageWithSections` public procedure (input: `{ slug }`). |
| **client/src/pages/CmsPageView.tsx** | **New.** Public page component: loads by slug, renders page title and sections (hero, text, cta, features, links, html with safe sanitizer). Shows "דף לא נמצא" + link home when page missing or not published. |
| **client/src/App.tsx** | Lazy-loaded `CmsPageView`; added route `/page/:slug`; `NavLinks` extended with `termsPageSlug` and `privacyPageSlug`; terms button goes to `/page/{termsSlug}` when set, else opens terms dialog; optional "פרטיות" link when `privacy_page_slug` set. |

---

## 2. Routes Added

- **`/page/:slug`** – Renders the CMS page with the given slug (e.g. `/page/terms`, `/page/privacy`, `/page/about`, `/page/faq`, `/page/contact`, `/page/how-it-works`, `/page/transparency`).  
  Only **published** pages are returned by the API; draft or missing slug shows the safe "דף לא נמצא" state and a link back home.

Existing routes (`/how-it-works`, `/transparency`, etc.) are unchanged and still render their current components.

---

## 3. Public Renderer Added

- **Component:** `CmsPageView.tsx`
  - Uses `useRoute("/page/:slug")` and `trpc.cms.getPublicPageWithSections.useQuery({ slug })`.
  - Renders:
    - **Page title** from `page.title`.
    - **Sections** by `section.type`:
      - **text** – title, subtitle, body (plain).
      - **hero** – optional image, title, subtitle, body, optional CTA button (internal Link or external link).
      - **cta** – title, subtitle, body, optional button.
      - **features / cards** – title, subtitle, body as bullet list (lines).
      - **links** – title, body lines as "label \| url" for links.
      - **html** – body sanitized (whitelist of tags, script/on* removed) then rendered with `dangerouslySetInnerHTML`; fallback to plain text.
  - Internal CTA buttons use wouter `Link`; external URLs use `<a target="_blank">`.
  - Missing/empty slug redirects to `/` via `useEffect`.
  - Loading: spinner; error or no page: "דף לא נמצא" and "חזרה לדף הבית" button.

---

## 4. Public Pages Now CMS-Powered

Any **published** page in the CMS with a slug is reachable at `/page/{slug}`. Examples that can be created in admin and then used publicly:

- about, info, faq, contact, terms, privacy, how-it-works, transparency (or any other slug).

There is no automatic replacement of existing `/how-it-works` or `/transparency` routes; those remain as today. CMS-powered versions are available at `/page/how-it-works` and `/page/transparency` if pages with those slugs exist and are published.

---

## 5. Hardcoded Legal/Info Content Replaced

- **Terms (תקנון):**
  - If **site setting `legal.terms_page_slug`** is set (e.g. `terms`), the header "תקנון" button **navigates to `/page/{slug}`** (CMS page).
  - If **not set**, behavior is unchanged: the existing **terms dialog** (hardcoded content in `App.tsx`) opens. So hardcoded terms remain the fallback when no CMS terms page is configured.
- **Privacy (פרטיות):**
  - A **"פרטיות"** link appears in the nav **only when** `legal.privacy_page_slug` is set, and goes to `/page/{slug}`. No hardcoded privacy content was replaced; this is additive.

No other hardcoded content (e.g. HowItWorks, Transparency component bodies) was removed; they stay as fallbacks or standalone pages.

---

## 6. Legal Settings Integration

- **Site settings** (Phase 12): `legal.terms_page_slug`, `legal.privacy_page_slug`.
- **Layout** passes `siteSettings?.["legal.terms_page_slug"]` and `siteSettings?.["legal.privacy_page_slug"]` into `NavLinks` as `termsPageSlug` and `privacyPageSlug`.
- **NavLinks:**
  - Terms: if `termsPageSlug` is non-empty → `go(\`/page/${slug}\`)`; else → `onOpenTerms()` (dialog).
  - Privacy: if `privacyPageSlug` is non-empty → show "פרטיות" button and `go(\`/page/${slug}\`)`; else → no privacy link.

So legal links use CMS when slugs are set; otherwise only terms fallback (dialog) is used.

---

## 7. Fallback Strategy

- **CMS page missing or draft:** API returns `{ page: null, sections: [] }`. UI shows "דף לא נמצא" and "חזרה לדף הבית". No crash.
- **Terms:** No `legal.terms_page_slug` → open existing terms dialog. With slug set → go to CMS page (or same "דף לא נמצא" if that page doesn’t exist or isn’t published).
- **Privacy:** No `legal.privacy_page_slug` → no privacy link. With slug set → link to `/page/{slug}` (same safe missing-page behavior if not published).
- **Empty slug:** Redirect to `/`.
- **API/network error:** Treated like missing page; "דף לא נמצא" and link home.

---

## 8. Known Limitations

- **HTML sections:** Simple tag whitelist and script/on* stripping only; not a full XSS audit. Avoid storing untrusted HTML in CMS.
- **Section types:** Only text, hero, cta, features/cards, links, html are implemented. Other types fall back to text rendering.
- **Transparency / How-it-works:** Dedicated routes and components are unchanged. CMS versions exist only at `/page/transparency` and `/page/how-it-works` if such pages are created and published.
- **Footer:** No global footer component was added; legal links are in the header/nav only.

---

## 9. Next Recommended Phase

- Add a **global footer** that uses site settings (e.g. footer.company_name, footer.copyright_text, social links) and optional legal links to `/page/{terms_slug}` and `/page/{privacy_slug}`.
- Optionally **redirect** `/terms` and `/privacy` to `/page/{slug}` when legal slugs are set, for shorter URLs.
- Consider **sitemap or meta** (e.g. SEO) for CMS pages using `seoTitle` / `seoDescription` from content_pages.
