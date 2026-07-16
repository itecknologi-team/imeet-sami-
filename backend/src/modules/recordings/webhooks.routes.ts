import express, { Router } from "express";
import { stripeWebhookHandler } from "../payments/payments.controller";
import { livekitWebhookHandler } from "./webhooks.controller";

const router = Router();

router.post("/livekit", express.raw({ type: "*/*" }), livekitWebhookHandler);
router.post("/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

export default router;
