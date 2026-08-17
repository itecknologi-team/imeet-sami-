import Stripe from "stripe";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError, PaymentRequiredError } from "../../shared/errors";

const stripeClient = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

function requireStripe(): Stripe {
  if (!stripeClient) {
    throw new AppError(400, "Payments not configured");
  }
  return stripeClient;
}

interface MeetingRow {
  id: string;
  price_cents: number | null;
  host_id: string | null;
}

async function findMeetingByCode(meetingCode: string): Promise<MeetingRow> {
  const { rows } = await pool.query<MeetingRow>(
    "SELECT id, price_cents, host_id FROM meetings WHERE meeting_code = $1",
    [meetingCode],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Meeting not found");
  }
  return row;
}

export async function createCheckoutSession(
  meetingCode: string,
  userId: string,
  successUrl: string,
  cancelUrl: string,
) {
  const stripe = requireStripe();
  const meeting = await findMeetingByCode(meetingCode);

  if (!meeting.price_cents || meeting.price_cents <= 0) {
    throw new AppError(400, "This meeting is free — no payment needed");
  }
  if (meeting.host_id === userId) {
    throw new AppError(400, "The host does not need to pay to join their own meeting");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: meeting.price_cents,
          product_data: { name: `Join meeting ${meetingCode}` },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await pool.query(
    `INSERT INTO meeting_payments (meeting_id, user_id, stripe_session_id, status, amount_cents)
     VALUES ($1, $2, $3, 'pending', $4)`,
    [meeting.id, userId, session.id, meeting.price_cents],
  );

  return { url: session.url };
}

export async function confirmPayment(meetingCode: string, userId: string, sessionId: string) {
  const stripe = requireStripe();
  await findMeetingByCode(meetingCode);

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    throw new AppError(400, "Payment not completed");
  }

  await pool.query(
    "UPDATE meeting_payments SET status = 'paid' WHERE stripe_session_id = $1 AND user_id = $2",
    [sessionId, userId],
  );

  return { success: true };
}

export async function hasPaid(meetingId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM meeting_payments WHERE meeting_id = $1 AND user_id = $2 AND status = 'paid'",
    [meetingId, userId],
  );
  return rows.length > 0;
}

export async function requirePaymentIfNeeded(meeting: MeetingRow, userId: string): Promise<void> {
  if (!meeting.price_cents || meeting.price_cents <= 0) return;
  if (meeting.host_id === userId) return;
  if (await hasPaid(meeting.id, userId)) return;
  throw new PaymentRequiredError(meeting.price_cents, "usd");
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!stripeClient || !env.stripeWebhookSecret || !signature) return;

  const event = stripeClient.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await pool.query("UPDATE meeting_payments SET status = 'paid' WHERE stripe_session_id = $1", [session.id]);
  }
}
