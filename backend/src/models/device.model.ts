import mongoose from "mongoose";

export const DEVICE_SENSORS = ["DHT11"] as const;
export type DeviceSensor = (typeof DEVICE_SENSORS)[number];

export const DATA_TRANSFER_STATES = ["start", "stop"] as const;
export type DataTransferState = (typeof DATA_TRANSFER_STATES)[number];

export const LOGGING_STATES = ["on", "off"] as const;
export type LoggingState = (typeof LOGGING_STATES)[number];

export const DEFAULT_DELAY_MS = 3_000;
export const MIN_DELAY_MS = 3_000;
export const MAX_DELAY_MS = 2 * 60 * 60 * 1000;

export interface IDevice {
  userId: mongoose.Types.ObjectId;
  name: string;
  username: string;
  sensor: DeviceSensor;
  token: string;
  delay_ms: number;
  data_transfer: DataTransferState;
  logging: LoggingState;
}

const deviceSchema = new mongoose.Schema<IDevice>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    sensor: {
      type: String,
      required: true,
      enum: DEVICE_SENSORS,
    },
    token: { type: String, required: true, unique: true },
    delay_ms: {
      type: Number,
      required: true,
      default: DEFAULT_DELAY_MS,
      min: MIN_DELAY_MS,
      max: MAX_DELAY_MS,
    },
    data_transfer: {
      type: String,
      required: true,
      enum: DATA_TRANSFER_STATES,
      default: "start",
    },
    logging: {
      type: String,
      required: true,
      enum: LOGGING_STATES,
      default: "off",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const Device = mongoose.model<IDevice>("Device", deviceSchema);
