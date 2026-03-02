import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { initPointsSocket } from "./pointsSocket";
import { serveStatic, setupVite } from "./vite";
import { getDb, getTournamentsToCleanup, cleanupTournamentData, runLockedTournamentsRemoval } from "../db";
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
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
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

async function startServer() {
  await getDb().catch((err) => {
    console.error("[Server] Database init failed:", err);
  });

  const app = express();
  const server = createServer(app);
  initPointsSocket(server);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    setInterval(async () => {
      try {
        const toClean = await getTournamentsToCleanup();
        for (const t of toClean) {
          await cleanupTournamentData(t.id);
          logger.info("Cleanup: tournament data cleared", { tournamentId: t.id });
        }
      } catch (e) {
        logger.warn("Cleanup error", { error: String(e) });
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
  });
}

startServer().catch(console.error);
