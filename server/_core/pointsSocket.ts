/**
 * Socket.IO עדכוני נקודות בזמן אמת.
 * כל פעולה פיננסית משדרת ללקוחות הרלוונטיים (לפי userId) את היתרה והתנועה.
 */
import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import type { User } from "../../drizzle/schema";

let io: Server | null = null;
/** userId -> Set of sockets (user can have multiple tabs) */
const userSockets = new Map<number, Set<Socket>>();

export type PointsUpdatePayload = {
  userId: number;
  balance: number;
  actionType: string;
  amount: number;
  performedByUsername?: string | null;
  note?: string | null;
};

function getCookieFromHandshake(socket: Socket): string | undefined {
  const cookieHeader = socket.handshake.headers?.cookie;
  if (!cookieHeader) return undefined;
  const parsed = parseCookie(cookieHeader);
  return parsed[COOKIE_NAME];
}

async function authenticateSocket(socket: Socket): Promise<User | null> {
  const cookie = getCookieFromHandshake(socket);
  if (!cookie) return null;
  try {
    const req = { headers: { cookie } } as Parameters<typeof sdk.authenticateRequest>[0];
    const user = await sdk.authenticateRequest(req);
    if (user && (user as { deletedAt?: Date | null }).deletedAt) return null;
    if (user && (user as { isBlocked?: boolean }).isBlocked) return null;
    return user;
  } catch {
    return null;
  }
}

export function initPointsSocket(httpServer: HttpServer): Server {
  if (io) return io;
  io = new Server(httpServer, {
    path: "/api/socket.io",
    cors: { origin: true, credentials: true },
  });

  io.on("connection", async (socket: Socket) => {
    const user = await authenticateSocket(socket);
    if (!user) {
      socket.disconnect(true);
      return;
    }
    const userId = user.id;
    socket.data.userId = userId;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket);

    socket.on("disconnect", () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket);
        if (set.size === 0) userSockets.delete(userId);
      }
    });
  });

  return io;
}

/**
 * שליחת עדכון יתרה לכל הלקוחות המחוברים של המשתמשים ברשימה.
 * נקרא אחרי כל פעולה שמשנה נקודות (הפקדה, משיכה, שליחת טופס, חלוקת פרסים וכו').
 * כל פריט ב-payloads מכיל userId ויתרה מעודכנת לאותו משתמש.
 */
export function emitPointsUpdate(payloads: PointsUpdatePayload[]): void {
  if (!io) return;
  for (const payload of payloads) {
    const sockets = userSockets.get(payload.userId);
    if (sockets) {
      for (const s of Array.from(sockets)) {
        s.emit("points-update", payload);
      }
    }
  }
}
