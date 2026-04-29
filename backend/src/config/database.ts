import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/ESP32-temperature";

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? DEFAULT_URI;
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${uri.replace(/\/\/.*@/, "//***@")}`);
}
