import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthRequest = Request & { userId?: string };

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }
  const custom = req.headers.authtoken ?? req.headers["authtoken"];
  if (typeof custom === "string" && custom.trim()) {
    return custom.trim();
  }
  return null;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "Server misconfiguration" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { sub?: string };
    if (!payload.sub) {
      res.status(401).json({ error: { code: 401, message: "Invalid token" } });
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: { code: 401, message: "Invalid or expired token" } });
  }
}
