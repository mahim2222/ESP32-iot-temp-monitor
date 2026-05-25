import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import {
  clearLatestReading,
  getLatestReading,
  type LatestReading,
} from "../realtime/device-readings";
import { MAX_DELAY_MS, MIN_DELAY_MS } from "../models/device.model";
import { isDeviceOnline } from "../realtime/device-socket-store";
import { sendToDevice } from "../realtime/device-ws";
import {
  createDevice,
  deleteDevice,
  getDeviceForUser,
  getDeviceIdsForUser,
  isValidSensor,
  listDevicesForUser,
  setDeviceDataTransfer,
  setDeviceDelay,
  updateDeviceName,
  type DevicePublic,
} from "../services/device.service";

type DeviceCommand =
  | { type: "delay"; value: number }
  | { type: "data_transfer"; value: "start" | "stop" };

function parseCommand(body: unknown): DeviceCommand | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Command body must be an object" };
  }
  const b = body as { type?: unknown; value?: unknown };
  if (b.type === "delay") {
    if (typeof b.value !== "number" || !Number.isFinite(b.value)) {
      return { error: "delay.value must be a number (milliseconds)" };
    }
    const ms = Math.round(b.value);
    if (ms < MIN_DELAY_MS || ms > MAX_DELAY_MS) {
      return {
        error: `delay.value must be between ${MIN_DELAY_MS} and ${MAX_DELAY_MS} ms`,
      };
    }
    return { type: "delay", value: ms };
  }
  if (b.type === "data_transfer") {
    if (b.value !== "start" && b.value !== "stop") {
      return { error: "data_transfer.value must be 'start' or 'stop'" };
    }
    return { type: "data_transfer", value: b.value };
  }
  return { error: "Unknown command type" };
}

async function persistCommand(deviceId: string, command: DeviceCommand): Promise<void> {
  if (command.type === "delay") {
    await setDeviceDelay(deviceId, command.value);
  } else if (command.type === "data_transfer") {
    await setDeviceDataTransfer(deviceId, command.value);
  }
}

type DeviceWithLive = DevicePublic & {
  latest_reading: {
    temperature: number;
    humidity: number;
    ts: string;
  } | null;
};

function attachLiveFields(device: DevicePublic): DeviceWithLive {
  const r = getLatestReading(device.id);
  return {
    ...device,
    status: isDeviceOnline(device.id) ? "online" : "offline",
    latest_reading: r ? readingToPublic(r) : null,
  };
}

function readingToPublic(r: LatestReading) {
  return {
    temperature: r.temperature,
    humidity: r.humidity,
    ts: new Date(r.ts).toISOString(),
  };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function createDeviceHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }

    const { name, username, sensor } = req.body ?? {};

    if (!isNonEmptyString(name) || !isNonEmptyString(username) || !isNonEmptyString(sensor)) {
      res.status(400).json({ message: "Name, username, and sensor are required" });
      return;
    }

    if (!isValidSensor(sensor)) {
      res.status(400).json({ message: "Invalid sensor type" });
      return;
    }

    const device = await createDevice(userId, {
      name,
      username,
      sensor,
    });
    res.status(201).json({ device: attachLiveFields(device) });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ message: err.message || "Failed to create device" });
  }
}

export async function listDevicesHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }

    const devices = await listDevicesForUser(userId);
    res.status(200).json({ devices: devices.map(attachLiveFields) });
  } catch {
    res.status(500).json({ message: "Failed to load devices" });
  }
}

export async function updateDeviceHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }

    const id = String(req.params.id ?? "");
    const { name } = req.body ?? {};

    if (!isNonEmptyString(name)) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const device = await updateDeviceName(userId, id, name);
    res.status(200).json({ device: attachLiveFields(device) });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ message: err.message || "Failed to update device" });
  }
}

export async function getDeviceHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }
    const id = String(req.params.id ?? "");
    const device = await getDeviceForUser(userId, id);
    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }
    res.status(200).json({ device: attachLiveFields(device) });
  } catch {
    res.status(500).json({ message: "Failed to load device" });
  }
}

export async function getDeviceStatsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }
    const ids = await getDeviceIdsForUser(userId);
    const total = ids.length;
    let online = 0;
    for (const id of ids) {
      if (isDeviceOnline(id)) online++;
    }
    res.status(200).json({ total, online });
  } catch {
    res.status(500).json({ message: "Failed to load device stats" });
  }
}

export async function sendCommandHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }
    const id = String(req.params.id ?? "");
    const device = await getDeviceForUser(userId, id);
    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    const parsed = parseCommand(req.body);
    if ("error" in parsed) {
      res.status(400).json({ message: parsed.error });
      return;
    }

    if (!isDeviceOnline(id)) {
      res.status(409).json({ message: "Device is offline" });
      return;
    }

    const ok = sendToDevice(id, JSON.stringify(parsed));
    if (!ok) {
      res.status(409).json({ message: "Device is offline" });
      return;
    }

    await persistCommand(id, parsed);

    res.status(200).json({ ok: true, sent: parsed });
  } catch {
    res.status(500).json({ message: "Failed to send command" });
  }
}

export async function deleteDeviceHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }

    const id = String(req.params.id ?? "");
    await deleteDevice(userId, id);
    clearLatestReading(id);
    res.status(204).end();
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ message: err.message || "Failed to delete device" });
  }
}
