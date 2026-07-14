import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import authRoutes from "./modules/auth/auth.routes";
import meetingsRoutes from "./modules/meetings/meetings.routes";
import { AppError } from "./shared/errors";
import { HealthResponse } from "./shared/types";

export function createApp(): Application {
  const app = express();

  app.use(cors());
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

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
