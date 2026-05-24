import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { URL } from "url";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { findDeviceByToken } from "../services/device.service";
import { notifyDeviceStatus } from "./app-ws";
import { setLatestReading } from "./device-readings";
import { deviceSockets, type DeviceSocket } from "./device-socket-store";

const HEARTBEAT_INTERVAL_MS = 30_000;

const closeCodes = {
  policyViolation: 1008,
  internalError: 1011,
} as const;

export function sendToDevice(deviceId: string, data: string | Buffer): boolean {
  const ws = deviceSockets.get(deviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(data);
  return true;
}

function rawDataToString(data: RawData): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data as ArrayBuffer).toString("utf8");
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function safeSend(ws: WebSocket, payload: object): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function handleDeviceMessage(ws: DeviceSocket, data: RawData): void {
  const deviceId = ws.deviceId;
  if (!deviceId) return;

  const text = rawDataToString(data).trim();
  if (!text) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    safeSend(ws, { type: "error", message: "invalid json" });
    return;
  }

  if (!parsed || typeof parsed !== "object") {
    safeSend(ws, { type: "error", message: "expected object" });
    return;
  }

  const msg = parsed as { type?: unknown; temperature?: unknown; humidity?: unknown };

  if (msg.type !== "reading") {
    safeSend(ws, { type: "error", message: "unknown type" });
    return;
  }

  if (!isFiniteNumber(msg.temperature) || !isFiniteNumber(msg.humidity)) {
    safeSend(ws, { type: "error", message: "temperature and humidity must be numbers" });
    return;
  }

  setLatestReading(deviceId, {
    temperature: msg.temperature,
    humidity: msg.humidity,
    ts: Date.now(),
  });
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

export function createDeviceWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (rawWs: WebSocket, req: IncomingMessage) => {
    const ws = rawWs as DeviceSocket;
    const token = tokenFromUrl(req.url);
    if (!token) {
      ws.close(closeCodes.policyViolation, "missing token");
      return;
    }

    let device: { id: string; userId: string; username: string } | null;
    try {
      device = await findDeviceByToken(token);
    } catch (err) {
      console.error("[device-ws] token lookup failed:", err);
      ws.close(closeCodes.internalError, "lookup failed");
      return;
    }
    if (!device) {
      ws.close(closeCodes.policyViolation, "invalid token");
      return;
    }

    const existing = deviceSockets.get(device.id);
    if (existing && existing !== ws) {
      try {
        existing.close(closeCodes.policyViolation, "replaced by new connection");
      } catch {
        // ignore
      }
    }

    ws.deviceId = device.id;
    ws.userId = device.userId;
    ws.username = device.username;
    ws.isAlive = true;
    deviceSockets.set(device.id, ws);

    console.log(`[device-ws] connected: ${device.username} (${device.id})`);
    notifyDeviceStatus(device.userId, device.id, "online");

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data) => {
      handleDeviceMessage(ws, data);
    });

    ws.on("close", () => {
      const id = ws.deviceId;
      if (!id) return;
      if (deviceSockets.get(id) === ws) {
        deviceSockets.delete(id);
        console.log(`[device-ws] disconnected: ${ws.username} (${id})`);
        if (ws.userId) notifyDeviceStatus(ws.userId, id, "offline");
      }
    });

    ws.on("error", (err) => {
      console.error(`[device-ws] socket error for device ${ws.deviceId}:`, err);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as DeviceSocket;
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
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    },
  };
}
