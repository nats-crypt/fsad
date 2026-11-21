import type { PaymentProvider, VerifyPayload, VerifyResult, OrderResult } from "./provider.js";

const KEY_ID = () => process.env.RAZORPAY_KEY_ID!;
const KEY_SECRET = () => process.env.RAZORPAY_KEY_SECRET!;

export const razorpayProvider: PaymentProvider = {
  name: "razorpay",

  async createOrder(amount: number, currency: string, receipt: string): Promise<OrderResult> {
    // Lazy import — the razorpay npm package is ONLY loaded here, not at module level.
    // This ensures the mock path never loads it and tests need no network.
    const RazorpayModule = await import("razorpay");
    const Razorpay = (RazorpayModule as { default?: unknown }).default ?? RazorpayModule;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rz = new (Razorpay as any)({ key_id: KEY_ID(), key_secret: KEY_SECRET() });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = await rz.orders.create({ amount, currency, receipt }) as any;
    return {
      orderId: order.id as string,
      amount: order.amount as number,
      currency: order.currency as string,
      keyId: KEY_ID(),
    };
  },

  async verify(payload: VerifyPayload): Promise<VerifyResult> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return { ok: false, reason: "Missing Razorpay proof fields" };
    }

    // HMAC-SHA256(order_id | payment_id, KEY_SECRET) — never log KEY_SECRET
    const { createHmac } = await import("crypto");
    const expected = createHmac("sha256", KEY_SECRET())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return { ok: false, reason: "Signature mismatch" };
    }

    return { ok: true, paymentId: razorpay_payment_id, method: "RAZORPAY" };
  },
};
