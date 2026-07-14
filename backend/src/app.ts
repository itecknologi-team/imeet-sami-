import cors from "cors";
import express, { Application } from "express";
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

  return app;
}
