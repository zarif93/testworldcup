# Image Upload Architecture – Multipart/Form-Data (Production)

This document describes the **production upload flow** after the full migration from base64 JSON to **multipart/form-data** with streaming to disk.

---

## 1. New upload flow architecture

- **Single REST endpoint:** `POST /api/upload`
- **Content-Type:** `multipart/form-data` (browser sets boundary automatically).
- **Auth:** Same as admin tRPC: cookies + optional admin code. Context is created via `createContext(req, res)`; user must be admin and have the required permission for the upload `type`.
- **Streaming:** Multer writes the file **directly to disk** (temp directory). The request body is never fully loaded into memory.
- **Processing:** Server moves/renames the temp file to the final path (or, for jackpot, reads from path with sharp and writes WebP outputs). Sharp reads from **file path**, so the image is streamed from disk; only the processed outputs (e.g. WebP buffers) are in memory.
- **Response:** Always JSON: `{ success: true, id, url [, thumbnailUrl ] }` or `{ success: false, message }`.

### Flow summary

1. **Client:** Validates file (size/type) with `validateImageFile()`, builds `FormData` with `type`, `file`, and optional `activate`, `altText`, `category`. Sends `POST /api/upload` with `credentials: 'include'`.
2. **Server (multer):** Parses multipart, streams file to `uploads/temp/<unique>.ext`, enforces 16MB limit and image type filter. On success, `req.file` has `path`, `originalname`, `mimetype`.
3. **Server (auth):** Builds context from request, checks admin + permission by `type` (site-background/jackpot-background → `settings.manage`, media → `cms.edit`). Returns 401/403 JSON if unauthorized.
4. **Server (handler):** Calls the appropriate `create*FromFile(tempPath, ...)`:
   - **Site background:** Move temp → `uploads/backgrounds/<id>.ext`, sharp metadata from path, insert row, return `{ id, url }`.
   - **Jackpot background:** `processJackpotBackgroundImageFromFile(tempPath)` (sharp reads from path, outputs WebP buffers), save to storage, insert row, audit log, return `{ id, url, thumbnailUrl }`.
   - **Media:** Move temp → `uploads/<id>.ext`, insert row, return `{ id, url }`.
5. **Server (cleanup):** In `finally`, unlink temp file (no-op if already moved).
6. **Client:** Parses JSON; on success invalidates relevant tRPC queries and shows toast; on error shows `getUploadErrorMessage(e)`.

---

## 2. Files changed (global)

| Area | File | Change |
|------|------|--------|
| **Server – upload API** | `server/upload/routes.ts` | **New.** Multer diskStorage (16MB), auth + permission by type, single `POST /api/upload` handler. |
| **Server – mount** | `server/_core/index.ts` | Create `uploads/temp`, call `registerUploadRoutes(app)`, comment update for JSON limit. |
| **Server – DB** | `server/db.ts` | Added `createSiteBackgroundImageFromFile`, `createJackpotBackgroundImageFromFile`, `createMediaAssetFromFile`. Kept legacy base64 `create*` for reference but they are no longer used by any route. |
| **Server – jackpot processor** | `server/storage/jackpotBackgroundImageProcess.ts` | Added `processJackpotBackgroundImageFromFile(inputPath, mimeType)` using `sharp(inputPath)` (stream from disk). |
| **Server – jackpot validate** | `server/storage/jackpotBackgroundValidate.ts` | Added `validateJackpotBackgroundFile(filePath, mimeType)` (stat + 12-byte magic read). |
| **Server – tRPC** | `server/routers.ts` | Removed `uploadSiteBackgroundImage`, `uploadJackpotBackgroundImage`, `uploadMediaAsset` mutations and their imports. |
| **Client – shared util** | `client/src/lib/uploadUtils.ts` | Added `uploadImage({ type, file, activate?, altText?, category? })` (FormData + fetch), `UploadType`, `UploadResult`. |
| **Client – UIs** | `BackgroundImagesSection.tsx`, `JackpotBackgroundSection.tsx`, `MediaManagerSection.tsx`, `MediaPickerModal.tsx` | Replaced tRPC upload mutations with `uploadImage()` + local `doUpload()`; removed FileReader/base64. |
| **Dependencies** | `package.json` | Added `multer`, `@types/multer`. |

---

## 3. Memory behavior

- **Before (base64):** Entire file was read in the browser as base64, then sent in JSON. Server parsed JSON into a large string, then `Buffer.from(base64)` held the full file in memory. Sharp then read from that buffer. So the file existed in memory at least twice (string + buffer) on the server.
- **After (multipart):**
  - **Multer:** Writes the request body stream directly to a file in `uploads/temp/`. No full-file buffer in Node.
  - **Site background:** Temp file is moved to final path; `sharp(filePath).metadata()` reads from disk (streaming). Only small metadata in memory.
  - **Jackpot:** `sharp(inputPath)` pipelines read from disk and output WebP buffers. Only the processed buffers (full, thumb, mobile) are in memory, not the original decoded image.
  - **Media:** Temp file is moved to final path; no image decoding.

So the **full image is never loaded into Node memory**; only the stream to disk and (for jackpot) the compressed WebP outputs.

---

## 4. Limits and max safe upload size

| Layer | Limit | Notes |
|-------|--------|------|
| **Nginx** | `client_max_body_size 50m` | 50 MB request body; must be set on the **live** server block (see docs/UPLOAD-413-LIVE-SERVER-FIX.md). |
| **Multer** | `limits.fileSize: 50 * 1024 * 1024` | 50 MB per file. |
| **Client (site/jackpot)** | 8 MB | `validateImageFile` with `MAX_*_BYTES`. |
| **Client (media)** | 5 MB | Same. |

**Max safe upload size after change:** **50 MB** per request (file + multipart overhead). Client-side limits (8 MB / 5 MB) remain for UX. If you get 413 + HTML, the limit is applied before the app (nginx or CDN); see **docs/UPLOAD-413-LIVE-SERVER-FIX.md**.

---

## 5. Performance improvement

- **No base64 overhead:** Payload size is ~1.33× the binary file for base64; multipart sends the raw file. So **~25% less data** on the wire for the same image.
- **No JSON parse of huge body:** Express no longer parses a multi‑megabyte JSON body for uploads; multer streams directly to disk, reducing CPU and memory spikes.
- **Streaming on server:** File is written to disk as it arrives; sharp then reads from path instead of holding the whole image in memory. This scales better for concurrent uploads and larger images.

---

## 6. Error handling and UX

- All upload responses are **JSON** (success or error). No raw HTML (e.g. nginx 413) is returned to the client logic; the client treats non-JSON/413 as the same Hebrew message via `getUploadErrorMessage`.
- Multer `LIMIT_FILE_SIZE` is mapped to the same Hebrew message and sent as 400 JSON.
- Client still uses `validateImageFile` and `getUploadErrorMessage` so UX is unchanged: clear Hebrew messages, no “Unexpected token” or raw HTML.

---

## 7. Verification checklist

- [ ] Site background: upload &lt; 8 MB image → success; &gt; 8 MB → client validation error; &gt; 50 MB → server 400 JSON (when nginx is 50m).
- [ ] Jackpot background: same (8 MB client, 50 MB server when nginx is set).
- [ ] Media manager & media picker: same with 5 MB client limit.
- [ ] All responses are JSON; no HTML in UI.
- [ ] Unauthorized or wrong permission → 401/403 JSON.

---

## 8. Nginx

Use `client_max_body_size 50m` in the **server** block that serves the live domain. Ensure the **actual** nginx config on the server has this (see docs/UPLOAD-413-LIVE-SERVER-FIX.md). Reload after any config change:

```bash
sudo nginx -t && sudo systemctl reload nginx
```
