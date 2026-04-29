import mongoose from "mongoose";

export interface IProfile {
  userId: mongoose.Types.ObjectId;
  avatar: string;
}

const profileSchema = new mongoose.Schema<IProfile>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    avatar: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const Profile = mongoose.model<IProfile>("Profile", profileSchema);
