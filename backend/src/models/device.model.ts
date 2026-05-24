import mongoose from "mongoose";

export const DEVICE_SENSORS = ["DHT11"] as const;
export type DeviceSensor = (typeof DEVICE_SENSORS)[number];

export interface IDevice {
  userId: mongoose.Types.ObjectId;
  name: string;
  username: string;
  sensor: DeviceSensor;
  token: string;
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
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const Device = mongoose.model<IDevice>("Device", deviceSchema);
