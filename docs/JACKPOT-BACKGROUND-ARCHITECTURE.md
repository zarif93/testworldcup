# Jackpot background system – production architecture

## Final architecture summary

The Jackpot hero has a **dedicated background image system** (separate from the global site background). It is storage-abstracted, optimized, and safe for production.

---

## DB schema

**Table: `jackpot_background_images`**

| Column             | Type    | Notes                              |
|--------------------|---------|------------------------------------|
| `id`               | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| `filename`         | TEXT    | NOT NULL (full image key, e.g. `xxx.webp`) |
| `thumbnailFilename`| TEXT    | Nullable (blur placeholder key)     |
| `url`              | TEXT    | NOT NULL (public URL for full)     |
| `thumbnailUrl`     | TEXT    | Nullable (public URL for thumb)    |
| `is_active`        | INTEGER | NOT NULL, 0/1, only one row = 1   |
| `display_order`    | INTEGER | NOT NULL, DEFAULT 0 (higher = first in list) |
| `created_at`       | INTEGER | Timestamp                          |

**Index:** `jackpot_background_images_is_active` on `is_active` for fast active lookup.

**Invariants:** At most one row with `is_active = 1`. Activation is done inside a **transaction** (set all to 0, then set chosen id to 1) to avoid race conditions.

---

## API endpoints

### Public (no auth)

| Procedure | Description |
|-----------|-------------|
| `settings.getActiveJackpotBackground` | Returns `{ active: { id, url, thumbnailUrl } \| null, overlayOpacity, vignetteStrength, fxIntensity }`. Used by JackpotHero. |
| `settings.trackJackpotCtaClick` | Body: `{ backgroundId?: number }`. Records `jackpot_cta_click` in analytics with `payload.backgroundId` for conversion vs background. |

### Admin (settings.manage)

| Procedure | Description |
|-----------|-------------|
| `admin.listJackpotBackgroundImages` | List all, ordered by `display_order` DESC then `created_at` DESC. |
| `admin.uploadJackpotBackgroundImage` | Body: `fileBase64`, `originalName`, `mimeType`, `activate?`. Validates, optimizes (1920px, WebP, thumb), saves via storage, inserts row, optionally activates. |
| `admin.setActiveJackpotBackground` | Body: `{ id }`. Transaction: set all inactive, then set this id active. |
| `admin.deleteJackpotBackgroundImage` | Body: `{ id }`. Deletes files from storage and row. |
| `admin.duplicateJackpotBackgroundImage` | Body: `{ id }`. Copies full + thumb files, inserts new row (inactive). |
| `admin.reorderJackpotBackgroundImages` | Body: `{ updates: [{ id, displayOrder }] }`. Updates `display_order` for each id. |
| `admin.setJackpotBackgroundOverlay` | Body: `overlayOpacity?`, `vignetteStrength?`, `fxIntensity?` (0–100). Writes to `site_settings`: `jackpot_bg_overlay_opacity`, `jackpot_bg_vignette_strength`, `jackpot_bg_fx_intensity`. |

---

## Storage path and CDN readiness

- **Current:** Local files under `uploads/jackpot-backgrounds/` (relative to `process.cwd()`).  
- **URLs:** `/uploads/jackpot-backgrounds/<filename>` (served by `express.static(uploadsDir)`).
- **Abstraction:** `server/storage/jackpotBackgroundStorage.ts` exposes:
  - `save(key, buffer)` → returns public URL
  - `getUrl(key)`
  - `delete(key)`
  - `duplicate(key, newKey)` → returns new URL  
  Replacing this module with an S3/CDN implementation (same interface) allows moving assets without changing frontend or DB URLs (if base URL is configured in the abstraction).

---

## Image optimization (upload)

- **Validation:** Mime (JPEG/PNG/GIF/WebP), magic-byte check, size ≤ 8MB, width ≥ 1200px (via sharp metadata).
- **Processing (sharp):** Resize to max width 1920px (fit inside), convert to WebP (quality 85), strip metadata / EXIF (`.rotate()`), produce full and thumbnail (40px width, WebP 60).
- **Output:** Two files per upload: `{nanoid}.webp` (full), `{nanoid}_thumb.webp` (blur placeholder).

---

## Fallback hierarchy (frontend)

1. **Active jackpot background** from `settings.getActiveJackpotBackground` (`.active.url` / `.thumbnailUrl`).
2. **Default fallback image:** `/jackpot-bg-default.webp` if no active (optional static file in `public/`).
3. **Gradient only:** Base gradient is always present; if no image or default fails, only gradient is visible. No randomness.

---

## JackpotHero behavior

- **Background layer:** If `active` or default URL: show blurred thumbnail first, then fade-in full image (hidden `<img>` triggers `onLoad`/`onError`). No layout jump.
- **Overlay:** Dark overlay opacity, vignette strength, and FX (beam/fog/arc) intensity come from API (`overlayOpacity`, `vignetteStrength`, `fxIntensity` 0–100). Applied so the amount stays the visual focus.
- **CTA:** “שחק עכשיו” calls `settings.trackJackpotCtaClick` with `backgroundId: active?.id` then scrolls to tournaments.

---

## Admin UX flow

1. **Site settings → ג׳קפוט – תמונת רקע**
2. **Upload:** Choose file (JPEG/PNG/GIF/WebP, ≤ 8MB, ≥ 1200px width). Optional “הפעל מיד אחרי ההעלאה”. Server validates, resizes, converts to WebP, saves full + thumb, inserts row, optionally activates.
3. **Overlay sliders:** “חשיכת רקע”, “וינייט”, “אפקטי אור” (0–100%). Stored in site_settings and used by JackpotHero.
4. **List:** Each item shows thumb, filename, date, פעילה/לא פעילה. **Active** row is visually dominant (border/ring). **Inactive** rows are visually weaker.
5. **Actions per image:** הפעל / החלף, תצוגה (simulation with mock amount/countdown), תמונת תמונה בלבד, שכפל, **מחק** (destructive style, confirmation dialog; extra warning when deleting the active one).
6. **Reorder:** Up/down buttons to change order; backend updates `display_order` for the list.
7. **Preview simulation:** Dialog with mock “JACKPOT”, “הגרלה בעוד”, “12:00:00”, “₪50,000” on top of the selected background.

---

## Performance strategy

- **Upload:** Resize to 1920px, WebP, thumbnail 40px → smaller payload and fast blur-up.
- **Frontend:** Blur placeholder (thumbnail) shown immediately; full image fades in on load/error to avoid layout shift.
- **Caching:** `getActiveJackpotBackground` and list queries use appropriate `staleTime` (e.g. 60_000 ms for public, 30_000 for admin settings).
- **Mobile:** Single URL today; later the storage layer can expose a mobile variant (e.g. smaller key) and the frontend can choose by viewport.

---

## Security checklist

- [x] Only one active background (DB + transaction).
- [x] Upload validation: mime, magic bytes, size ≤ 8MB, width ≥ 1200px.
- [x] File types restricted to image/jpeg, image/png, image/gif, image/webp.
- [x] Admin actions (upload, activate, delete, duplicate) require `settings.manage` and are logged in `admin_audit_log` with `performedBy`, `action`, `details` (entityType, entityId, ip).
- [x] Storage abstraction keeps paths/keys internal; no user-controlled paths.
- [x] Reorder and overlay updates are idempotent and scoped to admin.

---

## Backend files touched

- `drizzle/schema-sqlite.ts` – `jackpot_background_images` (display_order, thumbnailFilename, thumbnailUrl).
- `server/db.ts` – CREATE TABLE, migrations for new columns, index, list/getActive/create/setActive/delete/duplicate/reorder using storage and image process.
- `server/storage/jackpotBackgroundStorage.ts` – storage abstraction (save, getUrl, delete, duplicate).
- `server/storage/jackpotBackgroundImageProcess.ts` – validate, resize 1920, WebP, thumbnail, strip meta, min width 1200.
- `server/routers.ts` – public getActiveJackpotBackground (with overlay settings), trackJackpotCtaClick; admin list/upload/setActive/delete/duplicate/reorder/setJackpotBackgroundOverlay; audit log on upload/activate/delete/duplicate.
- `server/analytics/events.ts` – `JACKPOT_CTA_CLICK`, `trackJackpotCtaClick`.
- `server/_core/index.ts` – ensure `uploads/jackpot-backgrounds` exists (if not already).

---

## Frontend files touched

- `client/src/components/JackpotHero.tsx` – Fetch active + overlay; blur thumbnail → fade-in full; overlay from settings; default fallback; CTA tracks `backgroundId`.
- `client/src/components/admin/JackpotBackgroundSection.tsx` – Upload (with min size/width note), overlay sliders, list with reorder (up/down), duplicate, dangerous delete, preview simulation dialog.

---

## Optional next steps

- **Auto-contrast:** Analyze image luminance (client or server) and suggest or apply overlay opacity.
- **Mobile:** Serve a smaller asset key for viewport &lt; 768px from the storage layer.
- **CDN:** Implement `jackpotBackgroundStorage` with S3 (or similar) and set public base URL in config.
