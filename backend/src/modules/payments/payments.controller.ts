import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { parseBody } from "../../shared/utils";
import * as paymentsService from "./payments.service";

const checkoutSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const confirmPaymentSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export async function createCheckoutSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { successUrl, cancelUrl } = parseBody(checkoutSchema, req.body);
    const result = await paymentsService.createCheckoutSession(
      req.params.meetingCode,
      req.user!.id,
      successUrl,
      cancelUrl,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function confirmPaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = parseBody(confirmPaymentSchema, req.body);
    const result = await paymentsService.confirmPayment(req.params.meetingCode, req.user!.id, sessionId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  try {
    const rawBody = req.body as Buffer;
    const signature = req.headers["stripe-signature"] as string | undefined;
    await paymentsService.handleStripeWebhook(rawBody, signature);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook processing failed:", err);
    res.status(400).json({ error: "Invalid webhook payload" });
  }
}
