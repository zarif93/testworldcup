# Phase 15: Media / Image Uploads / Asset Management

## Summary

A practical media layer was added so the site owner can upload images from admin and use them in CMS banners and sections. Uploaded files are stored under `uploads/` and served at `/uploads/*`. Manual URL entry remains supported; existing saved URLs are unchanged.

---

## 1. Files Changed

| File | Change |
|------|--------|
| **drizzle/schema-sqlite.ts** | Added `media_assets` table and `mediaAssets`, `MediaAsset`, `InsertMediaAsset`. |
| **server/db.ts** | Added `CREATE TABLE IF NOT EXISTS media_assets` in init; added `listMediaAssets`, `createMediaAsset`, `deleteMediaAsset`, `updateMediaAsset`. |
| **server/_core/index.ts** | Mounted `express.static(uploadsDir)` at `/uploads`. |
| **server/routers.ts** | Imported media helpers; added admin procedures `listMediaAssets`, `uploadMediaAsset`, `deleteMediaAsset`, `updateMediaAsset` (all guarded by `cms.edit`). |
| **client/src/components/admin/MediaPickerModal.tsx** | **New.** Modal: upload (file → base64 → API), grid of assets, select/copy/delete; used from CMS forms. |
| **client/src/components/admin/MediaManagerSection.tsx** | **New.** Admin section: upload, grid with copy URL and delete. |
| **client/src/pages/AdminPanel.tsx** | Added section type `"media"`, nav item "מדיה", render `MediaManagerSection` when section is media. |
| **client/src/components/admin/CmsSection.tsx** | Banner form: added `mobileImageUrl`, MediaPicker for imageUrl and mobileImageUrl; Section form: added `imageUrl` field and MediaPicker. |

---

## 2. New Media Schema / Entity

**Table: `media_assets`**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| filename | TEXT | Stored filename (e.g. nanoid + ext) |
| originalName | TEXT | User-facing original name |
| mimeType | TEXT | e.g. image/jpeg |
| sizeBytes | INTEGER | File size |
| url | TEXT | Public URL path, e.g. `/uploads/xxx.jpg` |
| altText | TEXT | Optional alt text |
| category | TEXT | Optional category for filter |
| metadataJson | TEXT (JSON) | Reserved for future |
| createdAt | INTEGER (timestamp) | |
| updatedAt | INTEGER (timestamp) | |

---

## 3. APIs Added

| Procedure | Auth | Input | Description |
|-----------|------|--------|-------------|
| **admin.listMediaAssets** | cms.view | `{ category?: string \| null }` optional | Returns all assets (or filtered by category), newest first. |
| **admin.uploadMediaAsset** | cms.edit | `{ fileBase64, originalName, mimeType, altText?, category? }` | Validates type/size, writes file to `uploads/`, inserts row; returns `{ id, url }`. |
| **admin.deleteMediaAsset** | cms.edit | `{ id }` | Deletes file from disk and row. |
| **admin.updateMediaAsset** | cms.edit | `{ id, altText?, category? }` | Updates alt text and/or category. |

**Validation:** Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`. Max size 5MB.

---

## 4. Admin UI Added

- **מדיה (Media) section** in admin nav (visible when user has cms.view/cms.edit). Renders `MediaManagerSection`: upload button (file input), grid of thumbnails with copy-URL and delete.
- **MediaPickerModal:** Used from Banner and Section forms. Upload area + grid of assets; "בחר" sets the form field to the asset URL and closes; copy and delete available in the modal.

---

## 5. CMS / Media Picker Integrations

- **Banners:** "קישור תמונה" and "קישור תמונה מובייל" each have an input plus "בחר מהספרייה". Picker sets the corresponding URL (relative, e.g. `/uploads/xxx.jpg`). Manual paste still works.
- **Sections:** "קישור תמונה (אופציונלי)" added with input + "בחר מהספרייה". Section create/update now send `imageUrl`; existing sections without imageUrl unchanged.

---

## 6. Upload / Storage Strategy

- **Directory:** `uploads/` at project root (`process.cwd()/uploads`). Created on first upload if missing.
- **Naming:** `{nanoid(12)}.{ext}` (ext from original name, whitelisted to jpg/jpeg/png/gif/webp).
- **Serving:** Express serves `uploads` at `/uploads` so that `url` stored in DB (e.g. `/uploads/abc123.jpg`) is the same path used by the browser.
- **Upload path:** Client reads file as Data URL, strips data-URL prefix, sends base64 in `uploadMediaAsset` mutation. Server decodes, validates, writes to disk, inserts row.

---

## 7. Fallback Behavior

- **Existing image URLs:** No change. Any existing `imageUrl` / `mobileImageUrl` in banners or sections (e.g. `https://...`) continues to work.
- **Manual URL:** Input fields remain; admin can paste any URL. Picker only sets the value when an asset is chosen.
- **Missing media:** If an asset is deleted, CMS entities still hold the URL; frontend will show broken image until the field is updated. No crash.
- **No uploads:** Media manager shows empty state; picker shows "אין תמונות" and upload CTA.

---

## 8. Remaining Limitations

- **Images only:** Only image types above are allowed; no generic file uploads.
- **No CDN:** Files are served from the app server; for scale, consider moving to object storage + CDN later.
- **Category filter:** Optional category is stored and can be passed to `listMediaAssets`; admin UI does not yet expose a category filter.
- **updateMediaAsset:** Alt text and category are updatable via API but not yet edited in the admin media grid.
- **Section form:** Section create mutation already accepted `imageUrl` in the API; the form previously omitted it; form now sends it. No schema change.

---

## RBAC

- **listMediaAssets:** requires **cms.view** (so content editors can pick existing media in forms).
- **uploadMediaAsset, deleteMediaAsset, updateMediaAsset:** require **cms.edit**.
The Media section is shown when the user has cms.view; upload/delete/update are forbidden for cms.view-only users.

---

## Recommended Next Phase

- Add category filter and optional alt/category edit in the media grid.
- Optionally allow non-image file types (e.g. PDF) with separate validation and limits.
- Consider image optimization (resize/compress) on upload.
- If deploying to multiple instances, replace local `uploads/` with object storage (S3-compatible) and use public URLs in `url`.
