import express, { Router } from "express";
import { livekitWebhookHandler } from "./webhooks.controller";

const router = Router();

router.post("/livekit", express.raw({ type: "*/*" }), livekitWebhookHandler);

export default router;
