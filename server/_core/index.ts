import dotenv from "dotenv";
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production" });
} else {
  dotenv.config();
}
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import os from "os";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { initPointsSocket } from "./pointsSocket";
import { serveStatic, setupVite } from "./vite";
import { getDb, getTournamentsToCleanup, cleanupTournamentData, runLockedTournamentsRemoval, runAutoCloseTournaments, getDbInitError, getTournamentsWithStatusSettling, runRecoverSettlements, runFinancialIntegrityCheck } from "../db";
import { logger } from "./logger";

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
  const db = await getDb();
  if (!db) {
    const err = getDbInitError();
    logger.error("Database not available. Server will start but API will fail.", {
      error: err != null ? String(err) : "Unknown",
      hint: "Check: SQLite needs write access to ./data (or set DATABASE_URL for MySQL).",
    });
  }

  const app = express();
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
  registerOAuthRoutes(app);
  registerChatRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
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
        const closed = await runAutoCloseTournaments();
        if (closed.length > 0) logger.info("Auto-close: tournaments locked by closesAt", { tournamentIds: closed });
      } catch (e) {
        logger.warn("Auto-close error", { error: String(e) });
      }
    }, 60 * 1000);
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
