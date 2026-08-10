import crypto from "crypto";
import mongoose from "mongoose";
import { DeviceReading } from "../models/device-reading.model";
import {
  DEFAULT_DELAY_MS,
  Device,
  DEVICE_SENSORS,
  type DataTransferState,
  type DeviceSensor,
  type LoggingState,
} from "../models/device.model";

export type DeviceStatus = "online" | "offline";

export type DevicePublic = {
  id: string;
  name: string;
  username: string;
  sensor: DeviceSensor;
  token: string;
  status: DeviceStatus;
  delay_ms: number;
  data_transfer: DataTransferState;
  logging: LoggingState;
  created_at?: string;
  updated_at?: string;
};

type LeanDeviceFields = {
  _id: unknown;
  name: string;
  username: string;
  sensor: DeviceSensor;
  token: string;
  delay_ms?: number;
  data_transfer?: DataTransferState;
  logging?: LoggingState;
  created_at?: Date;
  updated_at?: Date;
};

function toPublicDevice(doc: LeanDeviceFields): DevicePublic {
  return {
    id: String(doc._id),
    name: doc.name,
    username: doc.username,
    sensor: doc.sensor,
    token: doc.token,
    status: "offline",
    delay_ms: doc.delay_ms ?? DEFAULT_DELAY_MS,
    data_transfer: doc.data_transfer ?? "start",
    logging: doc.logging ?? "off",
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
    updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined,
  };
}

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function isValidSensor(sensor: string): sensor is DeviceSensor {
  return (DEVICE_SENSORS as readonly string[]).includes(sensor);
}

export async function createDevice(
  userId: string,
  input: { name: string; username: string; sensor: DeviceSensor }
): Promise<DevicePublic> {
  const username = input.username.toLowerCase().trim();
  const name = input.name.trim();

  const existing = await Device.findOne({ username });
  if (existing) {
    const err = new Error("Device username already in use") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = generateToken();
    try {
      const device = await Device.create({
        userId,
        name,
        username,
        sensor: input.sensor,
        token,
      });
      return toPublicDevice(device.toObject() as LeanDeviceFields);
    } catch (e: unknown) {
      const mongoErr = e as { code?: number };
      if (mongoErr.code === 11000 && attempt < maxAttempts - 1) {
        continue;
      }
      if (mongoErr.code === 11000) {
        const err = new Error("Device username already in use") as Error & { status: number };
        err.status = 409;
        throw err;
      }
      throw e;
    }
  }

  throw new Error("Failed to create device");
}

export async function listDevicesForUser(userId: string): Promise<DevicePublic[]> {
  const docs = await Device.find({ userId })
    .sort({ created_at: -1 })
    .lean();
  return docs.map((doc) => toPublicDevice(doc as LeanDeviceFields));
}

export async function getDeviceForUser(
  userId: string,
  deviceId: string
): Promise<DevicePublic | null> {
  if (!mongoose.isValidObjectId(deviceId)) return null;
  const doc = await Device.findOne({ _id: deviceId, userId }).lean();
  if (!doc) return null;
  return toPublicDevice(doc as LeanDeviceFields);
}

function notFound(): Error & { status: number } {
  const err = new Error("Device not found") as Error & { status: number };
  err.status = 404;
  return err;
}

function isValidObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

export async function updateDeviceName(
  userId: string,
  deviceId: string,
  name: string
): Promise<DevicePublic> {
  if (!isValidObjectId(deviceId)) {
    throw notFound();
  }
  const trimmed = name.trim();
  if (!trimmed) {
    const err = new Error("Name is required") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const updated = await Device.findOneAndUpdate(
    { _id: deviceId, userId },
    { $set: { name: trimmed } },
    { new: true }
  ).lean();
  if (!updated) {
    throw notFound();
  }
  return toPublicDevice(updated as LeanDeviceFields);
}

export async function deleteDevice(userId: string, deviceId: string): Promise<void> {
  if (!isValidObjectId(deviceId)) {
    throw notFound();
  }
  const result = await Device.deleteOne({ _id: deviceId, userId });
  if (result.deletedCount === 0) {
    throw notFound();
  }
  await DeviceReading.deleteMany({ deviceId });
}

export async function findDeviceByToken(token: string): Promise<{
  id: string;
  userId: string;
  username: string;
  logging: LoggingState;
} | null> {
  if (!token) return null;
  const doc = await Device.findOne({ token })
    .select("_id userId username logging")
    .lean();
  if (!doc) return null;
  return {
    id: String(doc._id),
    userId: String((doc as { userId: unknown }).userId),
    username: doc.username,
    logging: ((doc as { logging?: LoggingState }).logging ?? "off") as LoggingState,
  };
}

export async function getDeviceIdsForUser(userId: string): Promise<string[]> {
  const docs = await Device.find({ userId }).select("_id").lean();
  return docs.map((d) => String((d as { _id: unknown })._id));
}

export async function setDeviceDelay(deviceId: string, delayMs: number): Promise<void> {
  if (!isValidObjectId(deviceId)) return;
  await Device.updateOne({ _id: deviceId }, { $set: { delay_ms: delayMs } });
}

export async function setDeviceDataTransfer(
  deviceId: string,
  state: DataTransferState
): Promise<void> {
  if (!isValidObjectId(deviceId)) return;
  await Device.updateOne({ _id: deviceId }, { $set: { data_transfer: state } });
}

export async function setDeviceLogging(
  userId: string,
  deviceId: string,
  state: LoggingState
): Promise<DevicePublic> {
  if (!isValidObjectId(deviceId)) {
    throw notFound();
  }
  const updated = await Device.findOneAndUpdate(
    { _id: deviceId, userId },
    { $set: { logging: state } },
    { new: true }
  ).lean();
  if (!updated) {
    throw notFound();
  }
  return toPublicDevice(updated as LeanDeviceFields);
}

export async function saveDeviceReading(
  deviceId: string,
  userId: string,
  data: { temperature: number; humidity: number; ts: Date }
): Promise<void> {
  await DeviceReading.create({
    deviceId,
    userId,
    temperature: data.temperature,
    humidity: data.humidity,
    ts: data.ts,
  });
}

export type LoggedReading = {
  id: string;
  temperature: number;
  humidity: number;
  ts: string;
};

export async function getDeviceReadings(
  userId: string,
  deviceId: string,
  options: { limit?: number; sinceMs?: number } = {}
): Promise<LoggedReading[]> {
  if (!isValidObjectId(deviceId)) return [];
  const device = await Device.findOne({ _id: deviceId, userId })
    .select("_id")
    .lean();
  if (!device) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 500, 5000));
  const filter: Record<string, unknown> = { deviceId };
  if (options.sinceMs && Number.isFinite(options.sinceMs)) {
    filter.ts = { $gte: new Date(options.sinceMs) };
  }

  const docs = await DeviceReading.find(filter)
    .sort({ ts: -1 })
    .limit(limit)
    .lean();

  return docs
    .map((d) => ({
      id: String((d as { _id: unknown })._id),
      temperature: d.temperature,
      humidity: d.humidity,
      ts: new Date(d.ts).toISOString(),
    }))
    .reverse();
}
