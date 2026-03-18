/**
 * Production upload API: multipart/form-data, streaming to disk (multer),
 * no base64, no full-file memory. Single endpoint for all image upload types.
 */

import type { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createContext } from "../_core/context";
import { ENV } from "../_core/env";
import { canAccessPermission, isSuperAdmin } from "../rbac";
import type { TrpcUser } from "../rbac";
import {
  createSiteBackgroundImageFromFile,
  createJackpotBackgroundImageFromFile,
  createMediaAssetFromFile,
} from "../db";
import { insertAdminAuditLog } from "../db";

const UPLOAD_MAX_BYTES = 50 * 1024 * 1024; // 50MB – match nginx client_max_body_size 50m
const TEMP_DIR = "uploads/temp";
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), TEMP_DIR);
    fs.mkdir(dir, { recursive: true })
      .then(() => cb(null, dir))
      .catch((err) => cb(err as Error, dir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const safe = /^\.(jpe?g|png|gif|webp)$/i.test(ext) ? ext : ".jpg";
    const name = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new Error("סוג קובץ לא נתמך. אפשר רק: JPEG, PNG, GIF, WebP."));
      return;
    }
    cb(null, true);
  },
});

export type UploadType = "site-background" | "jackpot-background" | "media";

function getRequiredPermission(type: UploadType): string {
  switch (type) {
    case "site-background":
    case "jackpot-background":
      return "settings.manage";
    case "media":
      return "cms.edit";
    default:
      return "settings.manage";
  }
}

async function ensureAuthAndPermission(
  req: Request,
  res: Response,
  type: UploadType
): Promise<{ user: TrpcUser; userId: number } | null> {
  const ctx = await createContext({ req, res });
  const user = ctx.user as TrpcUser | null;
  if (!user || (user as { role?: string }).role !== "admin") {
    res.status(401).json({ success: false, message: "נדרשת התחברות כמנהל." });
    return null;
  }
  if (ENV.adminSecret && !ctx.adminCodeVerified) {
    res.status(403).json({ success: false, message: "נדרש קוד מנהל." });
    return null;
  }
  const permission = getRequiredPermission(type);
  if (isSuperAdmin(user)) {
    return { user, userId: user.id };
  }
  const allowed = await canAccessPermission(
    user.id,
    permission,
    (user as { role?: string }).role ?? ""
  );
  if (!allowed) {
    res.status(403).json({ success: false, message: "אין הרשאה לפעולה זו." });
    return null;
  }
  return { user, userId: user.id };
}

function sendJsonError(res: Response, status: number, message: string) {
  res.status(status).set("Content-Type", "application/json").json({ success: false, message });
}

export function registerUploadRoutes(app: import("express").Application): void {
  app.post(
    "/api/upload",
    (req: Request, res: Response, next: () => void) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) {
          const message =
            (err as { code?: string }).code === "LIMIT_FILE_SIZE"
              ? "הקובץ גדול מדי להעלאה. נסה קובץ קטן יותר או פורמט WebP."
              : err instanceof Error
                ? err.message
                : "שגיאה בהעלאה.";
          sendJsonError(res, 400, message);
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      const type = (req.body?.type ?? req.query?.type) as UploadType | undefined;
      if (!type || !["site-background", "jackpot-background", "media"].includes(type)) {
        sendJsonError(res, 400, "חסר סוג העלאה (type): site-background, jackpot-background או media.");
        return;
      }
      const auth = await ensureAuthAndPermission(req, res, type);
      if (!auth) return;

      const file = req.file as Express.Multer.File | undefined;
      if (!file?.path) {
        sendJsonError(res, 400, "לא נבחר קובץ.");
        return;
      }

      const tempPath = file.path;
      const originalName = file.originalname || path.basename(tempPath);
      const mimeType = file.mimetype || "image/jpeg";

      try {
        if (type === "site-background") {
          const activate = req.body?.activate === true || req.body?.activate === "true";
          const result = await createSiteBackgroundImageFromFile({
            tempPath,
            originalName,
            mimeType,
            activate,
            uploadedBy: auth.userId,
          });
          res.status(200).set("Content-Type", "application/json").json({ success: true, ...result });
          return;
        }
        if (type === "jackpot-background") {
          const activate = req.body?.activate === true || req.body?.activate === "true";
          const result = await createJackpotBackgroundImageFromFile({
            tempPath,
            originalName,
            mimeType,
            activate,
          });
          const ip =
            (req as { ip?: string }).ip ??
            (req.socket?.remoteAddress ?? "");
          await insertAdminAuditLog({
            performedBy: auth.userId,
            action: "jackpot_bg_upload",
            details: { entityType: "jackpot_background", entityId: result.id, ip },
          });
          res.status(200).set("Content-Type", "application/json").json({ success: true, ...result });
          return;
        }
        if (type === "media") {
          const altText = req.body?.altText ?? null;
          const category = req.body?.category ?? null;
          const result = await createMediaAssetFromFile({
            tempPath,
            originalName,
            mimeType,
            altText: altText || undefined,
            category: category || undefined,
          });
          res.status(200).set("Content-Type", "application/json").json({ success: true, ...result });
          return;
        }
        sendJsonError(res, 400, "סוג העלאה לא נתמך.");
      } catch (e) {
        const message = e instanceof Error ? e.message : "העלאת הקובץ נכשלה.";
        sendJsonError(res, 500, message);
      } finally {
        try {
          await fs.unlink(tempPath);
        } catch {
          /* ignore cleanup */
        }
      }
    }
  );
}
