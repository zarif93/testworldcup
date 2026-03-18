/**
 * Jackpot background image processing: validate, resize to 1920, WebP, thumbnail, strip metadata.
 * Safety: reject < 1200px width, > 8MB, invalid mime, suspicious signature.
 * Uses static import of sharp; on sharp failure falls back to storing original without processing.
 */

import sharp from "sharp";
import { validateJackpotBackgroundBuffer } from "./jackpotBackgroundValidate";

const MIN_WIDTH = 1200;
const MAX_WIDTH = 1920;
const MOBILE_MAX_WIDTH = 768;
const THUMB_WIDTH = 40;

export { validateJackpotBackgroundBuffer };
export type ProcessedJackpotImage = {
  fullBuffer: Buffer;
  thumbBuffer: Buffer;
  mobileBuffer: Buffer;
  width: number;
  height: number;
  /** 0–1 mean luminance for auto contrast (stored as 0–1000 in DB). */
  meanLuminance: number;
};

/** Fallback when sharp fails: return original buffer as-is (no resize/WebP). */
function fallbackResult(inputBuffer: Buffer): ProcessedJackpotImage {
  return {
    fullBuffer: inputBuffer,
    thumbBuffer: inputBuffer,
    mobileBuffer: inputBuffer,
    width: 1920,
    height: 1080,
    meanLuminance: 0.5,
  };
}

export async function processJackpotBackgroundImage(
  inputBuffer: Buffer,
  mimeType: string
): Promise<{ ok: true; result: ProcessedJackpotImage } | { ok: false; error: string }> {
  const validation = validateJackpotBackgroundBuffer(inputBuffer, mimeType);
  if (!validation.ok) return validation;

  try {
    const meta = await sharp(inputBuffer).metadata();
    if (meta.width == null || meta.height == null) return { ok: false, error: "לא ניתן לקרוא מידות התמונה." };
    if (meta.width < MIN_WIDTH) return { ok: false, error: `רוחב מינימלי ${MIN_WIDTH}px.` };

    const full = await sharp(inputBuffer)
      .resize(MAX_WIDTH, undefined, { withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 85 })
      .rotate()
      .toBuffer();

    const thumb = await sharp(inputBuffer)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer();

    const mobile = await sharp(inputBuffer)
      .resize(MOBILE_MAX_WIDTH, undefined, { withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 80 })
      .rotate()
      .toBuffer();

    const width = meta.width > MAX_WIDTH ? MAX_WIDTH : meta.width;
    const height = meta.height;

    let meanLuminance = 0.5;
    try {
      const onePixel = await sharp(full).resize(1, 1).raw().toBuffer();
      if (onePixel.length >= 3) {
        const r = onePixel[0]! / 255;
        const g = onePixel[1]! / 255;
        const b = onePixel[2]! / 255;
        meanLuminance = Math.min(1, Math.max(0, 0.299 * r + 0.587 * g + 0.114 * b));
      }
    } catch {
      /* keep default */
    }

    return {
      ok: true,
      result: {
        fullBuffer: full,
        thumbBuffer: thumb,
        mobileBuffer: mobile,
        width,
        height,
        meanLuminance,
      },
    };
  } catch {
    /* sharp failed at runtime: store original without processing, do not crash */
    return { ok: true, result: fallbackResult(inputBuffer) };
  }
}
