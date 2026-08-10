import mongoose from "mongoose";

export interface IDeviceReading {
  deviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  temperature: number;
  humidity: number;
  ts: Date;
}

const deviceReadingSchema = new mongoose.Schema<IDeviceReading>(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    ts: { type: Date, required: true, default: () => new Date() },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

deviceReadingSchema.index({ deviceId: 1, ts: -1 });

export const DeviceReading = mongoose.model<IDeviceReading>(
  "DeviceReading",
  deviceReadingSchema
);
