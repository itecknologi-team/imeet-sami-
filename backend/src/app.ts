import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import authRoutes from "./modules/auth/auth.routes";
import asyncVideosRoutes from "./modules/asyncVideos/asyncVideos.routes";
import meetingsRoutes from "./modules/meetings/meetings.routes";
import webhooksRoutes from "./modules/recordings/webhooks.routes";
import { env } from "./config/env";
import { AppError, PaymentRequiredError } from "./shared/errors";
import { HealthResponse } from "./shared/types";

export function createApp(): Application {
  const app = express();

  // In development, reflect whatever origin made the request (`true`) so the
  // LAN-IP flow — testing from a phone/other device on the network — keeps
  // working without hardcoding an IP. Production has no such need and must
  // list its real origin(s) explicitly (enforced in env.ts at startup).
  app.use(cors({ origin: env.nodeEnv === "production" ? env.allowedOrigins : true }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const body: HealthResponse = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(body);
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/meetings", meetingsRoutes);
  app.use("/api/videos", asyncVideosRoutes);
  app.use("/api/webhooks", webhooksRoutes);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      const extra = err instanceof PaymentRequiredError ? { priceCents: err.priceCents, currency: err.currency } : {};
      res.status(err.statusCode).json({ error: err.message, ...extra });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
