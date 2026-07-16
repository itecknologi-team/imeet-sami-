export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class PaymentRequiredError extends AppError {
  constructor(
    public priceCents: number,
    public currency: string,
  ) {
    super(402, "Payment required to join this meeting");
    this.name = "PaymentRequiredError";
  }
}
