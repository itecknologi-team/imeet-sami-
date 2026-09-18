import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes";
import asyncVideosRoutes from "./modules/asyncVideos/asyncVideos.routes";
import meetingsRoutes from "./modules/meetings/meetings.routes";
import webhooksRoutes from "./modules/recordings/webhooks.routes";
import { env } from "./config/env";
import { pool } from "./config/db";
import { AppError, PaymentRequiredError } from "./shared/errors";
import { HealthResponse } from "./shared/types";

export function createApp(): Application {
  const app = express();

  // Behind Caddy every request arrives from the proxy's address, so without
  // this req.ip is the proxy for everyone — which would make the rate limits
  // below a single shared bucket for the entire internet instead of per
  // client. A fixed hop count (rather than `true`) so a client can't spoof
  // its way to a fresh bucket by injecting its own X-Forwarded-For.
  app.set("trust proxy", env.trustProxyHops);
  // Don't advertise the framework to attackers scanning for known Express CVEs.
  app.disable("x-powered-by");

  // The API serves JSON to a separate origin and never renders HTML, so the
  // CSP/COEP defaults would only get in the way; the transport- and
  // sniffing-related headers are the ones that matter here.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // Recording/video responses are read cross-origin by the SPA.
      crossOriginResourcePolicy: false,
    }),
  );

  // In development, reflect whatever origin made the request (`true`) so the
  // LAN-IP flow — testing from a phone/other device on the network — keeps
  // working without hardcoding an IP. Production has no such need and must
  // list its real origin(s) explicitly (enforced in env.ts at startup).
  app.use(cors({ origin: env.isProduction ? env.allowedOrigins : true }));

  // Health must stay outside the rate limiter — container/proxy health probes
  // poll it constantly and would otherwise exhaust the bucket for real users
  // sharing that source IP.
  // Actually checks DB reachability rather than returning a static 200 —
  // container/deploy health probes rely on this to detect a real outage
  // (e.g. Postgres down) instead of reporting the app healthy while every
  // real request fails.
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      const body: HealthResponse = { status: "ok", timestamp: new Date().toISOString() };
      res.status(200).json(body);
    } catch (err) {
      console.error("Health check failed — database unreachable:", err);
      const body: HealthResponse = { status: "error", timestamp: new Date().toISOString() };
      res.status(503).json(body);
    }
  });

  // Webhooks are mounted before the body parser and the rate limiter on
  // purpose: both LiveKit and Stripe sign the *raw* bytes, and their retry
  // storms must not be throttled.
  app.use("/api/webhooks", webhooksRoutes);

  // An explicit ceiling — express.json defaults to 100kb, but being explicit
  // keeps it from drifting and documents the intent.
  app.use(express.json({ limit: "100kb" }));

  const generalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests — please slow down" },
  });

  // Credential endpoints get a much tighter bucket: without one, an unlimited
  // number of password guesses per second is possible against /login, and
  // /signup can be used to mass-create accounts.
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: "Too many authentication attempts — please try again later" },
  });

  app.use("/api", generalLimiter);
  app.use(["/api/auth/login", "/api/auth/signup", "/api/auth/google", "/api/auth/refresh"], authLimiter);

  app.use("/api/auth", authRoutes);
  app.use("/api/meetings", meetingsRoutes);
  app.use("/api/videos", asyncVideosRoutes);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      const extra = err instanceof PaymentRequiredError ? { priceCents: err.priceCents, currency: err.currency } : {};
      res.status(err.statusCode).json({ error: err.message, ...extra });
      return;
    }
    // Never leak stack traces or driver-level messages (which can carry SQL
    // fragments and connection strings) to the client — log them instead.
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
