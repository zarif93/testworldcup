import "./loadEnv";
import express from "express";
import fs from "fs";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import os from "os";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { initPointsSocket } from "./pointsSocket";
import { serveStatic, setupVite } from "./vite";
import { getDb, getTournamentsToCleanup, cleanupTournamentData, runLockedTournamentsRemoval, getTournamentsToAutoClose, getTournamentsToSettleNow, getTournamentsClosingSoon, hasRecentNotificationForTournament, getParticipantUserIdsForTournament, getDbInitError, getTournamentsWithStatusSettling, runRecoverSettlements, runFinancialIntegrityCheck, getRetryableFailedJobs } from "../db";
import { logger } from "./logger";
import { getMetricsSnapshot } from "./metrics";
import { validateConfigAndExitIfInvalid } from "./validateConfig";
import { runAutomationJob } from "../automation/runJob";
import { AUTOMATION_JOB_TYPES, type AutomationJobType } from "../automation/jobTypes";

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many login attempts." },
  standardHeaders: true,
  legacyHeaders: false,
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createServer();
    s.listen(port, "0.0.0.0", () => {
      s.close(() => resolve(true));
    });
    s.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/** מחזיר כתובת IP פנימית ברשת (LAN) למשל 192.168.1.5 */
function getLocalNetworkIP(): string | null {
  try {
    const ifaces = os.networkInterfaces();
    if (!ifaces) return null;
    for (const _name of Object.keys(ifaces)) {
      const list = ifaces[_name];
      if (!list) continue;
      for (const iface of list) {
        if (iface.family === "IPv4" && !iface.internal) return iface.address;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function startServer() {
  await validateConfigAndExitIfInvalid();

  const db = await getDb();
  if (!db) {
    const err = getDbInitError();
    logger.error("Database not available. Server will start but API will fail.", {
      error: err != null ? String(err) : "Unknown",
      hint: "Check: SQLite needs write access to ./data (or set DATABASE_URL for MySQL).",
    });
  }

  // Ensure uploads directory exists so /uploads static serving works
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info("Created uploads directory", { uploadsDir });
  }

  const app = express();
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  const server = createServer(app);
  initPointsSocket(server);
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: false,
    xFrameOptions: { action: "deny" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/ping", (_req, res) => {
    res.status(200).send("ok");
  });
  app.get("/health", async (_req, res) => {
    const db = await getDb();
    const dbOk = !!db;
    const err = getDbInitError();
    const metrics = getMetricsSnapshot();
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      db: dbOk ? "ok" : "error",
      dbError: dbOk ? undefined : (err != null ? String(err) : "unknown"),
      metrics,
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/ready", async (_req, res) => {
    const db = await getDb();
    if (db) {
      res.status(200).send("ready");
    } else {
      res.status(503).send("not ready");
    }
  });
  // Debug: player settlement report (development only) – GET /debug/player-settlement/:playerId
  if (process.env.NODE_ENV !== "production") {
    app.get("/debug/player-settlement/:playerId", async (req, res) => {
      try {
        const playerId = parseInt(req.params.playerId, 10);
        if (Number.isNaN(playerId)) {
          res.status(400).json({ error: "Invalid playerId" });
          return;
        }
        const { getPlayerSettlementReport } = await import("../finance/settlementReports");
        const report = await getPlayerSettlementReport(playerId);
        if (!report) {
          res.status(404).json({ error: "Report not found (user or no data)" });
          return;
        }
        res.json({
          userId: report.userId,
          username: report.username,
          rows: report.rows.map((r) => ({
            competition: r.competition,
            entry: r.entry,
            refund: r.refund,
            winnings: r.winnings,
            commission: r.commission,
            result: r.result,
          })),
          finalResult: report.summary.finalResult,
        });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    });
  }
  app.use(
    (req, res, next) => {
      const origin = req.headers.origin;
      const allowList = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean) : [];
      const allowOrigin =
        process.env.NODE_ENV === "production" && allowList.length > 0
          ? (origin && allowList.includes(origin) ? origin : allowList[0])
          : process.env.NODE_ENV === "production" && origin
            ? origin
            : req.headers.origin || "*";
      res.setHeader("Access-Control-Allow-Origin", allowOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") return res.sendStatus(204);
      next();
    }
  );
  app.use("/api/trpc", apiLimiter);
  app.use("/api/oauth/callback", authLimiter);
  // Phase 15: serve uploaded media (must be before catch-all); uploadsDir created above
  app.use("/uploads", express.static(uploadsDir));
  registerOAuthRoutes(app);
  registerChatRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: process.env.NODE_ENV === "production"
        ? ({ error }) => {
            // In production: log full error server-side but never send stack to client
            logger.error("tRPC error", { code: error.code, message: error.message, path: (error as { path?: string }).path });
            // Response is already sent by tRPC; we only influence what gets logged. Stack is stripped by tRPC in prod by default; ensure no leakage
            if (typeof (error as { stack?: string }).stack === "string") {
              (error as { stack?: string }).stack = undefined;
            }
          }
        : undefined,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn("Port busy, using alternative", { preferredPort, port });
  }

  const host = "0.0.0.0";
  server.listen(port, host, () => {
    const networkIp = getLocalNetworkIP();
    if (process.env.NODE_ENV === "production") {
      logger.info("Server listening", { port, host });
      logger.info("Environment", { NODE_ENV: process.env.NODE_ENV, db: process.env.DATABASE_URL ? "mysql" : "sqlite" });
    } else {
      console.log("");
      console.log("Server running:");
      console.log(`  Local:   http://localhost:${port}`);
      if (networkIp) {
        console.log(`  Network: http://${networkIp}:${port}`);
        console.log("");
        console.log("To open from another device on the same network, use:");
        console.log(`  http://${networkIp}:${port}`);
      } else {
        console.log("  Network: (could not detect LAN IP)");
      }
      console.log("");
    }
    setInterval(async () => {
      try {
        const toClean = await getTournamentsToCleanup();
        for (const t of toClean) {
          await cleanupTournamentData(t.id);
          logger.info("Archive: tournament archived (data preserved)", { tournamentId: t.id });
        }
      } catch (e) {
        logger.warn("Cleanup error", { error: String(e) });
      }
    }, 60 * 1000);
    setInterval(async () => {
      try {
        const toClose = await getTournamentsToAutoClose();
        for (const { id } of toClose) {
          await runAutomationJob(AUTOMATION_JOB_TYPES.TOURNAMENT_CLOSE_SUBMISSIONS, id);
        }
      } catch (e) {
        logger.warn("Automation (close) error", { error: String(e) });
      }
    }, 60 * 1000);
    setInterval(async () => {
      try {
        const toSettle = await getTournamentsToSettleNow();
        for (const { id, settledAt } of toSettle) {
          await runAutomationJob(AUTOMATION_JOB_TYPES.TOURNAMENT_SETTLE, id, {
            scheduledAt: settledAt ?? undefined,
          });
        }
      } catch (e) {
        logger.warn("Automation (settle) error", { error: String(e) });
      }
    }, 60 * 1000);
    setInterval(async () => {
      try {
        const retryable = await getRetryableFailedJobs();
        const validTypes = new Set(Object.values(AUTOMATION_JOB_TYPES));
        for (const row of retryable) {
          const { entityId, retryCount } = row;
          const jobType = row.jobType as AutomationJobType;
          if (entityId && jobType && validTypes.has(jobType)) {
            await runAutomationJob(jobType, entityId, { retryCount: retryCount + 1 });
          }
        }
      } catch (e) {
        logger.warn("Automation (retry) error", { error: String(e) });
      }
    }, 60 * 1000);
    setInterval(async () => {
      try {
        const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;
        const closing = await getTournamentsClosingSoon(CLOSING_SOON_MS);
        const { notifyLater } = await import("../notifications/createNotification");
        const { NOTIFICATION_TYPES } = await import("../notifications/types");
        for (const t of closing) {
          const already = await hasRecentNotificationForTournament(t.id, NOTIFICATION_TYPES.COMPETITION_CLOSING_SOON, CLOSING_SOON_MS);
          if (!already) {
            notifyLater({
              type: NOTIFICATION_TYPES.COMPETITION_CLOSING_SOON,
              recipientType: "admin",
              title: "תחרות נסגרת בקרוב",
              body: t.name ? `תחרות "${t.name}" נסגרת בתוך 24 שעות` : `תחרות #${t.id} נסגרת בתוך 24 שעות`,
              payload: { tournamentId: t.id, name: t.name, closesAt: t.closesAt },
            });
          }
          try {
            const participantIds = await getParticipantUserIdsForTournament(t.id);
            const name = t.name ?? `תחרות #${t.id}`;
            for (const userId of participantIds) {
              notifyLater({
                type: NOTIFICATION_TYPES.COMPETITION_CLOSING_SOON,
                recipientType: "user",
                recipientId: userId,
                title: "תחרות נסגרת בקרוב",
                body: `התחרות "${name}" נסגרת בתוך 24 שעות. אל תפספסו!`,
                payload: { tournamentId: t.id, name, closesAt: t.closesAt, userId },
              });
            }
          } catch { /* ignore per-tournament send error */ }
        }
      } catch (e) {
        logger.warn("Notifications (closing soon) error", { error: String(e) });
      }
    }, 60 * 60 * 1000);
    setInterval(async () => {
      try {
        const removed = await runLockedTournamentsRemoval();
        const rowsAffected = removed.length;
        if (rowsAffected > 0) logger.info("Locked tournaments removed from homepage", { rowsAffected, tournamentIds: removed, serverTime: new Date().toISOString() });
      } catch (e) {
        logger.warn("Locked removal error", { error: String(e) });
      }
    }, 60 * 1000);
    const SETTLING_RECOVERY_MS = 5 * 60 * 1000;
    const settlingFirstSeen = new Map<number, number>();
    setInterval(async () => {
      try {
        const stuck = await getTournamentsWithStatusSettling();
        const now = Date.now();
        for (const { id } of stuck) {
          if (!settlingFirstSeen.has(id)) settlingFirstSeen.set(id, now);
        }
        const toRecover = stuck.filter(({ id }) => now - (settlingFirstSeen.get(id) ?? now) >= SETTLING_RECOVERY_MS).map((r) => r.id);
        if (toRecover.length > 0) {
          const { recovered, errors } = await runRecoverSettlements({ onlyTournamentIds: toRecover });
          for (const id of recovered) settlingFirstSeen.delete(id);
          if (recovered.length > 0) logger.info("Settling recovery", { recovered });
          if (errors.length > 0) logger.warn("Settling recovery errors", { errors });
        }
      } catch (e) {
        logger.warn("Settling recovery error", { error: String(e) });
      }
    }, 60 * 1000);
    setInterval(async () => {
      try {
        const integrity = await runFinancialIntegrityCheck();
        if (!integrity.ok) {
          logger.warn("Financial integrity check: delta detected", { ...integrity });
        }
      } catch (e) {
        logger.warn("Financial integrity check error", { error: String(e) });
      }
    }, 5 * 60 * 1000);
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger.error(`Port ${port} is busy. Set PORT to another value (e.g. 3001) or close the process using the port.`);
    } else {
      logger.error("Server error", { error: String(err) });
    }
  });
}

startServer().catch((err) => logger.error("Start failed", { error: String(err) }));
