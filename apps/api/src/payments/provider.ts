import { mockProvider } from "./mock.js";
import { razorpayProvider } from "./razorpay.js";

export interface OrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

export interface VerifyPayload {
  // Razorpay proof
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  // Mock proof
  orderId?: string;
  card?: { number: string; expiry: string; cvv: string };
}

export interface VerifyResult {
  ok: boolean;
  paymentId?: string;
  method?: string;
  last4?: string;
  reason?: string;
}

export interface PaymentProvider {
  name: string;
  createOrder(amount: number, currency: string, receipt: string): Promise<OrderResult>;
  verify(payload: VerifyPayload): Promise<VerifyResult>;
}

/**
 * Returns razorpayProvider when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set,
 * otherwise returns mockProvider. The razorpay npm package is imported LAZILY
 * inside razorpay.ts (only when createOrder/verify are called), so the mock
 * path never touches the network.
 */
export function getPaymentProvider(): PaymentProvider {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret) {
    return razorpayProvider;
  }

  return mockProvider;
}
