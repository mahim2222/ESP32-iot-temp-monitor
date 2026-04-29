import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Profile } from "../models/profile.model";
import { User } from "../models/user.model";

const SALT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function signToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign({ sub: userId }, getJwtSecret(), options);
}

export type AuthUserPublic = {
  id: string;
  name: string;
  email: string;
  is_blocked: string;
  blocked_text: string;
  created_at?: string;
  updated_at?: string;
};

export type AuthProfilePublic = {
  avatar: string;
  created_at?: string;
  updated_at?: string;
};

export type AuthResult = {
  token: string;
  user: AuthUserPublic;
  profile: AuthProfilePublic;
};

type LeanUserFields = {
  _id: unknown;
  name: string;
  email: string;
  is_blocked?: string;
  blocked_text?: string;
  created_at?: Date;
  updated_at?: Date;
};

function toPublicUser(doc: LeanUserFields): AuthUserPublic {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    is_blocked: doc.is_blocked ?? "",
    blocked_text: doc.blocked_text ?? "",
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
    updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined,
  };
}

type LeanProfileFields = {
  avatar?: string;
  created_at?: Date;
  updated_at?: Date;
};

function toPublicProfile(doc: LeanProfileFields): AuthProfilePublic {
  return {
    avatar: doc.avatar ?? "",
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
    updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined,
  };
}

function isUserBlocked(isBlocked: string | undefined): boolean {
  return String(isBlocked ?? "")
    .trim()
    .toLowerCase() === "true";
}

async function ensureProfile(userId: string): Promise<LeanProfileFields & { _id: unknown }> {
  let profile = await Profile.findOne({ userId }).lean();
  if (!profile) {
    const created = await Profile.create({ userId, avatar: "" });
    profile = created.toObject();
  }
  return profile as LeanProfileFields & { _id: unknown };
}

export async function getAuthPayloadByUserId(
  userId: string
): Promise<{ user: AuthUserPublic; profile: AuthProfilePublic } | null> {
  const doc = await User.findById(userId)
    .select("_id name email is_blocked blocked_text created_at updated_at")
    .lean();
  if (!doc?._id) {
    return null;
  }
  const profileDoc = await ensureProfile(userId);
  return {
    user: toPublicUser(doc as LeanUserFields),
    profile: toPublicProfile(profileDoc),
  };
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<AuthResult> {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const err = new Error("Email already in use") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashed,
    is_blocked: "",
    blocked_text: "",
  });

  await Profile.create({
    userId: user._id,
    avatar: "",
  });

  const payload = await getAuthPayloadByUserId(String(user._id));
  if (!payload) {
    throw new Error("Failed to create session");
  }

  return {
    token: signToken(String(user._id)),
    user: payload.user,
    profile: payload.profile,
  };
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    const err = new Error("Invalid email or password") as Error & { status: number };
    err.status = 401;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const err = new Error("Invalid email or password") as Error & { status: number };
    err.status = 401;
    throw err;
  }

  if (isUserBlocked(user.is_blocked)) {
    const err = new Error(
      user.blocked_text?.trim() ? user.blocked_text : "Your account has been blocked"
    ) as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const payload = await getAuthPayloadByUserId(String(user._id));
  if (!payload) {
    const err = new Error("User not found") as Error & { status: number };
    err.status = 401;
    throw err;
  }

  return {
    token: signToken(String(user._id)),
    user: payload.user,
    profile: payload.profile,
  };
}

