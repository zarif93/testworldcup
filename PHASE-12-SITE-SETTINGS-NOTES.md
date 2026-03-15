# Phase 12: Site Settings / Global Configuration Center

## Summary

Centralized global site settings so the site owner can control key business/configuration values from the admin panel without editing code. Existing CMS and competition platform are unchanged.

---

## 1. Files Changed

| File | Change |
|------|--------|
| `server/db.ts` | Added `PUBLIC_SITE_SETTINGS_KEYS`, `DEFAULT_PUBLIC_SETTINGS`, `PublicSiteSettings` type, `getPublicSiteSettings()`, `setSiteSettingsBatch()`. |
| `server/routers.ts` | Added public `settings.getPublic` router; admin `getSiteSettings` / `setSiteSetting` / `setSiteSettingsBatch` guarded with `settings.manage`. |
| `client/src/components/admin/SettingsSection.tsx` | **New.** Admin UI for editing all public settings by group (contact, cta, social, footer, legal, brand). |
| `client/src/pages/AdminPanel.tsx` | Added "settings" section type, `canManageSettings`, nav item "הגדרות אתר", render `<SettingsSection />` when section is settings. |
| `client/src/App.tsx` | Uses `trpc.settings.getPublic.useQuery()` in Layout; WhatsApp URL and site name from settings with fallbacks; `NavLinks` receives `whatsappUrl`; floating WhatsApp button uses `whatsappUrl`. |
| `client/src/pages/Register.tsx` | Uses `trpc.settings.getPublic.useQuery()`; post-registration WhatsApp link uses `contact.whatsapp` with fallback `972538099212`. |

---

## 2. Settings Keys Added/Used

All keys are flat strings (e.g. `"contact.whatsapp"`). Public API returns only these keys with defaults.

| Group | Keys |
|-------|------|
| **contact** | `contact.whatsapp`, `contact.phone`, `contact.email`, `contact.address` |
| **cta** | `cta.primary_text`, `cta.primary_url`, `cta.secondary_text`, `cta.secondary_url` |
| **social** | `social.instagram`, `social.facebook`, `social.telegram` |
| **footer** | `footer.company_name`, `footer.copyright_text` |
| **legal** | `legal.terms_page_slug`, `legal.privacy_page_slug` |
| **brand** | `brand.site_name`, `brand.tagline` |

**Defaults (server):**  
- `contact.whatsapp`: `"972538099212"`  
- `cta.primary_text`: `"בחר טורניר"`, `cta.primary_url`: `"/tournaments"`  
- `brand.site_name`: `"WinMondial"`, `brand.tagline`: `"תחרות ניחושי המונדיאל הגדולה"`  
- All others: `""` unless noted above.

---

## 3. APIs Added

- **Public**
  - `trpc.settings.getPublic.useQuery()`  
    Returns `PublicSiteSettings` (all keys above with server-side defaults). No auth.

- **Admin** (all require `settings.manage`)
  - `trpc.admin.getSiteSettings.useQuery()`  
    Returns full key/value map (all keys in DB).
  - `trpc.admin.setSiteSetting.useMutation({ key, value })`  
    Sets a single key.
  - `trpc.admin.setSiteSettingsBatch.useMutation(record)`  
    Sets multiple keys in one call. Used by the admin Settings UI.

---

## 4. Admin UI Added

- **Section:** "הגדרות אתר" (settings), visible only when user has `settings.manage` or is super-admin.
- **Component:** `SettingsSection.tsx`  
  - Loads settings via `admin.getSiteSettings`.  
  - Renders groups: פרטי קשר, כפתורי CTA ראשיים, רשתות חברתיות, פוטר, משפטי/דפים, מיתוג.  
  - Editable text inputs per key; save button calls `setSiteSettingsBatch` with current form state.  
  - Toasts on success/error.

---

## 5. Frontend Integrations Completed

- **App.tsx (Layout)**  
  - `settings.getPublic` used for:  
    - **WhatsApp:** `contact.whatsapp` → used in header nav link and floating mobile button. Fallback: `972538099212`.  
    - **Site name:** `brand.site_name` → used in header logo/title. Fallback: `WinMondial`.  
  - `NavLinks` receives `whatsappUrl` prop; uses it or falls back to `https://wa.me/972538099212`.

- **Register.tsx**  
  - After successful registration, opens WhatsApp with number from `contact.whatsapp`. Fallback: `972538099212`.

---

## 6. Fallback Behavior

- **Server:** `getPublicSiteSettings()` merges DB values over `DEFAULT_PUBLIC_SETTINGS`. Missing or null keys get the default; values are trimmed strings.
- **Client:**  
  - If `settings.getPublic` is loading or fails, or a key is missing/empty:  
    - WhatsApp: number `972538099212` and URL `https://wa.me/972538099212`.  
    - Site name: `"WinMondial"`.  
  - No rendering or runtime errors from missing settings.

---

## 7. Remaining Hardcoded / For Later

- **Terms dialog:** Content of the terms popup in `App.tsx` is still hardcoded HTML. `legal.terms_page_slug` / `legal.privacy_page_slug` are stored and editable but not yet used to link to CMS pages or replace the dialog.
- **Footer:** No global footer component yet using `footer.company_name`, `footer.copyright_text`, or social links. Can be added in a future pass.
- **CTA buttons:** `cta.primary_*` and `cta.secondary_*` are in settings and admin UI but not yet used on landing/home or other pages; those still use existing copy/links where present.
- **Social links:** `social.instagram`, `social.facebook`, `social.telegram` are editable but not yet rendered in header/footer.

---

## RBAC

- Admin procedures `getSiteSettings`, `setSiteSetting`, and `setSiteSettingsBatch` are protected with `requirePermission("settings.manage")`.  
- Permission `settings.manage` exists in DB seed and is included for super-admin and legacy admin (no roles).  
- Admin panel shows "הגדרות אתר" only when user has `settings.manage` or is super-admin.
