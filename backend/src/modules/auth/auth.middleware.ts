import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { id: string; email: string };
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// Populates req.user when a valid Bearer token is present, but always calls
// next() — lets guests (no/invalid token) reach routes that also serve
// signed-in users, e.g. instant meeting create/join.
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length);
    try {
      const payload = jwt.verify(token, env.jwtSecret) as { id: string; email: string };
      req.user = { id: payload.id, email: payload.email };
    } catch {
      // invalid/expired token — fall through as anonymous rather than failing
    }
  }
  next();
}
