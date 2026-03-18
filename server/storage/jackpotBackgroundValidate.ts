/**
 * Jackpot background validation only (no sharp dependency).
 * Used by processor and by db fallback when sharp is unavailable.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

function checkMagic(buf: Buffer): boolean {
  for (const { mime, bytes } of MAGIC) {
    if (bytes.length <= buf.length && bytes.every((b, i) => buf[i] === b)) {
      if (mime === "image/webp" && buf.length >= 12) {
        return buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
      }
      return true;
    }
  }
  return false;
}

export function validateJackpotBackgroundBuffer(
  buf: Buffer,
  mimeType: string
): { ok: true } | { ok: false; error: string } {
  if (buf.length === 0) return { ok: false, error: "הקובץ ריק." };
  if (buf.length > MAX_BYTES) return { ok: false, error: "גודל מקסימלי 8MB." };
  if (!ALLOWED_MIMES.includes(mimeType)) return { ok: false, error: "סוג קובץ לא נתמך. אפשר רק: JPEG, PNG, GIF, WebP." };
  if (!checkMagic(buf)) return { ok: false, error: "תוכן הקובץ לא תואם לתמונה." };
  return { ok: true };
}
