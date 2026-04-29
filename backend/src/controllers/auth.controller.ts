import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { getAuthPayloadByUserId, loginUser, registerUser } from "../services/auth.service";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body ?? {};

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      res.status(400).json({ message: "Name, email, and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const result = await registerUser(name, email, password);
    res.status(201).json(result);
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ message: err.message || "Registration failed" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body ?? {};

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const result = await loginUser(email, password);
    res.status(200).json(result);
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    res.status(status).json({ message: err.message || "Login failed" });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
      return;
    }
    const payload = await getAuthPayloadByUserId(userId);
    if (!payload) {
      res.status(401).json({ error: { code: 401, message: "User not found" } });
      return;
    }
    if (String(payload.user.is_blocked ?? "").trim().toLowerCase() === "true") {
      res.status(403).json({
        error: {
          code: 403,
          message: payload.user.blocked_text?.trim()
            ? payload.user.blocked_text
            : "Your account has been blocked",
        },
      });
      return;
    }
    res.status(200).json({ user: payload.user, profile: payload.profile });
  } catch {
    res.status(500).json({ message: "Failed to load user" });
  }
}
