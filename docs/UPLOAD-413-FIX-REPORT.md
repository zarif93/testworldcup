# Image Upload 413 & Global Upload Fix – Report

**Goal:** Fix 413 Request Entity Too Large and non-JSON (HTML) responses across all image upload flows, and standardize validation and error UX.

---

## 1. Upload flows reviewed

| Flow | Location | Method | Max size (client) | Backend |
|------|----------|--------|--------------------|---------|
| **Site background** | Admin → Settings → תמונות רקע | tRPC mutation `uploadSiteBackgroundImage` | 8MB | `createSiteBackgroundImage` (db.ts), base64 |
| **Jackpot background** | Admin → ניהול ג׳קפוט | tRPC mutation `uploadJackpotBackgroundImage` | 8MB | `createJackpotBackgroundImage` (db.ts), base64 + sharp |
| **Media library** | Admin → ניהול מדיה | tRPC mutation `uploadMediaAsset` | 5MB | `createMediaAsset` (db.ts), base64 |
| **Media picker (modal)** | CMS banner/section forms | Same `uploadMediaAsset` | 5MB | Same |

**No other image upload entry points** were found (no separate CMS upload or user avatar upload using a different path).

---

## 2. Where 413 was happening

- **Nginx:** Default `client_max_body_size` is **1m**. Requests with body > 1MB (e.g. base64 image) were rejected by nginx **before** reaching Express, returning nginx’s **HTML** 413 page. That led to "Unexpected token <" when the frontend tried to parse the response as JSON.
- **Express:** `express.json({ limit: "50mb" })` was already in place, so Express itself did not return 413 for typical upload sizes once the request reached the app.
- **Frontend:** No special handling for 413 or non-JSON; raw error or parse failure was shown.

---

## 3. What was changed globally

### Nginx (reverse proxy)

- **Files:** `nginx-worldcup2026.conf`, `deployment/nginx-worldcup2026.conf`
- **Change:** Set `client_max_body_size 50m;` in the repo’s nginx configs. On the **live** server, the active server block must include this (see docs/UPLOAD-413-LIVE-SERVER-FIX.md).
- **Reason:** If the directive is missing or small (e.g. default 1m), nginx returns 413 with HTML before the app. 50m allows multipart uploads up to 50 MB.

### Express (backend)

- **File:** `server/_core/index.ts`
- **Changes:**
  - Comment above `express.json` / `express.urlencoded`: documents body limit; uploads use multipart and multer 50 MB.
  - Global API error handler: if the error is “payload too large” (or status 413), respond with **413** and a **JSON** body with the Hebrew message: `"הקובץ גדול מדי להעלאה. נסה קובץ קטן יותר או פורמט WebP."` so the app never leaks HTML.

### Frontend – tRPC fetch

- **File:** `client/src/main.tsx`
- **Changes:** In `trpcSafeFetch`:
  - If the response is **non-JSON** (e.g. HTML) or **status 413**, throw an error with the same Hebrew message above instead of raw HTML or generic “תגובה לא תקינה”.
  - After parsing JSON, if **status === 413**, throw the same message so any future 413-from-our-server is handled the same way.

### Frontend – shared upload util

- **File:** `client/src/lib/uploadUtils.ts` (new)
- **Contents:**
  - Constants: `MAX_SITE_BACKGROUND_BYTES` (8MB), `MAX_JACKPOT_BACKGROUND_BYTES` (8MB), `MAX_MEDIA_ASSET_BYTES` (5MB), `ACCEPT_IMAGES`, `UPLOAD_FILE_TOO_LARGE_MSG`, `UPLOAD_SERVER_HTML_MSG`.
  - `getUploadErrorMessage(error)`: maps any upload error (including 413, HTML, “Unexpected token”) to a user-friendly Hebrew string; never returns raw HTML or parser errors.
  - `validateImageFile(file, maxBytes, accept)`: client-side validation (type + size); returns `{ ok: true }` or `{ ok: false, error: string }`.

### Frontend – upload UIs

- **Files:**
  - `client/src/components/admin/BackgroundImagesSection.tsx`
  - `client/src/components/admin/JackpotBackgroundSection.tsx`
  - `client/src/components/admin/MediaManagerSection.tsx`
  - `client/src/components/admin/MediaPickerModal.tsx`
- **Changes:**
  - Use `validateImageFile` with the appropriate max size and `ACCEPT_IMAGES` before starting upload.
  - Use `getUploadErrorMessage(e)` in mutation `onError` so 413 and non-JSON responses show the same clean Hebrew message.
  - Use shared constants for max size and accept string (no duplicate literals).

---

## 4. Multipart vs base64

- **Current state (updated):** All image uploads have been **migrated to multipart/form-data**. They use `POST /api/upload` with `FormData`; no base64 or tRPC for the file payload. See **docs/UPLOAD-MULTIPART-ARCHITECTURE.md** for the full architecture.
- **Result:** 413 is avoided when nginx (and any CDN) allow up to 50 MB; app uses multer 50 MB. Error handling remains standardized (JSON only, clean Hebrew messages in the UI).

---

## 5. Exact nginx and body limits

| Layer | Limit | Config / file |
|-------|--------|----------------|
| **Nginx** | **50m** (50 MB) | `client_max_body_size 50m;` in repo configs; **on live server** the active config must be updated (see docs/UPLOAD-413-LIVE-SERVER-FIX.md). |
| **Express JSON** | **50mb** | `express.json({ limit: "50mb" })` in `server/_core/index.ts` |
| **Express urlencoded** | **50mb** | `express.urlencoded({ limit: "50mb", extended: true })` in `server/_core/index.ts` |

---

## 6. Files and configs changed

| File | Change |
|------|--------|
| `nginx-worldcup2026.conf` | `client_max_body_size 50m;` |
| `deployment/nginx-worldcup2026.conf` | `client_max_body_size 50m;` |
| **Live server** | Must set in the **actual** server block (run `scripts/diagnose-upload-413.sh` on server). |
| `server/_core/index.ts` | Comment for body limits; error handler returns 413 + JSON for payload-too-large |
| `client/src/main.tsx` | Import `UPLOAD_FILE_TOO_LARGE_MSG`; in `trpcSafeFetch`, 413 and non-JSON → friendly Hebrew error |
| `client/src/lib/uploadUtils.ts` | **New:** constants, `getUploadErrorMessage`, `validateImageFile` |
| `client/src/components/admin/BackgroundImagesSection.tsx` | Use uploadUtils; `onError` → `getUploadErrorMessage(e)`; validate with `validateImageFile` |
| `client/src/components/admin/JackpotBackgroundSection.tsx` | Same as above |
| `client/src/components/admin/MediaManagerSection.tsx` | Same as above |
| `client/src/components/admin/MediaPickerModal.tsx` | Same as above |

---

## 7. Max upload size supported safely

- **Nginx:** Must be **50m** in the **live** server block; otherwise 413 + HTML. See docs/UPLOAD-413-LIVE-SERVER-FIX.md.
- **Multer:** 50 MB per file. Express JSON 50 MB for other API routes.
- **Client validation:** 8MB for site/Jackpot backgrounds, 5MB for media. Users are blocked from starting an upload above these.
- **Practical safe max:** **50 MB** at server when nginx (and CDN) are set correctly. Client limits stay 8MB / 5MB for UX.

---

## 8. Nginx reload (production)

After deploying the nginx config changes:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. Error UX summary

- **Before:** 413 or proxy HTML could surface as raw HTML or "Unexpected token <" in the UI.
- **After:**
  - All upload mutations show errors via `getUploadErrorMessage(e)`.
  - 413 (from nginx or Express) and non-JSON (e.g. HTML) responses are mapped to: **"הקובץ גדול מדי להעלאה. נסה קובץ קטן יותר או פורמט WebP."**
  - No raw HTML or parser-error strings are shown to the user.

---

## 10. Verification checklist

- [ ] **Site background upload:** Choose image &lt; 8MB → upload succeeds; choose &gt; 8MB → client toast "גודל מקסימלי 8MB"; if client bypass and nginx 413 → toast shows the friendly Hebrew message.
- [ ] **Jackpot background upload:** Same as above (8MB).
- [ ] **Media manager upload:** Same with 5MB limit.
- [ ] **Media picker (modal) upload:** Same with 5MB limit.
- [ ] **Oversized file:** With nginx 50m on the live server, requests up to 50 MB reach the app. If nginx is not updated, 413 returns HTML but frontend shows the friendly Hebrew message.
- [ ] **Invalid type:** All four UIs validate type and show "נא לבחור קובץ תמונה (JPEG, PNG, GIF, WebP)."

All upload entry points now share the same validation and error-handling pattern and never show raw HTML or "Unexpected token" to the user.
