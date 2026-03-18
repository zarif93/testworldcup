/**
 * Jackpot background storage abstraction – CDN-ready.
 * Today: local uploads/jackpot-backgrounds/. Later: swap implementation to S3/CDN without changing callers.
 */

const SUBDIR = "jackpot-backgrounds";

export type JackpotBackgroundStorage = {
  /** Save buffer under key (filename). Returns public URL. */
  save(key: string, buffer: Buffer): Promise<string>;
  /** Return public URL for key (no upload). */
  getUrl(key: string): string;
  /** Delete file by key. */
  delete(key: string): Promise<void>;
  /** Copy key to newKey (read from disk, write new file). Returns new URL. */
  duplicate(key: string, newKey: string): Promise<string>;
};

async function basePath(): Promise<string> {
  const path = await import("path");
  return path.join(process.cwd(), "uploads", SUBDIR);
}

function publicBaseUrl(): string {
  return `/uploads/${SUBDIR}`;
}

export const jackpotBackgroundStorage: JackpotBackgroundStorage = {
  async save(key: string, buffer: Buffer): Promise<string> {
    const path = await import("path");
    const fs = await import("fs/promises");
    const dir = await basePath();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), buffer);
    return `${publicBaseUrl()}/${key}`;
  },

  getUrl(key: string): string {
    return `${publicBaseUrl()}/${key}`;
  },

  async delete(key: string): Promise<void> {
    const path = await import("path");
    const fs = await import("fs/promises");
    const dir = await basePath();
    const filePath = path.join(dir, key);
    try {
      await fs.unlink(filePath);
    } catch {
      /* ignore if missing */
    }
  },

  async duplicate(key: string, newKey: string): Promise<string> {
    const path = await import("path");
    const fs = await import("fs/promises");
    const dir = await basePath();
    const src = path.join(dir, key);
    const dest = path.join(dir, newKey);
    await fs.copyFile(src, dest);
    return `${publicBaseUrl()}/${newKey}`;
  },
};
