import mongoose from "mongoose";

export interface IUser {
  name: string;
  email: string;
  password: string;
  is_blocked: string;
  blocked_text: string;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    is_blocked: { type: String, default: "" },
    blocked_text: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const User = mongoose.model<IUser>("User", userSchema);
