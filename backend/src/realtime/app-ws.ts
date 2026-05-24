import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { URL } from "url";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import { getOnlineDeviceIdsForUser } from "./device-socket-store";

type AppSocket = WebSocket & {
  userId?: string;
  isAlive?: boolean;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const closeCodes = {
  policyViolation: 1008,
  internalError: 1011,
} as const;

const userSockets = new Map<string, Set<AppSocket>>();

function addUserSocket(userId: string, ws: AppSocket): void {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(ws);
}

function removeUserSocket(userId: string, ws: AppSocket): void {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

function safeSend(ws: WebSocket, payload: object): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function tokenFromUrl(reqUrl: string | undefined): string | null {
  if (!reqUrl) return null;
  try {
    const parsed = new URL(reqUrl, "http://localhost");
    const token = parsed.searchParams.get("token");
    return token?.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

function verifyJwt(token: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function notifyDeviceStatus(
  userId: string,
  deviceId: string,
  status: "online" | "offline"
): void {
  const set = userSockets.get(userId);
  if (!set || set.size === 0) return;
  const payload = { type: "device:status", deviceId, status } as const;
  for (const ws of set) {
    safeSend(ws, payload);
  }
}

export function createAppWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (rawWs: WebSocket) => {
    const ws = rawWs as AppSocket;
    // userId is set by the upgrade handler before connection emits.
    if (!ws.userId) {
      ws.close(closeCodes.internalError, "missing user");
      return;
    }
    ws.isAlive = true;
    addUserSocket(ws.userId, ws);

    safeSend(ws, {
      type: "init",
      online_device_ids: getOnlineDeviceIdsForUser(ws.userId),
    });

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      if (ws.userId) removeUserSocket(ws.userId, ws);
    });

    ws.on("error", (err) => {
      console.error(`[app-ws] socket error for user ${ws.userId}:`, err);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as AppSocket;
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        // ignore
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(heartbeat));

  return {
    wss,
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
      const token = tokenFromUrl(req.url);
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      const userId = verifyJwt(token);
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        (ws as AppSocket).userId = userId;
        wss.emit("connection", ws, req);
      });
    },
  };
}
