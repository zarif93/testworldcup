# Phase 11: CMS / Banners / Page Content Management

## Overview

Phase 11 adds a safe internal CMS layer so the site owner can manage content (banners, homepage hero, announcements, pages, sections) from the admin panel without editing code. All CMS management is guarded by RBAC permissions `cms.view` and `cms.edit`. The content_manager role has both; super_admin and admin have full access.

---

## 1. Files Changed

### Schema & DB
- **`drizzle/schema-sqlite.ts`** – Added tables: `contentPages`, `contentSections`, `siteBanners`, `siteAnnouncements`.
- **`server/db.ts`** – CREATE TABLE for `content_pages`, `content_sections`, `site_banners`, `site_announcements`; schema import extended; CMS helper functions (getActiveBanners, getActiveAnnouncements, list/create/update/delete for pages, sections, banners, announcements).

### API
- **`server/routers.ts`** – Public router `cms`: `getActiveBanners`, `getActiveAnnouncements`, `getPageBySlug`. Admin procedures (with `requirePermission("cms.view")` / `requirePermission("cms.edit")`): listContentPages, getContentPageById, createContentPage, updateContentPage, deleteContentPage; listContentSections, getContentSectionById, createContentSection, updateContentSection, deleteContentSection; listSiteBanners, getSiteBannerById, createSiteBanner, updateSiteBanner, deleteSiteBanner; listSiteAnnouncements, getSiteAnnouncementById, createSiteAnnouncement, updateSiteAnnouncement, deleteSiteAnnouncement.

### Admin UI
- **`client/src/components/admin/CmsSection.tsx`** – New component: tabs (באנרים, הודעות, דפים, סקשנים), list + add/edit/delete modals for each entity.
- **`client/src/pages/AdminPanel.tsx`** – Added `AdminSection` "cms", nav item "תוכן (CMS)" (visible when user has `cms.view` or `cms.edit`), render `<CmsSection />` when section === "cms".

### Frontend integration
- **`client/src/pages/Home.tsx`** – Uses `trpc.cms.getActiveBanners.useQuery({ key: "homepage_hero" })` and `trpc.cms.getActiveAnnouncements.useQuery()`. Renders announcement strip from first active announcement; hero from first active banner (title, subtitle, image, button) with fallback to hardcoded "WinMondial" and default CTA.

---

## 2. Tables / Entities

| Table            | Purpose |
|------------------|--------|
| **content_pages** | Static pages: slug, title, status (draft/published), seo_title, seo_description. |
| **content_sections** | Sections belonging to a page (or global when page_id is null): key, type, title, subtitle, body, image_url, button_text, button_url, sort_order, is_active, metadata_json. |
| **site_banners** | Banners by key (e.g. homepage_hero): title, subtitle, image_url, mobile_image_url, button_text, button_url, is_active, sort_order, starts_at, ends_at, metadata_json. |
| **site_announcements** | Popup/announcement strip: title, body, variant (info/warning/success/neutral), is_active, starts_at, ends_at, metadata_json. |

Naming follows project conventions (camelCase in Drizzle, snake_case table names).

---

## 3. APIs Added

### Public (no auth)
- **`cms.getActiveBanners`** – Input: `{ key?: string }`. Returns active banners (is_active, within starts_at/ends_at), optionally filtered by key, ordered by sort_order.
- **`cms.getActiveAnnouncements`** – Returns active announcements (is_active, within starts_at/ends_at).
- **`cms.getPageBySlug`** – Input: `{ slug: string }`. Returns published content page by slug or null.

### Admin (require cms.view for read, cms.edit for write)
- **Pages:** listContentPages, getContentPageById, createContentPage, updateContentPage, deleteContentPage.
- **Sections:** listContentSections({ pageId }), getContentSectionById, createContentSection, updateContentSection, deleteContentSection.
- **Banners:** listSiteBanners, getSiteBannerById, createSiteBanner, updateSiteBanner, deleteSiteBanner.
- **Announcements:** listSiteAnnouncements, getSiteAnnouncementById, createSiteAnnouncement, updateSiteAnnouncement, deleteSiteAnnouncement.

---

## 4. Admin UI Added

- **Section:** "תוכן (CMS)" in admin sidebar (icon: Image), visible when user has `cms.view` or `cms.edit`.
- **Tabs:** באנרים | הודעות/פופאפ | דפים | סקשנים.
- **Banners:** List by key/title/active; Add/Edit modal (key, title, subtitle, image URL, button text/URL, isActive); Delete confirm.
- **Announcements:** List by title/variant/active; Add/Edit modal (title, body, variant, isActive); Delete confirm.
- **Pages:** List by slug/title/status; Add/Edit modal (slug, title, status); Delete confirm.
- **Sections:** List global sections (pageId null); Add/Edit modal (key, type, title, subtitle, body, isActive); Delete confirm.

Modals use existing Dialog/AlertDialog and trpc mutations; list data from admin procedures.

---

## 5. Frontend Integrations Completed

- **Homepage**
  - **Announcement strip:** Rendered at top when `cms.getActiveAnnouncements` returns at least one item. Styled by variant (info/warning/success/neutral). No strip when no active announcements.
  - **Hero:** If `cms.getActiveBanners({ key: "homepage_hero" })` returns a banner:
    - Optional background image from `imageUrl`.
    - Title = banner.title or fallback "WinMondial".
    - Subtitle = banner.subtitle or fallback "תחרות ניחושי המונדיאל הגדולה".
    - Long description paragraph hidden when a CMS banner is used (fallback text only when no banner).
    - CTA button: text = banner.buttonText or "בחר טורניר", link = banner.buttonUrl or "/tournaments". CTA shown when there are tournaments or when banner has buttonUrl.
  - **Fallback:** If no active banner for homepage_hero, the existing hardcoded hero (WinMondial, default subtitle, default paragraph, "בחר טורניר") is shown unchanged.

---

## 6. Fallback Strategy

- **Banners:** If no active banner for a key (e.g. homepage_hero), frontend uses default hero content and default CTA. No errors, no blank hero.
- **Announcements:** If no active announcements, the announcement strip is not rendered.
- **Page by slug:** If slug not found or not published, `getPageBySlug` returns null; future static-page route can show 404 or default.
- **Admin:** If user lacks cms.view/cms.edit, CMS nav item is hidden and procedures return FORBIDDEN.

---

## 7. Future Extension Points

- **Static page route:** Add a route (e.g. `/page/:slug`) that calls `cms.getPageBySlug` and renders content_sections for that page (or a simple body field on the page).
- **Sections by page:** In CmsSection, allow choosing a page and listing/editing sections for that page (listContentSections already supports pageId).
- **Banner scheduling:** Admin UI already has starts_at/ends_at in the schema; form modals can be extended to set dates for banners/announcements.
- **Rich body / SEO:** content_pages has seo_title, seo_description; content_sections has body. Can add a rich-text editor or markdown for body later.
- **site_settings:** Existing key-value store remains for global settings (e.g. WhatsApp number, withdrawal hours); can be wired to CMS or left as admin-only key/value.

---

## 8. Remaining Hardcoded Areas (for later)

- **WhatsApp / CTA in header/footer:** Still hardcoded in App.tsx / layout (e.g. 972538099212). Can be moved to site_settings or a CMS “contact” block.
- **Terms content:** App.tsx terms dialog content is hardcoded; could become a published content page or site_settings.
- **Other static pages:** HowItWorks, Transparency, etc. are still code-backed; can later be replaced by content_pages + sections or kept as-is.
- **Default hero long paragraph:** The string "FIFA World Cup 2026 – שלב הבתים..." is still in Home.tsx as fallback when no CMS banner; can add a third CMS field (e.g. “description”) to replace it later.

---

## 9. RBAC

- **cms.view** – Required to see CMS section and to call admin list/get CMS procedures.
- **cms.edit** – Required to create/update/delete pages, sections, banners, announcements.
- **content_manager** role has cms.view + cms.edit (seeded in db.ts).
- **super_admin** and **admin** have all permissions and can manage CMS.

No changes were made to competition, auth, or reporting flows; CMS is additive and fail-safe.
