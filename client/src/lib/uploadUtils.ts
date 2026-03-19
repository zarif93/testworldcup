/**
 * Shared upload constants and error handling for all image upload flows.
 * Use for: site background, media manager, media picker.
 */

/** Max file size for site background images (bytes). */
export const MAX_SITE_BACKGROUND_BYTES = 8 * 1024 * 1024; // 8MB

/** Max file size for media library images (bytes). */
export const MAX_MEDIA_ASSET_BYTES = 5 * 1024 * 1024; // 5MB

export const ACCEPT_IMAGES = "image/jpeg,image/png,image/gif,image/webp";

/** User-facing message when file is too large (413 or server rejection). */
export const UPLOAD_FILE_TOO_LARGE_MSG =
  "הקובץ גדול מדי להעלאה. נסה קובץ קטן יותר או פורמט WebP.";

/** User-facing message when server returns HTML instead of JSON (e.g. proxy 413). */
export const UPLOAD_SERVER_HTML_MSG =
  "הקובץ גדול מדי להעלאה. נסה קובץ קטן יותר או פורמט WebP.";

/**
 * Returns a user-friendly Hebrew error message for upload failures.
 * Never returns raw HTML or "Unexpected token" style messages.
 */
export function getUploadErrorMessage(error: unknown): string {
  if (error == null) return UPLOAD_FILE_TOO_LARGE_MSG;
  const msg = typeof error === "string" ? error : (error as Error)?.message ?? String(error);
  if (msg.includes("413") || msg.includes("גדול מדי") || msg.includes("Entity Too Large")) return UPLOAD_FILE_TOO_LARGE_MSG;
  if (msg.includes("HTML") || msg.includes("Unexpected token") || msg.startsWith("<")) return UPLOAD_SERVER_HTML_MSG;
  return msg || UPLOAD_FILE_TOO_LARGE_MSG;
}

export function validateImageFile(
  file: File,
  maxBytes: number,
  accept: string = ACCEPT_IMAGES
): { ok: true } | { ok: false; error: string } {
  const acceptList = accept.split(",").map((s) => s.trim());
  const okType = acceptList.some((m) => {
    if (m.endsWith("/*")) return file.type.startsWith(m.replace("/*", ""));
    return file.type === m;
  });
  if (!okType) return { ok: false, error: "נא לבחור קובץ תמונה (JPEG, PNG, GIF, WebP)." };
  if (file.size > maxBytes) return { ok: false, error: `גודל מקסימלי ${Math.round(maxBytes / (1024 * 1024))}MB.` };
  return { ok: true };
}

export type UploadType = "site-background" | "media";

export type UploadResult =
  | { id: number; url: string }
  | { id: number; url: string; thumbnailUrl: string };

/** Set to true to log 413 response body snippet (e.g. in console: window.__UPLOAD_DEBUG = true). */
const UPLOAD_DEBUG_413 = typeof window !== "undefined" && (window as unknown as { __UPLOAD_DEBUG?: boolean }).__UPLOAD_DEBUG;

function logUploadDiagnostics(params: { type: UploadType; file: File; target: string }) {
  const sizeBytes = params.file.size;
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
  const limits = { "site-background": "8MB", media: "5MB" };
  console.log("[upload] file size:", sizeBytes, "bytes (" + sizeMB + " MB)", "| type:", params.type, "| mime:", params.file.type, "| client limit:", limits[params.type], "| target:", params.target);
}

/**
 * Upload image via multipart/form-data to POST /api/upload.
 * Uses streaming upload; no base64. Credentials (cookies) sent for auth.
 * On 413 (from nginx/CDN or app), always shows clean Hebrew message, never raw HTML.
 */
export async function uploadImage(params: {
  type: UploadType;
  file: File;
  activate?: boolean;
  altText?: string | null;
  category?: string | null;
}): Promise<UploadResult> {
  const target = "/api/upload";
  logUploadDiagnostics({ type: params.type, file: params.file, target });

  const form = new FormData();
  form.append("type", params.type);
  form.append("file", params.file, params.file.name);
  if (params.activate !== undefined) form.append("activate", String(params.activate));
  if (params.altText != null && params.altText !== "") form.append("altText", params.altText);
  if (params.category != null && params.category !== "") form.append("category", params.category);

  const res = await fetch(target, {
    method: "POST",
    body: form,
    credentials: "include",
  });

  const text = await res.text();

  // 413 = request body too large (usually nginx/CDN before app). Always show clean message, never HTML.
  if (res.status === 413) {
    if (UPLOAD_DEBUG_413) console.warn("[upload] 413 response body (first 120 chars):", text.slice(0, 120), text.startsWith("<") ? "→ HTML (rejected before app)" : "");
    throw new Error(UPLOAD_FILE_TOO_LARGE_MSG);
  }

  let json: { success?: boolean; message?: string; id?: number; url?: string; thumbnailUrl?: string } | null = null;
  try {
    if (text.startsWith("<")) {
      if (UPLOAD_DEBUG_413) console.warn("[upload] Response is HTML, not JSON:", text.slice(0, 120));
      throw new Error(UPLOAD_SERVER_HTML_MSG);
    }
    json = JSON.parse(text) as typeof json;
  } catch (e) {
    if (e instanceof Error && (e.message === UPLOAD_FILE_TOO_LARGE_MSG || e.message === UPLOAD_SERVER_HTML_MSG)) throw e;
    throw new Error(UPLOAD_SERVER_HTML_MSG);
  }

  if (!res.ok) {
    const message = json?.message ?? "העלאת הקובץ נכשלה.";
    throw new Error(message);
  }
  if (!json?.success || json.id == null || json.url == null) {
    throw new Error(json?.message ?? "תגובת שרת לא תקינה.");
  }
  if (json.thumbnailUrl != null) {
    return { id: json.id, url: json.url, thumbnailUrl: json.thumbnailUrl };
  }
  return { id: json.id, url: json.url };
}
